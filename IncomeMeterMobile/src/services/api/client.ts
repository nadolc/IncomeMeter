import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_CONFIG } from '../../constants/config';
import { 
  MobilePlatform, 
  DeviceInfo, 
  MobileTokenResponse,
  MobileLoginRequest,
  ApiResponse,
  NetworkError,
  AuthenticationError
} from '../../types';
import { AuthService } from '../auth/AuthService';
import { Platform } from 'react-native';

class IncomeMeterMobileApiClient {
  private client: AxiosInstance;
  private authService: AuthService;
  private platform: MobilePlatform;
  private deviceInfo: DeviceInfo;

  constructor(platform: MobilePlatform, deviceInfo: DeviceInfo) {
    const config = __DEV__ ? API_CONFIG.development : API_CONFIG.production;
    
    this.platform = platform;
    this.deviceInfo = deviceInfo;
    this.authService = new AuthService();
    
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Platform': this.platform,
        'X-Device-ID': this.deviceInfo.deviceId,
        'X-App-Version': this.deviceInfo.appVersion || 'unknown'
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for auth token and device info
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.authService.getStoredToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add current battery level and network info if available
        const currentDeviceInfo = await this.getCurrentDeviceInfo();
        if (currentDeviceInfo.batteryLevel) {
          config.headers['X-Battery-Level'] = currentDeviceInfo.batteryLevel.toString();
        }
        if (currentDeviceInfo.networkType) {
          config.headers['X-Network-Type'] = currentDeviceInfo.networkType;
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for token refresh and error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshed = await this.refreshTokenWithRetry();
            if (refreshed) {
              const newToken = await this.authService.getStoredToken();
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            await this.handleMobileLogout();
            throw new AuthenticationError('Session expired');
          }
        }
        
        // Handle network errors
        if (error.code === 'NETWORK_ERROR' || !error.response) {
          throw new NetworkError('Network connection failed', error);
        }

        return Promise.reject(error);
      }
    );
  }

  // Authentication methods
  async loginWithCredentials(credentials: Omit<MobileLoginRequest, 'platform' | 'deviceInfo'>): Promise<MobileTokenResponse> {
    const loginRequest: MobileLoginRequest = {
      ...credentials,
      platform: this.platform,
      deviceInfo: this.deviceInfo
    };

    const response = await this.post<MobileTokenResponse>('/api/mobile/login', loginRequest);
    
    // Store tokens after successful login
    await this.authService.storeTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: response.expiresAt
    });

    return response;
  }

  async refreshToken(): Promise<MobileTokenResponse> {
    const refreshToken = await this.authService.getStoredRefreshToken();
    if (!refreshToken) {
      throw new AuthenticationError('No refresh token available');
    }

    const response = await this.post<MobileTokenResponse>('/api/mobile/refresh', { refreshToken });
    
    // Store new tokens
    await this.authService.storeTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: response.expiresAt
    });

    return response;
  }

  async setupMobileIntegration(accessToken: string, refreshToken: string) {
    return this.post('/api/mobile/setup', {
      accessToken,
      refreshToken,
      platform: this.platform,
      appVersion: this.deviceInfo.appVersion,
      deviceId: this.deviceInfo.deviceId
    });
  }

  // Route management methods
  async getRoutes() {
    return this.get('/api/routes');
  }

  async getRouteById(id: string) {
    return this.get(`/api/routes/${id}`);
  }

  async startRoute(routeData: any) {
    const currentLocation = await this.getCurrentLocation();
    
    return this.post('/api/mobile/routes/start', {
      ...routeData,
      startLocation: currentLocation,
      platform: this.platform,
      deviceInfo: await this.getCurrentDeviceInfo()
    });
  }

  async endRoute(routeData: any) {
    const currentLocation = await this.getCurrentLocation();
    
    return this.post('/api/mobile/routes/end', {
      ...routeData,
      endLocation: currentLocation,
      platform: this.platform,
      deviceInfo: await this.getCurrentDeviceInfo()
    });
  }

  async getRoutesByStatus(status: string) {
    return this.get(`/api/routes/status/${status}`);
  }

  async getRoutesByDateRange(startDate: string, endDate: string) {
    return this.get(`/api/routes/date-range?startDate=${startDate}&endDate=${endDate}`);
  }

  // Work type configuration
  async getWorkTypeConfigs() {
    return this.get('/api/worktype-configs');
  }

  // Dashboard and analytics
  async getDashboardAnalytics() {
    return this.get('/api/dashboard/analytics');
  }

  // Mobile-specific features
  async syncOfflineData(offlineData: any) {
    return this.post('/api/mobile/sync', offlineData);
  }

  async uploadWaypoints(routeId: string, waypoints: any[]) {
    return this.post(`/api/mobile/routes/${routeId}/waypoints`, { waypoints });
  }

  async reportBatteryStatus(batteryLevel: number, lowPowerMode: boolean) {
    return this.post('/api/mobile/device/battery', { batteryLevel, lowPowerMode });
  }

  async updateDeviceInfo(deviceInfo: Partial<DeviceInfo>) {
    this.deviceInfo = { ...this.deviceInfo, ...deviceInfo };
    return this.post('/api/mobile/device/update', deviceInfo);
  }

  // Generic HTTP methods
  private async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(endpoint, config);
    return response.data.data;
  }

  private async post<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(endpoint, data, config);
    return response.data.data;
  }

  private async put<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(endpoint, data, config);
    return response.data.data;
  }

  private async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(endpoint, config);
    return response.data.data;
  }

  // Helper methods
  private async getCurrentDeviceInfo(): Promise<DeviceInfo> {
    // This would be implemented to get current device state
    // For now, return the stored device info
    return this.deviceInfo;
  }

  private async getCurrentLocation() {
    // This would be implemented to get current GPS location
    // For now, return null
    return null;
  }

  private async refreshTokenWithRetry(maxAttempts: number = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const refreshToken = await this.authService.getStoredRefreshToken();
        if (!refreshToken) return false;
        
        await this.refreshToken();
        return true;
      } catch (error) {
        if (attempt === maxAttempts) {
          return false;
        }
        // Exponential backoff
        await this.delay(Math.pow(2, attempt) * 1000);
      }
    }
    return false;
  }

  private async handleMobileLogout(): Promise<void> {
    // Clear stored tokens
    await this.authService.clearStoredTokens();
    
    // Clear offline data (optional)
    // await this.clearOfflineData();
    
    // Notify app to redirect to login
    // this.notifyLogout();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
let apiClientInstance: IncomeMeterMobileApiClient | null = null;

export const initializeApiClient = (platform: MobilePlatform, deviceInfo: DeviceInfo) => {
  apiClientInstance = new IncomeMeterMobileApiClient(platform, deviceInfo);
  return apiClientInstance;
};

export const getApiClient = (): IncomeMeterMobileApiClient => {
  if (!apiClientInstance) {
    throw new Error('API client not initialized. Call initializeApiClient first.');
  }
  return apiClientInstance;
};

export default IncomeMeterMobileApiClient;