import axios from 'axios';
import type { DashboardStats, RegisterFormData, Route, User, UserSettings } from "../types";

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

// For development: point to .NET API server
// For production: same domain as frontend
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.DEV ? 'https://localhost:7079' : window.location.origin
);

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

// Location endpoints
export const getLocationsByRouteId = async (routeId: string) => {
  const response = await api.get(`/api/locations?routeId=${routeId}`);
  return response.data;
};