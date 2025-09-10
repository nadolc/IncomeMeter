# IncomeMeter Mobile Data Models and Storage Strategy

## Overview
This document defines the data models, storage strategies, and synchronization patterns for the IncomeMeter mobile application, focusing on offline-first architecture and real-time GPS tracking capabilities.

## Core Data Models

### 1. Route Tracking Models

#### Base Route Interface
```typescript
interface BaseRoute {
  id: string;
  userId: string;
  workType: string;
  workTypeId?: string;
  status: RouteStatus;
  scheduleStart: Date;
  scheduleEnd: Date;
  actualStartTime?: Date;
  actualEndTime?: Date;
  estimatedIncome?: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

enum RouteStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in-progress', 
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'  // Mobile-specific status
}
```

#### Mobile Route Extension
```typescript
interface MobileRoute extends BaseRoute {
  // GPS tracking data
  trackingData: RouteTrackingData;
  
  // Offline synchronization
  syncStatus: SyncStatus;
  lastSyncAt?: Date;
  
  // Mobile-specific metadata
  deviceId: string;
  appVersion: string;
  
  // Income tracking
  incomes: IncomeItem[];
  totalIncome: number;
  
  // Mileage and distance
  startMileage?: number;
  endMileage?: number;
  gpsDistance?: number;
  odometerDistance?: number;
}

enum SyncStatus {
  PENDING = 'pending',
  SYNCING = 'syncing',
  SYNCED = 'synced',
  ERROR = 'error',
  CONFLICT = 'conflict'
}
```

#### Route Tracking Data
```typescript
interface RouteTrackingData {
  // Location tracking
  waypoints: LocationPoint[];
  startLocation?: LocationPoint;
  endLocation?: LocationPoint;
  
  // Performance metrics
  totalDistance: number;
  averageSpeed: number;
  maxSpeed: number;
  duration: number;
  
  // Tracking metadata
  trackingStartedAt?: Date;
  trackingEndedAt?: Date;
  pausedPeriods: PausedPeriod[];
  
  // Quality indicators
  gpsAccuracy: {
    average: number;
    minimum: number;
    maximum: number;
  };
}

interface LocationPoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy: number;
  altitude?: number;
  speed?: number;
  heading?: number;
  
  // Mobile-specific metadata
  batteryLevel?: number;
  networkType?: string;
  isMoving: boolean;
}

interface PausedPeriod {
  startTime: Date;
  endTime?: Date;
  reason: PauseReason;
  location?: LocationPoint;
}

enum PauseReason {
  USER_INITIATED = 'user_initiated',
  LOW_BATTERY = 'low_battery',
  NO_GPS_SIGNAL = 'no_gps_signal',
  APP_BACKGROUND = 'app_background',
  PHONE_CALL = 'phone_call'
}
```

### 2. Income and Financial Models

#### Income Item
```typescript
interface IncomeItem {
  id: string;
  source: string;
  amount: number;
  currency: string;
  timestamp: Date;
  
  // Mobile-specific fields
  entryMethod: IncomeEntryMethod;
  gpsLocation?: LocationPoint;
  photo?: string;  // Base64 or file path
  notes?: string;
}

enum IncomeEntryMethod {
  MANUAL = 'manual',
  VOICE_INPUT = 'voice_input',
  PHOTO_SCAN = 'photo_scan',
  NFC_READ = 'nfc_read',
  SHORTCUT = 'shortcut'
}
```

#### Financial Summary
```typescript
interface FinancialSummary {
  routeId: string;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  incomeBySource: { [source: string]: number };
  hourlyRate: number;
  milesPerDollar: number;
  
  // Tax and accounting
  taxableIncome: number;
  deductibleExpenses: number;
  
  // Performance metrics
  incomePerMile: number;
  incomePerHour: number;
}
```

### 3. User and Configuration Models

#### Mobile User Profile
```typescript
interface MobileUserProfile {
  id: string;
  email: string;
  displayName: string;
  profilePicture?: string;
  
  // Mobile preferences
  preferences: UserPreferences;
  
  // Authentication
  lastLoginAt: Date;
  twoFactorEnabled: boolean;
  
  // Subscription and features
  subscriptionTier: SubscriptionTier;
  enabledFeatures: string[];
}

interface UserPreferences {
  // Location and GPS
  locationAccuracy: LocationAccuracy;
  backgroundTracking: boolean;
  batteryOptimization: boolean;
  
  // UI and UX
  theme: 'light' | 'dark' | 'auto';
  units: 'metric' | 'imperial';
  currency: string;
  language: string;
  
  // Notifications
  routeReminders: boolean;
  incomeNotifications: boolean;
  dailySummary: boolean;
  
  // Privacy
  shareAnalytics: boolean;
  locationDataRetention: number; // days
}

enum LocationAccuracy {
  HIGH = 'high',        // Best accuracy, higher battery usage
  BALANCED = 'balanced', // Good accuracy, moderate battery
  LOW = 'low'           // Lower accuracy, battery saving
}

enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}
```

#### Work Type Configuration
```typescript
interface WorkTypeConfig {
  id: string;
  name: string;
  isActive: boolean;
  
  // Income configuration
  defaultHourlyRate?: number;
  incomeSources: IncomeSource[];
  
  // Mobile-specific settings
  trackingSettings: TrackingSettings;
  
  // Visual configuration
  color: string;
  icon: string;
  
  // Automation rules
  autoStartRules: AutoStartRule[];
  autoEndRules: AutoEndRule[];
}

interface IncomeSource {
  name: string;
  isDefault: boolean;
  expectedRange?: {
    min: number;
    max: number;
  };
}

interface TrackingSettings {
  requireGPS: boolean;
  minimumAccuracy: number;
  trackingInterval: number; // seconds
  pauseThreshold: number;   // seconds of no movement
  
  // Battery optimization
  adaptiveTracking: boolean;
  lowBatteryMode: boolean;
}
```

### 4. Offline Storage Models

#### Sync Queue Item
```typescript
interface SyncQueueItem {
  id: string;
  type: SyncItemType;
  operation: CRUDOperation;
  data: any;
  
  // Scheduling
  createdAt: Date;
  scheduledAt: Date;
  attempts: number;
  maxRetries: number;
  
  // Conflict resolution
  conflictResolution: ConflictResolution;
  serverVersion?: number;
  clientVersion: number;
  
  // Metadata
  deviceId: string;
  networkType?: string;
  
  // Error tracking
  lastError?: string;
  lastErrorAt?: Date;
}

enum SyncItemType {
  ROUTE = 'route',
  INCOME = 'income',
  LOCATION_BATCH = 'location_batch',
  USER_PREFERENCES = 'user_preferences'
}

enum CRUDOperation {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete'
}

enum ConflictResolution {
  CLIENT_WINS = 'client_wins',
  SERVER_WINS = 'server_wins',
  MERGE = 'merge',
  MANUAL = 'manual'
}
```

#### Cached Data
```typescript
interface CachedData<T> {
  key: string;
  data: T;
  cachedAt: Date;
  expiresAt: Date;
  version: number;
  
  // Cache metadata
  size: number;
  accessCount: number;
  lastAccessAt: Date;
  
  // Validation
  checksum?: string;
  isValid: boolean;
}
```

## Storage Architecture

### 1. Local Storage Layers

#### Layer 1: Secure Storage (Keychain/Keystore)
```typescript
interface SecureStorageData {
  // Authentication tokens
  accessToken?: string;
  refreshToken?: string;
  
  // Encryption keys
  dataEncryptionKey: string;
  
  // Biometric settings
  biometricEnabled: boolean;
}
```

#### Layer 2: SQLite Database
```typescript
// Database schema for structured data
interface DatabaseSchema {
  routes: MobileRoute[];
  incomes: IncomeItem[];
  workTypes: WorkTypeConfig[];
  locations: LocationPoint[];
  syncQueue: SyncQueueItem[];
  userPreferences: UserPreferences;
}

// Database indexes for performance
const DATABASE_INDEXES = {
  routes_by_status: 'CREATE INDEX idx_routes_status ON routes(status)',
  routes_by_date: 'CREATE INDEX idx_routes_date ON routes(actualStartTime)',
  locations_by_route: 'CREATE INDEX idx_locations_route ON locations(routeId)',
  locations_by_timestamp: 'CREATE INDEX idx_locations_time ON locations(timestamp)',
  sync_by_priority: 'CREATE INDEX idx_sync_priority ON sync_queue(scheduledAt, attempts)'
};
```

#### Layer 3: AsyncStorage (JSON/Key-Value)
```typescript
// Simple key-value storage for app state
interface AsyncStorageData {
  // App state
  lastAppVersion: string;
  onboardingCompleted: boolean;
  
  // Cache metadata
  cacheStats: CacheStatistics;
  
  // Feature flags
  featureFlags: { [key: string]: boolean };
  
  // Analytics data
  analyticsBuffer: AnalyticsEvent[];
}

interface CacheStatistics {
  totalSize: number;
  itemCount: number;
  hitRate: number;
  lastCleanup: Date;
}
```

### 2. Data Synchronization Strategy

#### Sync Priority Queue
```typescript
enum SyncPriority {
  CRITICAL = 0,    // Authentication, active route data
  HIGH = 1,        // Route completion, income entry
  MEDIUM = 2,      // Route updates, preferences
  LOW = 3,         // Analytics, cache cleanup
  BACKGROUND = 4   // Historical data, optimizations
}

interface PriorityQueue<T> {
  enqueue(item: T, priority: SyncPriority): void;
  dequeue(): T | null;
  peek(): T | null;
  isEmpty(): boolean;
  size(): number;
}
```

#### Conflict Resolution Strategies
```typescript
interface ConflictResolver {
  resolveRouteConflict(local: MobileRoute, remote: BaseRoute): MobileRoute;
  resolveIncomeConflict(local: IncomeItem[], remote: IncomeItem[]): IncomeItem[];
  resolvePreferencesConflict(local: UserPreferences, remote: UserPreferences): UserPreferences;
}

// Example conflict resolution for routes
const resolveRouteConflict = (local: MobileRoute, remote: BaseRoute): MobileRoute => {
  return {
    ...remote,
    // Preserve mobile-specific data
    trackingData: local.trackingData,
    deviceId: local.deviceId,
    syncStatus: SyncStatus.SYNCED,
    lastSyncAt: new Date(),
    
    // Merge income data
    incomes: mergeIncomes(local.incomes, remote.incomes),
    
    // Use server version for core fields, local for tracking
    actualStartTime: remote.actualStartTime || local.actualStartTime,
    actualEndTime: remote.actualEndTime || local.actualEndTime
  };
};
```

## Data Validation and Integrity

### 1. Validation Schemas
```typescript
// Route validation
interface RouteValidation {
  validateRoute(route: MobileRoute): ValidationResult;
  validateLocationPoint(point: LocationPoint): ValidationResult;
  validateIncomeItem(item: IncomeItem): ValidationResult;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Example validation rules
const VALIDATION_RULES = {
  location: {
    latitudeRange: [-90, 90],
    longitudeRange: [-180, 180],
    accuracyThreshold: 100,     // meters
    timestampTolerance: 300,    // seconds
  },
  route: {
    maxDurationHours: 24,
    minDistanceMeters: 10,
    maxSpeedKmh: 200,
  },
  income: {
    maxAmountPerItem: 10000,
    minAmountPerItem: 0.01,
  }
};
```

### 2. Data Encryption
```typescript
interface DataEncryption {
  // Sensitive data encryption
  encryptLocationData(points: LocationPoint[]): EncryptedData;
  decryptLocationData(encrypted: EncryptedData): LocationPoint[];
  
  // Income data encryption
  encryptIncomeData(incomes: IncomeItem[]): EncryptedData;
  decryptIncomeData(encrypted: EncryptedData): IncomeItem[];
}

interface EncryptedData {
  data: string;           // Base64 encoded encrypted data
  iv: string;            // Initialization vector
  algorithm: string;     // Encryption algorithm used
  keyVersion: number;    // Key version for rotation
  createdAt: Date;
}
```

## Performance Optimizations

### 1. Data Compression
```typescript
interface DataCompression {
  compressLocationBatch(points: LocationPoint[]): CompressedLocationBatch;
  decompressLocationBatch(compressed: CompressedLocationBatch): LocationPoint[];
}

interface CompressedLocationBatch {
  routeId: string;
  startTime: Date;
  endTime: Date;
  compressionRatio: number;
  
  // Delta-compressed coordinates
  baseLatitude: number;
  baseLongitude: number;
  deltaPoints: DeltaPoint[];
}

interface DeltaPoint {
  deltaLat: number;      // Offset from base latitude
  deltaLon: number;      // Offset from base longitude
  deltaTime: number;     // Milliseconds from previous point
  accuracy: number;
  speed?: number;
}
```

### 2. Batch Operations
```typescript
interface BatchProcessor {
  batchLocationUpdates(points: LocationPoint[]): LocationBatch[];
  batchSyncOperations(items: SyncQueueItem[]): SyncBatch[];
}

interface LocationBatch {
  routeId: string;
  batchId: string;
  points: LocationPoint[];
  batchSize: number;
  compressionUsed: boolean;
  
  // Quality metrics
  averageAccuracy: number;
  timeSpan: number;
  distance: number;
}

interface SyncBatch {
  batchId: string;
  operations: SyncQueueItem[];
  priority: SyncPriority;
  estimatedSize: number;
  retryPolicy: RetryPolicy;
}
```

## Analytics and Telemetry

### 1. Usage Analytics
```typescript
interface AnalyticsEvent {
  eventType: string;
  timestamp: Date;
  userId: string;
  sessionId: string;
  
  // Event data
  properties: { [key: string]: any };
  
  // Context
  deviceInfo: DeviceInfo;
  appVersion: string;
  
  // Privacy
  anonymized: boolean;
}

interface DeviceInfo {
  platform: 'ios' | 'android';
  osVersion: string;
  deviceModel: string;
  screenSize: string;
  
  // Performance context
  batteryLevel?: number;
  networkType?: string;
  locationPermission?: boolean;
}

// Predefined event types
enum AnalyticsEventType {
  ROUTE_STARTED = 'route_started',
  ROUTE_COMPLETED = 'route_completed',
  ROUTE_PAUSED = 'route_paused',
  INCOME_ADDED = 'income_added',
  GPS_ACCURACY_LOW = 'gps_accuracy_low',
  SYNC_COMPLETED = 'sync_completed',
  SYNC_FAILED = 'sync_failed',
  BATTERY_LOW = 'battery_low',
  APP_BACKGROUND = 'app_background',
  APP_FOREGROUND = 'app_foreground'
}
```

### 2. Performance Metrics
```typescript
interface PerformanceMetrics {
  // App performance
  appStartupTime: number;
  memoryUsage: number;
  batteryUsage: number;
  
  // GPS performance
  gpsAcquisitionTime: number;
  gpsAccuracyMetrics: AccuracyMetrics;
  locationUpdateFrequency: number;
  
  // Sync performance
  syncLatency: number;
  syncSuccessRate: number;
  offlineDataSize: number;
  
  // User experience
  screenLoadTimes: { [screen: string]: number };
  errorRates: { [component: string]: number };
}

interface AccuracyMetrics {
  average: number;
  median: number;
  p95: number;
  worstCase: number;
  samplesCount: number;
}
```

## Data Retention and Cleanup

### 1. Retention Policies
```typescript
interface RetentionPolicy {
  locationData: {
    activeRoutes: number;      // Days to keep for active routes
    completedRoutes: number;   // Days to keep for completed routes
    maxStorageSize: number;    // MB limit for location data
  };
  
  syncQueue: {
    maxAge: number;           // Days before removing completed sync items
    maxFailedAttempts: number; // Remove after N failed attempts
  };
  
  cache: {
    maxAge: number;           // Hours before cache expiry
    maxItems: number;         // Maximum cached items
    sizeLimitMB: number;      // Storage size limit
  };
  
  analytics: {
    bufferDays: number;       // Days to buffer before upload
    maxEvents: number;        // Maximum events in buffer
  };
}

const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  locationData: {
    activeRoutes: 7,
    completedRoutes: 90,
    maxStorageSize: 100
  },
  syncQueue: {
    maxAge: 7,
    maxFailedAttempts: 5
  },
  cache: {
    maxAge: 24,
    maxItems: 1000,
    sizeLimitMB: 50
  },
  analytics: {
    bufferDays: 1,
    maxEvents: 1000
  }
};
```

### 2. Cleanup Operations
```typescript
interface DataCleanupManager {
  performCleanup(): Promise<CleanupResult>;
  scheduleCleanup(interval: number): void;
  getStorageUsage(): Promise<StorageUsage>;
}

interface CleanupResult {
  locationPointsRemoved: number;
  syncItemsRemoved: number;
  cacheItemsRemoved: number;
  bytesFreed: number;
  
  errors: string[];
  duration: number;
}

interface StorageUsage {
  totalUsage: number;
  breakdown: {
    routes: number;
    locations: number;
    cache: number;
    syncQueue: number;
    analytics: number;
  };
  
  limits: {
    warning: number;    // 80% of limit
    critical: number;   // 95% of limit
    maximum: number;    // 100% of limit
  };
}
```

This comprehensive data model specification provides the foundation for building a robust, offline-capable mobile application that can efficiently track routes, manage financial data, and synchronize with the existing IncomeMeter backend infrastructure while maintaining data integrity and optimal performance.