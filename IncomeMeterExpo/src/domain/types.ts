// Mirrors the IncomeMeter.Api models (camelCase JSON). Dates are ISO-8601 UTC strings.

export type RouteStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

/** How the route is travelled – decides GPS power settings and whether an odometer is used. */
export type TravelMode = 'car' | 'motorcycle' | 'bicycle' | 'walk';
export const TRAVEL_MODES: TravelMode[] = ['walk', 'bicycle', 'motorcycle', 'car'];
/** Walking and cycling have no odometer: the route distance comes from GPS. */
export const usesOdometer = (mode: TravelMode | null | undefined) => mode !== 'walk' && mode !== 'bicycle';

export interface IncomeItem {
  source: string;
  amount: number;
}

export interface Route {
  id: string;
  workType: string | null;
  workTypeId: string | null;
  vehicleId: string | null;
  status: RouteStatus;
  scheduleStart: string;
  scheduleEnd: string;
  actualStartTime: string | null;
  actualEndTime: string | null;
  incomes: IncomeItem[];
  totalIncome: number;
  estimatedIncome: number;
  distance: number;
  startMile: number | null;
  endMile: number | null;
  /** GPS distance recorded while the route was in progress, in the odometer unit (Settings). */
  trackedMiles: number | null;
  /** Missing on routes created before travel modes existed (treated as 'car'). */
  travelMode?: TravelMode | null;
  /** Minutes actually moving (from GPS); the rest of the route time is waiting. */
  movingMinutes?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 'track' = recorded automatically while driving; 'stop' = marked by the driver (Record stop / iOS shortcut). */
export type LocationKind = 'track' | 'stop';

export interface LocationPoint {
  id: string;
  kind: LocationKind;
  routeId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy: number | null;
  speed: number | null;
  address: string | null;
  distanceFromLastKm: number | null;
  distanceFromLastMi: number | null;
  /** GPS altitude in metres (for "uphill" area stats); noisy per point, fine on average. */
  altitude?: number | null;
}

export type VehicleType = 'car' | 'van' | 'motorcycle';
export type ClaimMethod = 'actualCost' | 'mileage';
export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'other';
export type FinanceType = 'cash' | 'hp' | 'lease' | 'none';

export interface Vehicle {
  id: string;
  registration: string;
  make: string | null;
  model: string | null;
  vehicleType: VehicleType;
  fuelType: FuelType | null;
  co2GPerKm: number | null;
  purchaseDate: string | null;
  disposalDate: string | null;
  disposalProceeds: number | null;
  purchasePrice: number | null;
  isNew: boolean;
  financeType: FinanceType;
  claimMethod: ClaimMethod;
  claimMethodLockedFromTaxYear: number | null;
  capitalAllowancePoolBroughtForward: number | null;
  poolBroughtForwardTaxYear: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const EXPENSE_CATEGORIES = [
  'fuel', 'insurance', 'servicing', 'repairs', 'mot', 'roadTax', 'breakdown',
  'parking', 'tolls', 'cleaning', 'financeInterest', 'vehiclePurchase', 'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type DateSource = 'exif' | 'filename' | 'ocr' | 'manual';

export interface Expense {
  id: string;
  vehicleId: string | null;
  category: ExpenseCategory;
  date: string;
  amount: number;
  currency: string;
  merchant: string | null;
  notes: string | null;
  fuel: { litres: number | null; odometerMiles: number | null } | null;
  attachmentIds: string[];
  isFullyBusiness: boolean;
  status: 'draft' | 'confirmed';
  dateSource: DateSource;
  createdAt: string;
  updatedAt: string;
}

export type OdometerSource = 'fuelStop' | 'taxYearStart' | 'taxYearEnd' | 'manual';

export interface OdometerReading {
  id: string;
  vehicleId: string | null;
  date: string;
  miles: number;
  source: OdometerSource;
  photoAttachmentId: string | null;
  dateSource: DateSource;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentOcr {
  kind?: 'receipt' | 'dashboard' | null;
  merchant?: string | null;
  date?: string | null;
  total?: number | null;
  currency?: string | null;
  litres?: number | null;
  pricePerLitre?: number | null;
  fuelType?: string | null;
  odometerMiles?: number | null;
  tripMiles?: number | null;
  mpg?: number | null;
  confidence?: number;
  rawText?: string | null;
}

export interface Attachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** file:// URI on this device; null when the file only exists on the server. */
  localUri: string | null;
  /** True once the bytes exist on the server under `id`. */
  uploaded: boolean;
  takenAt: string | null;
  ocr: AttachmentOcr | null;
  createdAt: string;
}

export interface IncomeSourceTemplate {
  name: string;
  category: string | null;
  defaultAmount: number | null;
  isRequired: boolean;
  description: string | null;
  displayOrder: number;
}

export interface WorkType {
  id: string;
  name: string;
  description: string | null;
  incomeSourceTemplates: IncomeSourceTemplate[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MileageUnit = 'mi' | 'km';
export type Region = 'UK' | 'HK';

export interface Settings {
  currencyCode: string;
  language: string;
  timeZone: string;
  /** Unit the vehicle odometer displays. Route start/end mile fields are stored in this unit, like the web app. */
  mileageUnit: MileageUnit;
  defaultChartPeriod: 'weekly' | 'monthly' | 'annual';
  /** "MM-DD"; 04-06 = UK tax year. Used by the dashboard's annual view and week numbers. */
  fiscalYearStart: string;
  /** Record GPS points while a route is in progress. */
  trackRoutes: boolean;
  /** HK hides the UK tax report and seeds Keeta / foodpanda. */
  region: Region;
  /** Last travel mode used – preselected when starting a route. */
  defaultTravelMode: TravelMode;
  /** Walking / cycling: mark a stop automatically after standing still for 2 minutes. */
  autoStops: boolean;
  /** Hourly target for judging offers; null = own average over the last 4 weeks. */
  targetHourly: number | null;
  /** Share of an offer's time limit usually needed (1 = uses all of it – worst case). */
  completionFactor: number;
  /** Place names to avoid, separated by "|" (same list as the Keeta shortcut). */
  avoidAreas: string;
  /** Sync */
  apiBaseUrl: string;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  userEmail: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  currencyCode: 'GBP',
  language: 'en-GB',
  timeZone: 'Europe/London',
  mileageUnit: 'mi',
  defaultChartPeriod: 'weekly',
  fiscalYearStart: '04-06',
  trackRoutes: true,
  region: 'UK',
  defaultTravelMode: 'car',
  autoStops: true,
  targetHourly: null,
  completionFactor: 1,
  avoidAreas: '',
  apiBaseUrl: '',
  syncEnabled: false,
  lastSyncAt: null,
  userEmail: null,
};
