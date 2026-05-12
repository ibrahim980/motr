import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMileage(km: number): string {
  return new Intl.NumberFormat('en-US').format(km) + ' KM';
}

export function calculateOilLife(current: number, lastChange: number, interval: number): number {
  const used = current - lastChange;
  const life = 100 - (used / interval) * 100;
  return Math.max(0, Math.min(100, Math.round(life)));
}
