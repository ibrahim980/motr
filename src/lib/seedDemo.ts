import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ServiceType } from '../types';

function isoNDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function isoNMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

interface DemoEvent {
  type: ServiceType;
  mileage: number;
  date: string;
  notes?: string;
}

export async function seedDemoData(userId: string): Promise<void> {
  // 1. Create the vehicle (all optional fields filled)
  const vehicleRef = await addDoc(collection(db, 'vehicles'), {
    userId,
    name: 'Ford Raptor',
    make: 'Ford',
    model: 'F-150 Raptor',
    year: 2023,
    color: 'Black',
    currentMileage: 87250,
    lastOilChangeMileage: 82000,
    oilIntervalKm: 10000,
    healthScore: 100,
    lastBatteryChangeDate: isoNMonthsAgo(22),
    batteryIntervalMonths: 24,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 2. Create events spanning the past year
  const events: DemoEvent[] = [
    { type: ServiceType.FUEL, mileage: 87250, date: isoNDaysAgo(2) },
    { type: ServiceType.OIL_CHANGE, mileage: 82000, date: isoNMonthsAgo(3) },
    { type: ServiceType.TIRES, mileage: 75000, date: isoNMonthsAgo(5), notes: 'تركيب 4 إطارات Michelin Defender' },
    { type: ServiceType.MAINTENANCE, mileage: 70000, date: isoNMonthsAgo(7), notes: 'فحص دوري + غيار سوائل' },
    { type: ServiceType.FUEL, mileage: 65000, date: isoNMonthsAgo(8) },
    { type: ServiceType.PARTS, mileage: 60000, date: isoNMonthsAgo(9), notes: 'تغيير فلتر الزيت + فلتر الهواء' },
    { type: ServiceType.BATTERY, mileage: 50000, date: isoNMonthsAgo(22), notes: 'AC Delco — 24 شهر ضمان' },
    { type: ServiceType.FUEL, mileage: 45000, date: isoNMonthsAgo(11) },
    { type: ServiceType.OIL_CHANGE, mileage: 40000, date: isoNMonthsAgo(12) },
    { type: ServiceType.OTHER, mileage: 38000, date: isoNMonthsAgo(13), notes: 'غسيل ودهان حماية' },
  ];

  for (const ev of events) {
    const payload: Record<string, unknown> = {
      userId,
      vehicleId: vehicleRef.id,
      type: ev.type,
      mileage: ev.mileage,
      date: ev.date,
      createdAt: serverTimestamp(),
    };
    if (ev.notes) payload.notes = ev.notes;
    await addDoc(collection(db, 'events'), payload);
  }

  // 3. Touch vehicle's updatedAt so the dashboard "Last update" reads fresh
  await updateDoc(doc(db, 'vehicles', vehicleRef.id), {
    updatedAt: serverTimestamp(),
  });
}
