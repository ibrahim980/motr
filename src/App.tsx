import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Trash2,
  TrendingUp,
  TrendingDown,
  X,
  ArrowLeft,
  Home as HomeIcon,
  BarChart3
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

function CountUp({ value, format }: { value: number; format?: (n: number) => string }) {
  const fmt = format ?? formatMileage;
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const startValue = Number(node.textContent?.replace(/[^0-9.-]/g, '')) || 0;
    const controls = animate(startValue, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        if (node) node.textContent = fmt(Math.round(latest));
      },
    });
    return () => controls.stop();
  }, [value, fmt]);
  return <span ref={ref}>{fmt(value)}</span>;
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

type AlertEntry = { vehicle: Vehicle; status: MaintenanceStatus };

function FeaturedAlertCard({
  entry,
  onMarkDone,
  onSnooze,
}: {
  entry: AlertEntry;
  onMarkDone: (vehicle: Vehicle, kind: StatusKind) => Promise<void>;
  onSnooze: (vehicle: Vehicle, kind: StatusKind) => void;
}) {
  const { t } = useI18n();
  const formatValue = useFormatStatusValue();
  const [busy, setBusy] = useState(false);
  const { vehicle, status } = entry;
  const eyebrow =
    status.state === 'overdue'
      ? t('alerts.featured_overdue_eyebrow')
      : t('alerts.featured_soon_eyebrow');
  return (
    <div className="bg-brand text-white rounded-[28px] p-5 space-y-4 shadow-[0_12px_28px_rgba(242,107,31,0.25)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">{eyebrow}</p>
          <h3 className="text-xl font-extrabold mt-1 truncate">{t(`status.${status.kind}`)}</h3>
          <p className="text-xs text-white/80 mt-1 truncate">
            {vehicle.name} · {formatValue(status)}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5" />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSnooze(vehicle, status.kind)}
          disabled={busy}
          className="flex-1 bg-white/15 hover:bg-white/25 transition py-3 rounded-2xl text-sm font-bold disabled:opacity-60"
        >
          {t('alerts.snooze')}
        </button>
        <button
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await onMarkDone(vehicle, status.kind);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="flex-1 bg-white text-brand hover:bg-white/90 transition py-3 rounded-2xl text-sm font-bold disabled:opacity-60"
        >
          {t('alerts.featured_mark_done')}
        </button>
      </div>
    </div>
  );
}

function AlertCompactRow({
  entry,
  onMarkDone,
}: {
  entry: AlertEntry;
  onMarkDone: (vehicle: Vehicle, kind: StatusKind) => Promise<void>;
}) {
  const { t } = useI18n();
  const formatValue = useFormatStatusValue();
  const [busy, setBusy] = useState(false);
  const { vehicle, status } = entry;
  const Icon = STATUS_ICONS[status.kind];
  return (
    <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between gap-3 shadow-[0_2px_8px_rgba(14,34,51,0.04)]">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
            STATE_ICON_BG[status.state],
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{t(`status.${status.kind}`)}</p>
          <p className="text-xs text-black/40 truncate">{vehicle.name}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn('text-xs font-bold whitespace-nowrap', STATE_COLOR[status.state])}>
          {formatValue(status)}
        </span>
        {status.state !== 'ok' && (
          <button
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              try {
                await onMarkDone(vehicle, status.kind);
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            aria-label={t('alerts.mark_done')}
            className="w-7 h-7 rounded-full bg-success/10 text-success flex items-center justify-center hover:bg-success/20 transition disabled:opacity-60"
          >
            <CheckCircle2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function AlertItemRow({
  status,
  vehicle,
  onMarkDone,
}: {
  status: MaintenanceStatus;
  vehicle?: Vehicle;
  onMarkDone?: (vehicle: Vehicle, kind: StatusKind) => Promise<void>;
}) {
  const { t } = useI18n();
  const formatValue = useFormatStatusValue();
  const Icon = STATUS_ICONS[status.kind];
  const [busy, setBusy] = useState(false);
  const canMarkDone = vehicle && onMarkDone && status.state !== 'ok';
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', STATE_ICON_BG[status.state])}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{t(`status.${status.kind}`)}</p>
          <p className={cn('text-xs font-bold whitespace-nowrap', STATE_COLOR[status.state])}>
            {formatValue(status)}
          </p>
        </div>
      </div>
      {canMarkDone && (
        <button
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            try {
              await onMarkDone!(vehicle!, status.kind);
            } finally {
              setBusy(false);
            }
          }}
          disabled={busy}
          className="shrink-0 bg-success/10 text-success px-3 py-1.5 rounded-full text-xs font-bold hover:bg-success/20 transition disabled:opacity-60"
        >
          {t('alerts.mark_done')}
        </button>
      )}
    </div>
  );
}

function PreviewServiceCard({
  type,
  mileage,
  dateLocale,
  notes,
  onNotesChange,
  Icon,
  iconColor,
  label,
  onCancel,
  onAdd,
}: {
  type: ServiceType;
  mileage: number;
  dateLocale: string;
  notes: string;
  onNotesChange: (v: string) => void;
  Icon: typeof Fuel;
  iconColor: string;
  label: string;
  onCancel: () => void;
  onAdd: () => void | Promise<void>;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const today = new Date().toLocaleDateString(dateLocale);

  return (
    <div className="relative ps-8 pb-2">
      <div
        className={cn(
          'absolute start-2 top-2 w-4 h-4 rounded-full border-2 border-bg-dark',
          type === ServiceType.FUEL ? 'bg-brand' : 'bg-success',
        )}
      />
      <div className="glass-dark p-6 rounded-[28px] space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <Icon className={cn('w-4 h-4', iconColor)} />
            <span className="font-bold">{label}</span>
          </div>
          <span className="text-xs text-black/40">{today}</span>
        </div>
        <div className="flex justify-between">
          <p className="text-lg font-bold">{formatMileage(mileage)}</p>
        </div>

        <label className="block pt-1">
          <span className="block text-xs font-bold text-black/60 mb-2">
            {t('service.notes')}
          </span>
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={t('service.notes_placeholder')}
            maxLength={1000}
            rows={3}
            className="w-full bg-white border border-black/10 rounded-2xl px-4 py-3 text-sm outline-none focus:border-brand resize-none"
          />
        </label>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 bg-black/5 border border-black/10 py-3 rounded-2xl text-sm font-bold hover:bg-black/10 transition"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await onAdd();
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="flex-1 bg-brand text-white py-3 rounded-2xl text-sm font-bold hover:brightness-95 transition disabled:opacity-60"
          >
            {t('service.add')}
          </button>
        </div>
      </div>
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

const EVENT_TONE: Record<ServiceType, { bg: string; fg: string }> = {
  [ServiceType.FUEL]: { bg: 'bg-brand/15', fg: 'text-brand' },
  [ServiceType.OIL_CHANGE]: { bg: 'bg-sky-500/15', fg: 'text-sky-600' },
  [ServiceType.MAINTENANCE]: { bg: 'bg-warning/15', fg: 'text-warning' },
  [ServiceType.TIRES]: { bg: 'bg-warning/15', fg: 'text-warning' },
  [ServiceType.BATTERY]: { bg: 'bg-danger/15', fg: 'text-danger' },
  [ServiceType.PARTS]: { bg: 'bg-sky-500/15', fg: 'text-sky-600' },
  [ServiceType.OTHER]: { bg: 'bg-success/15', fg: 'text-success' },
};

function eventIcon(type: ServiceType) {
  switch (type) {
    case ServiceType.FUEL: return Fuel;
    case ServiceType.OIL_CHANGE: return Droplets;
    case ServiceType.MAINTENANCE: return Wrench;
    case ServiceType.TIRES: return Disc;
    case ServiceType.BATTERY: return Battery;
    case ServiceType.PARTS: return Cog;
    case ServiceType.OTHER: return CheckCircle2;
    default: return Plus;
  }
}

function EventCardV2({
  event,
  serviceLabel,
  dateLocale,
  onDelete,
}: {
  event: TimelineEvent;
  serviceLabel: (type: ServiceType) => string;
  dateLocale: string;
  onDelete: (eventId: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const tone = EVENT_TONE[event.type] ?? EVENT_TONE[ServiceType.OTHER];
  const Icon = eventIcon(event.type);
  const dateStr = new Date(event.date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
  const isFuel = event.type === ServiceType.FUEL;
  const title = isFuel && event.liters
    ? `${serviceLabel(event.type)} · ${event.liters} ${t('timeline.unit_liters')}`
    : serviceLabel(event.type);

  return (
    <div className="bg-white rounded-2xl p-4 group relative shadow-[0_2px_8px_rgba(14,34,51,0.04)]">
      <div className="flex items-center gap-3">
        <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', tone.bg, tone.fg)}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{title}</p>
          <p className="text-xs text-black/40 truncate mt-0.5">
            {dateStr} · {t('timeline.odometer_label')} {event.mileage.toLocaleString()} {t('timeline.unit_km')}
          </p>
        </div>
        <div className="shrink-0 text-end">
          {event.amount != null ? (
            <p className="whitespace-nowrap">
              <span className="text-base font-extrabold tabular">{event.amount}</span>
              <span className="text-[10px] text-black/40 ms-1">{t('timeline.unit_riyal')}</span>
            </p>
          ) : null}
        </div>
        <button
          onClick={() => setConfirming(true)}
          className="absolute top-2 end-2 w-6 h-6 rounded-full bg-black/5 text-black/50 flex items-center justify-center hover:bg-danger/10 hover:text-danger transition opacity-0 group-hover:opacity-100 sm:opacity-100"
          aria-label={t('timeline.delete')}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
      {confirming && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl p-3 space-y-2 mt-3">
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
                try { await onDelete(event.id); } finally { setBusy(false); }
              }}
              disabled={busy}
              className="flex-1 bg-danger text-white py-2 rounded-xl text-xs font-bold hover:brightness-95 transition disabled:opacity-60"
            >
              {t('timeline.delete')}
            </button>
          </div>
        </div>
      )}
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

function MaintenanceStatusCard({
  vehicle,
  onMarkDone,
}: {
  vehicle: Vehicle;
  onMarkDone?: (vehicle: Vehicle, kind: StatusKind) => Promise<void>;
}) {
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
            <div key={s.kind}><AlertItemRow status={s} vehicle={vehicle} onMarkDone={onMarkDone} /></div>
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

type NextCta =
  | { source: 'oil'; state: StatusState; value: number; key: string }
  | { source: 'status'; state: StatusState; value: number; status: MaintenanceStatus; key: string };

function getNextCta(vehicle: Vehicle): NextCta | null {
  const candidates: NextCta[] = [];
  const oilLeft =
    (vehicle.lastOilChangeMileage ?? vehicle.currentMileage) +
    vehicle.oilIntervalKm -
    vehicle.currentMileage;
  const oilState: StatusState = oilLeft < 0 ? 'overdue' : oilLeft <= 2000 ? 'soon' : 'ok';
  if (oilState !== 'ok') {
    candidates.push({
      source: 'oil',
      state: oilState,
      value: Math.abs(oilLeft),
      key: `${vehicle.id}:oil`,
    });
  }
  getMaintenanceStatuses(vehicle)
    .filter((s) => s.state !== 'ok')
    .forEach((s) =>
      candidates.push({
        source: 'status',
        state: s.state,
        value: s.value,
        status: s,
        key: `${vehicle.id}:${s.kind}`,
      }),
    );
  if (candidates.length === 0) return null;
  const rank: Record<StatusState, number> = { overdue: 0, soon: 1, ok: 2 };
  candidates.sort((a, b) => {
    if (rank[a.state] !== rank[b.state]) return rank[a.state] - rank[b.state];
    return a.value - b.value;
  });
  return candidates[0];
}

function computeFuelAverage(events: TimelineEvent[]): { avg: number | null; trend: number | null } {
  const fuels = events
    .filter(
      (e) =>
        e.type === ServiceType.FUEL &&
        typeof e.liters === 'number' &&
        e.liters > 0 &&
        Number.isFinite(e.mileage),
    )
    .sort((a, b) => a.mileage - b.mileage);
  const compute = (arr: TimelineEvent[]): number | null => {
    if (arr.length < 2) return null;
    const km = arr[arr.length - 1].mileage - arr[0].mileage;
    if (km <= 0) return null;
    const L = arr.slice(1).reduce((acc, e) => acc + (e.liters ?? 0), 0);
    if (L <= 0) return null;
    return (L / km) * 100;
  };
  const avg = compute(fuels);
  if (avg == null) return { avg: null, trend: null };
  if (fuels.length < 4) return { avg, trend: null };
  const mid = Math.floor(fuels.length / 2);
  const earlier = compute(fuels.slice(0, mid + 1));
  const later = compute(fuels.slice(mid));
  if (earlier == null || later == null || earlier === 0) return { avg, trend: null };
  return { avg, trend: ((earlier - later) / earlier) * 100 };
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

const Navbar = ({ activePage, setActivePage, alertCount = 0 }: any) => {
  const { t } = useI18n();
  const tabs = [
    { id: 'dashboard', icon: HomeIcon, label: t('nav.home'), badge: alertCount },
    { id: 'cars', icon: Car, label: t('nav.cars') },
    { id: 'camera', icon: Camera, label: t('nav.camera'), primary: true },
    { id: 'timeline', icon: BarChart3, label: t('nav.stats') },
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
              <span className="relative">
                <Icon className="h-5 w-5 shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                {tab.badge > 0 && (
                  <span className="absolute -top-1.5 -end-2 min-w-[16px] h-[16px] px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center tabular leading-none">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </span>
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
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'fuel' | 'service' | 'inspection'>('all');

  const serviceIcon = (type: ServiceType) => {
    switch (type) {
      case ServiceType.FUEL: return Fuel;
      case ServiceType.OIL_CHANGE: return Droplets;
      case ServiceType.MAINTENANCE: return Wrench;
      case ServiceType.TIRES: return Disc;
      case ServiceType.BATTERY: return Battery;
      case ServiceType.PARTS: return Cog;
      default: return Plus;
    }
  };

  const serviceColor = (type: ServiceType): string => {
    switch (type) {
      case ServiceType.FUEL: return 'text-brand';
      case ServiceType.OIL_CHANGE: return 'text-success';
      case ServiceType.MAINTENANCE: return 'text-warning';
      case ServiceType.TIRES: return 'text-purple-400';
      case ServiceType.BATTERY: return 'text-danger';
      case ServiceType.PARTS: return 'text-sky-500';
      default: return 'text-black/60';
    }
  };
  const [reportBusy, setReportBusy] = useState(false);
  const [addCarForm, setAddCarForm] = useState({ name: '', make: '', model: '', year: '', color: '', mileage: '' });
  const [fuelForm, setFuelForm] = useState({ liters: '', pricePerLiter: '', station: '', grade: '95' });
  const [serviceForm, setServiceForm] = useState({ center: '', cost: '', subtype: 'oil', reminderOn: true });

  useEffect(() => {
    if (!showSplash) return;
    const id = window.setTimeout(() => {
      localStorage.setItem('motr-splash-seen', '1');
      setShowSplash(false);
      if (!user) {
        setActivePage('signin');
      } else if (!hasSeenOnboarding) {
        setActivePage('onboarding');
      } else {
        setActivePage('dashboard');
      }
    }, 1600);
    return () => window.clearTimeout(id);
  }, [showSplash, user, hasSeenOnboarding]);

  const finishOnboarding = () => {
    localStorage.setItem('motr-onboarding-done', '1');
    setHasSeenOnboarding(true);
    setActivePage('add-car');
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

  const [snoozedAlerts, setSnoozedAlerts] = useState<Set<string>>(new Set());
  const snoozeKey = (vehicleId: string, kind: StatusKind) => `${vehicleId}:${kind}`;
  const [dismissedCtaKeys, setDismissedCtaKeys] = useState<Set<string>>(new Set());

  const timelineData = useMemo(() => {
    const empty = {
      counts: { all: 0, fuel: 0, service: 0, inspection: 0 },
      filtered: [] as TimelineEvent[],
      monthSpend: 0,
      distance: 0,
    };
    if (!selectedVehicle) return empty;
    const forVehicle = events.filter((e) => e.vehicleId === selectedVehicle.id);
    const counts = { all: forVehicle.length, fuel: 0, service: 0, inspection: 0 };
    forVehicle.forEach((e) => {
      if (e.type === ServiceType.FUEL) counts.fuel++;
      else if (e.type === ServiceType.OTHER) counts.inspection++;
      else counts.service++;
    });
    const filtered = forVehicle.filter((e) => {
      if (timelineFilter === 'all') return true;
      if (timelineFilter === 'fuel') return e.type === ServiceType.FUEL;
      if (timelineFilter === 'inspection') return e.type === ServiceType.OTHER;
      return e.type !== ServiceType.FUEL && e.type !== ServiceType.OTHER;
    });
    const now = new Date();
    const monthSpend = forVehicle.reduce((acc, e) => {
      if (e.amount == null) return acc;
      const d = new Date(e.date);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        return acc + e.amount;
      }
      return acc;
    }, 0);
    const mileages = forVehicle.map((e) => e.mileage).filter((m) => Number.isFinite(m));
    const distance = mileages.length >= 2 ? Math.max(...mileages) - Math.min(...mileages) : 0;
    return { counts, filtered, monthSpend, distance };
  }, [events, selectedVehicle, timelineFilter]);

  const alertCount = useMemo(
    () =>
      vehicles.reduce(
        (acc, v) =>
          acc +
          getMaintenanceStatuses(v).filter(
            (s) => s.state !== 'ok' && !snoozedAlerts.has(snoozeKey(v.id, s.kind)),
          ).length,
        0,
      ),
    [vehicles, snoozedAlerts],
  );

  const handleSnoozeReminder = (vehicle: Vehicle, kind: StatusKind) => {
    setSnoozedAlerts((prev) => {
      const next = new Set(prev);
      next.add(snoozeKey(vehicle.id, kind));
      return next;
    });
    toast.success(t('alerts.snoozed_toast'));
  };

  const handleMarkReminderDone = async (vehicle: Vehicle, kind: StatusKind) => {
    try {
      const nowIso = new Date().toISOString();
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (kind === 'battery') patch.lastBatteryChangeDate = nowIso;
      else if (kind === 'tires') patch.lastTireChangeMileage = vehicle.currentMileage;
      else if (kind === 'maintenance') patch.lastMaintenanceDate = nowIso;
      else if (kind === 'parts') patch.lastPartsDate = nowIso;
      await updateDoc(doc(db, 'vehicles', vehicle.id), patch);
      setSnoozedAlerts((prev) => {
        const k = snoozeKey(vehicle.id, kind);
        if (!prev.has(k)) return prev;
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
      toast.success(t('alerts.done_toast'));
    } catch (err) {
      console.error(err);
      toast.error(t('alerts.done_failed'));
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
      setSelectedServiceType(null);
      setFuelForm({ liters: '', pricePerLiter: '', station: '', grade: '95' });
      setServiceForm({ center: '', cost: '', subtype: 'oil', reminderOn: true });
    } catch (err) {
      console.error(err);
      toast.error(t('service.save_failed'));
    }
  };

  if (loading) return null;

  if (showSplash) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-brand text-white overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-20 bg-ink/10 pointer-events-none"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative text-center px-10"
        >
          <img src="/logo.svg" alt="MOTR" className="mx-auto h-24 w-auto" />
          <p className="mt-7 text-base font-medium tracking-wide text-white/90">
            {t('splash.tagline')}
          </p>
        </motion.div>
        <p className="absolute bottom-16 inset-x-0 text-center text-[11px] font-semibold tracking-[0.15em] text-white/55">
          {t('splash.version')}
        </p>
        <div className="absolute inset-x-0 bottom-0 h-1.5 bg-ink" />
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
          {activePage === 'signin' && (
            <motion.div
              key="signin"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="relative -mx-4 -mt-12 min-h-screen bg-white"
            >
              <div className="absolute inset-x-0 top-[38%] h-24 bg-brand/95 pointer-events-none" />

              <div className="relative flex flex-col items-center pt-14">
                <img src="/logo.svg" alt="MOTR" className="h-10 w-auto" />
              </div>

              <div className="relative px-8 pt-9 text-center">
                <h1 className="text-2xl font-extrabold tracking-tight text-ink leading-tight">
                  {t('signin.title')}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-[#4A6378] max-w-[280px] mx-auto">
                  {t('signin.subtitle')}
                </p>
              </div>

              <div className="absolute inset-x-5 bottom-9 rounded-3xl bg-white border border-[#E1EAF1] p-4 shadow-[0_12px_30px_rgba(14,34,51,0.08)] space-y-3">
                <button
                  onClick={handleSignIn}
                  dir="ltr"
                  className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white border border-[#E1EAF1] px-5 py-3.5 text-sm font-semibold text-ink hover:bg-[#F4F7F9] transition"
                >
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"/>
                    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"/>
                    <path fill="#FBBC05" d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"/>
                    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"/>
                  </svg>
                  <span>{t('signin.with_google')}</span>
                </button>
                <button
                  type="button"
                  disabled
                  dir="ltr"
                  className="w-full flex items-center justify-center gap-3 rounded-2xl bg-ink border-0 px-5 py-3.5 text-sm font-semibold text-white opacity-90 cursor-not-allowed"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                    <path d="M17.05 12.04c.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.93 1.16 9.2.77 1.11 1.69 2.36 2.9 2.31 1.16-.05 1.6-.75 3.01-.75 1.4 0 1.8.75 3.03.73 1.25-.02 2.04-1.13 2.81-2.24.88-1.29 1.25-2.54 1.27-2.6-.03-.01-2.43-.93-2.45-3.7Z M14.5 5.32c.64-.78 1.07-1.86.95-2.94-.92.04-2.04.61-2.7 1.38-.59.68-1.11 1.78-.97 2.83 1.03.08 2.08-.52 2.72-1.27Z"/>
                  </svg>
                  <span>{t('signin.with_apple')}</span>
                </button>
                <p className="text-[11px] leading-relaxed text-[#7B92A6] text-center px-2">
                  {t('signin.terms_pre')}{' '}
                  <span className="text-ink font-semibold">{t('signin.terms')}</span>
                  {' '}{t('signin.terms_mid')}{' '}
                  <span className="text-ink font-semibold">{t('signin.privacy')}</span>.
                </p>
              </div>
            </motion.div>
          )}

          {activePage === 'onboarding' && (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="relative -mx-4 -mt-12 min-h-screen bg-white pt-14 pb-32 overflow-hidden"
            >
              <button
                onClick={finishOnboarding}
                className="absolute top-14 start-5 z-10 text-sm font-semibold text-[#4A6378]"
              >
                {t('onboarding.skip')}
              </button>

              <div className="mx-5 mt-3 h-72 rounded-[32px] bg-[#DCEAF3] relative overflow-hidden">
                <div className="absolute inset-x-[-20px] top-[52%] h-16 bg-brand -rotate-3" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative w-44 h-60 bg-white rounded-3xl border border-[#E1EAF1] shadow-[0_20px_40px_rgba(14,34,51,0.2)] -rotate-3 flex flex-col items-center justify-center">
                    <div className="font-mono text-[32px] font-extrabold text-brand tracking-wider">212,450</div>
                    <div className="mt-1.5 text-[11px] text-[#4A6378]">OCR · 2.1s</div>
                    {[
                      'top-3.5 start-3.5 border-t-2 border-s-2 rounded-tl-lg',
                      'top-3.5 end-3.5 border-t-2 border-e-2 rounded-tr-lg',
                      'bottom-3.5 start-3.5 border-b-2 border-s-2 rounded-bl-lg',
                      'bottom-3.5 end-3.5 border-b-2 border-e-2 rounded-br-lg',
                    ].map((cls, i) => (
                      <div key={i} className={cn('absolute w-3.5 h-3.5 border-brand', cls)} />
                    ))}
                  </div>
                </div>
                <span className="absolute top-5 end-5 bg-ink text-white px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {t('onboarding.feature_label')}
                </span>
              </div>

              <div className="px-7 mt-8">
                <h1 className="text-3xl font-extrabold tracking-tight leading-snug text-balance">
                  {t('onboarding.h1')}
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-[#4A6378] text-pretty">
                  {t('onboarding.desc')}
                </p>
              </div>

              <div className="absolute inset-x-6 bottom-8 space-y-3.5">
                <div className="flex gap-1.5 justify-center">
                  <span className="w-6 h-1.5 rounded-full bg-brand" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E1EAF1]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E1EAF1]" />
                </div>
                <button
                  onClick={finishOnboarding}
                  className="w-full rounded-2xl bg-brand text-white px-5 py-4 text-[15px] font-bold tracking-tight shadow-[0_12px_28px_rgba(242,107,31,0.35)]"
                >
                  {t('onboarding.next')}
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
              className="-mx-4 -mt-12 min-h-screen bg-bg-dark pt-14 pb-28"
            >
              <div className="px-5 pb-3 flex items-start justify-between gap-3">
                <button
                  onClick={() => setActivePage(hasSeenOnboarding ? 'dashboard' : 'onboarding')}
                  className="w-9 h-9 rounded-full bg-white border border-[#E1EAF1] flex items-center justify-center"
                  aria-label="close"
                >
                  <X className="w-4 h-4 text-ink" />
                </button>
                <div className="flex-1 text-end min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4A6378]">{t('addcar.sub')}</p>
                  <h1 className="mt-0.5 text-lg font-extrabold tracking-tight text-ink truncate">{t('addcar.title')}</h1>
                </div>
                <button
                  onClick={createVehicleFromForm}
                  className="text-sm font-bold text-brand"
                >
                  {t('common.save')}
                </button>
              </div>

              <div className="px-5">
                <div className="rounded-3xl bg-white border border-[#E1EAF1] p-4">
                  <div className="relative h-32 rounded-2xl overflow-hidden flex items-end justify-center pb-1.5" style={{ background: 'linear-gradient(135deg, #DCEAF3, #FFE6D5)' }}>
                    <svg width="170" height="80" viewBox="0 0 170 80">
                      <path d="M14 56 Q24 36 56 32 L114 32 Q140 32 152 48 L156 56 Z" fill="#F26B1F"/>
                      <path d="M60 32 L72 18 L100 18 L114 32 Z" fill="#F26B1F" opacity="0.7"/>
                      <circle cx="44" cy="58" r="10" fill="#0E2233"/>
                      <circle cx="44" cy="58" r="4" fill="white"/>
                      <circle cx="128" cy="58" r="10" fill="#0E2233"/>
                      <circle cx="128" cy="58" r="4" fill="white"/>
                    </svg>
                    <button className="absolute top-2.5 start-2.5 bg-white/85 backdrop-blur px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-ink flex items-center gap-1.5">
                      <Plus className="w-3 h-3" />
                      <span>{t('addcar.change_color')}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('addcar.section_info')}</p>
                  <div className="space-y-2">
                    <DesignField label={t('reports.make')} value={addCarForm.make} onChange={(v) => updateAddCarForm('make', v)} placeholder="Toyota" />
                    <DesignField label={t('reports.model')} value={addCarForm.model} onChange={(v) => updateAddCarForm('model', v)} placeholder="Camry" />
                    <div className="grid grid-cols-2 gap-2">
                      <DesignField label={t('reports.year')} value={addCarForm.year} onChange={(v) => updateAddCarForm('year', v)} type="number" placeholder="2022" />
                      <DesignField label={t('common.mileage')} value={addCarForm.mileage} onChange={(v) => updateAddCarForm('mileage', v)} type="number" placeholder="212450" />
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('addcar.section_nickname')}</p>
                  <DesignField label={t('reports.color')} value={addCarForm.name} onChange={(v) => updateAddCarForm('name', v)} placeholder={t('addcar.nickname_hint')} />
                </div>

                <div className="mt-5">
                  <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('addcar.section_fuel')}</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: '95', label: t('addcar.fuel_95'), active: true },
                      { key: '91', label: t('addcar.fuel_91') },
                      { key: 'diesel', label: t('addcar.fuel_diesel') },
                      { key: 'ev', label: t('addcar.fuel_ev') },
                    ].map((c) => (
                      <span
                        key={c.key}
                        className={cn(
                          'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold',
                          c.active ? 'bg-brand text-white' : 'bg-[#FFE6D5] text-brand',
                        )}
                      >
                        {c.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="h-24" />
              </div>

              <div className="fixed bottom-6 inset-x-4 max-w-[430px] mx-auto px-1">
                <button
                  onClick={createVehicleFromForm}
                  className="w-full rounded-2xl bg-brand text-white px-5 py-4 text-[15px] font-bold tracking-tight shadow-[0_12px_28px_rgba(242,107,31,0.35)] flex items-center justify-center gap-2"
                >
                  <span>{t('addcar.continue')}</span>
                  <ArrowLeft className="w-4 h-4 -scale-x-100" />
                </button>
              </div>
            </motion.div>
          )}

          {activePage === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-5"
            >
              {(() => {
                const firstName = user?.displayName?.trim().split(/\s+/)[0] ?? t('dashboard.guest_name');
                const todayLabel = new Date().toLocaleDateString(dateLocale, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                });
                return (
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => setActivePage('alerts')}
                      aria-label={t('nav.alerts')}
                      className="relative w-10 h-10 rounded-full bg-white border border-[#E1EAF1] shadow-[0_2px_8px_rgba(14,34,51,0.04)] flex items-center justify-center"
                    >
                      <Bell className="w-4 h-4 text-ink" />
                      {alertCount > 0 && (
                        <span className="absolute -top-1 -end-1 min-w-[16px] h-[16px] px-1 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center tabular leading-none">
                          {alertCount > 9 ? '9+' : alertCount}
                        </span>
                      )}
                    </button>
                    <div className="text-end min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#4A6378] truncate">{todayLabel}</p>
                      <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-ink truncate">
                        {t('dashboard.greeting', { name: firstName })} <span aria-hidden="true">👋</span>
                      </h1>
                    </div>
                  </div>
                );
              })()}

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
              ) : selectedVehicle ? (
                <>
                  {/* Hero card */}
                  <div className="relative overflow-hidden rounded-[28px] bg-ink text-white shadow-[0_18px_38px_rgba(14,34,51,0.18)]">
                    <div className="px-5 pt-5 pb-7">
                      <div className="flex items-start justify-between gap-3">
                        {vehicles.length > 1 ? (
                          <button
                            onClick={() => {
                              const idx = vehicles.findIndex((v) => v.id === selectedVehicle.id);
                              setSelectedVehicle(vehicles[(idx + 1) % vehicles.length]);
                            }}
                            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 transition rounded-full px-3 py-1.5 text-xs font-bold"
                          >
                            <ChevronRight className="w-3 h-3" />
                            <span>{t('dashboard.switch')}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowSettings(true)}
                            className="bg-white/10 hover:bg-white/15 transition rounded-full p-2"
                            aria-label={t('common.settings')}
                          >
                            <SettingsIcon className="w-4 h-4" />
                          </button>
                        )}
                        <div className="text-end min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                            {t('dashboard.current_car')}
                          </p>
                          <h3 className="mt-1 text-2xl font-extrabold tracking-tight truncate">
                            {selectedVehicle.name}
                            {selectedVehicle.year ? ` ${selectedVehicle.year}` : ''}
                          </h3>
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              onClick={() => setActivePage('cars')}
                              className="bg-white/10 hover:bg-white/15 transition rounded-full px-3 py-1 text-[10px] font-bold"
                            >
                              {t('dashboard.my_cars')}
                            </button>
                            <span className="bg-white/10 rounded-full px-3 py-1 text-[10px] font-bold tabular">
                              {calculateOilLife(
                                selectedVehicle.currentMileage,
                                selectedVehicle.lastOilChangeMileage || 0,
                                selectedVehicle.oilIntervalKm,
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="h-6 bg-brand" />
                    <div className="px-5 pt-4 pb-5">
                      {(() => {
                        const vEvents = events.filter((e) => e.vehicleId === selectedVehicle.id);
                        const latestEvent = vEvents.reduce<TimelineEvent | null>((acc, e) => {
                          if (!acc) return e;
                          return new Date(e.date).getTime() > new Date(acc.date).getTime() ? e : acc;
                        }, null);
                        const hasReading = vEvents.length > 0 || selectedVehicle.currentMileage > 0;
                        if (!hasReading) {
                          return (
                            <div className="flex items-center justify-between gap-3">
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-brand text-white rounded-full px-4 py-2 text-xs font-bold flex items-center gap-2 shadow-[0_8px_18px_rgba(242,107,31,0.38)]"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                {t('dashboard.scan_first')}
                              </button>
                              <div className="text-end">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                                  {t('dashboard.current_odometer')}
                                </p>
                                <p className="mt-1 text-2xl font-extrabold tracking-tight text-white/40">
                                  {t('dashboard.awaiting_first_reading')}
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return (
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 text-[11px] text-white/60 mt-1.5">
                              <Camera className="w-3.5 h-3.5" />
                              {latestEvent ? (
                                <span>
                                  {t('dashboard.updated_ago', {
                                    time: formatDistanceToNow(new Date(latestEvent.date), {
                                      addSuffix: true,
                                      locale: lang === 'ar' ? arLocale : enLocale,
                                    }),
                                  })}
                                </span>
                              ) : (
                                <span>{t('dashboard.never_updated')}</span>
                              )}
                            </div>
                            <div className="text-end">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                                {t('dashboard.current_odometer')}
                              </p>
                              <p
                                dir="ltr"
                                className="mt-1 text-4xl font-extrabold tabular tracking-tight leading-none text-end"
                              >
                                <CountUp
                                  value={selectedVehicle.currentMileage}
                                  format={(n) => new Intl.NumberFormat('en-US').format(n)}
                                />
                                <span className="ms-2 text-xs font-bold text-white/60">{t('common.km_unit')}</span>
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Next maintenance CTA */}
                  {(() => {
                    const cta = getNextCta(selectedVehicle);
                    if (!cta) return null;
                    if (dismissedCtaKeys.has(cta.key)) return null;
                    const isOverdue = cta.state === 'overdue';
                    const label =
                      cta.source === 'oil'
                        ? isOverdue
                          ? t('dashboard.next_oil_overdue', { value: cta.value.toLocaleString() })
                          : t('dashboard.next_oil_in', { value: cta.value.toLocaleString() })
                        : (() => {
                            const lbl = t(`status.${cta.status.kind}`);
                            const tplKey =
                              cta.status.unit === 'km'
                                ? isOverdue
                                  ? 'dashboard.next_status_overdue_km'
                                  : 'dashboard.next_status_in_km'
                                : isOverdue
                                  ? 'dashboard.next_status_overdue_months'
                                  : 'dashboard.next_status_in_months';
                            return t(tplKey, { label: lbl, value: cta.value.toLocaleString() });
                          })();
                    const Icon = cta.source === 'oil' ? Droplets : STATUS_ICONS[cta.status.kind];
                    return (
                      <button
                        onClick={() => setActivePage('alerts')}
                        className="w-full bg-brand text-white rounded-[24px] p-4 flex items-center gap-3 text-start shadow-[0_12px_28px_rgba(242,107,31,0.25)] hover:brightness-95 transition"
                      >
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setDismissedCtaKeys((prev) => {
                              const next = new Set(prev);
                              next.add(cta.key);
                              return next;
                            });
                            toast.success(t('dashboard.snoozed_cta'));
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              setDismissedCtaKeys((prev) => {
                                const next = new Set(prev);
                                next.add(cta.key);
                                return next;
                              });
                              toast.success(t('dashboard.snoozed_cta'));
                            }
                          }}
                          className="shrink-0 bg-white text-brand px-3.5 py-2 rounded-full text-xs font-bold cursor-pointer hover:bg-white/90 transition"
                        >
                          {t('alerts.snooze')}
                        </span>
                        <div className="flex-1 min-w-0 text-end">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-white/80">
                            {t('dashboard.next_maintenance')}
                          </p>
                          <p className="mt-0.5 text-sm font-extrabold truncate">{label}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5" />
                        </div>
                      </button>
                    );
                  })()}

                  {/* Stats: fuel avg only */}
                  {(() => {
                    const { avg, trend } = computeFuelAverage(
                      events.filter((e) => e.vehicleId === selectedVehicle.id),
                    );
                    return (
                      <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(14,34,51,0.04)] text-end">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                          {t('dashboard.fuel_avg')}
                        </p>
                        {avg != null ? (
                          <>
                            <p dir="ltr" className="mt-2 text-2xl font-extrabold tabular leading-none text-end">
                              {avg.toFixed(1)}
                              <span className="ms-1 text-[10px] font-bold text-black/40">{t('dashboard.fuel_avg_unit')}</span>
                            </p>
                            {trend != null && Math.abs(trend) >= 1 && (
                              <p className={cn('mt-2 inline-flex items-center gap-1 text-[11px] font-bold',
                                trend > 0 ? 'text-success' : 'text-danger')}>
                                {trend > 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {trend > 0
                                  ? t('dashboard.improvement', { value: trend.toFixed(1) })
                                  : t('dashboard.regression', { value: Math.abs(trend).toFixed(1) })}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="mt-2 text-xs text-black/40 leading-snug">{t('dashboard.fuel_avg_unavailable')}</p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Latest activities */}
                  {(() => {
                    const recent = events
                      .filter((e) => e.vehicleId === selectedVehicle.id)
                      .slice(0, 3);
                    if (recent.length === 0) return null;
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => setActivePage('timeline')}
                            className="text-brand text-xs font-bold"
                          >
                            {t('common.show_all')}
                          </button>
                          <h4 className="text-lg font-extrabold">{t('dashboard.recent_activity')}</h4>
                        </div>
                        <div className="space-y-2">
                          {recent.map((event) => {
                            const tone = EVENT_TONE[event.type] ?? EVENT_TONE[ServiceType.OTHER];
                            const Icon = eventIcon(event.type);
                            const subtitle =
                              event.station || event.serviceCenter || event.location?.address ||
                              new Date(event.date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short' });
                            const ago = formatDistanceToNow(new Date(event.date), {
                              addSuffix: true,
                              locale: lang === 'ar' ? arLocale : enLocale,
                            });
                            return (
                              <div key={event.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-[0_2px_8px_rgba(14,34,51,0.04)]">
                                <div className="shrink-0 text-end">
                                  {event.amount != null && (
                                    <p className="text-sm font-extrabold tabular whitespace-nowrap">
                                      {event.amount}
                                      <span className="ms-1 text-[10px] text-black/40">{t('timeline.unit_riyal')}</span>
                                    </p>
                                  )}
                                  <p className="text-[10px] text-black/40 whitespace-nowrap mt-0.5">{ago}</p>
                                </div>
                                <div className="flex-1 min-w-0 text-end">
                                  <p className="text-sm font-bold truncate">{serviceLabel(event.type)}</p>
                                  <p className="text-xs text-black/40 truncate mt-0.5">{subtitle}</p>
                                </div>
                                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', tone.bg, tone.fg)}>
                                  <Icon className="w-5 h-5" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : null}
            </motion.div>
          )}

          {activePage === 'cars' && (
            <motion.div
              key="cars"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {(() => {
                const totalKm = vehicles.reduce((acc, v) => acc + (v.currentMileage || 0), 0);
                const tones = vehicles.map((v) => {
                  const cta = getNextCta(v);
                  if (!cta) return 'ok' as const;
                  return cta.state === 'overdue' ? 'brand' : 'warn' as const;
                });
                const toneColor = (k: 'brand' | 'ok' | 'warn') =>
                  k === 'brand' ? '#F26B1F' : k === 'ok' ? '#3F7A40' : '#B96A1E';
                const toneBg = (k: 'brand' | 'ok' | 'warn') =>
                  k === 'brand' ? 'bg-[#FFE6D5]' : k === 'ok' ? 'bg-[#E2EFE3]' : 'bg-[#FBEFE0]';

                return (
                  <>
                    <div className="flex items-start justify-between gap-3 pb-2">
                      <button
                        onClick={handleAddVehicle}
                        className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center shadow-[0_8px_18px_rgba(242,107,31,0.38)]"
                        aria-label={t('cars.add_first')}
                      >
                        <Plus className="w-5 h-5" strokeWidth={2.4} />
                      </button>
                      <h1 className="text-3xl font-extrabold tracking-tight text-end">{t('cars.title')}</h1>
                    </div>

                    {vehicles.length > 0 && (
                      <div className="bg-white rounded-2xl border border-[#E1EAF1] px-3.5 py-2.5 flex items-center justify-between">
                        <button className="text-xs font-semibold text-brand">{t('cars.sort')}</button>
                        <p className="text-xs text-[#4A6378] text-end">
                          {vehicles.length === 1
                            ? t('cars.counter_one', { total: totalKm.toLocaleString() })
                            : t('cars.counter', { count: vehicles.length, total: totalKm.toLocaleString() })}
                        </p>
                      </div>
                    )}

                    {vehicles.length === 0 ? (
                      <div className="bg-white rounded-[28px] border border-[#E1EAF1] p-10 text-center space-y-3">
                        <Car className="w-12 h-12 text-black/20 mx-auto" />
                        <p className="text-sm text-black/40">{t('cars.empty')}</p>
                        <button
                          onClick={handleAddVehicle}
                          className="inline-flex items-center gap-2 rounded-full bg-brand text-white px-4 py-2 text-xs font-bold"
                        >
                          <Plus className="w-4 h-4" />
                          {t('cars.add_first')}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {vehicles.map((v, i) => {
                          const tone = tones[i];
                          const cta = getNextCta(v);
                          const statusLabel = cta
                            ? cta.source === 'oil'
                              ? cta.state === 'overdue'
                                ? t('dashboard.next_oil_overdue', { value: cta.value.toLocaleString() })
                                : t('dashboard.next_oil_in', { value: cta.value.toLocaleString() })
                              : (() => {
                                  const lbl = t(`status.${cta.status.kind}`);
                                  const tplKey =
                                    cta.status.unit === 'km'
                                      ? cta.state === 'overdue' ? 'dashboard.next_status_overdue_km' : 'dashboard.next_status_in_km'
                                      : cta.state === 'overdue' ? 'dashboard.next_status_overdue_months' : 'dashboard.next_status_in_months';
                                  return t(tplKey, { label: lbl, value: cta.value.toLocaleString() });
                                })()
                            : v.currentMileage > 0 ? t('cars.status_ok') : t('cars.status_no_data');

                          return (
                            <button
                              key={v.id}
                              onClick={() => {
                                setSelectedVehicle(v);
                                setActivePage('car-details');
                              }}
                              className="w-full text-end bg-white rounded-[22px] border border-[#E1EAF1] p-3.5"
                            >
                              <div className={cn('relative h-28 rounded-2xl overflow-hidden mb-3 flex items-end justify-center pb-1.5', toneBg(tone))}>
                                {tone === 'brand' && (
                                  <div className="absolute inset-x-0 top-[55%] h-5 bg-brand" />
                                )}
                                <svg width="160" height="80" viewBox="0 0 160 80" className="relative z-[1]">
                                  <path d="M14 56 Q24 36 56 32 L104 32 Q130 32 142 48 L146 56 Z" fill={toneColor(tone)}/>
                                  <path d="M60 32 L70 18 L96 18 L104 32 Z" fill={toneColor(tone)} opacity="0.7"/>
                                  <circle cx="40" cy="58" r="10" fill="#0E2233"/>
                                  <circle cx="40" cy="58" r="4" fill="white"/>
                                  <circle cx="118" cy="58" r="10" fill="#0E2233"/>
                                  <circle cx="118" cy="58" r="4" fill="white"/>
                                </svg>
                                <span
                                  className="absolute top-2.5 end-2.5 text-[10px] font-bold tracking-widest uppercase bg-white/85 backdrop-blur-sm px-2.5 py-1 rounded-full"
                                  style={{ color: toneColor(tone) }}
                                >
                                  {v.name}
                                </span>
                              </div>

                              <div className="flex items-start justify-between gap-2">
                                <span
                                  className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap', toneBg(tone))}
                                  style={{ color: toneColor(tone) }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: toneColor(tone) }} />
                                  {statusLabel}
                                </span>
                                <div className="min-w-0 text-end">
                                  <p className="text-sm font-bold truncate">
                                    {v.make || ''} {v.model || ''}{' '}
                                    {v.year && <span className="tabular text-[#4A6378] font-semibold">{v.year}</span>}
                                  </p>
                                  <p className="tabular text-xs text-[#4A6378] mt-0.5">
                                    {(v.currentMileage || 0).toLocaleString()} {t('common.km_unit')}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                );
              })()}
            </motion.div>
          )}

          {activePage === 'car-details' && selectedVehicle && (
            <motion.div
              key="car-details"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {(() => {
                const v = selectedVehicle;
                const vEvents = events.filter((e) => e.vehicleId === v.id);
                const fuels = vEvents
                  .filter((e) => e.type === ServiceType.FUEL && e.liters && Number.isFinite(e.mileage))
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const { avg } = computeFuelAverage(vEvents);

                const now = new Date();
                const monthBuckets: { km: number; liters: number; label: string }[] = [];
                for (let i = 5; i >= 0; i--) {
                  const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                  monthBuckets.push({
                    km: 0,
                    liters: 0,
                    label: d.toLocaleDateString(dateLocale, { month: 'short' }).slice(0, 3),
                  });
                }
                const inSameMonth = (a: Date, b: Date) =>
                  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
                for (let i = 1; i < fuels.length; i++) {
                  const prev = fuels[i - 1];
                  const cur = fuels[i];
                  const dKm = cur.mileage - prev.mileage;
                  if (dKm <= 0 || !cur.liters) continue;
                  const curDate = new Date(cur.date);
                  for (let m = 0; m < 6; m++) {
                    const md = new Date(now.getFullYear(), now.getMonth() - (5 - m), 1);
                    if (inSameMonth(curDate, md)) {
                      monthBuckets[m].km += dKm;
                      monthBuckets[m].liters += cur.liters;
                      break;
                    }
                  }
                }
                const monthAvgs = monthBuckets.map((b) => (b.km > 0 ? (b.liters / b.km) * 100 : null));
                const maxFuel = Math.max(10, ...monthAvgs.filter((x): x is number => x != null));

                const startOfYear = new Date(now.getFullYear(), 0, 1);
                const yearEvents = vEvents.filter((e) => new Date(e.date) >= startOfYear);
                const distanceThisYear = (() => {
                  const ms = yearEvents.map((e) => e.mileage).filter((m) => Number.isFinite(m));
                  if (ms.length < 2) return 0;
                  return Math.max(...ms) - Math.min(...ms);
                })();
                const totalSpend = vEvents.reduce((acc, e) => acc + (e.amount ?? 0), 0);

                const catSums = {
                  fuel: 0,
                  service: 0,
                  tires: 0,
                  other: 0,
                };
                vEvents.forEach((e) => {
                  const a = e.amount ?? 0;
                  if (e.type === ServiceType.FUEL) catSums.fuel += a;
                  else if (e.type === ServiceType.TIRES) catSums.tires += a;
                  else if (
                    e.type === ServiceType.OIL_CHANGE ||
                    e.type === ServiceType.MAINTENANCE ||
                    e.type === ServiceType.BATTERY ||
                    e.type === ServiceType.PARTS
                  )
                    catSums.service += a;
                  else catSums.other += a;
                });
                const catTotal = catSums.fuel + catSums.service + catSums.tires + catSums.other;
                const pct = (n: number) => (catTotal > 0 ? Math.round((n / catTotal) * 100) : 0);

                return (
                  <>
                    <div className="flex items-start justify-between gap-3 pb-2">
                      <button
                        onClick={() => setActivePage('cars')}
                        className="w-10 h-10 rounded-full bg-white border border-[#E1EAF1] flex items-center justify-center"
                        aria-label="back"
                      >
                        <ChevronRight className="w-4 h-4 text-ink" />
                      </button>
                      <div className="text-end min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4A6378]">{t('cardetails.title_sub')}</p>
                        <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight truncate">
                          {v.make || v.name} {v.model || ''}{' '}
                          {v.year && <span className="tabular text-[#4A6378] font-semibold">{v.year}</span>}
                        </h1>
                      </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-[#E1EAF1] p-1 flex gap-1.5">
                      {[t('cardetails.tab_details'), t('cardetails.tab_stats'), t('cardetails.tab_history')].map((label, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            if (i === 2) {
                              setActivePage('timeline');
                            }
                          }}
                          className={cn(
                            'flex-1 py-2 rounded-xl text-xs font-semibold transition',
                            i === 1 ? 'bg-ink text-white' : 'text-[#4A6378] hover:text-ink',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="bg-white rounded-[22px] border border-[#E1EAF1] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <span className="bg-[#E2EFE3] text-success px-2.5 py-1 rounded-full text-[11px] font-bold tabular">
                          ▼ 6%
                        </span>
                        <div className="text-end">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">
                            {t('cardetails.consumption_6m')}
                          </p>
                          {avg != null ? (
                            <p dir="ltr" className="mt-1 text-end">
                              <span className="text-4xl font-extrabold tabular tracking-tight">{avg.toFixed(1)}</span>
                              <span className="ms-1 text-xs font-bold text-[#4A6378]">{t('dashboard.fuel_avg_unit')}</span>
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-[#4A6378]">{t('dashboard.fuel_avg_unavailable')}</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex items-end justify-between gap-1.5 h-24">
                        {monthBuckets.map((b, i) => {
                          const value = monthAvgs[i];
                          const h = value != null ? (value / maxFuel) * 70 + 14 : 14;
                          const isLast = i === monthBuckets.length - 1 && value != null;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                              <div className="w-full relative" style={{ height: h }}>
                                {isLast && (
                                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-brand tabular">
                                    {value!.toFixed(1)}
                                  </span>
                                )}
                                <div
                                  className={cn('absolute inset-0 rounded-md', isLast ? 'bg-brand' : value != null ? 'bg-[#DCEAF3]' : 'bg-[#EEF3F7]')}
                                />
                              </div>
                              <span className="text-[10px] font-semibold text-[#7B92A6]">{b.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-white rounded-[18px] border border-[#E1EAF1] p-3.5 text-end">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">
                          {t('cardetails.distance_label')}
                        </p>
                        <p dir="ltr" className="mt-1 text-end">
                          <span className="text-xl font-extrabold tabular">{distanceThisYear.toLocaleString()}</span>
                          <span className="ms-1 text-[10px] font-bold text-[#4A6378]">{t('common.km_unit')}</span>
                        </p>
                        <p className="text-[10px] text-[#7B92A6] mt-1">{t('cardetails.distance_sub')}</p>
                      </div>
                      <div className="bg-white rounded-[18px] border border-[#E1EAF1] p-3.5 text-end">
                        <p className="text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">
                          {t('cardetails.spend_label')}
                        </p>
                        <p className="mt-1 text-end">
                          <span className="text-xl font-extrabold tabular">{totalSpend.toLocaleString()}</span>
                          <span className="ms-1 text-[10px] font-bold text-[#4A6378]">{t('timeline.unit_riyal')}</span>
                        </p>
                        <p className="text-[10px] text-[#7B92A6] mt-1">{t('cardetails.spend_sub')}</p>
                      </div>
                    </div>

                    <div className="bg-white rounded-[22px] border border-[#E1EAF1] p-4">
                      <h3 className="text-sm font-bold text-end mb-3">{t('cardetails.breakdown_title')}</h3>
                      {catTotal > 0 ? (
                        <>
                          <div dir="ltr" className="flex h-3.5 rounded-full overflow-hidden mb-3">
                            <div style={{ width: `${pct(catSums.fuel)}%`, background: '#F26B1F' }} />
                            <div style={{ width: `${pct(catSums.service)}%`, background: '#1F3A8A' }} />
                            <div style={{ width: `${pct(catSums.tires)}%`, background: '#3F7A40' }} />
                            <div style={{ width: `${pct(catSums.other)}%`, background: '#4A6378' }} />
                          </div>
                          <div className="space-y-2">
                            {[
                              { c: '#F26B1F', n: t('cardetails.cat_fuel'), v: catSums.fuel, p: pct(catSums.fuel) },
                              { c: '#1F3A8A', n: t('cardetails.cat_service'), v: catSums.service, p: pct(catSums.service) },
                              { c: '#3F7A40', n: t('cardetails.cat_tires'), v: catSums.tires, p: pct(catSums.tires) },
                              { c: '#4A6378', n: t('cardetails.cat_other'), v: catSums.other, p: pct(catSums.other) },
                            ].map((r) => (
                              <div key={r.n} className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-mono">
                                  <span className="tabular text-[11px] text-[#7B92A6]">{r.p}%</span>
                                  <span className="tabular text-sm font-bold">
                                    {r.v.toLocaleString()} {t('timeline.unit_riyal')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold">{r.n}</span>
                                  <span className="w-2 h-2 rounded-full" style={{ background: r.c }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-[#7B92A6] text-end">{t('cardetails.no_data')}</p>
                      )}
                    </div>
                  </>
                );
              })()}
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
              {(() => {
                const urgencyRank: Record<StatusState, number> = { overdue: 0, soon: 1, ok: 2 };
                const all: AlertEntry[] = [];
                vehicles.forEach((v) => {
                  getMaintenanceStatuses(v).forEach((s) => {
                    if (snoozedAlerts.has(snoozeKey(v.id, s.kind))) return;
                    all.push({ vehicle: v, status: s });
                  });
                });
                all.sort((a, b) => urgencyRank[a.status.state] - urgencyRank[b.status.state]);

                const active = all.filter((a) => a.status.state !== 'ok');
                const later = all.filter((a) => a.status.state === 'ok');
                const featured = active[0] ?? null;
                const upcoming = active.slice(1);

                return (
                  <>
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-3xl font-bold tracking-tight">{t('alerts.title')}</h2>
                      {active.length > 0 && (
                        <span className="text-xs font-bold text-black/50 whitespace-nowrap">
                          {t('alerts.count', { count: active.length })}
                        </span>
                      )}
                    </div>

                    {featured ? (
                      <FeaturedAlertCard
                        entry={featured}
                        onMarkDone={handleMarkReminderDone}
                        onSnooze={handleSnoozeReminder}
                      />
                    ) : null}

                    {!featured && later.length === 0 ? (
                      <div className="glass-dark p-12 rounded-[32px] text-center space-y-3">
                        <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
                        <p className="text-lg font-bold">{t('alerts.all_good_title')}</p>
                        <p className="text-sm text-black/40">{t('alerts.all_good_desc')}</p>
                      </div>
                    ) : null}

                    {upcoming.length > 0 && (
                      <section className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-black/40">
                          {t('alerts.section_upcoming')}
                        </h3>
                        <div className="space-y-2">
                          {upcoming.map((entry) => (
                            <AlertCompactRow
                              key={`${entry.vehicle.id}:${entry.status.kind}`}
                              entry={entry}
                              onMarkDone={handleMarkReminderDone}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {later.length > 0 && (
                      <section className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-black/40">
                          {t('alerts.section_later')}
                        </h3>
                        <div className="space-y-2">
                          {later.map((entry) => (
                            <AlertCompactRow
                              key={`${entry.vehicle.id}:${entry.status.kind}`}
                              entry={entry}
                              onMarkDone={handleMarkReminderDone}
                            />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                );
              })()}
            </motion.div>
          )}

          {activePage === 'camera' && (
            <motion.div
              key="camera"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative -mx-4 -mt-12 min-h-screen bg-[#0E0C0A] text-white overflow-hidden"
              style={{
                backgroundImage:
                  'radial-gradient(120% 70% at 50% 42%, #2a2520 0%, #0E0C0A 60%), repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 2px, transparent 2px 6px)',
              }}
            >
              <div className="absolute top-[28%] inset-x-[8%] h-56 rounded-3xl bg-gradient-to-b from-[#1a1410] to-[#2a2118] opacity-80" />

              <div className="relative pt-14 px-5 flex items-center justify-between gap-3">
                <button
                  onClick={() => setActivePage('dashboard')}
                  className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center"
                  aria-label="close"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
                <p className="flex-1 text-center text-base font-semibold">{t('capture.title')}</p>
                <span className="w-9" />
              </div>

              <div className="relative mt-8 flex justify-center gap-2">
                {[
                  { k: 'odometer', label: t('capture.mode_odometer'), active: true },
                  { k: 'receipt', label: t('capture.mode_receipt') },
                  { k: 'tire', label: t('capture.mode_tire') },
                ].map((m) => (
                  <span
                    key={m.k}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-semibold',
                      m.active ? 'bg-white text-ink' : 'bg-white/15 text-white',
                    )}
                  >
                    {m.label}
                  </span>
                ))}
              </div>

              <div className="relative mt-14 mx-10 h-32 rounded-2xl">
                {[
                  'top-0 start-0 border-t-[3px] border-s-[3px] rounded-tl-2xl',
                  'top-0 end-0 border-t-[3px] border-e-[3px] rounded-tr-2xl',
                  'bottom-0 start-0 border-b-[3px] border-s-[3px] rounded-bl-2xl',
                  'bottom-0 end-0 border-b-[3px] border-e-[3px] rounded-br-2xl',
                ].map((cls, i) => (
                  <div key={i} className={cn('absolute w-8 h-8 border-brand', cls)} />
                ))}
                <div className="absolute inset-3 rounded-lg bg-[#1a1410] flex items-center justify-center">
                  <span
                    className="font-mono text-5xl font-extrabold tracking-wider text-[#FFB07A]"
                    style={{ textShadow: '0 0 14px rgba(242, 107, 31, 0.5)' }}
                  >
                    {scanPreview ? '212,450' : '— — —'}
                  </span>
                </div>
                <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-brand/80 to-transparent" />
              </div>

              <div className="relative mt-6 text-center">
                <p className="text-sm text-white/65">
                  {scanning ? t('camera.scanning') : t('capture.detected_ok')}
                </p>
              </div>

              <div className="absolute bottom-7 inset-x-0 flex items-center justify-center gap-7 px-7" dir="ltr">
                <button
                  onClick={() => setActivePage('timeline')}
                  className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center"
                  aria-label="history"
                >
                  <History className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={scanning}
                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center disabled:opacity-50"
                  aria-label="capture"
                >
                  <span className="w-16 h-16 rounded-full bg-brand" />
                </button>
                <button
                  onClick={() => setActivePage('cars')}
                  className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center"
                  aria-label="cars"
                >
                  <Car className="w-5 h-5 text-white" />
                </button>
              </div>
            </motion.div>
          )}

          {activePage === 'timeline' && (
            <motion.div
              key="timeline"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-5"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => runReport(selectedVehicle)}
                  disabled={reportBusy || !selectedVehicle}
                  className="w-10 h-10 rounded-full bg-white border border-[#E1EAF1] shadow-[0_2px_8px_rgba(14,34,51,0.04)] flex items-center justify-center disabled:opacity-50"
                  aria-label={t('reports.title')}
                >
                  <Share2 className="w-4 h-4 text-black/60" />
                </button>
                <div className="text-end min-w-0 flex-1">
                  {selectedVehicle && (
                    <p className="text-xs font-bold text-black/40 truncate">
                      {selectedVehicle.name}
                      {selectedVehicle.year ? ` · ${selectedVehicle.year}` : ''}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-2 mt-0.5">
                    {vehicles.length > 1 && (
                      <button
                        onClick={() => {
                          if (!selectedVehicle) {
                            setSelectedVehicle(vehicles[0]);
                            return;
                          }
                          const idx = vehicles.findIndex((v) => v.id === selectedVehicle.id);
                          const next = vehicles[(idx + 1) % vehicles.length];
                          setSelectedVehicle(next);
                        }}
                        className="w-7 h-7 rounded-full bg-black/5 flex items-center justify-center hover:bg-black/10 transition"
                        aria-label={t('alerts.open_vehicle')}
                      >
                        <ChevronLeft className="w-4 h-4 text-black/60" />
                      </button>
                    )}
                    <h2 className="text-2xl font-extrabold tracking-tight truncate">{t('timeline.title')}</h2>
                  </div>
                </div>
              </div>

              {!selectedVehicle ? (
                <div className="glass-dark p-12 rounded-[32px] text-center text-sm text-black/40">
                  {t('timeline.no_vehicle')}
                </div>
              ) : (
                <>
                  <div className="flex gap-2 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none">
                    {([
                      { id: 'all', label: t('timeline.filter_all'), count: timelineData.counts.all, idle: 'bg-black/5 text-ink' },
                      { id: 'fuel', label: t('timeline.filter_fuel'), count: timelineData.counts.fuel, idle: 'bg-brand/10 text-brand' },
                      { id: 'service', label: t('timeline.filter_service'), count: timelineData.counts.service, idle: 'bg-sky-500/10 text-sky-600' },
                      { id: 'inspection', label: t('timeline.filter_inspection'), count: timelineData.counts.inspection, idle: 'bg-success/10 text-success' },
                    ] as const).map((f) => {
                      const active = timelineFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setTimelineFilter(f.id)}
                          className={cn(
                            'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition',
                            active ? 'bg-ink text-white' : f.idle,
                          )}
                        >
                          {f.label} · {f.count}
                        </button>
                      );
                    })}
                  </div>

                  <div className="bg-white rounded-2xl p-5 flex items-start justify-between gap-3 shadow-[0_2px_8px_rgba(14,34,51,0.04)]">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                        {t('timeline.month_spend_label')}
                      </p>
                      <p className="text-2xl font-extrabold tabular mt-1 truncate">
                        {timelineData.monthSpend.toFixed(2)}
                        <span className="text-[10px] text-black/40 ms-1 font-bold">{t('timeline.unit_riyal')}</span>
                      </p>
                    </div>
                    <div className="min-w-0 text-end">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                        {t('timeline.distance_label')}
                      </p>
                      <p className="text-2xl font-extrabold tabular mt-1 truncate">
                        {timelineData.distance.toLocaleString()}
                        <span className="text-[10px] text-black/40 ms-1 font-bold">{t('timeline.unit_km')}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {timelineData.filtered.length === 0 ? (
                      <div className="py-20 text-center text-sm text-black/30">
                        {timelineData.counts.all === 0 ? t('timeline.empty') : t('timeline.empty_filter')}
                      </div>
                    ) : (
                      timelineData.filtered.map((event) => (
                        <EventCardV2
                          key={event.id}
                          event={event}
                          serviceLabel={serviceLabel}
                          dateLocale={dateLocale}
                          onDelete={handleDeleteEvent}
                        />
                      ))
                    )}
                  </div>
                </>
              )}
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
              className="-mx-4 -mt-12 min-h-screen bg-bg-dark pt-14 pb-28"
            >
              {(() => {
                const m = tempEventData?.mileage ?? 0;
                const lastEventMileage = (() => {
                  if (!selectedVehicle) return null;
                  const vEvents = events.filter((e) => e.vehicleId === selectedVehicle.id);
                  if (vEvents.length === 0) return null;
                  const sorted = [...vEvents].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                  return sorted[0].mileage;
                })();
                const diff = lastEventMileage != null ? m - lastEventMileage : null;
                const sinceLast = lastEventMileage != null ? events.find((e) => e.mileage === lastEventMileage) : null;
                const sinceText = sinceLast
                  ? formatDistanceToNow(new Date(sinceLast.date), { addSuffix: true, locale: lang === 'ar' ? arLocale : enLocale })
                  : null;

                return (
                  <div className="px-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-9 h-9 rounded-full bg-white border border-[#E1EAF1] flex items-center justify-center"
                        aria-label="retake"
                      >
                        <X className="w-4 h-4 text-ink" />
                      </button>
                      <div className="text-end min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4A6378]">{t('capture.result_sub')}</p>
                        <h1 className="mt-0.5 text-lg font-extrabold tracking-tight text-ink truncate">{t('capture.result_title')}</h1>
                      </div>
                      <button
                        onClick={() => setActivePage('dashboard')}
                        className="w-9 h-9 rounded-full bg-white border border-[#E1EAF1] flex items-center justify-center"
                        aria-label="close"
                      >
                        <ChevronLeft className="w-4 h-4 text-ink rtl:scale-x-[-1]" />
                      </button>
                    </div>

                    <div className="bg-[#1a1410] rounded-[22px] p-4 relative overflow-hidden">
                      <div
                        className="h-32 rounded-xl flex items-center justify-center relative"
                        style={{ background: 'linear-gradient(180deg, #2a2118 0%, #1a1410 100%)' }}
                      >
                        <span
                          className="font-mono text-4xl font-extrabold tracking-wider text-[#FFB07A]"
                          style={{ textShadow: '0 0 12px rgba(242, 107, 31, 0.4)' }}
                        >
                          {m.toLocaleString()}
                        </span>
                        <span className="absolute top-2.5 start-2.5 bg-brand text-white text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full">
                          OCR · 2.1s
                        </span>
                      </div>
                    </div>

                    <div className="bg-white rounded-[22px] border border-[#E1EAF1] p-4">
                      <p className="text-[11px] font-bold uppercase tracking-widest text-[#4A6378] text-end">
                        {t('capture.detected_number')}
                      </p>
                      <div className="mt-2 flex items-baseline justify-between">
                        <button className="bg-bg-dark text-ink rounded-full px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5">
                          <Plus className="w-3 h-3" />
                          {t('capture.edit_number')}
                        </button>
                        <p dir="ltr" className="text-end">
                          <span className="text-5xl font-extrabold tabular tracking-tight">{m.toLocaleString()}</span>
                          <span className="ms-1 text-xs font-bold text-[#4A6378]">{t('common.km_unit')}</span>
                        </p>
                      </div>
                      {diff != null && diff >= 0 && (
                        <div className="mt-3.5 bg-[#DCEAF3] rounded-xl px-3 py-2.5 flex items-center justify-between">
                          {sinceText && <span className="text-[11px] text-[#4A6378] tabular">{sinceText}</span>}
                          <p className="text-xs text-ink">
                            <span className="text-[#4A6378]">{t('capture.diff_since_last')} </span>
                            <span dir="ltr" className="tabular font-bold">+ {diff.toLocaleString()} {t('common.km_unit')}</span>
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378] text-end">
                        {t('capture.what_to_log')}
                      </p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { key: 'fuel', icon: Fuel, title: t('capture.act_fuel_title'), sub: t('capture.act_fuel_sub'), bg: 'bg-[#FFE6D5]', fg: 'text-brand', active: true, onClick: () => setActivePage('log-fuel') },
                          { key: 'oil', icon: Droplets, title: t('capture.act_oil_title'), sub: t('capture.act_oil_sub'), bg: 'bg-[#DCEAF3]', fg: 'text-[#1F3A8A]', onClick: () => { setServiceForm((s) => ({ ...s, subtype: 'oil' })); setActivePage('log-service'); } },
                          { key: 'service', icon: CheckCircle2, title: t('capture.act_service_title'), sub: t('capture.act_service_sub'), bg: 'bg-[#E2EFE3]', fg: 'text-success', onClick: () => { setServiceForm((s) => ({ ...s, subtype: 'check' })); setActivePage('log-service'); } },
                          { key: 'reading', icon: History, title: t('capture.act_reading_title'), sub: t('capture.act_reading_sub'), bg: 'bg-white', fg: 'text-ink', onClick: () => setActivePage('dashboard') },
                        ].map((o) => (
                          <button
                            key={o.key}
                            onClick={o.onClick}
                            className={cn(
                              'bg-white rounded-2xl p-3.5 text-end flex flex-col items-start gap-2.5',
                              o.active ? 'border-2 border-brand' : 'border border-[#E1EAF1]',
                            )}
                          >
                            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center', o.bg, o.fg)}>
                              <o.icon className="w-5 h-5" />
                            </div>
                            <div className="w-full text-end">
                              <p className="text-sm font-bold">{o.title}</p>
                              <p className="text-[11px] text-[#4A6378] mt-0.5">{o.sub}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}
              <div className="fixed bottom-6 inset-x-4 max-w-[430px] mx-auto px-1 flex gap-2.5">
                <button
                  onClick={() => setActivePage('dashboard')}
                  className="flex-1 rounded-2xl bg-bg-dark text-ink px-5 py-4 text-[15px] font-bold"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => setActivePage('log-fuel')}
                  className="flex-[2] rounded-2xl bg-brand text-white px-5 py-4 text-[15px] font-bold shadow-[0_12px_28px_rgba(242,107,31,0.35)]"
                >
                  {t('capture.continue')}
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
              className="-mx-4 -mt-12 min-h-screen bg-bg-dark pt-14 pb-28"
            >
              {(() => {
                const liters = Number(fuelForm.liters) || 0;
                const price = Number(fuelForm.pricePerLiter) || 0;
                const total = liters * price;
                return (
                  <>
                    <div className="px-5 pb-3 flex items-start justify-between gap-3">
                      <button
                        onClick={() => setActivePage('ocr-result')}
                        className="w-9 h-9 rounded-full bg-white border border-[#E1EAF1] flex items-center justify-center"
                        aria-label="back"
                      >
                        <ChevronLeft className="w-4 h-4 text-ink rtl:scale-x-[-1]" />
                      </button>
                      <div className="text-end min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4A6378]">{t('logfuel.sub')}</p>
                        <h1 className="mt-0.5 text-lg font-extrabold tracking-tight text-ink truncate">{t('logfuel.title')}</h1>
                      </div>
                      <button
                        onClick={() => saveEvent(ServiceType.FUEL, {
                          amount: total > 0 ? total : undefined,
                          liters: liters > 0 ? liters : undefined,
                          station: fuelForm.station.trim() || undefined,
                        })}
                        className="text-sm font-bold text-brand"
                      >
                        {t('common.save')}
                      </button>
                    </div>

                    <div className="px-5">
                      <div className="relative overflow-hidden bg-ink text-white rounded-[22px] p-5">
                        <div className="absolute inset-x-0 top-[58%] h-[18px] bg-brand pointer-events-none" />
                        <div className="relative text-end">
                          <p className="text-[11px] font-bold uppercase tracking-widest text-white/60">{t('logfuel.total_label')}</p>
                          <p dir="ltr" className="mt-1.5 text-end">
                            <span className="text-4xl font-extrabold tabular tracking-tight">{total.toFixed(2)}</span>
                            <span className="ms-2 text-sm font-bold text-white/60">{t('timeline.unit_riyal')}</span>
                          </p>
                          {liters > 0 && price > 0 && (
                            <p className="text-xs text-white/60 mt-1.5">
                              {t('logfuel.total_breakdown', { liters: liters.toString(), price: price.toFixed(2) })}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logfuel.section_details')}</p>
                        <div className="space-y-2">
                          <div className="bg-white rounded-2xl border border-[#E1EAF1] px-3.5 py-2.5 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#FFE6D5] text-brand flex items-center justify-center shrink-0">
                              <Camera className="w-4 h-4" />
                            </div>
                            <div className="flex-1 text-end min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logfuel.field_odometer')}</p>
                              <p className="mt-0.5 text-lg font-bold tabular">{(tempEventData?.mileage ?? 0).toLocaleString()}</p>
                            </div>
                            <span className="text-xs font-semibold text-[#4A6378]">{t('common.km_unit')}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white rounded-2xl border border-[#E1EAF1] px-3.5 py-2.5 text-end">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logfuel.field_quantity')}</p>
                              <div className="mt-0.5 flex items-baseline justify-end gap-1">
                                <input
                                  inputMode="decimal"
                                  value={fuelForm.liters}
                                  onChange={(e) => updateFuelForm('liters', e.target.value)}
                                  placeholder="32"
                                  className="w-full bg-transparent text-lg font-bold tabular outline-none text-end"
                                />
                                <span className="text-xs font-semibold text-[#4A6378]">لتر</span>
                              </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-[#E1EAF1] px-3.5 py-2.5 text-end">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logfuel.field_price')}</p>
                              <div className="mt-0.5 flex items-baseline justify-end gap-1">
                                <input
                                  inputMode="decimal"
                                  value={fuelForm.pricePerLiter}
                                  onChange={(e) => updateFuelForm('pricePerLiter', e.target.value)}
                                  placeholder="3.23"
                                  className="w-full bg-transparent text-lg font-bold tabular outline-none text-end"
                                />
                                <span className="text-xs font-semibold text-[#4A6378]">{t('timeline.unit_riyal')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logfuel.section_grade')}</p>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { key: '95', label: t('addcar.fuel_95') },
                            { key: '91', label: t('addcar.fuel_91') },
                            { key: 'diesel', label: t('addcar.fuel_diesel') },
                          ].map((c) => (
                            <button
                              key={c.key}
                              onClick={() => updateFuelForm('grade', c.key)}
                              className={cn(
                                'inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold',
                                fuelForm.grade === c.key ? 'bg-brand text-white' : 'bg-[#FFE6D5] text-brand',
                              )}
                            >
                              {c.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logfuel.section_station')}</p>
                        <div className="bg-white rounded-2xl border border-[#E1EAF1] px-3.5 py-2.5 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#DCEAF3] text-[#1F3A8A] flex items-center justify-center shrink-0">
                            <Fuel className="w-4 h-4" />
                          </div>
                          <div className="flex-1 text-end min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logfuel.station_label')}</p>
                            <input
                              value={fuelForm.station}
                              onChange={(e) => updateFuelForm('station', e.target.value)}
                              placeholder={t('logfuel.station_placeholder')}
                              className="mt-0.5 w-full bg-transparent text-sm font-semibold outline-none text-end placeholder:text-[#7B92A6] placeholder:font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logfuel.section_note')}</p>
                        <textarea
                          value={eventNotes}
                          onChange={(e) => setEventNotes(e.target.value)}
                          rows={3}
                          placeholder={t('logfuel.note_placeholder')}
                          className="w-full bg-white rounded-2xl border border-[#E1EAF1] px-3.5 py-3 text-sm font-medium outline-none placeholder:text-[#7B92A6] resize-none text-end"
                        />
                      </div>
                      <div className="h-24" />
                    </div>

                    <div className="fixed bottom-6 inset-x-4 max-w-[430px] mx-auto px-1">
                      <button
                        onClick={() => saveEvent(ServiceType.FUEL, {
                          amount: total > 0 ? total : undefined,
                          liters: liters > 0 ? liters : undefined,
                          station: fuelForm.station.trim() || undefined,
                        })}
                        className="w-full rounded-2xl bg-brand text-white px-5 py-4 text-[15px] font-bold tracking-tight shadow-[0_12px_28px_rgba(242,107,31,0.35)] flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('logfuel.save')}</span>
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}

          {activePage === 'log-service' && (
            <motion.div
              key="log-service"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              className="-mx-4 -mt-12 min-h-screen bg-bg-dark pt-14 pb-28"
            >
              {(() => {
                const types: { key: string; icon: typeof Droplets; label: string; mapsTo: ServiceType }[] = [
                  { key: 'oil', icon: Droplets, label: t('logservice.type_oil'), mapsTo: ServiceType.OIL_CHANGE },
                  { key: 'filter', icon: Cog, label: t('logservice.type_filter'), mapsTo: ServiceType.PARTS },
                  { key: 'tires', icon: Disc, label: t('logservice.type_tires'), mapsTo: ServiceType.TIRES },
                  { key: 'check', icon: CheckCircle2, label: t('logservice.type_check'), mapsTo: ServiceType.OTHER },
                  { key: 'electrical', icon: Battery, label: t('logservice.type_electrical'), mapsTo: ServiceType.BATTERY },
                  { key: 'other', icon: Wrench, label: t('logservice.type_other'), mapsTo: ServiceType.MAINTENANCE },
                ];
                const mappedType = types.find((x) => x.key === serviceForm.subtype)?.mapsTo ?? ServiceType.MAINTENANCE;
                const cost = Number(serviceForm.cost) || 0;
                const todayStr = new Date().toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' });

                return (
                  <>
                    <div className="px-5 pb-3 flex items-start justify-between gap-3">
                      <button
                        onClick={() => setActivePage('ocr-result')}
                        className="w-9 h-9 rounded-full bg-white border border-[#E1EAF1] flex items-center justify-center"
                        aria-label="back"
                      >
                        <ChevronLeft className="w-4 h-4 text-ink rtl:scale-x-[-1]" />
                      </button>
                      <div className="text-end min-w-0 flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#4A6378]">{t('logservice.sub')}</p>
                        <h1 className="mt-0.5 text-lg font-extrabold tracking-tight text-ink truncate">{t('logservice.title')}</h1>
                      </div>
                      <button
                        onClick={() => saveEvent(mappedType, {
                          amount: cost > 0 ? cost : undefined,
                          serviceCenter: serviceForm.center.trim() || undefined,
                        })}
                        className="text-sm font-bold text-brand"
                      >
                        {t('common.save')}
                      </button>
                    </div>

                    <div className="px-5">
                      <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logservice.section_type')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {types.map((tp) => {
                          const active = serviceForm.subtype === tp.key;
                          return (
                            <button
                              key={tp.key}
                              onClick={() => updateServiceForm('subtype', tp.key)}
                              className={cn(
                                'rounded-2xl px-2 py-3.5 flex flex-col items-center gap-2 text-xs font-semibold',
                                active ? 'bg-ink text-white' : 'bg-white text-ink border border-[#E1EAF1]',
                              )}
                            >
                              <span
                                className={cn(
                                  'w-9 h-9 rounded-xl flex items-center justify-center',
                                  active ? 'bg-brand text-white' : 'bg-[#DCEAF3] text-[#1F3A8A]',
                                )}
                              >
                                <tp.icon className="w-4 h-4" />
                              </span>
                              <span>{tp.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="mt-4">
                        <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logservice.section_details')}</p>
                        <div className="space-y-2">
                          <div className="bg-white rounded-2xl border border-[#E1EAF1] px-3.5 py-2.5 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#FFE6D5] text-brand flex items-center justify-center shrink-0">
                              <Camera className="w-4 h-4" />
                            </div>
                            <div className="flex-1 text-end min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logfuel.field_odometer')}</p>
                              <p className="mt-0.5 text-lg font-bold tabular">{(tempEventData?.mileage ?? 0).toLocaleString()}</p>
                            </div>
                            <span className="text-xs font-semibold text-[#4A6378]">{t('common.km_unit')}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white rounded-2xl border border-[#E1EAF1] px-3.5 py-2.5 text-end">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logservice.field_cost')}</p>
                              <div className="mt-0.5 flex items-baseline justify-end gap-1">
                                <input
                                  inputMode="decimal"
                                  value={serviceForm.cost}
                                  onChange={(e) => updateServiceForm('cost', e.target.value)}
                                  placeholder="180"
                                  className="w-full bg-transparent text-lg font-bold tabular outline-none text-end"
                                />
                                <span className="text-xs font-semibold text-[#4A6378]">{t('timeline.unit_riyal')}</span>
                              </div>
                            </div>
                            <div className="bg-white rounded-2xl border border-[#E1EAF1] px-3.5 py-2.5 text-end">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logservice.field_date')}</p>
                              <p className="mt-0.5 text-sm font-bold tabular truncate">{todayStr}</p>
                            </div>
                          </div>
                          <div className="bg-white rounded-2xl border border-[#E1EAF1] px-3.5 py-2.5 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#DCEAF3] text-[#1F3A8A] flex items-center justify-center shrink-0">
                              <HomeIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 text-end min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logservice.field_workshop')}</p>
                              <input
                                value={serviceForm.center}
                                onChange={(e) => updateServiceForm('center', e.target.value)}
                                placeholder={t('logservice.workshop_placeholder')}
                                className="mt-0.5 w-full bg-transparent text-sm font-semibold outline-none text-end placeholder:text-[#7B92A6] placeholder:font-medium"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logservice.section_receipt')}</p>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full bg-white rounded-2xl border border-dashed border-[#E1EAF1] px-4 py-4 flex items-center justify-center gap-2.5 text-[#4A6378]"
                        >
                          <Camera className="w-5 h-5" />
                          <span className="text-sm font-semibold">{t('logservice.receipt_cta')}</span>
                        </button>
                      </div>

                      <div className="mt-4">
                        <p className="px-1 pb-2 text-[11px] font-bold uppercase tracking-widest text-[#4A6378]">{t('logservice.section_reminder')}</p>
                        <div className="bg-[#FFE6D5] rounded-2xl p-3.5 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-brand text-white flex items-center justify-center shrink-0">
                            <Bell className="w-4 h-4" />
                          </div>
                          <div className="flex-1 text-end min-w-0">
                            <p className="text-sm font-bold text-ink">{t('logservice.reminder_label')}</p>
                            <p className="text-[11px] text-[#4A6378] mt-0.5">{t('logservice.reminder_sub')}</p>
                          </div>
                          <button
                            onClick={() => setServiceForm((s) => ({ ...s, reminderOn: !s.reminderOn }))}
                            className={cn(
                              'relative w-10 h-6 rounded-full transition shrink-0',
                              serviceForm.reminderOn ? 'bg-brand' : 'bg-[#E1EAF1]',
                            )}
                            aria-pressed={serviceForm.reminderOn}
                          >
                            <span
                              className={cn(
                                'absolute top-1 w-4 h-4 rounded-full bg-white transition',
                                serviceForm.reminderOn ? 'end-1' : 'start-1',
                              )}
                            />
                          </button>
                        </div>
                      </div>
                      <div className="h-24" />
                    </div>

                    <div className="fixed bottom-6 inset-x-4 max-w-[430px] mx-auto px-1">
                      <button
                        onClick={() => saveEvent(mappedType, {
                          amount: cost > 0 ? cost : undefined,
                          serviceCenter: serviceForm.center.trim() || undefined,
                        })}
                        className="w-full rounded-2xl bg-brand text-white px-5 py-4 text-[15px] font-bold tracking-tight shadow-[0_12px_28px_rgba(242,107,31,0.35)] flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t('logservice.save')}</span>
                      </button>
                    </div>
                  </>
                );
              })()}
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
                <p className="text-black/40">
                  {selectedServiceType
                    ? t('service.saw_odometer', { value: formatMileage(tempEventData?.mileage || 0) })
                    : t('service.pick_type')}
                </p>
              </div>

              {!selectedServiceType ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { type: ServiceType.FUEL, bg: 'bg-brand/10' },
                      { type: ServiceType.OIL_CHANGE, bg: 'bg-success/10' },
                      { type: ServiceType.MAINTENANCE, bg: 'bg-warning/10' },
                      { type: ServiceType.TIRES, bg: 'bg-purple-400/10' },
                      { type: ServiceType.BATTERY, bg: 'bg-danger/10' },
                      { type: ServiceType.PARTS, bg: 'bg-sky-500/10' },
                      { type: ServiceType.OTHER, bg: 'bg-black/5' },
                    ].map((s) => {
                      const Icon = serviceIcon(s.type);
                      const color = serviceColor(s.type);
                      return (
                        <button
                          key={s.type}
                          onClick={() => {
                            if (s.type === ServiceType.FUEL) setActivePage('log-fuel');
                            else if (s.type === ServiceType.MAINTENANCE) setActivePage('log-service');
                            else setSelectedServiceType(s.type);
                          }}
                          className="glass-dark p-6 rounded-[32px] flex flex-col items-center gap-3 transition-all active:scale-95 group hover:border-brand/40"
                        >
                          <div
                            className={cn(
                              'w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110',
                              s.bg,
                            )}
                          >
                            <Icon className={cn('w-7 h-7', color)} />
                          </div>
                          <span className="text-sm font-bold">{serviceLabel(s.type)}</span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => {
                      setEventNotes('');
                      setSelectedServiceType(null);
                      setActivePage('dashboard');
                    }}
                    className="w-full text-black/40 font-medium py-4"
                  >
                    {t('service.skip')}
                  </button>
                </>
              ) : (
                <PreviewServiceCard
                  type={selectedServiceType}
                  mileage={tempEventData?.mileage || 0}
                  dateLocale={dateLocale}
                  notes={eventNotes}
                  onNotesChange={setEventNotes}
                  Icon={serviceIcon(selectedServiceType)}
                  iconColor={serviceColor(selectedServiceType)}
                  label={serviceLabel(selectedServiceType)}
                  onCancel={() => {
                    setSelectedServiceType(null);
                    setEventNotes('');
                  }}
                  onAdd={() => saveEvent(selectedServiceType)}
                />
              )}
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

      {!['signin', 'onboarding', 'add-car', 'ocr-result', 'log-fuel', 'log-service', 'service-select'].includes(activePage) && (
        <Navbar activePage={activePage} setActivePage={setActivePage} alertCount={alertCount} />
      )}

      <AnimatePresence>
        {showSettings && selectedVehicle && (
          <VehicleSettings vehicle={selectedVehicle} onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
