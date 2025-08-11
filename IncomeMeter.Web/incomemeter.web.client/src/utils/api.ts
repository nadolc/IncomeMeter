import axios from 'axios';
import { User, AuthResponse, Route, Transaction, DashboardStats, RegisterFormData, UserSettings } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7079';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const getProfile = async (): Promise<User> => {
  const response = await api.get<User>('/api/auth/profile');
  return response.data;
};

export const logout = async (): Promise<void> => {
  await api.post('/api/auth/logout');
};

export const register = async (data: RegisterFormData): Promise<User> => {
  const response = await api.post<User>('/api/users', data);
  return response.data;
};

// Dashboard endpoints
export const getDashboardStats = async (): Promise<DashboardStats> => {
  // Mock data for now
  return {
    last7DaysIncome: 2450.00,
    currentMonthIncome: 4370.00,
    netIncome: 4370.00,
    incomeBySource: {
      salary: 3200.00,
      freelance: 850.00,
      other: 320.00,
    },
    dailyIncomeData: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      income: Math.floor(Math.random() * 400) + 200,
    })),
  };
};

export const getTodaysRoutes = async (): Promise<Route[]> => {
  // Mock data for now
  return [
    {
      id: '1',
      name: 'City Center Route',
      startTime: new Date(new Date().setHours(9, 0, 0, 0)),
      endTime: new Date(new Date().setHours(12, 0, 0, 0)),
      estimatedIncome: 180.00,
      distance: 25.5,
      userId: 'user1',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Airport Run',
      startTime: new Date(new Date().setHours(14, 0, 0, 0)),
      endTime: new Date(new Date().setHours(16, 0, 0, 0)),
      estimatedIncome: 95.00,
      distance: 45.2,
      userId: 'user1',
      createdAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Evening Shift',
      startTime: new Date(new Date().setHours(18, 0, 0, 0)),
      endTime: new Date(new Date().setHours(22, 0, 0, 0)),
      estimatedIncome: 220.00,
      distance: 38.7,
      userId: 'user1',
      createdAt: new Date().toISOString(),
    },
  ];
};

// Settings endpoints
export const getUserSettings = async (): Promise<UserSettings> => {
  const response = await api.get<UserSettings>('/api/users/settings');
  return response.data;
};

export const updateUserSettings = async (settings: Partial<UserSettings>): Promise<UserSettings> => {
  const response = await api.put<UserSettings>('/api/users/settings', settings);
  return response.data;
};