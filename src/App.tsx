import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, animate } from 'motion/react';
import { 
  Camera, 
  Car, 
  History, 
  Heart, 
  Settings, 
  Plus, 
  ChevronRight, 
  Fuel, 
  Droplets, 
  Wrench, 
  Disc, 
  Battery,
  Bell,
  Calendar,
  CheckCircle2,
  Cog,
  Palette,
  LogOut,
  User as UserIcon,
  ChevronLeft,
  Share2,
  Settings as SettingsIcon,
  Trash2
} from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, updateDoc, doc, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { ar as arLocale, enUS as enLocale } from 'date-fns/locale';
import { cn, formatMileage, calculateOilLife } from './lib/utils';
import { ServiceType, Vehicle, TimelineEvent } from './types';
import { scanOdometer, ScanError } from './lib/gemini';
import { seedDemoData } from './lib/seedDemo';
import { InstallPrompt } from './InstallPrompt';
import { useI18n, LanguageToggle } from './i18n';
import { VehicleSettings } from './VehicleSettings';

function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const startValue = Number(node.textContent?.replace(/[^0-9.-]/g, '')) || 0;
    const controls = animate(startValue, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        if (node) node.textContent = formatMileage(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [value]);
  return <span ref={ref}>{formatMileage(value)}</span>;
}

function ScanViewport({
  scanning,
  preview,
}: {
  scanning: boolean;
  preview: string | null;
}) {
  const showPreview = scanning && preview;
  return (
    <div className="relative w-56 h-56 flex items-center justify-center">
      {/* Outer glow ring (always present, intensifies when scanning) */}
      <div
        className={cn(
          'absolute inset-0 rounded-full blur-2xl transition-opacity duration-500',
          scanning ? 'bg-brand/40 opacity-100' : 'bg-brand/10 opacity-60'
        )}
      />

      {/* Frame */}
      <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-brand/20 bg-white/50">
        {showPreview ? (
          <>
            <img
              src={preview}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* dark overlay for contrast */}
            <div className="absolute inset-0 bg-black/30" />

            {/* corner brackets */}
            <CornerBracket position="tl" />
            <CornerBracket position="tr" />
            <CornerBracket position="bl" />
            <CornerBracket position="br" />

            {/* sweeping scan line */}
            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: '100%' }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-x-0 h-12 pointer-events-none"
              style={{
                background:
                  'linear-gradient(to bottom, transparent 0%, rgba(242,100,48,0.0) 20%, rgba(242,100,48,0.85) 50%, rgba(242,100,48,0.0) 80%, transparent 100%)',
                boxShadow: '0 0 24px rgba(242,100,48,0.6)',
              }}
            />
          </>
        ) : (
          <motion.div
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-full h-full rounded-full bg-brand/5 border border-brand/30 flex items-center justify-center"
          >
            <Camera className="w-16 h-16 text-brand" />
          </motion.div>
        )}
      </div>

      {/* Rotating accent ring while scanning */}
      {scanning && (
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-transparent"
          style={{
            borderTopColor: 'var(--color-brand, #F26430)',
            borderRightColor: 'var(--color-brand, #F26430)',
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      )}

    </div>
  );
}

function CornerBracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const base = 'absolute w-5 h-5 border-brand pointer-events-none';
  const styles = {
    tl: 'top-3 left-3 border-t-2 border-l-2 rounded-tl-md',
    tr: 'top-3 right-3 border-t-2 border-r-2 rounded-tr-md',
    bl: 'bottom-3 left-3 border-b-2 border-l-2 rounded-bl-md',
    br: 'bottom-3 right-3 border-b-2 border-r-2 rounded-br-md',
  };
  return <span className={`${base} ${styles[position]}`} />;
}

function timestampToDate(ts: unknown): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'object' && ts !== null) {
    const anyTs = ts as { toDate?: () => Date; seconds?: number };
    if (typeof anyTs.toDate === 'function') return anyTs.toDate();
    if (typeof anyTs.seconds === 'number') return new Date(anyTs.seconds * 1000);
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

type StatusState = 'ok' | 'soon' | 'overdue';
type StatusKind = 'battery' | 'tires' | 'maintenance' | 'parts';
type StatusUnit = 'months' | 'km';
interface MaintenanceStatus {
  kind: StatusKind;
  unit: StatusUnit;
  state: StatusState;
  value: number;
}

function statusFromMonths(
  kind: StatusKind,
  lastDate: string | undefined,
  intervalMonths: number | undefined,
  soonThreshold = 2
): MaintenanceStatus | null {
  if (!lastDate || !intervalMonths) return null;
  const last = new Date(lastDate);
  if (Number.isNaN(last.getTime())) return null;
  const due = new Date(last);
  due.setMonth(due.getMonth() + intervalMonths);
  const monthsLeft = Math.round((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.44));
  if (monthsLeft < 0) return { kind, unit: 'months', state: 'overdue', value: Math.abs(monthsLeft) };
  if (monthsLeft <= soonThreshold) return { kind, unit: 'months', state: 'soon', value: Math.max(0, monthsLeft) };
  return { kind, unit: 'months', state: 'ok', value: monthsLeft };
}

function statusFromKm(
  kind: StatusKind,
  currentMileage: number,
  lastMileage: number | undefined,
  intervalKm: number | undefined,
  soonThreshold = 2000
): MaintenanceStatus | null {
  if (lastMileage == null || !intervalKm) return null;
  const remaining = lastMileage + intervalKm - currentMileage;
  if (remaining < 0) return { kind, unit: 'km', state: 'overdue', value: Math.abs(remaining) };
  if (remaining <= soonThreshold) return { kind, unit: 'km', state: 'soon', value: Math.max(0, remaining) };
  return { kind, unit: 'km', state: 'ok', value: remaining };
}

const STATUS_ICONS: Record<StatusKind, typeof Battery> = {
  battery: Battery,
  tires: Disc,
  maintenance: Wrench,
  parts: Cog,
};

const STATE_COLOR: Record<StatusState, string> = {
  ok: 'text-success',
  soon: 'text-warning',
  overdue: 'text-danger',
};

const STATE_ICON_BG: Record<StatusState, string> = {
  ok: 'bg-success/10 text-success',
  soon: 'bg-warning/10 text-warning',
  overdue: 'bg-danger/10 text-danger',
};

function useFormatStatusValue() {
  const { t } = useI18n();
  return (s: MaintenanceStatus): string => {
    if (s.state === 'soon' && s.value === 0) return t('status.due_now');
    const key =
      s.state === 'overdue'
        ? s.unit === 'km' ? 'status.km_overdue' : 'status.months_overdue'
        : s.unit === 'km' ? 'status.km_left' : 'status.months_left';
    const value = s.unit === 'km' ? formatMileage(s.value).replace(' KM', '') : s.value;
    return t(key, { value });
  };
}

function AlertItemRow({ status }: { status: MaintenanceStatus }) {
  const { t } = useI18n();
  const formatValue = useFormatStatusValue();
  const Icon = STATUS_ICONS[status.kind];
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', STATE_ICON_BG[status.state])}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm font-medium">{t(`status.${status.kind}`)}</span>
      </div>
      <span className={cn('text-sm font-bold whitespace-nowrap', STATE_COLOR[status.state])}>
        {formatValue(status)}
      </span>
    </div>
  );
}

function TimelineEventRow({
  event,
  isLast,
  serviceLabel,
  dateLocale,
  onDelete,
}: {
  event: TimelineEvent;
  isLast: boolean;
  serviceLabel: (type: ServiceType) => string;
  dateLocale: string;
  onDelete: (eventId: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="relative ps-8 pb-8 last:pb-0">
      {!isLast && <div className="absolute start-4 top-8 bottom-0 w-[1px] bg-black/10" />}
      <div
        className={cn(
          'absolute start-2 top-2 w-4 h-4 rounded-full border-2 border-bg-dark',
          event.type === ServiceType.FUEL ? 'bg-brand' : 'bg-success',
        )}
      />
      <div className="glass-dark p-6 rounded-[28px] space-y-3 group">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            {event.type === ServiceType.FUEL ? (
              <Fuel className="w-4 h-4 text-brand" />
            ) : (
              <Droplets className="w-4 h-4 text-success" />
            )}
            <span className="font-bold">{serviceLabel(event.type)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-black/40">
              {new Date(event.date).toLocaleDateString(dateLocale)}
            </span>
            <button
              onClick={() => setConfirming(true)}
              className="w-7 h-7 rounded-full bg-danger/10 text-danger flex items-center justify-center hover:bg-danger/20 transition opacity-0 group-hover:opacity-100 sm:opacity-100 shrink-0"
              aria-label={t('timeline.delete')}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex justify-between">
          <p className="text-lg font-bold">{formatMileage(event.mileage)}</p>
          <p className="text-black/40 text-sm">{event.notes || ''}</p>
        </div>

        {confirming && (
          <div className="bg-danger/5 border border-danger/20 rounded-2xl p-3 space-y-2 mt-2">
            <p className="text-xs font-bold text-danger">{t('timeline.delete_confirm')}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="flex-1 bg-black/5 border border-black/10 py-2 rounded-xl text-xs font-bold hover:bg-black/10 transition"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onDelete(event.id);
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="flex-1 bg-danger text-white py-2 rounded-xl text-xs font-bold hover:brightness-95 transition disabled:opacity-60"
              >
                {t('settings.delete_confirm_button')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VehicleManageRow({
  vehicle,
  onDelete,
}: {
  vehicle: Vehicle;
  onDelete: (v: Vehicle) => Promise<void>;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (confirming) {
    return (
      <div className="bg-danger/5 border border-danger/20 rounded-2xl p-4 space-y-3">
        <p className="text-sm font-bold text-danger">{vehicle.name}</p>
        <p className="text-xs text-black/60 leading-relaxed">{t('settings.delete_explain')}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="flex-1 bg-black/5 border border-black/10 py-2.5 rounded-xl text-xs font-bold hover:bg-black/10 transition"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await onDelete(vehicle);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="flex-1 bg-danger text-white py-2.5 rounded-xl text-xs font-bold hover:brightness-95 transition disabled:opacity-60"
          >
            {t('settings.delete_confirm_button')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-4 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-bold text-sm truncate">{vehicle.name}</p>
        {(vehicle.make || vehicle.model) && (
          <p className="text-[10px] uppercase tracking-widest text-black/40 truncate">
            {vehicle.make} {vehicle.model}
            {vehicle.year ? ` • ${vehicle.year}` : ''}
          </p>
        )}
      </div>
      <button
        onClick={() => setConfirming(true)}
        className="w-9 h-9 rounded-full bg-danger/10 text-danger flex items-center justify-center hover:bg-danger/20 transition shrink-0"
        aria-label={t('settings.delete_vehicle')}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function MaintenanceStatusCard({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useI18n();
  const items = getMaintenanceStatuses(vehicle);

  return (
    <div className="glass-dark p-6 rounded-[32px] space-y-4">
      <h4 className="text-lg font-bold">{t('dashboard.maintenance_status')}</h4>
      {items.length === 0 ? (
        <p className="text-sm text-black/40 leading-relaxed">{t('status.empty_hint')}</p>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.kind}><AlertItemRow status={s} /></div>
          ))}
        </div>
      )}
    </div>
  );
}

function getMaintenanceStatuses(vehicle: Vehicle): MaintenanceStatus[] {
  const out: MaintenanceStatus[] = [];
  const bat = statusFromMonths('battery', vehicle.lastBatteryChangeDate, vehicle.batteryIntervalMonths);
  if (bat) out.push(bat);
  const tires = statusFromKm('tires', vehicle.currentMileage, vehicle.lastTireChangeMileage, vehicle.tireIntervalKm);
  if (tires) out.push(tires);
  const maint = statusFromMonths('maintenance', vehicle.lastMaintenanceDate, vehicle.maintenanceIntervalMonths);
  if (maint) out.push(maint);
  const parts = statusFromMonths('parts', vehicle.lastPartsDate, vehicle.partsIntervalMonths);
  if (parts) out.push(parts);
  return out;
}

function CarPlate({ letters = 'أ ب ج', numbers = '1234', size = 'md' }: { letters?: string; numbers?: string; size?: 'sm' | 'md' | 'lg' }) {
  const scale = size === 'lg' ? 'scale-110' : size === 'sm' ? 'scale-90' : '';
  return (
    <div dir="ltr" className={cn('inline-flex overflow-hidden rounded-md border-2 border-ink bg-white font-mono font-bold text-ink', scale)}>
      <div className="border-e-2 border-ink px-2 py-0.5 text-sm tabular">{numbers}</div>
      <div className="px-2 py-0.5 text-xs">{letters}</div>
    </div>
  );
}

function VehicleArt({ tone = 'brand' }: { tone?: 'brand' | 'ok' | 'warn' }) {
  const fill = tone === 'ok' ? '#3F7A40' : tone === 'warn' ? '#B96A1E' : '#F26B1F';
  return (
    <svg width="160" height="80" viewBox="0 0 160 80" className="relative z-[1]">
      <path d="M14 56 Q24 36 56 32 L104 32 Q130 32 142 48 L146 56 Z" fill={fill} />
      <path d="M60 32 L70 18 L96 18 L104 32 Z" fill={fill} opacity="0.7" />
      <circle cx="40" cy="58" r="10" fill="#0E2233" />
      <circle cx="40" cy="58" r="4" fill="white" />
      <circle cx="118" cy="58" r="10" fill="#0E2233" />
      <circle cx="118" cy="58" r="4" fill="white" />
    </svg>
  );
}

function BigNum({ value, unit, size = 'text-4xl', color = 'text-ink' }: { value: string | number; unit?: string; size?: string; color?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={cn('tabular font-mono font-bold leading-none tracking-tight', size, color)}>{value}</span>
      {unit && <span className="text-xs font-semibold text-[#4A6378]">{unit}</span>}
    </div>
  );
}

function AppTop({ title, sub, trailing }: { title: string; sub?: string; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-1 pb-4">
      <div className="min-w-0">
        {sub && <p className="text-[11px] font-bold uppercase tracking-normal text-[#4A6378]">{sub}</p>}
        <h1 className="mt-0.5 truncate text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
      </div>
      {trailing}
    </div>
  );
}

function DesignField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block rounded-2xl border border-[#E1EAF1] bg-white px-4 py-3">
      <span className="block text-[10px] font-bold uppercase tracking-normal text-[#4A6378]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full bg-transparent text-base font-semibold text-ink outline-none placeholder:text-[#7B92A6]"
      />
    </label>
  );
}

import { generateVehicleReport } from './lib/reports';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

const HealthIndicator = ({ score }: { score: number }) => {
  const data = [
    { value: score },
    { value: 100 - score }
  ];
  const COLORS = ['#F26B1F', '#E1EAF1'];

  return (
    <div className="relative w-32 h-32 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={45}
            outerRadius={60}
            paddingAngle={0}
            dataKey="value"
            startAngle={90}
            endAngle={450}
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tighter">{score}</span>
        <HealthLabel />
      </div>
    </div>
  );
};


const HealthLabel = () => {
  const { t } = useI18n();
  return (
    <span className="text-[8px] text-black/40 uppercase tracking-[0.2em] font-bold">
      {t('common.health_score')}
    </span>
  );
};

const Navbar = ({ activePage, setActivePage, user }: any) => {
  const { t } = useI18n();
  const tabs = [
    { id: 'dashboard', icon: Car, label: t('nav.vehicles') },
    { id: 'alerts', icon: Bell, label: t('nav.alerts') },
    { id: 'camera', icon: Camera, label: t('nav.camera'), primary: true },
    { id: 'timeline', icon: History, label: t('nav.timeline') },
    { id: 'profile', icon: UserIcon, label: t('nav.profile') },
  ];

  return (
    <div className="fixed bottom-5 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 px-3">
      <nav className="pill-nav flex items-center justify-around px-3 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activePage === tab.id;
          if (tab.primary) {
            return (
              <button
                key={tab.id}
                onClick={() => setActivePage(tab.id)}
                aria-label={tab.label}
                className="relative -mt-8 grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-brand text-white shadow-[0_8px_18px_rgba(242,107,31,0.38)] transition active:scale-95"
              >
                <Icon className="h-6 w-6" strokeWidth={2.2} />
              </button>
            );
          }
          return (
            <button
              key={tab.id}
              onClick={() => setActivePage(tab.id)}
              className={cn(
                "min-w-0 flex-1 rounded-2xl px-1 py-2 text-[9px] font-bold transition-all duration-300 flex flex-col items-center gap-1",
                isActive ? "text-brand" : "text-[#7B92A6] hover:text-ink"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
              <span className="max-w-full truncate">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const { t, lang } = useI18n();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => localStorage.getItem('motr-onboarding-done') === '1');
  const [showSplash, setShowSplash] = useState(() => localStorage.getItem('motr-splash-seen') !== '1');
  const [activePage, setActivePage] = useState(() => (localStorage.getItem('motr-onboarding-done') === '1' ? 'dashboard' : 'onboarding'));
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [eventNotes, setEventNotes] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [addCarForm, setAddCarForm] = useState({ name: '', make: '', model: '', year: '', color: '', mileage: '' });
  const [fuelForm, setFuelForm] = useState({ amount: '', liters: '', station: '' });
  const [serviceForm, setServiceForm] = useState({ center: '' });

  useEffect(() => {
    if (!showSplash) return;
    const id = window.setTimeout(() => {
      localStorage.setItem('motr-splash-seen', '1');
      setShowSplash(false);
    }, 1100);
    return () => window.clearTimeout(id);
  }, [showSplash]);

  const finishOnboarding = () => {
    localStorage.setItem('motr-onboarding-done', '1');
    setHasSeenOnboarding(true);
    setActivePage('dashboard');
  };

  const updateAddCarForm = (key: keyof typeof addCarForm, value: string) => {
    setAddCarForm((current) => ({ ...current, [key]: value }));
  };

  const updateFuelForm = (key: keyof typeof fuelForm, value: string) => {
    setFuelForm((current) => ({ ...current, [key]: value }));
  };

  const updateServiceForm = (key: keyof typeof serviceForm, value: string) => {
    setServiceForm((current) => ({ ...current, [key]: value }));
  };

  const runReport = async (vehicle: Vehicle | null) => {
    if (!vehicle) {
      toast.error(t('reports.no_vehicle'));
      return;
    }
    setReportBusy(true);
    const toastId = toast.loading(t('reports.generating'));
    try {
      await generateVehicleReport(
        vehicle,
        events.filter((e) => e.vehicleId === vehicle.id),
        t,
        lang
      );
      toast.dismiss(toastId);
    } catch (err) {
      console.error(err);
      toast.dismiss(toastId);
      toast.error(t('reports.failed'));
    } finally {
      setReportBusy(false);
    }
  };

  const dateLocale = lang === 'ar' ? 'ar-u-ca-gregory-nu-latn' : 'en-US';

  const serviceLabel = (type: ServiceType): string => {
    const map: Record<ServiceType, string> = {
      [ServiceType.FUEL]: t('service.fuel'),
      [ServiceType.OIL_CHANGE]: t('service.oil_change'),
      [ServiceType.MAINTENANCE]: t('service.maintenance'),
      [ServiceType.TIRES]: t('service.tires'),
      [ServiceType.BATTERY]: t('service.battery'),
      [ServiceType.PARTS]: t('service.parts'),
      [ServiceType.OTHER]: t('service.other'),
    };
    return map[type] ?? type;
  };
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const newVehicleIdRef = useRef<string | null>(null);

  const handleAddVehicle = () => {
    setSelectedVehicle(null);
    setActivePage('add-car');
  };

  const createVehicleFromForm = async () => {
    if (!user) {
      toast.error(t('profile.sign_in_first'));
      setActivePage('profile');
      return;
    }
    const mileage = Number(addCarForm.mileage) || 0;
    const name =
      addCarForm.name.trim() ||
      [addCarForm.make.trim(), addCarForm.model.trim(), addCarForm.year.trim()].filter(Boolean).join(' ') ||
      (lang === 'ar' ? 'مركبتي الجديدة' : 'My new vehicle');
    try {
      const vehiclePayload: Record<string, unknown> = {
        userId: user.uid,
        name,
        make: addCarForm.make.trim(),
        model: addCarForm.model.trim(),
        color: addCarForm.color.trim(),
        currentMileage: mileage,
        healthScore: 100,
        oilIntervalKm: 10000,
        lastOilChangeMileage: mileage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (addCarForm.year) vehiclePayload.year = Number(addCarForm.year);
      const newV = await addDoc(collection(db, 'vehicles'), vehiclePayload);
      newVehicleIdRef.current = newV.id;
      setAddCarForm({ name: '', make: '', model: '', year: '', color: '', mileage: '' });
      localStorage.setItem('motr-onboarding-done', '1');
      setHasSeenOnboarding(true);
      setActivePage('dashboard');
      toast.success(t('service.saved'));
    } catch (err) {
      console.error(err);
      toast.error(t('service.save_failed'));
    }
  };

  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    if (!user) return;
    try {
      const eventsQuery = query(
        collection(db, 'events'),
        where('userId', '==', user.uid),
        where('vehicleId', '==', vehicle.id)
      );
      const snap = await getDocs(eventsQuery);
      for (let i = 0; i < snap.docs.length; i += 400) {
        const chunk = snap.docs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'vehicles', vehicle.id));
      toast.success(t('settings.deleted'));
    } catch (err) {
      console.error(err);
      toast.error(t('settings.delete_failed'));
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteDoc(doc(db, 'events', eventId));
      toast.success(t('timeline.deleted'));
    } catch (err) {
      console.error(err);
      toast.error(t('timeline.delete_failed'));
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setVehicles([]);
      setEvents([]);
      return;
    }

    const vQuery = query(collection(db, 'vehicles'), where('userId', '==', user.uid));
    const unsubV = onSnapshot(vQuery, (snap) => {
      const vList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vehicle));
      setVehicles(vList);
      setSelectedVehicle((current) => {
        if (newVehicleIdRef.current) {
          const justAdded = vList.find((v) => v.id === newVehicleIdRef.current);
          if (justAdded) {
            newVehicleIdRef.current = null;
            return justAdded;
          }
        }
        if (!current) return vList[0] ?? null;
        const fresh = vList.find((v) => v.id === current.id);
        return fresh ?? vList[0] ?? null;
      });
    });

    const eQuery = query(collection(db, 'events'), where('userId', '==', user.uid));
    const unsubE = onSnapshot(eQuery, (snap) => {
      const eList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimelineEvent));
      setEvents(eList.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    return () => {
      unsubV();
      unsubE();
    };
  }, [user]);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success(t('profile.welcome'));
    } catch (err) {
      console.error(err);
      toast.error(t('profile.sign_in_failed'));
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!user) {
      toast.error(t('profile.sign_in_first'));
      setActivePage('profile');
      return;
    }

    setScanning(true);
    setActivePage('camera');
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setScanPreview(dataUrl);
      const base64 = dataUrl.split(',')[1];
      try {
        const result = await scanOdometer(base64);
        toast.success(t('camera.detected', { value: formatMileage(result.mileage) }));

        // Find existing vehicle or create new
        let vehicleId = selectedVehicle?.id;

        if (!vehicleId) {
          // If no vehicles, create one silently
          const newV = await addDoc(collection(db, 'vehicles'), {
            userId: user.uid,
            name: result.make ? `${result.make} ${result.model || ''}`.trim() : (lang === 'ar' ? 'مركبتي الجديدة' : 'My new vehicle'),
            make: result.make || '',
            model: result.model || '',
            currentMileage: result.mileage,
            healthScore: 100,
            oilIntervalKm: 10000,
            lastOilChangeMileage: result.mileage,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          vehicleId = newV.id;
          newVehicleIdRef.current = newV.id;
        } else {
          // Update current vehicle mileage
          await updateDoc(doc(db, 'vehicles', vehicleId), {
            currentMileage: result.mileage,
            updatedAt: serverTimestamp()
          });
        }
        
        // Show detected reading for confirmation before logging a service.
        setActivePage('ocr-result');
        setTempEventData({ mileage: result.mileage, vehicleId: vehicleId as string });
        
      } catch (err) {
        console.error(err);
        if (err instanceof ScanError) {
          if (err.code === 'quota_daily') toast.error(t('camera.quota_daily'));
          else if (err.code === 'quota_hourly') toast.error(t('camera.quota_hourly'));
          else if (err.code === 'unavailable') toast.error(t('camera.unavailable'));
          else toast.error(t('camera.failed'));
        } else {
          toast.error(t('camera.failed'));
        }
      } finally {
        setScanning(false);
        setScanPreview(null);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

  const [tempEventData, setTempEventData] = useState<{ mileage: number, vehicleId: string } | null>(null);

  const saveEvent = async (
    type: ServiceType,
    extra: Partial<Pick<TimelineEvent, 'amount' | 'liters' | 'station' | 'serviceCenter'>> = {}
  ) => {
    if (!tempEventData || !user) return;
    
    let location = null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      location = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };
    } catch (e) {
      console.warn("Could not get location", e);
    }
    
    try {
      const trimmedNotes = eventNotes.trim();
      const payload: Record<string, unknown> = {
        userId: user.uid,
        vehicleId: tempEventData.vehicleId,
        type,
        mileage: tempEventData.mileage,
        date: new Date().toISOString(),
        location,
        createdAt: serverTimestamp(),
      };
      if (trimmedNotes) payload.notes = trimmedNotes.slice(0, 1000);
      if (typeof extra.amount === 'number' && Number.isFinite(extra.amount)) payload.amount = extra.amount;
      if (typeof extra.liters === 'number' && Number.isFinite(extra.liters)) payload.liters = extra.liters;
      if (extra.station) payload.station = extra.station;
      if (extra.serviceCenter) payload.serviceCenter = extra.serviceCenter;
      await addDoc(collection(db, 'events'), payload);
      
      const vehiclePatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      const nowIso = new Date().toISOString();
      if (type === ServiceType.OIL_CHANGE) vehiclePatch.lastOilChangeMileage = tempEventData.mileage;
      if (type === ServiceType.TIRES) vehiclePatch.lastTireChangeMileage = tempEventData.mileage;
      if (type === ServiceType.BATTERY) vehiclePatch.lastBatteryChangeDate = nowIso;
      if (type === ServiceType.MAINTENANCE) vehiclePatch.lastMaintenanceDate = nowIso;
      if (type === ServiceType.PARTS) vehiclePatch.lastPartsDate = nowIso;
      if (Object.keys(vehiclePatch).length > 1) {
        await updateDoc(doc(db, 'vehicles', tempEventData.vehicleId), vehiclePatch);
      }
      
      toast.success(t('service.saved'));
      setActivePage('dashboard');
      setTempEventData(null);
      setEventNotes('');
      setFuelForm({ amount: '', liters: '', station: '' });
      setServiceForm({ center: '' });
    } catch (err) {
      console.error(err);
      toast.error(t('service.save_failed'));
    }
  };

  if (loading) return null;

  if (showSplash) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <img src="/logo.svg" alt="MOTR" className="mx-auto h-20 w-auto" />
          <p className="mt-4 text-sm font-semibold text-white/60">
            {lang === 'ar' ? 'صيانة سيارتك، ببساطة.' : 'Car maintenance, simplified.'}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark text-ink selection:bg-brand/30 overflow-x-hidden pb-28">
      <Toaster position="top-center" />
      <InstallPrompt />

      {/* Pages */}
      <main className="mx-auto min-h-screen w-full max-w-[430px] px-4 pt-12">
        <AnimatePresence mode="wait">
          {activePage === 'onboarding' && (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="flex min-h-[calc(100vh-8rem)] flex-col justify-between"
            >
              <div className="pt-8">
                <div className="relative mx-auto mb-10 h-72 w-full overflow-hidden rounded-[32px] bg-[#DCEAF3]">
                  <div className="absolute inset-x-0 top-[56%] h-7 bg-brand" />
                  <div className="absolute inset-0 flex items-end justify-center pb-8">
                    <VehicleArt />
                  </div>
                </div>
                <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
                  {lang === 'ar' ? 'كل شيء يخص سيارتك في مكان واحد.' : 'Everything your car needs. One app.'}
                </h1>
                <p className="mt-4 text-base font-medium leading-8 text-[#4A6378]">
                  {lang === 'ar'
                    ? 'صوّر العداد، سجّل الوقود والصيانة، واحصل على تنبيهات قبل الموعد.'
                    : 'Snap the odometer, log fuel and services, and get reminders before they are due.'}
                </p>
              </div>
              <div className="space-y-3 pb-4">
                <button
                  onClick={finishOnboarding}
                  className="w-full rounded-2xl bg-brand px-5 py-4 text-base font-bold text-white shadow-lg shadow-brand/20"
                >
                  {lang === 'ar' ? 'ابدأ الآن' : 'Get started'}
                </button>
                <button
                  onClick={() => setActivePage('add-car')}
                  className="w-full rounded-2xl border border-[#E1EAF1] bg-white px-5 py-4 text-base font-bold text-ink"
                >
                  {lang === 'ar' ? 'أضف سيارة مباشرة' : 'Add a car first'}
                </button>
              </div>
            </motion.div>
          )}

          {activePage === 'add-car' && (
            <motion.div
              key="add-car"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="space-y-5"
            >
              <AppTop
                title={lang === 'ar' ? 'إضافة سيارة' : 'Add car'}
                sub={lang === 'ar' ? 'بيانات السيارة' : 'Car details'}
                trailing={
                  <button onClick={() => setActivePage(hasSeenOnboarding ? 'dashboard' : 'onboarding')} className="rounded-full bg-white p-3 text-[#4A6378]">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                }
              />
              <div className="rounded-[28px] border border-[#E1EAF1] bg-white p-5 shadow-sm">
                <div className="mb-5 flex h-36 items-end justify-center overflow-hidden rounded-2xl bg-[#DCEAF3]">
                  <VehicleArt />
                </div>
                <div className="space-y-3">
                  <DesignField label={lang === 'ar' ? 'اسم السيارة' : 'Car name'} value={addCarForm.name} onChange={(v) => updateAddCarForm('name', v)} placeholder="Toyota Camry" />
                  <div className="grid grid-cols-2 gap-3">
                    <DesignField label={t('reports.make')} value={addCarForm.make} onChange={(v) => updateAddCarForm('make', v)} />
                    <DesignField label={t('reports.model')} value={addCarForm.model} onChange={(v) => updateAddCarForm('model', v)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <DesignField label={t('reports.year')} value={addCarForm.year} onChange={(v) => updateAddCarForm('year', v)} type="number" />
                    <DesignField label={t('reports.color')} value={addCarForm.color} onChange={(v) => updateAddCarForm('color', v)} />
                  </div>
                  <DesignField label={t('common.mileage')} value={addCarForm.mileage} onChange={(v) => updateAddCarForm('mileage', v)} type="number" placeholder="212450" />
                </div>
              </div>
              <button onClick={createVehicleFromForm} className="w-full rounded-2xl bg-brand px-5 py-4 font-bold text-white shadow-lg shadow-brand/20">
                {t('common.save')}
              </button>
            </motion.div>
          )}

          {activePage === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="text-xs font-semibold text-[#4A6378]">
                    {new Date().toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">
                    {user?.displayName ? `${lang === 'ar' ? 'مرحباً، ' : 'Hi, '}${user.displayName.split(' ')[0]}` : t('profile.welcome')}
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  {vehicles.length > 1 && (
                    <select
                      value={selectedVehicle?.id}
                      onChange={(e) => setSelectedVehicle(vehicles.find(v => v.id === e.target.value) || null)}
                      className="bg-black/5 border border-black/10 rounded-full px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none max-w-[120px]"
                    >
                      {vehicles.map(v => <option key={v.id} value={v.id} className="bg-bg-dark">{v.name}</option>)}
                    </select>
                  )}
                  <LanguageToggle />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center hover:brightness-95 transition-colors shadow-lg shadow-brand/20"
                    aria-label={t('dashboard.update_odometer')}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  {user?.photoURL && <img src={user.photoURL} className="w-8 h-8 rounded-full border border-black/10" />}
                </div>
              </div>

              {vehicles.length === 0 ? (
                <div className="glass-dark p-8 rounded-[32px] text-center space-y-4">
                  <div className="w-16 h-16 bg-black/5 rounded-2xl flex items-center justify-center mx-auto">
                    <Camera className="w-8 h-8 text-black/20" />
                  </div>
                  <p className="text-black/40">{t('dashboard.empty_hint')}</p>
                  <button
                    onClick={() => setActivePage('camera')}
                    className="bg-brand text-white px-6 py-4 rounded-2xl font-bold w-full uppercase tracking-widest text-xs"
                  >
                    {t('dashboard.first_scan')}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedVehicle && (
                    <div className="space-y-3">
                      {/* 1. Identity card */}
                      <div className="relative overflow-hidden rounded-[28px] bg-ink p-5 text-white shadow-[0_18px_38px_rgba(14,34,51,0.18)]">
                        <div className="absolute inset-x-0 top-[58%] h-6 bg-brand" />
                        <div className="relative flex justify-between items-start gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-normal text-white/50">{lang === 'ar' ? 'السيارة الحالية' : 'Current car'}</p>
                            <h3 className="mt-1 text-xl font-bold tracking-tight leading-[1.1] break-words">
                              {selectedVehicle.name}
                            </h3>
                            {selectedVehicle.model && (
                              <p className="text-sm font-semibold text-white/50 mt-1">
                                {selectedVehicle.model}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => setShowSettings(true)}
                              className="bg-white/15 p-2.5 rounded-full hover:bg-white/25 transition-colors"
                              aria-label={t('common.settings')}
                            >
                              <SettingsIcon className="w-5 h-5 text-white" />
                            </button>
                            <button
                              onClick={() => runReport(selectedVehicle)}
                              disabled={reportBusy}
                              className="bg-white/15 p-2.5 rounded-full hover:bg-white/25 transition-colors disabled:opacity-50"
                              aria-label={t('reports.title')}
                            >
                              <Share2 className="w-5 h-5 text-white" />
                            </button>
                          </div>
                        </div>

                        {(selectedVehicle.year || selectedVehicle.make || selectedVehicle.color) && (
                          <div className="relative flex flex-wrap gap-x-4 gap-y-2 mt-5 pt-4 border-t border-white/10">
                            {selectedVehicle.year && (
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-white/75">
                                <Calendar className="w-4 h-4" />
                                {selectedVehicle.year}
                              </span>
                            )}
                            {selectedVehicle.make && (
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-white/75">
                                <Car className="w-4 h-4" />
                                {selectedVehicle.make}
                              </span>
                            )}
                            {selectedVehicle.color && (
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-white/75">
                                <Palette className="w-4 h-4" />
                                {selectedVehicle.color}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* 2. Health hero card */}
                      <div className="relative bg-white/85 backdrop-blur rounded-[32px] p-7 border border-black/5 shadow-sm overflow-hidden">
                        <div className="absolute -top-16 -end-16 w-48 h-48 bg-brand/15 blur-[80px] pointer-events-none" />

                        <div className="relative flex flex-col items-center">
                          <HealthIndicator
                            score={calculateOilLife(
                              selectedVehicle.currentMileage,
                              selectedVehicle.lastOilChangeMileage || 0,
                              selectedVehicle.oilIntervalKm
                            )}
                          />
                        </div>

                        <div className="relative mt-4 space-y-2">
                          <div className="flex justify-between items-center text-xs uppercase tracking-widest">
                            <span className="text-black/40 font-bold">{t('common.oil_life')}</span>
                          </div>
                          <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{
                                width: `${calculateOilLife(selectedVehicle.currentMileage, selectedVehicle.lastOilChangeMileage || 0, selectedVehicle.oilIntervalKm)}%`,
                              }}
                              className="h-full bg-brand"
                            />
                          </div>
                        </div>

                        <div className="absolute bottom-4 end-4 bg-ink text-white px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-2 shadow-md">
                          <span className="text-white/60 uppercase tracking-wider text-[9px]">
                            {t('common.km_left')}
                          </span>
                          <span className="font-bold">
                            {Math.max(
                              0,
                              (selectedVehicle.lastOilChangeMileage || 0) +
                                selectedVehicle.oilIntervalKm -
                                selectedVehicle.currentMileage
                            )}
                          </span>
                        </div>
                        <div className="relative mt-8">
                          <p className="text-[10px] font-bold uppercase tracking-normal text-white/50">{t('common.mileage')}</p>
                          <div className="mt-2 flex items-end justify-between gap-3">
                            <BigNum value={formatMileage(selectedVehicle.currentMileage).replace(' KM', '')} unit={t('common.km_unit')} size="text-4xl" color="text-white" />
                            <CarPlate size="sm" />
                          </div>
                        </div>
                      </div>

                      {/* 3. Stats row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/85 backdrop-blur rounded-2xl p-5 border border-black/5 shadow-sm">
                          <p className="text-[10px] uppercase tracking-widest text-black/40 mb-2">
                            {t('common.mileage')}
                          </p>
                          <p className="text-lg sm:text-xl font-bold">
                            <CountUp value={selectedVehicle.currentMileage} />
                          </p>
                        </div>
                        <div className="bg-white/85 backdrop-blur rounded-2xl p-5 border border-black/5 shadow-sm">
                          <p className="text-[10px] uppercase tracking-widest text-black/40 mb-2">
                            {t('common.last_update')}
                          </p>
                          <p className="text-sm sm:text-base font-bold">
                            {(() => {
                              const d =
                                timestampToDate(selectedVehicle.updatedAt) ||
                                timestampToDate(selectedVehicle.createdAt);
                              if (!d) return t('common.never');
                              return formatDistanceToNow(d, {
                                addSuffix: true,
                                locale: lang === 'ar' ? arLocale : enLocale,
                              });
                            })()}
                          </p>
                        </div>
                      </div>

                      {/* Smart Insights */}
                      {events.filter(e => e.vehicleId === selectedVehicle.id).length >= 5 && (selectedVehicle.name.includes('مركبتي الجديدة') || selectedVehicle.name.toLowerCase().includes('my new vehicle')) && (
                        <div className="glass-dark p-6 rounded-[32px] border-l-4 border-l-brand">
                          <div className="flex gap-4">
                            <Car className="w-6 h-6 text-brand shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-bold">{t('dashboard.name_your_car')}</p>
                              <p className="text-xs text-black/40 mb-3">{t('dashboard.name_hint', { count: events.length })}</p>
                              <div className="flex gap-2">
                                <input
                                  id="vehicle-name-input"
                                  className="bg-black/5 border border-black/10 rounded-xl px-3 py-2 text-xs flex-1 outline-none focus:border-brand"
                                  placeholder={t('dashboard.name_placeholder')}
                                />
                                <button
                                  onClick={async () => {
                                    const input = document.getElementById('vehicle-name-input') as HTMLInputElement;
                                    if (input.value) {
                                      await updateDoc(doc(db, 'vehicles', selectedVehicle.id), { name: input.value });
                                      toast.success(t('dashboard.name_updated'));
                                    }
                                  }}
                                  className="bg-brand px-4 py-2 rounded-xl text-xs font-bold text-white"
                                >
                                  {t('common.save')}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <MaintenanceStatusCard vehicle={selectedVehicle} />

                      {/* Recent Activity */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xl font-bold">{t('dashboard.recent_activity')}</h4>
                          <button onClick={() => setActivePage('timeline')} className="text-brand text-sm font-medium">{t('common.show_all')}</button>
                        </div>
                        <div className="space-y-3">
                          {events.filter(e => e.vehicleId === selectedVehicle.id).slice(0, 3).map((event) => (
                            <div key={event.id} className="glass-dark p-4 rounded-2xl flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center">
                                  {event.type === ServiceType.FUEL ? <Fuel className="w-5 h-5 text-brand" /> : <Droplets className="w-5 h-5 text-success" />}
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{serviceLabel(event.type)}</p>
                                  <p className="text-[10px] text-black/40">{new Date(event.date).toLocaleDateString(dateLocale)}</p>
                                </div>
                              </div>
                              <p className="font-bold text-xs">{formatMileage(event.mileage)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="glass-dark p-6 rounded-[32px] flex flex-col items-center gap-3 transition-transform active:scale-95"
                    >
                      <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center">
                        <Camera className="w-6 h-6 text-brand" />
                      </div>
                      <span className="text-sm font-medium">{t('dashboard.update_odometer')}</span>
                    </button>
                    <button
                      onClick={() => setActivePage('timeline')}
                      className="glass-dark p-6 rounded-[32px] flex flex-col items-center gap-3 transition-transform active:scale-95"
                    >
                      <div className="w-12 h-12 bg-success/10 rounded-2xl flex items-center justify-center">
                        <History className="w-6 h-6 text-success" />
                      </div>
                      <span className="text-sm font-medium">{t('dashboard.activity_log')}</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activePage === 'alerts' && (
            <motion.div
              key="alerts"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <h2 className="text-3xl font-bold tracking-tight">{t('alerts.title')}</h2>

              {(() => {
                const groups = vehicles
                  .map((v) => ({
                    vehicle: v,
                    items: getMaintenanceStatuses(v).filter((s) => s.state !== 'ok'),
                  }))
                  .filter((g) => g.items.length > 0);

                if (groups.length === 0) {
                  return (
                    <div className="glass-dark p-12 rounded-[32px] text-center space-y-3">
                      <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
                      <p className="text-lg font-bold">{t('alerts.all_good_title')}</p>
                      <p className="text-sm text-black/40">{t('alerts.all_good_desc')}</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-5">
                    {groups.map(({ vehicle, items }) => (
                      <div key={vehicle.id} className="glass-dark p-6 rounded-[32px] space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <h3 className="text-lg font-bold truncate">{vehicle.name}</h3>
                            {(vehicle.make || vehicle.model) && (
                              <p className="text-[10px] uppercase tracking-widest text-black/40">
                                {vehicle.make} {vehicle.model}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setSelectedVehicle(vehicle);
                              setActivePage('dashboard');
                            }}
                            className="text-xs font-bold text-brand bg-brand/10 px-3 py-1.5 rounded-full"
                          >
                            {t('alerts.open_vehicle')}
                          </button>
                        </div>
                        <div className="space-y-2">
                          {items.map((s) => (
                            <div key={s.kind}><AlertItemRow status={s} /></div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          )}

          {activePage === 'camera' && (
            <motion.div
              key="camera"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center pt-20 text-center space-y-8"
            >
              <ScanViewport scanning={scanning} preview={scanPreview} />

              <div>
                <h2 className="text-2xl font-bold mb-2">{t('camera.title')}</h2>
                <p className="text-black/40 max-w-[240px]">{t('camera.subtitle')}</p>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={scanning}
                className="bg-brand text-white px-12 py-4 rounded-3xl font-bold shadow-2xl shadow-brand/20 disabled:opacity-50"
              >
                {scanning ? t('camera.scanning') : t('camera.open')}
              </button>
            </motion.div>
          )}

          {activePage === 'timeline' && (
            <motion.div 
              key="timeline"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold tracking-tight">{t('timeline.title')}</h2>
                <button
                  onClick={() => runReport(selectedVehicle)}
                  disabled={reportBusy || !selectedVehicle}
                  className="p-2 glass-dark rounded-full disabled:opacity-50"
                  aria-label={t('reports.title')}
                >
                  <Share2 className="w-5 h-5 text-black/60" />
                </button>
              </div>

              <div className="space-y-4">
                {events.length === 0 ? (
                  <div className="py-20 text-center text-black/20">{t('timeline.empty')}</div>
                ) : (
                  events.map((event, i) => (
                    <TimelineEventRow
                      key={event.id}
                      event={event}
                      isLast={i === events.length - 1}
                      serviceLabel={serviceLabel}
                      dateLocale={dateLocale}
                      onDelete={handleDeleteEvent}
                    />
                  ))
                )}
              </div>
            </motion.div>
          )}

          {activePage === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="text-center pt-10">
                <div className="w-24 h-24 bg-black/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-black/10">
                  {user?.photoURL ? <img src={user.photoURL} className="rounded-full" /> : <UserIcon className="w-12 h-12 text-black/20" />}
                </div>
                <h2 className="text-2xl font-bold">{user?.displayName || t('profile.guest')}</h2>
                <p className="text-black/40">{user?.email || t('profile.sign_in_hint')}</p>
              </div>

              <div className="flex justify-center">
                <LanguageToggle />
              </div>

              <div className="space-y-4">
                {!user ? (
                  <button
                    onClick={handleSignIn}
                    className="w-full glass p-6 rounded-3xl flex items-center gap-4 hover:bg-black/10 transition-all font-bold text-lg"
                  >
                    <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center">
                      <Plus className="w-6 h-6 text-white" />
                    </div>
                    <span>{t('profile.sign_in_google')}</span>
                  </button>
                ) : (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-lg font-bold">{t('profile.your_vehicles')}</h3>
                      <button
                        onClick={handleAddVehicle}
                        className="w-full bg-brand text-white p-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-brand/20 hover:brightness-95 transition"
                      >
                        <Plus className="w-5 h-5" />
                        <span>{t('profile.add_vehicle')}</span>
                      </button>
                      {vehicles.length === 0 ? (
                        <p className="text-sm text-black/40 text-center py-3">{t('profile.no_vehicles')}</p>
                      ) : (
                        <div className="space-y-2">
                          {vehicles.map((v) => (
                            <div key={v.id}>
                              <VehicleManageRow vehicle={v} onDelete={handleDeleteVehicle} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {vehicles.length === 0 && (
                      <button
                        onClick={async () => {
                          try {
                            await seedDemoData(user.uid);
                            toast.success(t('profile.seed_demo_done'));
                            setActivePage('dashboard');
                          } catch (err) {
                            console.error(err);
                            toast.error(t('profile.seed_demo_failed'));
                          }
                        }}
                        className="w-full glass-dark p-6 rounded-3xl flex items-center gap-4 text-brand font-bold"
                      >
                        <Plus className="w-6 h-6" />
                        <span>{t('profile.seed_demo')}</span>
                      </button>
                    )}
                    <button
                      onClick={() => signOut(auth)}
                      className="w-full glass-dark p-6 rounded-3xl flex items-center gap-4 text-danger font-bold"
                    >
                      <LogOut className="w-6 h-6" />
                      <span>{t('profile.sign_out')}</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {activePage === 'ocr-result' && (
            <motion.div
              key="ocr-result"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="space-y-6 pt-8"
            >
              <AppTop title={lang === 'ar' ? 'تمت قراءة العداد' : 'Odometer scanned'} sub={t('camera.detected', { value: '' }).trim()} />
              <div className="rounded-[32px] border border-[#E1EAF1] bg-white p-7 text-center shadow-sm">
                <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <BigNum value={formatMileage(tempEventData?.mileage || 0).replace(' KM', '')} unit={t('common.km_unit')} size="text-5xl" />
                <p className="mt-4 text-sm font-medium leading-7 text-[#4A6378]">
                  {lang === 'ar' ? 'راجع الرقم ثم اختر العملية التي تريد تسجيلها.' : 'Review the number, then choose what you want to log.'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => fileInputRef.current?.click()} className="rounded-2xl border border-[#E1EAF1] bg-white px-4 py-4 font-bold text-ink">
                  {lang === 'ar' ? 'إعادة التصوير' : 'Retake'}
                </button>
                <button onClick={() => setActivePage('service-select')} className="rounded-2xl bg-brand px-4 py-4 font-bold text-white shadow-lg shadow-brand/20">
                  {lang === 'ar' ? 'تأكيد' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          )}

          {activePage === 'log-fuel' && (
            <motion.div
              key="log-fuel"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="space-y-5"
            >
              <AppTop title={t('service.fuel')} sub={t('service.saw_odometer', { value: formatMileage(tempEventData?.mileage || 0) })} />
              <div className="space-y-3 rounded-[28px] border border-[#E1EAF1] bg-white p-5 shadow-sm">
                <DesignField label={lang === 'ar' ? 'المبلغ' : 'Amount'} value={fuelForm.amount} onChange={(v) => updateFuelForm('amount', v)} type="number" placeholder="52" />
                <DesignField label={lang === 'ar' ? 'اللترات' : 'Liters'} value={fuelForm.liters} onChange={(v) => updateFuelForm('liters', v)} type="number" placeholder="40" />
                <DesignField label={lang === 'ar' ? 'المحطة' : 'Station'} value={fuelForm.station} onChange={(v) => updateFuelForm('station', v)} placeholder={lang === 'ar' ? 'محطة أرامكو' : 'Aramco station'} />
                <label className="block rounded-2xl border border-[#E1EAF1] bg-white px-4 py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-normal text-[#4A6378]">{t('service.notes')}</span>
                  <textarea
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    rows={3}
                    className="mt-2 w-full resize-none bg-transparent text-sm font-medium outline-none placeholder:text-[#7B92A6]"
                    placeholder={t('service.notes_placeholder')}
                  />
                </label>
              </div>
              <button
                onClick={() => saveEvent(ServiceType.FUEL, {
                  amount: Number(fuelForm.amount),
                  liters: Number(fuelForm.liters),
                  station: fuelForm.station.trim(),
                })}
                className="w-full rounded-2xl bg-brand px-5 py-4 font-bold text-white shadow-lg shadow-brand/20"
              >
                {t('common.save')}
              </button>
            </motion.div>
          )}

          {activePage === 'log-service' && (
            <motion.div
              key="log-service"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="space-y-5"
            >
              <AppTop title={t('service.maintenance')} sub={t('service.saw_odometer', { value: formatMileage(tempEventData?.mileage || 0) })} />
              <div className="space-y-3 rounded-[28px] border border-[#E1EAF1] bg-white p-5 shadow-sm">
                <DesignField label={lang === 'ar' ? 'مركز الخدمة' : 'Service center'} value={serviceForm.center} onChange={(v) => updateServiceForm('center', v)} />
                <label className="block rounded-2xl border border-[#E1EAF1] bg-white px-4 py-3">
                  <span className="block text-[10px] font-bold uppercase tracking-normal text-[#4A6378]">{t('service.notes')}</span>
                  <textarea
                    value={eventNotes}
                    onChange={(e) => setEventNotes(e.target.value)}
                    rows={4}
                    className="mt-2 w-full resize-none bg-transparent text-sm font-medium outline-none placeholder:text-[#7B92A6]"
                    placeholder={t('service.notes_placeholder')}
                  />
                </label>
              </div>
              <button
                onClick={() => saveEvent(ServiceType.MAINTENANCE, { serviceCenter: serviceForm.center.trim() })}
                className="w-full rounded-2xl bg-brand px-5 py-4 font-bold text-white shadow-lg shadow-brand/20"
              >
                {t('common.save')}
              </button>
            </motion.div>
          )}

          {activePage === 'service-select' && (
            <motion.div 
              key="service-select"
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8 pt-6"
            >
              <div>
                <h2 className="text-3xl font-bold mb-2">{t('service.title')}</h2>
                <p className="text-black/40">{t('service.saw_odometer', { value: formatMileage(tempEventData?.mileage || 0) })}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {[
                  { type: ServiceType.FUEL, icon: Fuel, color: 'text-brand', bg: 'bg-brand/10' },
                  { type: ServiceType.OIL_CHANGE, icon: Droplets, color: 'text-success', bg: 'bg-success/10' },
                  { type: ServiceType.MAINTENANCE, icon: Wrench, color: 'text-warning', bg: 'bg-warning/10' },
                  { type: ServiceType.TIRES, icon: Disc, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                  { type: ServiceType.BATTERY, icon: Battery, color: 'text-danger', bg: 'bg-danger/10' },
                  { type: ServiceType.PARTS, icon: Cog, color: 'text-sky-500', bg: 'bg-sky-500/10' },
                  { type: ServiceType.OTHER, icon: Plus, color: 'text-black/60', bg: 'bg-black/5' },
                ].map((s) => (
                  <button
                    key={s.type}
                    onClick={() => {
                      if (s.type === ServiceType.FUEL) setActivePage('log-fuel');
                      else if (s.type === ServiceType.MAINTENANCE) setActivePage('log-service');
                      else saveEvent(s.type);
                    }}
                    className="glass-dark p-6 rounded-[32px] flex flex-col items-center gap-3 transition-all active:scale-95 group hover:border-brand/40"
                  >
                    <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", s.bg)}>
                      <s.icon className={cn("w-7 h-7", s.color)} />
                    </div>
                    <span className="text-sm font-bold">{serviceLabel(s.type)}</span>
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="block text-xs font-bold text-black/60 mb-2">{t('service.notes')}</span>
                <textarea
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder={t('service.notes_placeholder')}
                  maxLength={1000}
                  rows={3}
                  className="w-full bg-white border border-black/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand resize-none"
                />
              </label>

              <button
                onClick={() => { setEventNotes(''); setActivePage('dashboard'); }}
                className="w-full text-black/40 font-medium py-4"
              >
                {t('service.skip')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hidden File Input for Capture */}
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleCapture}
      />

      {!['onboarding', 'add-car', 'ocr-result', 'log-fuel', 'log-service', 'service-select'].includes(activePage) && (
        <Navbar activePage={activePage} setActivePage={setActivePage} user={user} />
      )}

      <AnimatePresence>
        {showSettings && selectedVehicle && (
          <VehicleSettings vehicle={selectedVehicle} onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
