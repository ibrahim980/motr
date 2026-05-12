import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { db } from './lib/firebase';
import { useI18n } from './i18n';
import type { Vehicle } from './types';

interface Props {
  vehicle: Vehicle;
  onClose: () => void;
}

function toDateInput(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function toNumber(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function VehicleSettings({ vehicle, onClose }: Props) {
  const { t } = useI18n();

  // Oil
  const [oilIntervalKm, setOilIntervalKm] = useState(toNumber(vehicle.oilIntervalKm, 10000));
  const [lastOilChangeMileage, setLastOilChangeMileage] = useState(toNumber(vehicle.lastOilChangeMileage, 0));

  // Battery
  const [batteryDate, setBatteryDate] = useState(toDateInput(vehicle.lastBatteryChangeDate));
  const [batteryMonths, setBatteryMonths] = useState(toNumber(vehicle.batteryIntervalMonths, 36));

  // Tires
  const [tireIntervalKm, setTireIntervalKm] = useState(toNumber(vehicle.tireIntervalKm, 60000));
  const [lastTireChangeMileage, setLastTireChangeMileage] = useState(toNumber(vehicle.lastTireChangeMileage, 0));

  // Maintenance
  const [maintenanceDate, setMaintenanceDate] = useState(toDateInput(vehicle.lastMaintenanceDate));
  const [maintenanceMonths, setMaintenanceMonths] = useState(toNumber(vehicle.maintenanceIntervalMonths, 6));

  // Parts
  const [partsDate, setPartsDate] = useState(toDateInput(vehicle.lastPartsDate));
  const [partsMonths, setPartsMonths] = useState(toNumber(vehicle.partsIntervalMonths, 12));

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        oilIntervalKm: Number(oilIntervalKm) || 10000,
        lastOilChangeMileage: Number(lastOilChangeMileage) || 0,
        batteryIntervalMonths: Number(batteryMonths) || 36,
        tireIntervalKm: Number(tireIntervalKm) || 60000,
        lastTireChangeMileage: Number(lastTireChangeMileage) || 0,
        maintenanceIntervalMonths: Number(maintenanceMonths) || 6,
        partsIntervalMonths: Number(partsMonths) || 12,
        updatedAt: serverTimestamp(),
      };
      if (batteryDate) updates.lastBatteryChangeDate = new Date(batteryDate).toISOString();
      if (maintenanceDate) updates.lastMaintenanceDate = new Date(maintenanceDate).toISOString();
      if (partsDate) updates.lastPartsDate = new Date(partsDate).toISOString();

      await updateDoc(doc(db, 'vehicles', vehicle.id), updates);
      toast.success(t('settings.saved'));
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(t('settings.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white w-full max-w-md rounded-3xl shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-3">
          <h3 className="text-xl font-bold">{t('settings.title')}</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-black/5 flex items-center justify-center"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 space-y-6">
          <Section title={t('settings.section.oil')}>
            <NumberField
              label={t('settings.oil_interval')}
              value={oilIntervalKm}
              onChange={setOilIntervalKm}
              min={1000}
              max={100000}
              step={500}
            />
            <NumberField
              label={t('settings.last_oil')}
              value={lastOilChangeMileage}
              onChange={setLastOilChangeMileage}
              min={0}
              max={10000000}
            />
          </Section>

          <Section title={t('settings.section.battery')}>
            <NumberField
              label={t('settings.battery_interval')}
              value={batteryMonths}
              onChange={setBatteryMonths}
              min={1}
              max={240}
            />
            <DateField
              label={t('settings.battery_date')}
              value={batteryDate}
              onChange={setBatteryDate}
            />
          </Section>

          <Section title={t('settings.section.tires')}>
            <NumberField
              label={t('settings.tire_interval')}
              value={tireIntervalKm}
              onChange={setTireIntervalKm}
              min={1000}
              max={500000}
              step={1000}
            />
            <NumberField
              label={t('settings.last_tire')}
              value={lastTireChangeMileage}
              onChange={setLastTireChangeMileage}
              min={0}
              max={10000000}
            />
          </Section>

          <Section title={t('settings.section.maintenance')}>
            <NumberField
              label={t('settings.maintenance_interval')}
              value={maintenanceMonths}
              onChange={setMaintenanceMonths}
              min={1}
              max={240}
            />
            <DateField
              label={t('settings.maintenance_date')}
              value={maintenanceDate}
              onChange={setMaintenanceDate}
            />
          </Section>

          <Section title={t('settings.section.parts')}>
            <NumberField
              label={t('settings.parts_interval')}
              value={partsMonths}
              onChange={setPartsMonths}
              min={1}
              max={240}
            />
            <DateField
              label={t('settings.parts_date')}
              value={partsDate}
              onChange={setPartsDate}
            />
          </Section>
        </div>

        <div className="flex gap-3 p-6 pt-4 border-t border-black/5">
          <button
            onClick={onClose}
            className="flex-1 bg-black/5 border border-black/10 py-3 rounded-2xl font-bold text-sm hover:bg-black/10 transition"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-brand text-white py-3 rounded-2xl font-bold text-sm hover:brightness-95 transition disabled:opacity-60"
          >
            {t('common.save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-bold text-brand mb-3 uppercase tracking-wider">{title}</h4>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-black/60 mb-1.5">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-brand"
      />
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-black/60 mb-1.5">{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-brand"
      />
    </label>
  );
}
