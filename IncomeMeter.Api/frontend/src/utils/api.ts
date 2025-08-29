import axios from 'axios';
import type { DashboardStats, RegisterFormData, Route, User, UserSettings, WorkTypeConfig, CreateWorkTypeConfigRequest, UpdateWorkTypeConfigRequest, ConfigurationResponse, WorkTypeConfigResponseDto, ApiEndpoints } from "../types";

// Get API URL from backend config endpoint
/*const _getApiUrl = async (): Promise<string> => {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    return config.ApiBaseUrl || window.location.origin;
  } catch {
    return import.meta.env.DEV ? 'https://localhost:7079' : window.location.origin;
  }
};*/

// Build-time URL validation
const validateApiUrl = (url: string): void => {
  if (!import.meta.env.DEV) {
    if (url.includes('localhost')) {
      console.error('❌ PRODUCTION BUILD ERROR: API URL contains localhost!');
      console.error('Set VITE_API_BASE_URL environment variable for production');
      console.error('Current URL:', url);
    }
    if (!url.startsWith('https://')) {
      console.warn('⚠️  WARNING: Production API URL should use HTTPS');
    }
  }
};

// For development: point to .NET API server
// For production: use VITE_API_BASE_URL or fallback to current domain
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.DEV ? 'https://localhost:7079' : window.location.origin
);

// Validate the URL at module load time
validateApiUrl(API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  console.log('API Request:', config.method?.toUpperCase(), config.url);
  console.log('Token present:', !!token);
  
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    console.warn('No access token found in localStorage');
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status, response.config?.url);
    return response;
  },
  (error) => {
    console.error('API Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      data: error.response?.data
    });
    
    if (error.response?.status === 401) {
      console.warn('Unauthorized - removing token and redirecting to login');
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

export const registerWithGoogle = async (googleId: string, email: string, displayName: string): Promise<{ success: boolean; token?: string; user?: User; message: string }> => {
  const response = await api.post('/api/auth/register', {
    googleId,
    email,
    displayName
  });
  return response.data;
};

// Dashboard endpoints
export const getDashboardStats = async (): Promise<DashboardStats> => {
  const response = await api.get<DashboardStats>('/api/dashboard/stats');
  return response.data;
};

export const getTodaysRoutes = async (): Promise<Route[]> => {
  const response = await api.get<Route[]>('/api/dashboard/todays-routes');
  
  // Ensure response.data is an array
  const routes = Array.isArray(response.data) ? response.data : [];
  
  // Convert date strings to Date objects
  return routes.map(route => ({
    ...route,
    scheduleStart: new Date(route.scheduleStart),
    scheduleEnd: new Date(route.scheduleEnd),
    actualStartTime: route.actualStartTime ? new Date(route.actualStartTime) : undefined,
    actualEndTime: route.actualEndTime ? new Date(route.actualEndTime) : undefined,
  }));
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

// Route endpoints
export const getRoutes = async (): Promise<Route[]> => {
  const response = await api.get<Route[]>('/api/routes');
  return response.data;
};

export const getRouteById = async (routeId: string): Promise<Route> => {
  const response = await api.get<Route>(`/api/routes/${routeId}`);
  return response.data;
};

export const getRoutesByStatus = async (status: string): Promise<Route[]> => {
  const response = await api.get<Route[]>(`/api/routes/status/${status}`);
  return response.data;
};

export const getRoutesByDateRange = async (startDate: string, endDate: string): Promise<Route[]> => {
  const response = await api.get<Route[]>(`/api/routes/date-range?startDate=${startDate}&endDate=${endDate}`);
  return response.data;
};

export const createRoute = async (routeData: any): Promise<Route> => {
  const response = await api.post<Route>('/api/routes', routeData);
  return response.data;
};

export const updateRoute = async (routeId: string, routeData: any): Promise<Route> => {
  const response = await api.put<Route>(`/api/routes/${routeId}`, routeData);
  return response.data;
};

export const deleteRoute = async (routeId: string): Promise<void> => {
  await api.delete(`/api/routes/${routeId}`);
};

export const startRoute = async (routeData: { workType: string; startMile: number; estimatedIncome?: number }): Promise<Route> => {
  const response = await api.post<Route>('/api/routes/start', routeData);
  return response.data;
};

export const endRoute = async (routeData: { id: string; endMile: number; incomes: any[] }): Promise<Route> => {
  const response = await api.post<Route>('/api/routes/end', routeData);
  return response.data;
};

// Location endpoints
export const getLocationsByRouteId = async (routeId: string) => {
  const response = await api.get(`/api/locations?routeId=${routeId}`);
  return response.data;
};

export const getLocationById = async (locationId: string) => {
  const response = await api.get(`/api/locations/${locationId}`);
  return response.data;
};

export const createLocation = async (locationData: {
  routeId: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  accuracy?: number;
  speed?: number;
}) => {
  const response = await api.post('/api/locations', locationData);
  return response.data;
};

export const updateLocation = async (locationId: string, locationData: {
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  accuracy?: number;
  speed?: number;
  address?: string;
}) => {
  const response = await api.put(`/api/locations/${locationId}`, locationData);
  return response.data;
};

export const deleteLocation = async (locationId: string): Promise<void> => {
  await api.delete(`/api/locations/${locationId}`);
};

export const deleteLocationsByRouteId = async (routeId: string): Promise<void> => {
  await api.delete(`/api/locations/route/${routeId}`);
};

// Work Type Configuration endpoints
export const getWorkTypeConfigs = async (): Promise<WorkTypeConfig[]> => {
  const response = await api.get<WorkTypeConfig[]>('/api/work-type-configs');
  return response.data;
};

export const getActiveWorkTypeConfigs = async (): Promise<WorkTypeConfig[]> => {
  const response = await api.get<WorkTypeConfig[]>('/api/work-type-configs/active');
  return response.data;
};

export const getWorkTypeConfigById = async (id: string): Promise<WorkTypeConfig> => {
  const response = await api.get<WorkTypeConfig>(`/api/work-type-configs/${id}`);
  return response.data;
};

export const createWorkTypeConfig = async (data: CreateWorkTypeConfigRequest): Promise<WorkTypeConfig> => {
  const response = await api.post<WorkTypeConfig>('/api/work-type-configs', data);
  return response.data;
};

export const updateWorkTypeConfig = async (id: string, data: UpdateWorkTypeConfigRequest): Promise<WorkTypeConfig> => {
  const response = await api.put<WorkTypeConfig>(`/api/work-type-configs/${id}`, data);
  return response.data;
};

export const deleteWorkTypeConfig = async (id: string): Promise<void> => {
  await api.delete(`/api/work-type-configs/${id}`);
};

// API Key endpoints
export const generateApiKey = async (description: string): Promise<{ apiKey: string; apiKeyDetails: any }> => {
  const response = await api.post('/api/users/me/apikeys', { description });
  return response.data;
};

// Configuration API (using API key authentication)
export const getConfigurationWithApiKey = async (apiKey: string): Promise<ConfigurationResponse> => {
  const response = await axios.get(`${getApiBaseUrl()}/api/configuration`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

export const getWorkTypesWithApiKey = async (apiKey: string): Promise<{ workTypes: WorkTypeConfigResponseDto[] }> => {
  const response = await axios.get(`${getApiBaseUrl()}/api/configuration/work-types`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};

export const getApiEndpointsWithApiKey = async (apiKey: string): Promise<ApiEndpoints> => {
  const response = await axios.get(`${getApiBaseUrl()}/api/configuration/endpoints`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data;
};