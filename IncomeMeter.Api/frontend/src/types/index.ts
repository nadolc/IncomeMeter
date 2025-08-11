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
  createdAt: string;
  updatedAt: string;
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
  currentMonthIncome: number;
  netIncome: number;
  incomeBySource: Record<string, number>;
  dailyIncomeData: {
    date: string;
    income: number;
  }[];
}

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

