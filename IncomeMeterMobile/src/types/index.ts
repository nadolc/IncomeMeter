// Platform types
export enum MobilePlatform {
  iOS = 'iOS',
  Android = 'Android',
  Unknown = 'Unknown'
}

// Base entity interface
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

// API response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Location types
export interface LocationPoint {
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

// Device information
export interface DeviceInfo {
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  timezone?: string;
  language?: string;
  batteryLevel?: number;
  lowPowerMode?: boolean;
  networkType?: string;
  deviceId: string;
}

// Route types
export interface Route extends BaseEntity {
  userId: string;
  workType: string;
  workTypeId?: string;
  status: RouteStatus;
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
}

export enum RouteStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in-progress', 
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

export interface IncomeItem {
  id: string;
  source: string;
  amount: number;
  currency: string;
  timestamp: Date;
  entryMethod: IncomeEntryMethod;
  gpsLocation?: LocationPoint;
  photo?: string;
  notes?: string;
}

export enum IncomeEntryMethod {
  MANUAL = 'manual',
  VOICE_INPUT = 'voice_input',
  PHOTO_SCAN = 'photo_scan',
  NFC_READ = 'nfc_read',
  SHORTCUT = 'shortcut'
}

// User types
export interface User extends BaseEntity {
  email: string;
  displayName: string;
  profilePicture?: string;
  twoFactorEnabled: boolean;
  lastLoginAt?: Date;
  preferences: UserPreferences;
  subscriptionTier: SubscriptionTier;
  enabledFeatures: string[];
}

export interface UserPreferences {
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

export enum LocationAccuracy {
  HIGH = 'high',
  BALANCED = 'balanced',
  LOW = 'low'
}

export enum SubscriptionTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

// Mobile API types
export interface MobileLoginRequest {
  email: string;
  password: string;
  twoFactorCode: string;
  deviceId: string;
  platform: MobilePlatform;
  appVersion?: string;
  deviceInfo?: DeviceInfo;
}

export interface MobileTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshExpiresAt?: Date;
  requiresTwoFactor: boolean;
  userInfo?: MobileUserInfo;
  mobileConfig?: MobileConfig;
}

export interface MobileUserInfo {
  userId: string;
  displayName: string;
  email: string;
  profilePicture?: string;
  twoFactorEnabled: boolean;
  enabledFeatures: string[];
}

export interface MobileConfig {
  locationConfig: LocationConfig;
  syncConfig: SyncConfig;
  uiConfig: UIConfig;
  platformSettings: { [key: string]: any };
}

export interface LocationConfig {
  minAccuracy: number;
  updateInterval: number;
  backgroundTracking: boolean;
  batteryOptimization: string;
}

export interface SyncConfig {
  syncInterval: number;
  offlineRetentionDays: number;
  wifiOnlySync: boolean;
  batchSize: number;
}

export interface UIConfig {
  theme: string;
  units: string;
  language: string;
  accessibilityFeatures: string[];
}

// Navigation types
export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  Auth: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Track: undefined;
  History: undefined;
  Analytics: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
};

// Onboarding types
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  skippable: boolean;
  required: boolean;
}

export interface OnboardingProgress {
  currentStep: number;
  totalSteps: number;
  completedSteps: string[];
  userData: { [key: string]: any };
}

// Accessibility types
export interface AccessibilityProps {
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
}

export type AccessibilityRole = 
  | 'none'
  | 'button'
  | 'link'
  | 'search'
  | 'image'
  | 'keyboardkey'
  | 'text'
  | 'adjustable'
  | 'imagebutton'
  | 'header'
  | 'summary'
  | 'alert'
  | 'checkbox'
  | 'combobox'
  | 'menu'
  | 'menubar'
  | 'menuitem'
  | 'progressbar'
  | 'radio'
  | 'radiogroup'
  | 'scrollbar'
  | 'spinbutton'
  | 'switch'
  | 'tab'
  | 'tablist'
  | 'timer'
  | 'toolbar';

export interface AccessibilityState {
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean | 'mixed';
  busy?: boolean;
  expanded?: boolean;
}

// Error types
export interface AppError extends Error {
  code?: string;
  context?: string;
  recoverable?: boolean;
}

export interface NetworkError extends AppError {
  isNetworkError: true;
  statusCode?: number;
  response?: any;
}

export interface AuthenticationError extends AppError {
  isAuthError: true;
  needsReauth?: boolean;
}