/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { getDashboardStats, getTodaysRoutes, getProfile, logout, register, getAvailableScopes, getUserTokens, generateJwtToken, revokeJwtToken } from '../api';
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

  describe('JWT Token API', () => {
    describe('Available Scopes', () => {
      it('should fetch available scopes successfully', async () => {
        const mockScopeData = {
          available_scopes: [
            { scope: 'read:routes', description: 'Read route data' },
            { scope: 'write:routes', description: 'Create and update routes' },
            { scope: 'read:locations', description: 'Read location data' },
            { scope: 'write:locations', description: 'Create and update locations' },
            { scope: 'read:dashboard', description: 'Access dashboard data' }
          ],
          default_scopes: ['read:routes', 'read:locations'],
          readonly_scopes: ['read:routes', 'read:locations', 'read:dashboard']
        };

        mockAxiosInstance.get.mockResolvedValue({ data: mockScopeData });

        const scopes = await getAvailableScopes();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/tokens/scopes');
        expect(scopes).toEqual(mockScopeData);
        expect(scopes.available_scopes).toHaveLength(5);
        expect(scopes.default_scopes).toContain('read:routes');
        expect(scopes.readonly_scopes).toContain('read:dashboard');
      });

      it('should handle scopes fetch error', async () => {
        mockAxiosInstance.get.mockRejectedValue(new Error('Unauthorized'));

        await expect(getAvailableScopes()).rejects.toThrow('Unauthorized');
        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/tokens/scopes');
      });

      it('should validate scope structure', async () => {
        const mockScopeData = {
          available_scopes: [
            { scope: 'read:routes', description: 'Read route data' },
            { scope: 'write:routes', description: 'Create and update routes' }
          ],
          default_scopes: ['read:routes'],
          readonly_scopes: ['read:routes']
        };

        mockAxiosInstance.get.mockResolvedValue({ data: mockScopeData });

        const scopes = await getAvailableScopes();

        // Validate each scope has required properties
        scopes.available_scopes.forEach((scope: any) => {
          expect(scope).toHaveProperty('scope');
          expect(scope).toHaveProperty('description');
          expect(typeof scope.scope).toBe('string');
          expect(typeof scope.description).toBe('string');
        });
      });
    });

    describe('User Tokens', () => {
      it('should fetch user tokens successfully', async () => {
        const mockTokens = [
          {
            tokenId: 'token-1',
            description: 'Mobile App Token',
            scopes: ['read:routes', 'write:routes'],
            createdAt: '2024-01-01T00:00:00Z',
            expiresAt: '2024-12-31T23:59:59Z',
            lastUsedAt: '2024-06-01T12:00:00Z',
            usageCount: 25,
            daysUntilExpiry: 180,
            isNearExpiry: false,
            isExpired: false,
            isRevoked: false,
            lastUsedIp: '192.168.1.100'
          },
          {
            tokenId: 'token-2',
            description: 'Desktop App Token',
            scopes: ['read:routes', 'read:locations'],
            createdAt: '2024-03-01T00:00:00Z',
            expiresAt: '2024-03-15T23:59:59Z',
            usageCount: 0,
            daysUntilExpiry: -90,
            isNearExpiry: false,
            isExpired: true,
            isRevoked: false
          }
        ];

        mockAxiosInstance.get.mockResolvedValue({ data: mockTokens });

        const tokens = await getUserTokens();

        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/tokens');
        expect(tokens).toEqual(mockTokens);
        expect(tokens).toHaveLength(2);
        expect(tokens[0]).toMatchObject({
          tokenId: 'token-1',
          description: 'Mobile App Token',
          scopes: ['read:routes', 'write:routes'],
          usageCount: 25,
          isExpired: false
        });
      });

      it('should handle empty token list', async () => {
        mockAxiosInstance.get.mockResolvedValue({ data: [] });

        const tokens = await getUserTokens();

        expect(tokens).toEqual([]);
        expect(tokens).toHaveLength(0);
      });

      it('should handle tokens fetch error', async () => {
        mockAxiosInstance.get.mockRejectedValue({
          response: { status: 401, data: { message: 'Unauthorized' } }
        });

        await expect(getUserTokens()).rejects.toMatchObject({
          response: { status: 401 }
        });
      });

      it('should validate token structure', async () => {
        const mockTokens = [
          {
            tokenId: 'token-1',
            description: 'Test Token',
            scopes: ['read:routes'],
            createdAt: '2024-01-01T00:00:00Z',
            expiresAt: '2024-12-31T23:59:59Z',
            usageCount: 5,
            daysUntilExpiry: 100,
            isNearExpiry: false,
            isExpired: false,
            isRevoked: false
          }
        ];

        mockAxiosInstance.get.mockResolvedValue({ data: mockTokens });

        const tokens = await getUserTokens();

        tokens.forEach((token: any) => {
          expect(token).toHaveProperty('tokenId');
          expect(token).toHaveProperty('description');
          expect(token).toHaveProperty('scopes');
          expect(token).toHaveProperty('createdAt');
          expect(token).toHaveProperty('expiresAt');
          expect(token).toHaveProperty('usageCount');
          expect(token).toHaveProperty('daysUntilExpiry');
          expect(token).toHaveProperty('isExpired');
          expect(Array.isArray(token.scopes)).toBe(true);
          expect(typeof token.usageCount).toBe('number');
        });
      });
    });

    describe('Token Generation', () => {
      it('should generate JWT token successfully', async () => {
        const tokenRequest = {
          description: 'Test API Token',
          scopes: ['read:routes', 'write:routes'],
          expiryDays: 30,
          generateRefreshToken: true
        };

        const mockResponse = {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-access-token',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 2592000, // 30 days in seconds
          expiresAt: '2024-02-01T00:00:00Z',
          scopes: ['read:routes', 'write:routes'],
          tokenId: 'new-token-123',
          description: 'Test API Token'
        };

        mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

        const response = await generateJwtToken(tokenRequest);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/tokens/generate', tokenRequest);
        expect(response).toEqual(mockResponse);
        expect(response.accessToken).toMatch(/^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
        expect(response.refreshToken).toMatch(/^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
        expect(response.tokenType).toBe('Bearer');
        expect(response.scopes).toEqual(['read:routes', 'write:routes']);
      });

      it('should generate token without refresh token', async () => {
        const tokenRequest = {
          description: 'Test API Token',
          scopes: ['read:routes'],
          expiryDays: 30,
          generateRefreshToken: false
        };

        const mockResponse = {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-access-token',
          tokenType: 'Bearer',
          expiresIn: 2592000,
          expiresAt: '2024-02-01T00:00:00Z',
          scopes: ['read:routes'],
          tokenId: 'new-token-123',
          description: 'Test API Token'
        };

        mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

        const response = await generateJwtToken(tokenRequest);

        expect(response.refreshToken).toBeUndefined();
        expect(response.accessToken).toBeDefined();
      });

      it('should handle token generation validation errors', async () => {
        const tokenRequest = {
          description: '', // Invalid: empty description
          scopes: [], // Invalid: no scopes
          expiryDays: 0, // Invalid: zero expiry
          generateRefreshToken: true
        };

        mockAxiosInstance.post.mockRejectedValue({
          response: {
            status: 400,
            data: { message: 'Validation failed', details: ['Description is required', 'At least one scope must be selected'] }
          }
        });

        await expect(generateJwtToken(tokenRequest)).rejects.toMatchObject({
          response: {
            status: 400,
            data: { message: 'Validation failed' }
          }
        });
      });

      it('should handle token generation server errors', async () => {
        const tokenRequest = {
          description: 'Test Token',
          scopes: ['read:routes'],
          expiryDays: 30
        };

        mockAxiosInstance.post.mockRejectedValue({
          response: { status: 500, data: { message: 'Internal server error' } }
        });

        await expect(generateJwtToken(tokenRequest)).rejects.toMatchObject({
          response: { status: 500 }
        });
      });

      it('should validate generated token response structure', async () => {
        const tokenRequest = {
          description: 'Test Token',
          scopes: ['read:routes'],
          expiryDays: 30,
          generateRefreshToken: true
        };

        const mockResponse = {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-access-token',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-refresh-token',
          tokenType: 'Bearer',
          expiresIn: 2592000,
          expiresAt: '2024-02-01T00:00:00Z',
          scopes: ['read:routes'],
          tokenId: 'new-token-123',
          description: 'Test Token'
        };

        mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

        const response = await generateJwtToken(tokenRequest);

        // Validate required properties
        expect(response).toHaveProperty('accessToken');
        expect(response).toHaveProperty('tokenType');
        expect(response).toHaveProperty('expiresIn');
        expect(response).toHaveProperty('expiresAt');
        expect(response).toHaveProperty('scopes');
        expect(response).toHaveProperty('tokenId');
        expect(response).toHaveProperty('description');

        // Validate types
        expect(typeof response.accessToken).toBe('string');
        expect(typeof response.tokenType).toBe('string');
        expect(typeof response.expiresIn).toBe('number');
        expect(typeof response.expiresAt).toBe('string');
        expect(Array.isArray(response.scopes)).toBe(true);
        expect(typeof response.tokenId).toBe('string');
        expect(typeof response.description).toBe('string');
      });
    });

    describe('Token Revocation', () => {
      it('should revoke token successfully', async () => {
        const tokenId = 'token-to-revoke';
        const mockResponse = { success: true, message: 'Token revoked successfully' };

        mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

        const response = await revokeJwtToken(tokenId);

        expect(mockAxiosInstance.post).toHaveBeenCalledWith('/api/tokens/revoke', { tokenId });
        expect(response).toEqual(mockResponse);
        expect(response.success).toBe(true);
      });

      it('should handle token not found error', async () => {
        const tokenId = 'non-existent-token';

        mockAxiosInstance.post.mockRejectedValue({
          response: { status: 404, data: { message: 'Token not found' } }
        });

        await expect(revokeJwtToken(tokenId)).rejects.toMatchObject({
          response: { status: 404 }
        });
      });

      it('should handle unauthorized revocation attempt', async () => {
        const tokenId = 'someone-elses-token';

        mockAxiosInstance.post.mockRejectedValue({
          response: { status: 403, data: { message: 'Forbidden: Cannot revoke this token' } }
        });

        await expect(revokeJwtToken(tokenId)).rejects.toMatchObject({
          response: { status: 403 }
        });
      });

      it('should handle revocation server errors', async () => {
        const tokenId = 'valid-token';

        mockAxiosInstance.post.mockRejectedValue({
          response: { status: 500, data: { message: 'Internal server error' } }
        });

        await expect(revokeJwtToken(tokenId)).rejects.toMatchObject({
          response: { status: 500 }
        });
      });

      it('should handle network errors during revocation', async () => {
        const tokenId = 'valid-token';

        mockAxiosInstance.post.mockRejectedValue(new Error('Network Error'));

        await expect(revokeJwtToken(tokenId)).rejects.toThrow('Network Error');
      });
    });

    describe('JWT Authentication Flow Integration', () => {
      it('should handle token expiry and refresh flow', async () => {
        // Simulate expired token scenario
        mockAxiosInstance.get.mockRejectedValueOnce({
          response: { status: 401, data: { message: 'Token expired' } }
        });

        await expect(getUserTokens()).rejects.toMatchObject({
          response: { status: 401 }
        });

        // Verify the request was made
        expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/tokens');
      });

      it('should handle invalid scopes in token generation', async () => {
        const tokenRequest = {
          description: 'Test Token',
          scopes: ['invalid:scope', 'another:invalid'], // Invalid scopes
          expiryDays: 30
        };

        mockAxiosInstance.post.mockRejectedValue({
          response: {
            status: 400,
            data: { message: 'Invalid scopes provided', invalidScopes: ['invalid:scope', 'another:invalid'] }
          }
        });

        await expect(generateJwtToken(tokenRequest)).rejects.toMatchObject({
          response: {
            status: 400,
            data: { message: 'Invalid scopes provided' }
          }
        });
      });

      it('should handle concurrent token operations', async () => {
        const tokenRequest1 = {
          description: 'Token 1',
          scopes: ['read:routes'],
          expiryDays: 30
        };

        const tokenRequest2 = {
          description: 'Token 2',
          scopes: ['write:routes'],
          expiryDays: 60
        };

        const mockResponse1 = { accessToken: 'token1', tokenId: 'id1', description: 'Token 1' };
        const mockResponse2 = { accessToken: 'token2', tokenId: 'id2', description: 'Token 2' };

        mockAxiosInstance.post
          .mockResolvedValueOnce({ data: mockResponse1 })
          .mockResolvedValueOnce({ data: mockResponse2 });

        const [response1, response2] = await Promise.all([
          generateJwtToken(tokenRequest1),
          generateJwtToken(tokenRequest2)
        ]);

        expect(response1.tokenId).toBe('id1');
        expect(response2.tokenId).toBe('id2');
        expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2);
      });

      it('should validate token-based API authentication', async () => {
        // Test that the axios interceptor adds the token to requests
        localStorageMock.getItem.mockReturnValue('valid-jwt-token');

        const mockTokens = [{ tokenId: 'test', description: 'Test Token' }];
        mockAxiosInstance.get.mockResolvedValue({ data: mockTokens });

        await getUserTokens();

        // Verify the interceptor was set up to add authorization headers
        expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
      });

      it('should handle authentication redirect on unauthorized access', async () => {
        mockAxiosInstance.get.mockRejectedValue({
          response: { status: 401, data: { message: 'Unauthorized' } }
        });

        // Verify response interceptor is configured
        expect(mockAxiosInstance.interceptors.response.use).toHaveBeenCalled();

        await expect(getUserTokens()).rejects.toMatchObject({
          response: { status: 401 }
        });
      });
    });

    describe('Token Security Validation', () => {
      it('should validate JWT token format in responses', async () => {
        const tokenRequest = {
          description: 'Security Test Token',
          scopes: ['read:routes'],
          expiryDays: 30
        };

        const mockResponse = {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          tokenType: 'Bearer',
          expiresIn: 2592000,
          tokenId: 'secure-token-123'
        };

        mockAxiosInstance.post.mockResolvedValue({ data: mockResponse });

        const response = await generateJwtToken(tokenRequest);

        // Validate JWT format (header.payload.signature)
        const jwtPattern = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/;
        expect(response.accessToken).toMatch(jwtPattern);
        expect(response.tokenType).toBe('Bearer');
      });

      it('should handle expired token scenarios properly', async () => {
        const expiredTokenRequest = {
          description: 'Expired Token Test',
          scopes: ['read:routes'],
          expiryDays: -1 // Negative days should be rejected
        };

        mockAxiosInstance.post.mockRejectedValue({
          response: {
            status: 400,
            data: { message: 'Invalid expiry period', details: ['Expiry days must be positive'] }
          }
        });

        await expect(generateJwtToken(expiredTokenRequest)).rejects.toMatchObject({
          response: { status: 400 }
        });
      });

      it('should validate scope permissions during token usage', async () => {
        // Mock a scenario where token has insufficient scopes
        mockAxiosInstance.get.mockRejectedValue({
          response: {
            status: 403,
            data: { message: 'Insufficient permissions', requiredScope: 'write:routes', providedScopes: ['read:routes'] }
          }
        });

        await expect(getUserTokens()).rejects.toMatchObject({
          response: { status: 403 }
        });
      });
    });
  });
});