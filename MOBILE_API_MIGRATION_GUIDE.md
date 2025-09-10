# Mobile API Migration Guide: iOS-Specific to Unified Mobile Endpoints

## Overview
This guide provides step-by-step instructions for migrating from iOS-specific endpoints (`/api/ios/*`) to unified mobile endpoints (`/api/mobile/*`) that support both iOS and Android platforms.

## Migration Benefits

### ✅ **Consistency**
- Single set of endpoints for both iOS and Android
- Unified data models and response formats
- Consistent error handling across platforms

### ✅ **Enhanced Features**
- GPS waypoint collection and analysis
- Route quality metrics and validation
- Device-specific optimizations
- Cross-platform configuration management

### ✅ **Better Maintainability**
- Reduced code duplication
- Single source of truth for mobile APIs
- Simplified testing and documentation

### ✅ **Future-Proofing**
- Platform-agnostic architecture
- Easy addition of new mobile platforms
- Scalable mobile feature development

## Endpoint Migration Map

### Authentication Endpoints

| **Old iOS Endpoint** | **New Unified Endpoint** | **Changes Required** |
|---------------------|---------------------------|---------------------|
| `POST /api/ios/login` | `POST /api/mobile/login` | Add platform and deviceInfo fields |
| `POST /api/ios/refresh` | `POST /api/mobile/refresh` | No changes to request, enhanced response |
| `POST /api/ios/setup` | `POST /api/mobile/setup` | Add platform field |

### Route Management Endpoints

| **Old iOS Endpoint** | **New Unified Endpoint** | **Changes Required** |
|---------------------|---------------------------|---------------------|
| `POST /api/ios/start-route` | `POST /api/mobile/routes/start` | Add location and device fields |
| `POST /api/ios/end-route` | `POST /api/mobile/routes/end` | Add waypoints and quality metrics |

## Step-by-Step Migration

### Step 1: Update Authentication

#### Old iOS Login Implementation
```typescript
// ❌ Old iOS-specific implementation
interface IOSLoginRequest {
  email: string;
  password: string;
  twoFactorCode: string;
  deviceId: string;
}

const loginResponse = await apiClient.post<TokenResponse>('/api/ios/login', {
  email: 'user@example.com',
  password: 'password',
  twoFactorCode: '123456',
  deviceId: 'device-123'
});
```

#### New Unified Mobile Login Implementation
```typescript
// ✅ New unified implementation
interface MobileLoginRequest {
  email: string;
  password: string;
  twoFactorCode: string;
  deviceId: string;
  platform: MobilePlatform;     // NEW: Platform identification
  appVersion?: string;          // NEW: App version tracking
  deviceInfo?: DeviceInfo;      // NEW: Enhanced device metadata
}

const loginResponse = await apiClient.post<MobileTokenResponse>('/api/mobile/login', {
  email: 'user@example.com',
  password: 'password',
  twoFactorCode: '123456',
  deviceId: 'device-123',
  platform: MobilePlatform.iOS,  // or MobilePlatform.Android
  appVersion: '1.2.0',
  deviceInfo: {
    deviceModel: 'iPhone 14 Pro',
    osVersion: 'iOS 17.0',
    timezone: 'America/New_York',
    language: 'en-US',
    batteryLevel: 85,
    lowPowerMode: false,
    networkType: 'wifi'
  }
});
```

#### Enhanced Response Benefits
```typescript
// New response includes enhanced mobile features
interface MobileTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt?: Date;
  requiresTwoFactor: boolean;
  
  // NEW: Enhanced user information
  userInfo?: MobileUserInfo;
  
  // NEW: Mobile-specific configuration
  mobileConfig?: MobileConfig;
}
```

### Step 2: Update Route Management

#### Old iOS Route Start Implementation
```typescript
// ❌ Old iOS-specific implementation
const startResponse = await apiClient.post<StartRouteResponse>('/api/ios/start-route', {
  workType: 'Uber',
  startMile: 15234.5,
  estimatedIncome: 45.00
});
```

#### New Unified Route Start Implementation
```typescript
// ✅ New unified implementation with GPS support
const startResponse = await apiClient.post<MobileRouteResponse>('/api/mobile/routes/start', {
  // Base route information
  workType: 'Uber',
  startMile: 15234.5,
  estimatedIncome: 45.00,
  
  // NEW: GPS location data
  startLocation: {
    latitude: 40.7128,
    longitude: -74.0060,
    timestamp: new Date(),
    accuracy: 5.0,
    altitude: 10.0,
    speed: 0.0,
    heading: 0.0,
    batteryLevel: 85,
    isMoving: false,
    networkType: 'wifi'
  },
  
  // NEW: Device information
  deviceInfo: getCurrentDeviceInfo(),
  
  // NEW: Platform identification
  platform: MobilePlatform.iOS
});
```

#### Old iOS Route End Implementation
```typescript
// ❌ Old iOS-specific implementation
const endResponse = await apiClient.post<EndRouteResponse>('/api/ios/end-route', {
  id: 'route-123',
  endMile: 15298.7,
  incomes: [
    { source: 'Uber', amount: 42.50 },
    { source: 'Tips', amount: 8.00 }
  ]
});
```

#### New Unified Route End Implementation
```typescript
// ✅ New unified implementation with waypoints and quality
const endResponse = await apiClient.post<MobileRouteResponse>('/api/mobile/routes/end', {
  // Base route completion
  id: 'route-123',
  endMile: 15298.7,
  incomes: [
    { source: 'Uber', amount: 42.50 },
    { source: 'Tips', amount: 8.00 }
  ],
  
  // NEW: End location
  endLocation: {
    latitude: 40.7589,
    longitude: -73.9851,
    timestamp: new Date(),
    accuracy: 3.0,
    // ... other location properties
  },
  
  // NEW: Collected waypoints during route
  waypoints: collectedWaypoints, // LocationPoint[]
  
  // NEW: Device information
  deviceInfo: getCurrentDeviceInfo(),
  
  // NEW: Platform identification
  platform: MobilePlatform.iOS,
  
  // NEW: Route quality metrics
  quality: {
    averageAccuracy: 5.2,
    gpsReliability: 0.95,
    dataPoints: 247,
    issues: [],
    batteryImpact: 3
  }
});
```

### Step 3: Update API Client Configuration

#### Old iOS API Client
```typescript
// ❌ Old iOS-specific client
class IOSApiClient {
  async loginWithCredentials(credentials: IOSLoginRequest): Promise<TokenResponse> {
    return this.post('/api/ios/login', credentials);
  }
  
  async startRoute(data: StartRouteDto): Promise<StartRouteResponse> {
    return this.post('/api/ios/start-route', data);
  }
  
  async endRoute(data: EndRouteDto): Promise<EndRouteResponse> {
    return this.post('/api/ios/end-route', data);
  }
}
```

#### New Unified Mobile API Client
```typescript
// ✅ New unified mobile client
class MobileApiClient {
  constructor(
    private platform: MobilePlatform,
    private deviceInfo: DeviceInfo
  ) {}
  
  async loginWithCredentials(credentials: MobileLoginRequest): Promise<MobileTokenResponse> {
    return this.post('/api/mobile/login', {
      ...credentials,
      platform: this.platform,
      deviceInfo: this.deviceInfo
    });
  }
  
  async startRoute(data: MobileStartRouteRequest): Promise<MobileRouteResponse> {
    return this.post('/api/mobile/routes/start', {
      ...data,
      platform: this.platform,
      deviceInfo: this.deviceInfo
    });
  }
  
  async endRoute(data: MobileEndRouteRequest): Promise<MobileRouteResponse> {
    return this.post('/api/mobile/routes/end', {
      ...data,
      platform: this.platform,
      deviceInfo: this.deviceInfo
    });
  }
  
  // Enhanced headers for all requests
  private getHeaders(token?: string) {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Platform': this.platform,
      'X-Device-ID': this.deviceInfo.deviceId,
      'X-App-Version': this.deviceInfo.appVersion || 'unknown',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }
}
```

## Migration Timeline and Strategy

### Phase 1: Preparation (Week 1)
- [ ] Update TypeScript interfaces and types
- [ ] Create unified API client classes
- [ ] Implement device information collection
- [ ] Update GPS location tracking integration

### Phase 2: Backend Deployment (Week 2)
- [ ] Deploy new unified mobile endpoints
- [ ] Keep old iOS endpoints running in parallel
- [ ] Monitor both endpoint usage
- [ ] Validate unified endpoint functionality

### Phase 3: Mobile App Updates (Week 3-4)
- [ ] Update iOS app to use unified endpoints
- [ ] Implement Android app with unified endpoints
- [ ] Test cross-platform functionality
- [ ] Deploy mobile app updates

### Phase 4: Cleanup (Week 5)
- [ ] Monitor unified endpoint adoption
- [ ] Deprecate old iOS-specific endpoints
- [ ] Remove old endpoint code after 30-day notice
- [ ] Update documentation and remove legacy references

## Testing Strategy

### Unit Tests
```typescript
describe('Mobile API Client Migration', () => {
  it('should login with enhanced mobile request', async () => {
    const client = new MobileApiClient(MobilePlatform.iOS, mockDeviceInfo);
    const response = await client.loginWithCredentials({
      email: 'test@example.com',
      password: 'password',
      twoFactorCode: '123456',
      deviceId: 'test-device',
      platform: MobilePlatform.iOS,
      appVersion: '1.0.0',
      deviceInfo: mockDeviceInfo
    });
    
    expect(response.userInfo).toBeDefined();
    expect(response.mobileConfig).toBeDefined();
  });
  
  it('should start route with GPS location', async () => {
    const client = new MobileApiClient(MobilePlatform.iOS, mockDeviceInfo);
    const response = await client.startRoute({
      workType: 'Test',
      startMile: 100,
      startLocation: mockLocation,
      platform: MobilePlatform.iOS,
      deviceInfo: mockDeviceInfo
    });
    
    expect(response.context).toBeDefined();
    expect(response.context?.suggestedActions).toContain('track_location');
  });
});
```

### Integration Tests
```typescript
describe('Mobile Endpoint Integration', () => {
  it('should handle iOS to unified migration seamlessly', async () => {
    // Test that old iOS apps can gradually migrate
    const oldIOSResponse = await legacyIOSClient.login(credentials);
    const newMobileResponse = await mobileClient.login(enhancedCredentials);
    
    // Both should work during transition period
    expect(oldIOSResponse.accessToken).toBeDefined();
    expect(newMobileResponse.accessToken).toBeDefined();
  });
  
  it('should provide enhanced features to new mobile clients', async () => {
    const response = await mobileClient.startRoute(enhancedRouteData);
    
    // New features should be available
    expect(response.context?.insights).toBeDefined();
    expect(response.context?.notifications).toBeDefined();
  });
});
```

## Error Handling Migration

### Old Error Handling
```typescript
// ❌ Old iOS-specific error handling
catch (error) {
  if (error.endpoint.includes('/api/ios/')) {
    // iOS-specific error handling
    handleIOSError(error);
  }
}
```

### New Unified Error Handling
```typescript
// ✅ New unified error handling
catch (error) {
  if (error.isMobileAuthError) {
    // Handle mobile authentication errors
    await handleMobileAuthError(error);
  } else if (error.isNetworkError) {
    // Handle network errors with offline queue
    await queueForOfflineSync(originalRequest);
  } else if (error.status === 400 && error.code === 'PLATFORM_MISMATCH') {
    // Handle platform-specific validation errors
    await updatePlatformInfo();
  }
}
```

## Rollback Plan

### Emergency Rollback Procedure
1. **Immediate Actions**
   - Revert mobile app to use old iOS endpoints
   - Monitor old endpoint traffic surge
   - Disable new unified endpoints if critical issues

2. **Communication**
   - Notify users of temporary service disruption
   - Provide estimated resolution timeline
   - Update status page and documentation

3. **Investigation**
   - Analyze unified endpoint logs for issues
   - Compare response formats and data integrity
   - Identify root cause of migration problems

4. **Resolution**
   - Fix identified issues in unified endpoints
   - Test thoroughly in staging environment
   - Gradually re-enable unified endpoints

## Success Metrics

### Technical Metrics
- [ ] 100% feature parity between old and new endpoints
- [ ] <100ms additional response time for enhanced features
- [ ] 0 data loss during migration
- [ ] >99.9% API availability during transition

### User Experience Metrics
- [ ] No increase in authentication failure rates
- [ ] Enhanced GPS accuracy and route tracking
- [ ] Improved battery efficiency with smart optimizations
- [ ] Positive user feedback on new mobile features

### Operational Metrics
- [ ] 50% reduction in API maintenance overhead
- [ ] Single codebase for mobile endpoint logic
- [ ] Unified monitoring and alerting
- [ ] Simplified documentation and onboarding

## Post-Migration Benefits

### For Developers
- **Unified Development**: Single API for both iOS and Android
- **Enhanced Testing**: Consistent behavior across platforms
- **Better Debugging**: Unified logging and monitoring
- **Future Features**: Platform-agnostic feature development

### For Users
- **Consistent Experience**: Same functionality across devices
- **Enhanced Features**: GPS waypoints, route quality metrics
- **Better Performance**: Platform-specific optimizations
- **Reliable Tracking**: Improved location accuracy and battery efficiency

### For Operations
- **Simplified Maintenance**: Single set of endpoints to maintain
- **Better Monitoring**: Unified metrics and alerting
- **Scalable Architecture**: Easy to add new platforms
- **Reduced Complexity**: Less duplicate code and logic

This migration guide ensures a smooth transition from iOS-specific endpoints to a robust, unified mobile API architecture that supports current needs and future growth.