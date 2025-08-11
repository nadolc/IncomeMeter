/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { getDashboardStats, getTodaysRoutes, getProfile, logout, register } from '../api';
import type { RegisterFormData } from '../../types';

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockAxiosInstance = {
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
};

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock as any;

// Mock window.location
delete (window as any).location;
window.location = { href: '' } as any;

describe('API Utils', () => {
  beforeAll(() => {
    (mockAxios.create as jest.Mock).mockReturnValue(mockAxiosInstance);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockReturnValue('test-token');
  });

  describe('API Configuration', () => {
    it('should create axios instance with correct base URL', () => {
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://localhost:7079',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should set up request interceptor for auth token', () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });

    it('should set up response interceptor for auth errors', () => {
      expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();
    });
  });

  describe('Dashboard Stats', () => {
    it('should return mock dashboard stats', async () => {
      const mockStats = {
        last7DaysIncome: 2450.00,
        currentMonthIncome: 4370.00,
        netIncome: 4370.00,
        incomeBySource: {
          salary: 3200.00,
          freelance: 850.00,
          other: 320.00,
        },
        dailyIncomeData: Array.from({ length: 7 }, (_, index) => ({
          date: new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          income: Math.floor(Math.random() * 400) + 200,
        })),
      };
      
      mockAxiosInstance.get.mockResolvedValue({ data: mockStats });
      
      const stats = await getDashboardStats();
      
      expect(stats).toEqual(mockStats);
      
      expect(stats.dailyIncomeData).toHaveLength(7);
    });

    it('should generate daily income data for last 7 days', async () => {
      const stats = await getDashboardStats();
      const today = new Date();
      
      stats.dailyIncomeData.forEach((day, index) => {
        const expectedDate = new Date(today.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
        const expectedDateString = expectedDate.toISOString().split('T')[0];
        
        expect(day.date).toBe(expectedDateString);
        expect(day.income).toBeGreaterThanOrEqual(200);
        expect(day.income).toBeLessThanOrEqual(599);
      });
    });
  });

  describe('Today\'s Routes', () => {
    it('should return mock routes for today', async () => {
      const today = new Date();
      const mockRoutes = [
        {
          id: '1',
          userId: 'user1',
          workType: 'City Center Route',
          status: 'scheduled' as const,
          scheduleStart: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString(),
          scheduleEnd: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0).toISOString(),
          estimatedIncome: 180.00,
          distance: 25.5,
          incomes: [],
          totalIncome: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          userId: 'user1',
          workType: 'Suburbs Route',
          status: 'scheduled' as const,
          scheduleStart: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
          scheduleEnd: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0).toISOString(),
          estimatedIncome: 120.00,
          distance: 18.2,
          incomes: [],
          totalIncome: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          userId: 'user1',
          workType: 'Evening Route',
          status: 'scheduled' as const,
          scheduleStart: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0).toISOString(),
          scheduleEnd: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 22, 0).toISOString(),
          estimatedIncome: 240.00,
          distance: 35.8,
          incomes: [],
          totalIncome: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      mockAxiosInstance.get.mockResolvedValue({ data: mockRoutes });
      
      const routes = await getTodaysRoutes();
      
      expect(routes).toHaveLength(3);
      expect(routes[0]).toMatchObject({
        id: '1',
        userId: 'user1',
        workType: 'City Center Route',
        status: 'scheduled',
        scheduleStart: expect.any(Date),
        scheduleEnd: expect.any(Date),
        estimatedIncome: 180.00,
        distance: 25.5,
        incomes: [],
        totalIncome: 0,
      });
    });

    it('should generate routes with correct time slots', async () => {
      const today = new Date();
      const mockRoutes = [
        {
          id: '1',
          userId: 'user1',
          workType: 'City Center Route',
          status: 'scheduled' as const,
          scheduleStart: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString(),
          scheduleEnd: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0).toISOString(),
          estimatedIncome: 180.00,
          distance: 25.5,
          incomes: [],
          totalIncome: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '2',
          userId: 'user1',
          workType: 'Suburbs Route',
          status: 'scheduled' as const,
          scheduleStart: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
          scheduleEnd: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 0).toISOString(),
          estimatedIncome: 120.00,
          distance: 18.2,
          incomes: [],
          totalIncome: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: '3',
          userId: 'user1',
          workType: 'Evening Route',
          status: 'scheduled' as const,
          scheduleStart: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0).toISOString(),
          scheduleEnd: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 22, 0).toISOString(),
          estimatedIncome: 240.00,
          distance: 35.8,
          incomes: [],
          totalIncome: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      mockAxiosInstance.get.mockResolvedValue({ data: mockRoutes });
      
      const routes = await getTodaysRoutes();
      
      // Check morning route
      expect(routes[0].scheduleStart.getHours()).toBe(9);
      expect(routes[0].scheduleEnd.getHours()).toBe(12);
      
      // Check afternoon route
      expect(routes[1].scheduleStart.getHours()).toBe(14);
      expect(routes[1].scheduleEnd.getHours()).toBe(16);
      
      // Check evening route
      expect(routes[2].scheduleStart.getHours()).toBe(18);
      expect(routes[2].scheduleEnd.getHours()).toBe(22);
    });
  });

  describe('User Profile', () => {
    it('should call get profile endpoint', async () => {
      const mockUser = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      };
      
      mockAxiosInstance.get.mockResolvedValue({ data: mockUser });
      
      const user = await getProfile();
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/auth/profile');
      expect(user).toEqual(mockUser);
    });

    it('should handle profile fetch error', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Unauthorized'));
      
      await expect(getProfile()).rejects.toThrow('Unauthorized');
    });
  });

  describe('User Registration', () => {
    it('should register new user successfully', async () => {
      const registrationData: RegisterFormData = {
        name: 'Jane Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        address: '123 Main St',
        currency: 'GBP',
        language: 'en-GB',
        timeZone: 'Europe/London',
        dateFormat: 'DD/MM/YYYY',
      };
      
      const mockUser = {
        id: '2',
        name: 'Jane Doe',
        email: 'jane@example.com',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      };
      
      mockAxiosInstance.post.mockResolvedValue({ data: mockUser });
      
      const user = await register(registrationData);
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/users', registrationData);
      expect(user).toEqual(mockUser);
    });

    it('should handle registration validation errors', async () => {
      const registrationData: RegisterFormData = {
        name: '',
        email: 'invalid-email',
        phone: '',
        address: '',
        currency: 'GBP',
        language: 'en-GB',
        timeZone: 'Europe/London',
        dateFormat: 'DD/MM/YYYY',
      };
      
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          status: 400,
          data: { message: 'Validation failed' }
        }
      });
      
      await expect(register(registrationData)).rejects.toMatchObject({
        response: {
          status: 400,
          data: { message: 'Validation failed' }
        }
      });
    });
  });

  describe('User Logout', () => {
    it('should call logout endpoint', async () => {
      mockAxiosInstance.post.mockResolvedValue({});
      
      await logout();
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/auth/logout');
    });

    it('should handle logout error gracefully', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Server error'));
      
      await expect(logout()).rejects.toThrow('Server error');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network Error'));
      
      await expect(getProfile()).rejects.toThrow('Network Error');
    });

    it('should handle 404 errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 404, data: { message: 'Not found' } }
      });
      
      await expect(getProfile()).rejects.toMatchObject({
        response: { status: 404 }
      });
    });

    it('should handle 500 errors', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: { status: 500, data: { message: 'Internal server error' } }
      });
      
      await expect(getProfile()).rejects.toMatchObject({
        response: { status: 500 }
      });
    });
  });

  describe('Mock Data Validation', () => {
    it('should return consistent mock data structure', async () => {
      // Mock dashboard stats
      const mockStats = {
        last7DaysIncome: 2450.00,
        currentMonthIncome: 4370.00,
        netIncome: 4370.00,
        incomeBySource: { salary: 3200.00, freelance: 850.00, other: 320.00 },
        dailyIncomeData: [{ date: '2024-01-01', income: 250 }],
      };
      
      // Mock routes
      const today = new Date();
      const mockRoutes = [
        {
          id: '1',
          userId: 'user1',
          workType: 'City Center Route',
          status: 'scheduled' as const,
          scheduleStart: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0).toISOString(),
          scheduleEnd: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0).toISOString(),
          estimatedIncome: 180.00,
          distance: 25.5,
          incomes: [],
          totalIncome: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockStats });
      mockAxiosInstance.get.mockResolvedValueOnce({ data: mockRoutes });
      
      const stats = await getDashboardStats();
      const routes = await getTodaysRoutes();
      
      // Validate dashboard stats structure
      expect(typeof stats.last7DaysIncome).toBe('number');
      expect(typeof stats.currentMonthIncome).toBe('number');
      expect(typeof stats.netIncome).toBe('number');
      expect(typeof stats.incomeBySource).toBe('object');
      expect(Array.isArray(stats.dailyIncomeData)).toBe(true);
      
      // Validate routes structure
      expect(Array.isArray(routes)).toBe(true);
      routes.forEach(route => {
        expect(typeof route.id).toBe('string');
        expect(typeof route.workType).toBe('string');
        expect(typeof route.estimatedIncome).toBe('number');
        expect(typeof route.distance).toBe('number');
        expect(typeof route.userId).toBe('string');
        expect(typeof route.createdAt).toBe('string');
      });
    });
  });
});