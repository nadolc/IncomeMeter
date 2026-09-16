// Period types for dashboard
export type PeriodType = 'weekly' | 'monthly' | 'annual';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  currency: 'GBP' | 'HKD';
  language: 'en-GB' | 'zh-HK';
  timeZone: string;
  dateFormat: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  defaultChartPeriod: string;
  showWeekends: boolean;
  mileageUnit: 'km' | 'mi';
  fiscalYearStartDate: string; // Format: "MM-DD" (e.g., "04-06" for April 6th)
}

export interface AuthResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  redirectUrl?: string;
}

export interface Route {
  id: string;
  userId: string;
  workType?: string;
  workTypeId?: string;
  vehicleId?: string | null;
  status: 'completed' | 'in_progress' | 'scheduled' | 'cancelled';
  scheduleStart: Date;
  scheduleEnd: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  incomes: Array<{ source: string; amount: number }>;
  totalIncome: number;
  estimatedIncome?: number;
  distance: number;
  startMile?: number;
  endMile?: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  source: string;
  category: string;
  date: Date;
  userId: string;
}

export interface DashboardStats {
  last7DaysIncome: number;
  previous7DaysIncome: number;
  currentMonthIncome: number;
  netIncome: number;
  last7DaysMileage: number;
  currentMonthMileage: number;
  incomeBySource: Record<string, {
    income: number;
    totalScheduledHours: number;
    totalMileage: number;
  }>;
  dailyIncomeData: {
    date: string;
    income: number;
  }[];
}

export interface WeeklyIncomeData {
  period: 'weekly';
  weekNumber: number;
  year: number;
  fiscalYear: number;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalMileage: number;
  dailyData: {
    date: string;
    dayOfWeek: number; // 0=Sunday, 1=Monday, etc.
    income: number;
    mileage: number;
  }[];
}

export interface MonthlyIncomeData {
  period: 'monthly';
  month: number; // 1-12
  year: number;
  fiscalYear: number;
  totalIncome: number;
  totalMileage: number;
  weeklyData: {
    weekNumber: number;
    startDate: string;
    endDate: string;
    income: number;
    mileage: number;
    isPartialWeek: boolean;
  }[];
}

export interface AnnualIncomeData {
  period: 'annual';
  fiscalYear: number;
  startDate: string; // Fiscal year start
  endDate: string;   // Fiscal year end
  totalIncome: number;
  totalMileage: number;
  monthlyData: {
    month: number; // 1-12
    year: number;
    income: number;
    mileage: number;
    weekCount: number;
  }[];
}

// Common chart data structure for all periods
export interface ChartDataPoint {
  label: string;
  date: string;
  income: number;
  routes: number;
  distance: number;
  /** Income in this bucket split by work type (source). */
  incomeBySource?: Record<string, number>;
}

/** Colours used for income sources everywhere on the dashboard (Tailwind 500 shades), by rank. */
export const SOURCE_COLORS = [
  { bg: 'bg-blue-500', hex: '#3B82F6' },
  { bg: 'bg-green-500', hex: '#22C55E' },
  { bg: 'bg-yellow-500', hex: '#EAB308' },
  { bg: 'bg-purple-500', hex: '#A855F7' },
  { bg: 'bg-red-500', hex: '#EF4444' },
  { bg: 'bg-indigo-500', hex: '#6366F1' },
];

// Navigation controls for period browsing
export interface PeriodNavigation {
  canGoPrevious: boolean;
  canGoNext: boolean;
  currentPeriodDisplay: string;
}

// Unified period data interface
export interface PeriodIncomeData {
  period: PeriodType;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalRoutes: number;
  totalDistance: number;
  chartData: ChartDataPoint[];
  navigation: PeriodNavigation;
  incomeBySource: Record<string, {
    income: number;
    routes: number;
    totalWorkingHours: number;
    totalMileage: number;
    hourlyRate: number;
    earningsPerMile: number;
    incomeBySource: Record<string, number>;
  }>;
}

export type PeriodDataUnion = WeeklyIncomeData | MonthlyIncomeData | AnnualIncomeData;

export interface RegisterFormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  currency: 'GBP' | 'HKD';
  language: 'en-GB' | 'zh-HK';
  timeZone: string;
  dateFormat: string;
}

export interface IncomeSourceTemplate {
  name: string;
  category?: string;
  defaultAmount?: number;
  isRequired: boolean;
  description?: string;
  displayOrder: number;
}

export interface WorkTypeConfig {
  id: string;
  name: string;
  description?: string;
  incomeSourceTemplates: IncomeSourceTemplate[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWorkTypeConfigRequest {
  name: string;
  description?: string;
  incomeSourceTemplates: Omit<IncomeSourceTemplate, 'displayOrder'>[];
  isActive?: boolean;
}

export interface UpdateWorkTypeConfigRequest {
  name?: string;
  description?: string;
  incomeSourceTemplates?: Omit<IncomeSourceTemplate, 'displayOrder'>[];
  isActive?: boolean;
}

export interface Location {
  id: string;
  routeId: string;
  userId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number | null;
  speed?: number | null;
  distanceFromLastKm?: number | null;
}

export interface ConfigurationResponse {
  user: UserInfo;
  workTypes: WorkTypeConfigResponseDto[];
  apiEndpoints: ApiEndpoints;
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  currency: string;
  language: string;
  timeZone: string;
}

export interface WorkTypeConfigResponseDto {
  id: string;
  name: string;
  description?: string;
  incomeSourceTemplates: IncomeSourceTemplateDto[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeSourceTemplateDto {
  name: string;
  category?: string;
  defaultAmount?: number;
  isRequired: boolean;
  description?: string;
  displayOrder: number;
}

export interface ApiEndpoints {
  startRoute: string;
  addLocation: string;
  endRoute: string;
  getRoutes: string;
  getRoute: string;
}

// Filter state types for route list
export interface RouteListFilters {
  status: string;
  timeRange: string;
  selectedWorkTypes: string[];
  selectedIncomeSources: string[];
  showFilters?: boolean; // for mobile toggle
}

export interface FilterOption {
  id: string;
  label: string;
  count?: number;
}


// ---------- Vehicle expenses / receipts ----------

export type ExpenseCategory =
  | 'fuel' | 'insurance' | 'servicing' | 'repairs' | 'mot' | 'roadTax' | 'breakdown'
  | 'parking' | 'tolls' | 'cleaning' | 'financeInterest' | 'vehiclePurchase' | 'other';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'fuel', 'insurance', 'servicing', 'repairs', 'mot', 'roadTax', 'breakdown',
  'parking', 'tolls', 'cleaning', 'financeInterest', 'vehiclePurchase', 'other'
];

export type DateSource = 'exif' | 'filename' | 'ocr' | 'manual';
export type OdometerSource = 'fuelStop' | 'taxYearStart' | 'taxYearEnd' | 'manual';

export interface AttachmentUploadResult {
  attachmentId: string | null;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  sha256: string | null;
  takenAt: string | null;
  dateSource: 'exif' | 'filename' | null;
  isDuplicate: boolean;
  error: string | null;
  ocr?: AttachmentOcr | null;
}

export interface AttachmentOcr {
  /** "receipt" | "dashboard" – what the photo looks like */
  kind: 'receipt' | 'dashboard' | null;
  merchant: string | null;
  date: string | null;
  total: number | null;
  currency: string | null;
  litres: number | null;
  pricePerLitre: number | null;
  fuelType: string | null;
  odometerMiles: number | null;
  tripMiles: number | null;
  mpg: number | null;
  confidence: number;
  rawText?: string | null;
}

export interface BackfillVehicleOptions {
  routes?: boolean;
  expenses?: boolean;
  odometerReadings?: boolean;
  onlyUnassigned?: boolean;
  from?: string | null;
  to?: string | null;
}

export interface BackfillVehicleResult {
  vehicleId: string;
  from: string | null;
  to: string | null;
  routesUpdated: number;
  expensesUpdated: number;
  odometerReadingsUpdated: number;
}

export interface MotTestSummary {
  completedDate: string | null;
  result: string | null;
  expiryDate: string | null;
  odometerValue: number | null;
  odometerUnit: string | null;
}

export interface VehicleLookupResult {
  registration: string;
  make?: string | null;
  model?: string | null;
  colour?: string | null;
  fuelType?: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'other' | null;
  fuelTypeRaw?: string | null;
  co2GPerKm?: number | null;
  engineCapacityCc?: number | null;
  yearOfManufacture?: number | null;
  monthOfFirstRegistration?: string | null;
  vehicleType?: 'car' | 'van' | 'motorcycle' | null;
  typeApproval?: string | null;
  taxStatus?: string | null;
  taxDueDate?: string | null;
  motStatus?: string | null;
  motExpiryDate?: string | null;
  firstUsedDate?: string | null;
  euroStatus?: string | null;
  motTests: MotTestSummary[];
  sources: string[];
  warnings: string[];
}

export interface FuelDetails {
  litres?: number | null;
  odometerMiles?: number | null;
}

export interface Expense {
  id: string;
  userId: string;
  vehicleId?: string | null;
  category: ExpenseCategory;
  date: string;
  amount: number;
  currency: string;
  merchant?: string | null;
  notes?: string | null;
  fuel?: FuelDetails | null;
  attachmentIds: string[];
  isFullyBusiness: boolean;
  status: 'draft' | 'confirmed';
  dateSource: DateSource;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpenseRequest {
  vehicleId?: string | null;
  category: ExpenseCategory;
  date: string;
  amount: number;
  currency?: string;
  merchant?: string | null;
  notes?: string | null;
  fuel?: FuelDetails | null;
  attachmentIds: string[];
  isFullyBusiness?: boolean;
  dateSource: DateSource;
}

export interface OdometerReading {
  id: string;
  userId: string;
  vehicleId?: string | null;
  date: string;
  miles: number;
  source: OdometerSource;
  photoAttachmentId?: string | null;
  dateSource: DateSource;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOdometerReadingRequest {
  vehicleId?: string | null;
  date: string;
  miles: number;
  source: OdometerSource;
  photoAttachmentId?: string | null;
  dateSource: DateSource;
  notes?: string | null;
}

export interface BatchImportItem {
  kind: 'expense' | 'odometer';
  expense?: CreateExpenseRequest;
  odometer?: CreateOdometerReadingRequest;
}

export interface BatchImportResult {
  created: number;
  failed: number;
  results: Array<{ index: number; kind: string; id: string | null; error: string | null }>;
}

// ---------- Vehicles ----------

export type VehicleType = 'car' | 'van' | 'motorcycle';
export type ClaimMethod = 'actualCost' | 'mileage';
export type FinanceType = 'cash' | 'hp' | 'lease' | 'none';

export interface Vehicle {
  id: string;
  userId: string;
  registration: string;
  make?: string | null;
  model?: string | null;
  vehicleType: VehicleType;
  fuelType?: string | null;
  co2GPerKm?: number | null;
  purchaseDate?: string | null;
  disposalDate?: string | null;
  disposalProceeds?: number | null;
  purchasePrice?: number | null;
  isNew: boolean;
  financeType: FinanceType;
  claimMethod: ClaimMethod;
  claimMethodLockedFromTaxYear?: number | null;
  capitalAllowancePoolBroughtForward?: number | null;
  poolBroughtForwardTaxYear?: number | null;
  isActive: boolean;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type VehicleInput = Omit<Vehicle, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isActive'> & { isActive?: boolean; clearDisposalDate?: boolean };

export interface AssignByDateResult {
  routesUpdated: number;
  expensesUpdated: number;
  odometerReadingsUpdated: number;
  unmatched: number;
  byVehicle: Record<string, number>;
}

// ---------- Tax year report ----------

export interface TaxReportWarning {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
}

export interface TaxReportOdometerPoint {
  date: string;
  miles: number;
  source: 'reading' | 'fuelReceipt';
}

export interface TaxReportCategory {
  category: string;
  count: number;
  total: number;
  fullyBusinessTotal: number;
  allowable: number;
  disallowable: number;
  receiptsMissing: number;
  excludedFromRunningCosts: boolean;
  coveredByFlatRate: boolean;
}

export interface TaxYearReport {
  taxYear: number;
  taxYearLabel: string;
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  vehicle: {
    id: string;
    registration: string;
    description?: string | null;
    vehicleType: VehicleType;
    claimMethod: ClaimMethod;
    claimMethodLockedFromTaxYear?: number | null;
    co2GPerKm?: number | null;
    isNew: boolean;
    purchaseDate?: string | null;
    purchasePrice?: number | null;
  } | null;
  mileage: {
    businessMiles: number;
    routesCounted: number;
    routesWithoutMileage: number;
    odometerStart: TaxReportOdometerPoint | null;
    odometerEnd: TaxReportOdometerPoint | null;
    odometerReadingsInPeriod: number;
    totalMiles: number | null;
    businessUsePercent: number | null;
    businessUseSource: 'odometer' | 'override' | 'unavailable';
  };
  categories: TaxReportCategory[];
  totals: { totalExpenses: number; allowable: number; disallowable: number; receiptsMissing: number; flatRateVehicle: boolean; flatRateClaim: number };
  capitalAllowance: {
    applicable: boolean;
    reason?: string | null;
    allowanceType?: string | null;
    allowanceLabel?: string | null;
    rate: number;
    qualifyingExpenditure: number;
    poolBroughtForward: number;
    grossAllowance: number;
    businessUsePercent: number | null;
    allowance: number;
    poolCarriedForward: number;
    sa103Box?: string | null;
    isDisposal: boolean;
    disposalDate?: string | null;
    disposalProceeds: number;
    balancingAdjustmentGross: number;
    balancingType?: 'balancingAllowance' | 'balancingCharge' | null;
  };
  simplifiedExpenses: {
    businessMiles: number;
    firstBandMiles: number;
    firstBandRate: number;
    secondBandMiles: number;
    secondBandRate: number;
    amount: number;
  };
  comparison: {
    actualCostTotal: number;
    simplifiedTotal: number;
    difference: number;
    betterMethod: 'actualCost' | 'mileage' | 'equal';
    lockedToOtherMethod: boolean;
  };
  sa103Boxes: Array<{ form: string; box: string; label: string; amount: number; note?: string | null }>;
  warnings: TaxReportWarning[];
  disclaimer: string;
}

export interface TaxYearCombinedReport {
  taxYear: number;
  taxYearLabel: string;
  periodFrom: string;
  periodTo: string;
  generatedAt: string;
  vehicles: TaxYearReport[];
  sa103Boxes: Array<{ form: string; box: string; label: string; amount: number; note?: string | null }>;
  totalClaim: number;
  totalBusinessMiles: number;
  unassignedRoutes: number;
  unassignedExpenses: number;
  unassignedOdometerReadings: number;
  warnings: TaxReportWarning[];
  disclaimer: string;
}
