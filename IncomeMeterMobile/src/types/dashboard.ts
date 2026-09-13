// Dashboard types adapted from frontend for React Native
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
  startLocationId?: string;
  endLocationId?: string;
  notes?: string;
}

export interface DashboardStats {
  last7DaysIncome: number;
  currentMonthIncome: number;
  netIncome: number;
  totalRoutes: number;
  totalDistance: number;
  averageIncomePerRoute: number;
  bestDay?: {
    date: string;
    income: number;
  };
}

export interface WorkTypeIncome {
  workTypeId: string;
  workTypeName: string;
  totalIncome: number;
  routeCount: number;
  averagePerRoute: number;
  percentage: number;
}

export interface PeriodIncomeData {
  period: PeriodType;
  startDate: Date;
  endDate: Date;
  totalIncome: number;
  routeCount: number;
  totalDistance: number;
  averageIncomePerRoute: number;
  workTypes: WorkTypeIncome[];
  dailyBreakdown?: Array<{
    date: string;
    income: number;
    routeCount: number;
  }>;
  navigation: {
    canGoPrevious: boolean;
    canGoNext: boolean;
    previousPeriodLabel: string;
    nextPeriodLabel: string;
    currentPeriodLabel: string;
  };
}

export interface AuthResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  redirectUrl?: string;
}