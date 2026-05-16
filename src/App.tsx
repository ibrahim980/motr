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
  TrendingDown
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
    { id: 'dashboard', icon: Car, label: t('nav.vehicles') },
    { id: 'alerts', icon: Bell, label: t('nav.alerts'), badge: alertCount },
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
                              onClick={() => setActivePage('profile')}
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
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 text-[11px] text-white/60 mt-1.5">
                          <Camera className="w-3.5 h-3.5" />
                          <span>
                            {(() => {
                              const d =
                                timestampToDate(selectedVehicle.updatedAt) ||
                                timestampToDate(selectedVehicle.createdAt);
                              if (!d) return t('dashboard.never_updated');
                              return t('dashboard.updated_ago', {
                                time: formatDistanceToNow(d, {
                                  addSuffix: true,
                                  locale: lang === 'ar' ? arLocale : enLocale,
                                }),
                              });
                            })()}
                          </span>
                        </div>
                        <div className="text-end">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                            {t('dashboard.current_odometer')}
                          </p>
                          <p className="mt-1 text-4xl font-extrabold tabular tracking-tight leading-none">
                            <CountUp value={selectedVehicle.currentMileage} />
                            <span className="ms-2 text-xs font-bold text-white/60">{t('common.km_unit')}</span>
                          </p>
                        </div>
                      </div>
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

                  {/* Stats: this month + fuel avg */}
                  {(() => {
                    const { avg, trend } = computeFuelAverage(
                      events.filter((e) => e.vehicleId === selectedVehicle.id),
                    );
                    const fuelCount = timelineData.counts.fuel;
                    const serviceCount = timelineData.counts.service + timelineData.counts.inspection;
                    return (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(14,34,51,0.04)]">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                            {t('dashboard.month_spend')}
                          </p>
                          <p className="mt-2 text-2xl font-extrabold tabular leading-none">
                            {timelineData.monthSpend.toFixed(0)}
                            <span className="ms-1 text-[10px] font-bold text-black/40">{t('timeline.unit_riyal')}</span>
                          </p>
                          <p className="mt-2 text-[11px] text-black/40">
                            {t('dashboard.month_breakdown_fuels', { count: fuelCount })} · {t('dashboard.month_breakdown_services', { count: serviceCount })}
                          </p>
                        </div>
                        <div className="bg-white rounded-2xl p-4 shadow-[0_2px_8px_rgba(14,34,51,0.04)]">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                            {t('dashboard.fuel_avg')}
                          </p>
                          {avg != null ? (
                            <>
                              <p className="mt-2 text-2xl font-extrabold tabular leading-none">
                                {avg.toFixed(1)}
                                <span className="ms-1 text-[10px] font-bold text-black/40">{t('dashboard.fuel_avg_unit')}</span>
                              </p>
                              {trend != null && Math.abs(trend) >= 1 ? (
                                <p className={cn('mt-2 flex items-center gap-1 text-[11px] font-bold',
                                  trend > 0 ? 'text-success' : 'text-danger')}>
                                  {trend > 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                  {trend > 0
                                    ? t('dashboard.improvement', { value: trend.toFixed(1) })
                                    : t('dashboard.regression', { value: Math.abs(trend).toFixed(1) })}
                                </p>
                              ) : (
                                <p className="mt-2 text-[11px] text-black/40">&nbsp;</p>
                              )}
                            </>
                          ) : (
                            <p className="mt-2 text-xs text-black/40 leading-snug">{t('dashboard.fuel_avg_unavailable')}</p>
                          )}
                        </div>
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

      {!['onboarding', 'add-car', 'ocr-result', 'log-fuel', 'log-service', 'service-select'].includes(activePage) && (
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
