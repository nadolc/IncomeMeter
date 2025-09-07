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
}

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

