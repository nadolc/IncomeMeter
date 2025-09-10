# IncomeMeter Mobile API Integration Guide

## Overview
This document provides comprehensive API integration guidance for the IncomeMeter mobile application, detailing existing endpoints, data models, and integration patterns.

## API Base Configuration

### Environment Configuration
```typescript
// API Configuration
const API_CONFIG = {
  development: {
    baseUrl: 'https://localhost:7079',
    timeout: 30000,
  },
  production: {
    baseUrl: 'https://incomemeter-api-app-cbf9hubqdhcjh7e5.uksouth-01.azurewebsites.net',
    timeout: 30000,
  }
};
```

### Authentication Headers
```typescript
// Standard API headers
const getApiHeaders = (token?: string) => ({
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  ...(token && { 'Authorization': `Bearer ${token}` })
});
```

## Authentication Endpoints

### 1. Google OAuth Login
**Endpoint:** `POST /api/auth/google`
**Purpose:** Initial web-based OAuth authentication

**Request:**
```typescript
interface GoogleAuthRequest {
  credential: string;  // Google OAuth credential
}
```

**Response:**
```typescript
interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    displayName: string;
    profilePicture?: string;
  };
}
```

### 2. Unified Mobile Login
**Endpoint:** `POST /api/mobile/login`
**Purpose:** Cross-platform mobile authentication with 2FA support for both iOS and Android

**Request:**
```typescript
interface MobileLoginRequest {
  email: string;
  password: string;
  twoFactorCode: string;    // 6-digit TOTP code
  deviceId: string;         // Unique device identifier
  platform: MobilePlatform; // iOS, Android, or Unknown
  appVersion?: string;      // App version for compatibility
  deviceInfo?: DeviceInfo;  // Device metadata
}

enum MobilePlatform {
  iOS = "iOS",
  Android = "Android", 
  Unknown = "Unknown"
}

interface DeviceInfo {
  deviceModel?: string;
  osVersion?: string;
  timezone?: string;
  language?: string;
  batteryLevel?: number;
  lowPowerMode?: boolean;
  networkType?: string;
}
```

**Response:**
```typescript
interface MobileTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt?: Date;
  requiresTwoFactor: boolean;
  userInfo?: MobileUserInfo;
  mobileConfig?: MobileConfig;
}

interface MobileUserInfo {
  userId: string;
  displayName: string;
  email: string;
  profilePicture?: string;
  twoFactorEnabled: boolean;
  enabledFeatures: string[];
}

interface MobileConfig {
  locationConfig: LocationConfig;
  syncConfig: SyncConfig;
  uiConfig: UIConfig;
  platformSettings: { [key: string]: any };
}
```

### 3. Mobile Token Refresh
**Endpoint:** `POST /api/mobile/refresh`
**Purpose:** Refresh expired access tokens with platform detection

**Request:**
```typescript
interface RefreshTokenRequest {
  refreshToken: string;
}
```

**Response:** Same as mobile login response (`MobileTokenResponse`)

**Features:**
- Automatic platform detection from User-Agent
- Updated mobile configuration on refresh
- Enhanced security logging

### 4. Mobile Integration Setup
**Endpoint:** `POST /api/mobile/setup`
**Purpose:** Validate tokens and setup mobile app integration for both iOS and Android

**Request:**
```typescript
interface MobileSetupRequest {
  accessToken: string;
  refreshToken: string;
  platform: MobilePlatform;
  appVersion?: string;
  deviceId?: string;
}
```

**Response:**
```typescript
interface MobileSetupResponse {
  success: boolean;
  message: string;
  userId?: string;
  userName?: string;
  tokenExpiry?: Date;
  refreshExpiry?: Date;
  platformConfig?: { [key: string]: any };
}
```

**Platform-Specific Config:**
```typescript
// iOS Configuration
{
  "shortcuts_enabled": true,
  "siri_enabled": true,
  "carplay_support": true,
  "background_app_refresh": true
}

// Android Configuration  
{
  "widgets_enabled": true,
  "auto_support": true,
  "background_location": true,
  "quick_settings_tile": true
}
```

## Route Management Endpoints

### 1. Get User Routes
**Endpoint:** `GET /api/routes`
**Purpose:** Retrieve all routes for authenticated user

**Headers:** Requires Bearer token

**Response:**
```typescript
interface Route {
  id: string;
  userId: string;
  workType: string;
  workTypeId?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  scheduleStart: Date;
  scheduleEnd: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  incomes: IncomeItem[];
  totalIncome: number;
  estimatedIncome: number;
  distance: number;
  startMile?: number;
  endMile?: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface IncomeItem {
  source: string;
  amount: number;
}
```

### 2. Get Routes by Status
**Endpoint:** `GET /api/routes/status/{status}`
**Purpose:** Filter routes by status

**Parameters:**
- `status`: 'scheduled' | 'in-progress' | 'completed' | 'cancelled'

**Response:** Array of `Route` objects

### 3. Get Routes by Date Range
**Endpoint:** `GET /api/routes/date-range?startDate={start}&endDate={end}`
**Purpose:** Filter routes by date range

**Parameters:**
- `startDate`: ISO date string
- `endDate`: ISO date string

**Response:** Array of `Route` objects

### 4. Get Route Details
**Endpoint:** `GET /api/routes/{id}`
**Purpose:** Get detailed information for specific route

**Parameters:**
- `id`: Route ID

**Response:** Single `Route` object

### 5. Create Route
**Endpoint:** `POST /api/routes`
**Purpose:** Create new scheduled route

**Request:**
```typescript
interface CreateRouteDto {
  workType: string;
  workTypeId?: string;
  scheduleStart: Date;
  scheduleEnd: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  incomes?: IncomeItem[];
  startMile?: number;
  endMile?: number;
  estimatedIncome?: number;
  description?: string;
  status?: string;
}
```

**Response:** Created `Route` object

### 6. Update Route
**Endpoint:** `PUT /api/routes/{id}`
**Purpose:** Update existing route

**Request:**
```typescript
interface UpdateRouteDto {
  workType?: string;
  workTypeId?: string;
  scheduleStart?: Date;
  scheduleEnd?: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  incomes?: IncomeItem[];
  estimatedIncome?: number;
  startMile?: number;
  endMile?: number;
  status?: string;
}
```

**Response:** Updated `Route` object

### 7. Delete Route
**Endpoint:** `DELETE /api/routes/{id}`
**Purpose:** Delete route

**Response:** `204 No Content` on success

## Mobile-Optimized Route Endpoints

### 1. Start Route (Mobile)
**Endpoint:** `POST /api/mobile/routes/start`
**Purpose:** Start route tracking on mobile device with enhanced GPS and device support

**Headers:** Requires Bearer token
**Request:**
```typescript
interface MobileStartRouteRequest {
  // Base route information
  workType: string;
  workTypeId?: string;
  startMile: number;
  estimatedIncome?: number;
  
  // Mobile-specific enhancements
  startLocation?: LocationPoint;
  deviceInfo?: DeviceInfo;
  platform: MobilePlatform;
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  batteryLevel?: number;
  isMoving: boolean;
  networkType?: string;
}
```

**Response:**
```typescript
interface MobileRouteResponse {
  success: boolean;
  message: string;
  route: RouteResponseDto;
  userName: string;
  context?: MobileRouteContext;
}

interface MobileRouteContext {
  suggestedActions: string[];
  insights: { [key: string]: any };
  notifications: MobileNotification[];
}
```

**Features:**
- Cross-platform support (iOS and Android)
- GPS location tracking integration
- Device-specific optimizations
- Smart suggestions and contextual actions
- Enhanced logging with platform detection
- Battery and network awareness

### 2. End Route (Mobile)
**Endpoint:** `POST /api/mobile/routes/end`
**Purpose:** Complete route tracking with GPS waypoints and quality metrics

**Headers:** Requires Bearer token
**Request:**
```typescript
interface MobileEndRouteRequest {
  // Base route completion
  id: string;
  endMile: number;
  incomes: IncomeItem[];
  
  // Mobile-specific enhancements
  endLocation?: LocationPoint;
  waypoints?: LocationPoint[];
  deviceInfo?: DeviceInfo;
  platform: MobilePlatform;
  quality?: RouteQuality;
}

interface RouteQuality {
  averageAccuracy: number;
  gpsReliability: number;
  dataPoints: number;
  issues: string[];
  batteryImpact: number;
}
```

**Response:**
```typescript
interface MobileRouteResponse {
  success: boolean;
  message: string;
  route: RouteResponseDto;
  userName: string;
  context?: MobileRouteContext;
}
```

**Enhanced Features:**
- GPS waypoint collection and analysis
- Route quality metrics and validation
- Cross-platform route completion
- Performance insights and suggestions
- Battery usage optimization feedback
- Automatic route analysis and recommendations

## Work Type Configuration

### Get Work Type Configs
**Endpoint:** `GET /api/worktype-configs`
**Purpose:** Get available work types and configurations

**Response:**
```typescript
interface WorkTypeConfig {
  id: string;
  name: string;
  isActive: boolean;
  defaultHourlyRate?: number;
  incomeSources: string[];
  description?: string;
}
```

## Dashboard and Analytics

### Get Dashboard Analytics
**Endpoint:** `GET /api/dashboard/analytics`
**Purpose:** Get user analytics and summary data

**Response:**
```typescript
interface DashboardAnalytics {
  totalRoutes: number;
  totalIncome: number;
  totalDistance: number;
  averageIncomePerRoute: number;
  routesByStatus: {
    scheduled: number;
    inProgress: number;
    completed: number;
    cancelled: number;
  };
  recentRoutes: Route[];
  topWorkTypes: {
    workType: string;
    routeCount: number;
    totalIncome: number;
  }[];
}
```

## Transaction Management

### Get Transactions
**Endpoint:** `GET /api/transactions`
**Purpose:** Get user transaction history

**Response:**
```typescript
interface Transaction {
  id: string;
  userId: string;
  routeId?: string;
  amount: number;
  source: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

## Error Handling

### Standard Error Response Format
```typescript
interface ApiError {
  message: string;
  status: number;
  errors?: { [key: string]: string[] };
  timestamp: Date;
}
```

### Common HTTP Status Codes
- `200`: Success
- `201`: Created
- `204`: No Content (successful delete)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid/expired token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

### Authentication Error Handling
```typescript
// Handle common authentication errors
const handleAuthError = (error: ApiError) => {
  switch (error.status) {
    case 401:
      // Token expired - attempt refresh or redirect to login
      return handleTokenRefresh();
    case 403:
      // Insufficient permissions
      return showPermissionError();
    default:
      return showGenericError(error.message);
  }
};
```

## Mobile-Specific Considerations

### 1. Token Management
```typescript
// Automatic token refresh implementation
class ApiClient {
  private async makeRequest<T>(config: RequestConfig): Promise<T> {
    try {
      return await this.httpClient.request<T>(config);
    } catch (error) {
      if (error.status === 401) {
        // Attempt token refresh
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry original request with new token
          return await this.httpClient.request<T>(config);
        } else {
          // Redirect to login
          throw new AuthenticationError('Session expired');
        }
      }
      throw error;
    }
  }
}
```

### 2. Offline Support
```typescript
// Queue API calls for offline sync
interface QueuedRequest {
  id: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  timestamp: Date;
  retryCount: number;
}

class OfflineQueue {
  async queueRequest(request: QueuedRequest): Promise<void> {
    // Store in local storage for later sync
  }
  
  async syncPendingRequests(): Promise<void> {
    // Process queued requests when online
  }
}
```

### 3. Real-time Updates
```typescript
// WebSocket integration for real-time route updates
class RouteTrackingService {
  private websocket: WebSocket;
  
  startRealtimeTracking(routeId: string): void {
    this.websocket = new WebSocket(`${WS_URL}/route/${routeId}`);
    
    this.websocket.onmessage = (event) => {
      const update = JSON.parse(event.data);
      this.handleRouteUpdate(update);
    };
  }
  
  sendLocationUpdate(location: LocationPoint): void {
    if (this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        type: 'location_update',
        data: location
      }));
    }
  }
}
```

## API Client Implementation Example

### TypeScript API Client
```typescript
class IncomeMeterMobileApiClient {
  private baseUrl: string;
  private timeout: number;
  private platform: MobilePlatform;
  private deviceInfo: DeviceInfo;
  
  constructor(config: ApiConfig, platform: MobilePlatform, deviceInfo: DeviceInfo) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
    this.platform = platform;
    this.deviceInfo = deviceInfo;
  }
  
  // Authentication
  async loginWithCredentials(credentials: MobileLoginRequest): Promise<MobileTokenResponse> {
    return this.post<MobileTokenResponse>('/api/mobile/login', {
      ...credentials,
      platform: this.platform,
      deviceInfo: this.deviceInfo
    });
  }
  
  async refreshToken(refreshToken: string): Promise<MobileTokenResponse> {
    return this.post<MobileTokenResponse>('/api/mobile/refresh', { refreshToken });
  }
  
  async setupMobileIntegration(setupData: MobileSetupRequest): Promise<MobileSetupResponse> {
    return this.post<MobileSetupResponse>('/api/mobile/setup', {
      ...setupData,
      platform: this.platform
    });
  }
  
  // Route Management
  async getRoutes(): Promise<Route[]> {
    return this.get<Route[]>('/api/routes');
  }
  
  async startRoute(routeData: MobileStartRouteRequest): Promise<MobileRouteResponse> {
    return this.post<MobileRouteResponse>('/api/mobile/routes/start', {
      ...routeData,
      platform: this.platform,
      deviceInfo: this.deviceInfo
    });
  }
  
  async endRoute(routeData: MobileEndRouteRequest): Promise<MobileRouteResponse> {
    return this.post<MobileRouteResponse>('/api/mobile/routes/end', {
      ...routeData,
      platform: this.platform,
      deviceInfo: this.deviceInfo
    });
  }
  
  // Mobile-specific features
  async syncOfflineData(offlineData: OfflineDataBatch): Promise<SyncResponse> {
    return this.post<SyncResponse>('/api/mobile/sync', offlineData);
  }
  
  async uploadWaypoints(routeId: string, waypoints: LocationPoint[]): Promise<void> {
    await this.post<void>(`/api/mobile/routes/${routeId}/waypoints`, { waypoints });
  }
  
  async getRouteQuality(routeId: string): Promise<RouteQuality> {
    return this.get<RouteQuality>(`/api/mobile/routes/${routeId}/quality`);
  }
  
  // Device management
  async updateDeviceInfo(deviceInfo: DeviceInfo): Promise<void> {
    this.deviceInfo = deviceInfo;
    await this.post<void>('/api/mobile/device/update', deviceInfo);
  }
  
  async reportBatteryStatus(batteryLevel: number, lowPowerMode: boolean): Promise<void> {
    await this.post<void>('/api/mobile/device/battery', { batteryLevel, lowPowerMode });
  }
  
  // Generic HTTP methods with mobile enhancements
  private async get<T>(endpoint: string): Promise<T> {
    return this.request<T>('GET', endpoint);
  }
  
  private async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }
  
  private async request<T>(method: string, endpoint: string, data?: any): Promise<T> {
    const token = await this.getStoredToken();
    
    const config: RequestConfig = {
      method,
      url: `${this.baseUrl}${endpoint}`,
      headers: {
        ...getApiHeaders(token),
        'X-Platform': this.platform,
        'X-Device-ID': this.deviceInfo.deviceId,
        'X-App-Version': this.deviceInfo.appVersion || 'unknown'
      },
      timeout: this.timeout,
      ...(data && { data })
    };
    
    return this.makeRequest<T>(config);
  }
  
  // Mobile-specific request handling
  private async makeRequest<T>(config: RequestConfig): Promise<T> {
    try {
      return await this.httpClient.request<T>(config);
    } catch (error) {
      if (error.status === 401) {
        // Enhanced token refresh for mobile
        const refreshed = await this.refreshTokenWithRetry();
        if (refreshed) {
          // Update headers and retry
          const newToken = await this.getStoredToken();
          config.headers.Authorization = `Bearer ${newToken}`;
          return await this.httpClient.request<T>(config);
        } else {
          // Enhanced mobile logout
          await this.handleMobileLogout();
          throw new MobileAuthenticationError('Session expired');
        }
      }
      
      // Mobile-specific error handling
      if (error.status === 0 || error.code === 'NETWORK_ERROR') {
        // Queue for offline sync
        await this.queueForOfflineSync(config);
        throw new NetworkError('Request queued for offline sync');
      }
      
      throw error;
    }
  }
  
  // Mobile-specific helper methods
  private async refreshTokenWithRetry(maxAttempts: number = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const refreshToken = await this.getStoredRefreshToken();
        if (!refreshToken) return false;
        
        const response = await this.refreshToken(refreshToken);
        await this.storeTokens(response);
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
    await this.clearStoredTokens();
    
    // Clear offline data (optional)
    await this.clearOfflineData();
    
    // Notify app to redirect to login
    this.notifyLogout();
  }
  
  private async queueForOfflineSync(config: RequestConfig): Promise<void> {
    // Implementation depends on offline storage strategy
    // Queue the request for later sync when network is available
  }
}

// Enhanced interfaces for mobile
interface MobileAuthenticationError extends Error {
  readonly isMobileAuthError: true;
}

interface NetworkError extends Error {
  readonly isNetworkError: true;
}

interface OfflineDataBatch {
  routes: Partial<Route>[];
  waypoints: LocationPoint[];
  incomes: IncomeItem[];
  syncTimestamp: Date;
}

interface SyncResponse {
  success: boolean;
  syncedItems: number;
  conflicts: SyncConflict[];
  nextSyncRecommended: Date;
}

interface SyncConflict {
  type: 'route' | 'income' | 'waypoint';
  localItem: any;
  serverItem: any;
  resolution: 'client_wins' | 'server_wins' | 'manual_required';
}
```

## Rate Limiting and Performance

### Request Throttling
- **Authentication**: 5 requests per minute per IP
- **Route Operations**: 60 requests per minute per user
- **Location Updates**: 4 requests per minute per active route

### Caching Strategy
```typescript
// Cache configuration for mobile app
const CACHE_CONFIG = {
  routes: { ttl: 300000 },        // 5 minutes
  workTypes: { ttl: 3600000 },    // 1 hour
  userProfile: { ttl: 1800000 },  // 30 minutes
  analytics: { ttl: 600000 },     // 10 minutes
};
```

### Batch Operations
```typescript
// Batch multiple route updates
interface BatchRouteUpdate {
  operations: {
    routeId: string;
    operation: 'update' | 'delete';
    data?: UpdateRouteDto;
  }[];
}
```

## Security Considerations

### Token Security
- Store tokens in secure keychain/keystore
- Implement automatic token rotation
- Use certificate pinning for production

### Data Validation
- Validate all input data on client side
- Sanitize user inputs before API calls
- Implement request signing for critical operations

### Privacy Protection
- Encrypt sensitive data in local storage
- Implement user consent for location tracking
- Provide data deletion capabilities

This API integration guide provides the foundation for implementing a robust mobile application that leverages the existing IncomeMeter backend infrastructure while providing enhanced mobile-specific functionality for route tracking and management.