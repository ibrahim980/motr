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

export function VehicleSettings({ vehicle, onClose }: Props) {
  const { t } = useI18n();
  const [oilIntervalKm, setOilIntervalKm] = useState(vehicle.oilIntervalKm || 10000);
  const [lastOilChangeMileage, setLastOilChangeMileage] = useState(vehicle.lastOilChangeMileage ?? 0);
  const [batteryDate, setBatteryDate] = useState(toDateInput(vehicle.lastBatteryChangeDate));
  const [batteryMonths, setBatteryMonths] = useState(vehicle.batteryIntervalMonths || 36);
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
        updatedAt: serverTimestamp(),
      };
      if (batteryDate) {
        updates.lastBatteryChangeDate = new Date(batteryDate).toISOString();
      }
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
        className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">{t('settings.title')}</h3>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-black/5 flex items-center justify-center"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          <Field label={t('settings.oil_interval')}>
            <input
              type="number"
              inputMode="numeric"
              min={1000}
              max={100000}
              step={500}
              value={oilIntervalKm}
              onChange={(e) => setOilIntervalKm(Number(e.target.value))}
              className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-brand"
            />
          </Field>

          <Field label={t('settings.last_oil')}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={10000000}
              value={lastOilChangeMileage}
              onChange={(e) => setLastOilChangeMileage(Number(e.target.value))}
              className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-brand"
            />
          </Field>

          <Field label={t('settings.battery_date')}>
            <input
              type="date"
              value={batteryDate}
              onChange={(e) => setBatteryDate(e.target.value)}
              className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-brand"
            />
          </Field>

          <Field label={t('settings.battery_interval')}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={240}
              value={batteryMonths}
              onChange={(e) => setBatteryMonths(Number(e.target.value))}
              className="w-full bg-black/5 border border-black/10 rounded-2xl px-4 py-3 text-sm font-medium outline-none focus:border-brand"
            />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-black/60 mb-1.5">{label}</span>
      {children}
    </label>
  );
}
