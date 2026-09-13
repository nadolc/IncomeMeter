import axios, { AxiosError } from 'axios';
import { DashboardStats, Route, PeriodIncomeData, PeriodType } from '../types/dashboard';
import { appConfig } from '../config/environment';
import { getSecureStorage } from './secureStorage';

const apiClient = axios.create({
  baseURL: appConfig.apiBaseUrl + '/api',
  timeout: appConfig.apiTimeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(async (config) => {
  try {
    const storage = await getSecureStorage();
    const token = await storage.getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (__DEV__) {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
      console.log('Token present:', !!token);
    }
  } catch (error) {
    console.error('Failed to get access token for API request:', error);
  }

  return config;
});

// Response interceptor to handle auth errors and token refresh
apiClient.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`API Response: ${response.status} ${response.config?.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config;

    if (__DEV__) {
      console.error('API Error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        data: error.response?.data,
      });
    }

    // Handle 401 Unauthorized - token expired or invalid
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const storage = await getSecureStorage();
        const refreshToken = await storage.getRefreshToken();

        if (refreshToken) {
          // TODO: Implement token refresh logic
          console.log('Token refresh not yet implemented');
        }

        // Clear invalid tokens
        await storage.removeAccessToken();
        await storage.removeRefreshToken();
        await storage.removeUserData();

        // TODO: Navigate to login screen
        console.warn('Authentication failed - user needs to login again');

      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { apiClient };

export class DashboardApiService {
  static async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await apiClient.get<DashboardStats>('/dashboard/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Fallback to mock data in development or network issues
      if (__DEV__ || this.isNetworkError(error)) {
        console.warn('Falling back to mock dashboard stats');
        return this.getMockDashboardStats();
      }
      throw error;
    }
  }

  static async getTodaysRoutes(): Promise<Route[]> {
    try {
      const response = await apiClient.get<Route[]>('/dashboard/todays-routes');

      // Convert date strings to Date objects for consistency
      return response.data.map(route => ({
        ...route,
        scheduleStart: new Date(route.scheduleStart),
        scheduleEnd: new Date(route.scheduleEnd),
        actualStartTime: route.actualStartTime ? new Date(route.actualStartTime) : undefined,
        actualEndTime: route.actualEndTime ? new Date(route.actualEndTime) : undefined,
        createdAt: typeof route.createdAt === 'string' ? route.createdAt : new Date(route.createdAt).toISOString(),
        updatedAt: typeof route.updatedAt === 'string' ? route.updatedAt : new Date(route.updatedAt).toISOString(),
      }));
    } catch (error) {
      console.error('Error fetching today\'s routes:', error);
      // Fallback to mock data in development or network issues
      if (__DEV__ || this.isNetworkError(error)) {
        console.warn('Falling back to mock today\'s routes');
        return this.getMockTodaysRoutes();
      }
      throw error;
    }
  }

  static async getPeriodStats(
    period: PeriodType,
    offset: number = 0,
    fiscalStartDate?: string
  ): Promise<PeriodIncomeData> {
    try {
      const requestBody = {
        period,
        offset,
        fiscalStartDate,
      };

      const response = await apiClient.post<PeriodIncomeData>(
        '/dashboard/period-stats',
        requestBody
      );

      // Ensure dates are properly formatted
      return {
        ...response.data,
        startDate: new Date(response.data.startDate),
        endDate: new Date(response.data.endDate),
        dailyBreakdown: response.data.dailyBreakdown?.map(item => ({
          ...item,
          date: typeof item.date === 'string' ? item.date : new Date(item.date).toISOString().split('T')[0],
        })),
      };
    } catch (error) {
      console.error('Error fetching period stats:', error);
      // Fallback to mock data in development or network issues
      if (__DEV__ || this.isNetworkError(error)) {
        console.warn('Falling back to mock period stats');
        return this.getMockPeriodData(period);
      }
      throw error;
    }
  }

  // Helper method to determine if error is network-related
  private static isNetworkError(error: any): boolean {
    return !error.response || error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED';
  }

  static async getRoutes(
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<Route[]> {
    try {
      const params = new URLSearchParams();

      if (startDate) {
        params.append('startDate', startDate.toISOString());
      }

      if (endDate) {
        params.append('endDate', endDate.toISOString());
      }

      if (limit) {
        params.append('limit', limit.toString());
      }

      const response = await apiClient.get<Route[]>(`/routes?${params.toString()}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching routes:', error);
      throw error;
    }
  }

  // Mock data for development/testing
  static getMockDashboardStats(): DashboardStats {
    return {
      last7DaysIncome: 1250.50,
      currentMonthIncome: 4875.25,
      netIncome: 4200.00,
      totalRoutes: 18,
      totalDistance: 340.5,
      averageIncomePerRoute: 270.85,
      bestDay: {
        date: '2024-09-10',
        income: 420.75
      }
    };
  }

  static getMockTodaysRoutes(): Route[] {
    return [
      {
        id: '1',
        userId: 'user1',
        workType: 'Delivery',
        status: 'completed',
        scheduleStart: new Date('2024-09-13T09:00:00'),
        scheduleEnd: new Date('2024-09-13T12:00:00'),
        actualStartTime: new Date('2024-09-13T09:15:00'),
        actualEndTime: new Date('2024-09-13T11:45:00'),
        incomes: [{ source: 'Base Pay', amount: 85.50 }, { source: 'Tips', amount: 12.25 }],
        totalIncome: 97.75,
        distance: 25.3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        userId: 'user1',
        workType: 'Rideshare',
        status: 'in_progress',
        scheduleStart: new Date('2024-09-13T14:00:00'),
        scheduleEnd: new Date('2024-09-13T18:00:00'),
        incomes: [],
        totalIncome: 0,
        estimatedIncome: 120.00,
        distance: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ];
  }

  static getMockPeriodData(period: PeriodType): PeriodIncomeData {
    const baseData = {
      period,
      startDate: new Date('2024-09-09'),
      endDate: new Date('2024-09-15'),
      totalIncome: 1250.50,
      routeCount: 8,
      totalDistance: 145.2,
      averageIncomePerRoute: 156.31,
      workTypes: [
        {
          workTypeId: '1',
          workTypeName: 'Delivery',
          totalIncome: 750.25,
          routeCount: 5,
          averagePerRoute: 150.05,
          percentage: 60.0
        },
        {
          workTypeId: '2',
          workTypeName: 'Rideshare',
          totalIncome: 500.25,
          routeCount: 3,
          averagePerRoute: 166.75,
          percentage: 40.0
        }
      ],
      dailyBreakdown: [
        { date: '2024-09-09', income: 180.50, routeCount: 1 },
        { date: '2024-09-10', income: 420.75, routeCount: 3 },
        { date: '2024-09-11', income: 95.25, routeCount: 1 },
        { date: '2024-09-12', income: 275.50, routeCount: 2 },
        { date: '2024-09-13', income: 278.50, routeCount: 1 },
      ],
      navigation: {
        canGoPrevious: true,
        canGoNext: false,
        previousPeriodLabel: 'Previous Week',
        nextPeriodLabel: 'Next Week',
        currentPeriodLabel: 'This Week'
      }
    };

    return baseData;
  }
}