export enum ServiceType {
  FUEL = 'Fuel',
  OIL_CHANGE = 'Oil Change',
  MAINTENANCE = 'Maintenance',
  TIRES = 'Tires',
  BATTERY = 'Battery',
  PARTS = 'Parts',
  OTHER = 'Other'
}

export interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
  currentMileage: number;
  lastOilChangeMileage?: number;
  oilIntervalKm: number;
  lastBatteryChangeDate?: string;
  batteryIntervalMonths?: number;
  healthScore: number;
  createdAt: any;
  updatedAt: any;
  userId: string;
}

export interface TimelineEvent {
  id: string;
  vehicleId: string;
  userId: string;
  type: ServiceType;
  mileage: number;
  date: string;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  imageUrl?: string;
  notes?: string;
  createdAt: any;
}
