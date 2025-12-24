
export interface Property {
  id: string;
  garden: string;
  subArea?: string; // e.g. "帝城苑"
  building: string; // e.g. "1栋"
  unit?: string; // e.g. "2单元"
  floor: string;
  totalFloors?: string; 
  propertyType?: 'flat' | 'duplex' | 'skip' | 'villa' | 'shop' | 'custom' | string;
  room: string;
  layout: string; // "3室2厅1卫2阳"
  layoutRoom?: number;
  layoutHall?: number;
  layoutBath?: number;
  layoutBalcony?: number;
  
  area: number;
  orientation?: string;
  renovation?: string;
  elevator?: string; 
  ownerName: string;
  ownerContact: string;
  salePrice?: number;
  rentPrice?: number;
  isSale: boolean;
  isRent: boolean;
  keys?: string; 
  remarks?: string;
  status: 'active' | 'sold' | 'rented' | 'off';
  features?: string[];
  assets?: string[];
  updatedAt: number;
  importDate?: number; 
  leaseEnd?: string; // YYYY-MM-DD
  
  waterPrice?: number;
  elecPrice?: number;
}

export interface UtilityConfig {
  waterType?: 'civil' | 'commercial';
  waterPrice?: number;
  elecType?: 'civil' | 'commercial';
  elecPrice?: number;
  gasType?: 'natural' | 'liquefied' | 'none';
  gasPrice?: number;
  propertyFee?: string;
  parkingFee?: string;
}

export interface UnitDetails extends UtilityConfig {
    name: string;
    orientation?: string;
    remark?: string;
}

export interface BuildingDetails extends UtilityConfig {
  totalFloors?: number;
  unitsPerFloor?: number;
  hasElevator?: boolean;
  yearBuilt?: string;
  orientation?: string;
  units?: UnitDetails[];
  description?: string;
}

export interface GardenDetail {
  schoolPrimary?: string;
  schoolMiddle?: string;
  transport?: string;
  commercial?: string;
  images?: string[];
  description?: string;
  propertyFee?: string;
  parkingInfo?: string; 
}

export interface PropertyFilter {
  garden: string;
  layoutRoom: string;
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
  elevator: string;
  floorMin: string;
  floorMax: string;
  type: 'all' | 'sale' | 'rent';
}
