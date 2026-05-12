export enum ServiceType {
  FUEL = 'Fuel',
  OIL_CHANGE = 'Oil Change',
  MAINTENANCE = 'Maintenance',
  TIRES = 'Tires',
  BATTERY = 'Battery',
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
