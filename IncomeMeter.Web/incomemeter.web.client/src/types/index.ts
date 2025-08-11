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
}

export interface AuthResponse {
  success: boolean;
  message: string;
  accessToken?: string;
  redirectUrl?: string;
}

export interface Route {
  id: string;
  name: string;
  startTime?: Date;
  endTime?: Date;
  estimatedIncome: number;
  distance: number;
  userId: string;
  createdAt: string;
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
  incomeBySource: {
    salary: number;
    freelance: number;
    other: number;
  };
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