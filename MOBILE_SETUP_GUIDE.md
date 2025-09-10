# IncomeMeter Mobile App Development Setup Guide

## Overview
This guide provides step-by-step instructions for setting up the development environment and creating the IncomeMeter React Native mobile application with full route tracking capabilities.

## Prerequisites

### System Requirements
- **Node.js**: Version 18.x or higher
- **npm** or **yarn**: Latest version
- **Git**: For version control
- **VS Code**: Recommended IDE with React Native extensions

### Platform-Specific Requirements

#### iOS Development
- **macOS**: Required for iOS development
- **Xcode**: Version 14.0 or higher
- **iOS Simulator**: Included with Xcode
- **CocoaPods**: `sudo gem install cocoapods`
- **Apple Developer Account**: For device testing and App Store distribution

#### Android Development
- **Android Studio**: Latest version
- **Android SDK**: API Level 33 (Android 13) or higher
- **Java Development Kit (JDK)**: Version 17
- **Android Emulator**: Configured through Android Studio

## Development Environment Setup

### 1. Install React Native CLI
```bash
# Global installation
npm install -g @react-native-community/cli

# Verify installation
npx react-native --version
```

### 2. Verify Environment Setup
```bash
# Check React Native environment
npx react-native doctor

# Expected output should show all requirements as ✓
```

## Project Initialization

### 1. Create React Native Project
```bash
# Navigate to IncomeMeter root directory
cd /path/to/IncomeMeter

# Create mobile app directory
mkdir IncomeMeterMobile
cd IncomeMeterMobile

# Initialize React Native project with TypeScript
npx react-native@latest init IncomeMeterMobile --template react-native-template-typescript

# Navigate to project directory
cd IncomeMeterMobile
```

### 2. Install Core Dependencies
```bash
# Navigation and routing
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
npm install react-native-screens react-native-safe-area-context

# Platform-specific navigation dependencies
# iOS
cd ios && pod install && cd ..

# State management
npm install @reduxjs/toolkit react-redux

# HTTP client and API integration
npm install axios react-query

# Location and mapping
npm install react-native-maps @react-native-community/geolocation
npm install react-native-background-job

# Storage
npm install @react-native-async-storage/async-storage
npm install react-native-sqlite-storage

# Authentication and security
npm install @react-native-keychain/react-native-keychain
npm install react-native-biometrics

# UI components and utilities
npm install react-native-vector-icons
npm install react-native-paper  # Material Design components
npm install react-native-elements # Additional UI components

# Date and time utilities
npm install date-fns

# Development dependencies
npm install --save-dev @types/react-native-sqlite-storage
npm install --save-dev @types/react-native-vector-icons
```

### 3. Platform-Specific Setup

#### iOS Setup
```bash
# Navigate to iOS directory
cd ios

# Install CocoaPods dependencies
pod install

# Return to project root
cd ..
```

#### Android Setup
```bash
# Add permissions to android/app/src/main/AndroidManifest.xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

## Project Structure Setup

### 1. Create Directory Structure
```bash
# Create main directories
mkdir -p src/components/{Auth,Route,Map,UI,Settings}
mkdir -p src/screens/{Routes,Tracking,Planning,Auth,Settings}
mkdir -p src/services/{api,location,storage,auth}
mkdir -p src/store/{slices,middleware}
mkdir -p src/{utils,types,constants,hooks}
mkdir -p src/assets/{images,icons}
mkdir -p docs
```

### 2. Project Structure Overview
```
IncomeMeterMobile/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Auth/           # Authentication components
│   │   ├── Route/          # Route-related components
│   │   ├── Map/            # Map and location components
│   │   ├── UI/             # General UI components
│   │   └── Settings/       # Settings components
│   ├── screens/            # Screen components
│   │   ├── Routes/         # Route management screens
│   │   ├── Tracking/       # GPS tracking screens
│   │   ├── Planning/       # Route planning screens
│   │   ├── Auth/           # Authentication screens
│   │   └── Settings/       # Settings screens
│   ├── services/           # Business logic services
│   │   ├── api/            # API client and endpoints
│   │   ├── location/       # GPS and location services
│   │   ├── storage/        # Local storage management
│   │   └── auth/           # Authentication services
│   ├── store/              # Redux store configuration
│   │   ├── slices/         # Redux slices
│   │   └── middleware/     # Custom middleware
│   ├── hooks/              # Custom React hooks
│   ├── utils/              # Utility functions
│   ├── types/              # TypeScript definitions
│   ├── constants/          # App constants
│   └── assets/             # Static assets
├── ios/                    # iOS platform files
├── android/                # Android platform files
├── docs/                   # Documentation
└── __tests__/             # Test files
```

## Configuration Files Setup

### 1. TypeScript Configuration
Create `tsconfig.json`:
```json
{
  "extends": "@react-native/typescript-config/tsconfig.json",
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@components/*": ["components/*"],
      "@screens/*": ["screens/*"],
      "@services/*": ["services/*"],
      "@store/*": ["store/*"],
      "@utils/*": ["utils/*"],
      "@types/*": ["types/*"],
      "@constants/*": ["constants/*"],
      "@hooks/*": ["hooks/*"],
      "@assets/*": ["assets/*"]
    }
  },
  "include": [
    "src/**/*",
    "__tests__/**/*"
  ]
}
```

### 2. Babel Configuration
Update `babel.config.js`:
```javascript
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@components': './src/components',
          '@screens': './src/screens',
          '@services': './src/services',
          '@store': './src/store',
          '@utils': './src/utils',
          '@types': './src/types',
          '@constants': './src/constants',
          '@hooks': './src/hooks',
          '@assets': './src/assets',
        },
      },
    ],
  ],
};
```

### 3. Metro Configuration
Create `metro.config.js`:
```javascript
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  resolver: {
    alias: {
      '@components': './src/components',
      '@screens': './src/screens',
      '@services': './src/services',
      '@store': './src/store',
      '@utils': './src/utils',
      '@types': './src/types',
      '@constants': './src/constants',
      '@hooks': './src/hooks',
      '@assets': './src/assets',
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
```

## Core Configuration Setup

### 1. Environment Configuration
Create `src/constants/config.ts`:
```typescript
export const API_CONFIG = {
  development: {
    baseUrl: 'https://localhost:7079',
    timeout: 30000,
  },
  production: {
    baseUrl: 'https://incomemeter-api-app-cbf9hubqdhcjh7e5.uksouth-01.azurewebsites.net',
    timeout: 30000,
  }
};

export const APP_CONFIG = {
  appName: 'IncomeMeter Mobile',
  version: '1.0.0',
  buildNumber: 1,
};

export const LOCATION_CONFIG = {
  accuracyThreshold: 50, // meters
  updateInterval: 15000, // 15 seconds
  fastestInterval: 5000, // 5 seconds
  maxWaitTime: 30000,    // 30 seconds
};

export const STORAGE_CONFIG = {
  databaseName: 'IncomeMeterMobile.db',
  databaseVersion: 1,
  maxStorageSize: 100 * 1024 * 1024, // 100MB
};
```

### 2. Type Definitions
Create `src/types/index.ts`:
```typescript
// Re-export all types from separate files
export * from './route';
export * from './user';
export * from './location';
export * from './sync';
export * from './api';

// Common base types
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

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
```

### 3. API Client Setup
Create `src/services/api/client.ts`:
```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { API_CONFIG } from '@constants/config';
import { AuthService } from '@services/auth';

class ApiClient {
  private client: AxiosInstance;
  private authService: AuthService;

  constructor() {
    const config = __DEV__ ? API_CONFIG.development : API_CONFIG.production;
    
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.authService = new AuthService();
    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for auth token
    this.client.interceptors.request.use(
      async (config) => {
        const token = await this.authService.getStoredToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshed = await this.authService.refreshToken();
            if (refreshed) {
              const newToken = await this.authService.getStoredToken();
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            await this.authService.logout();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async get<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(endpoint, config);
    return response.data;
  }

  async post<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(endpoint, data, config);
    return response.data;
  }

  async put<T>(endpoint: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(endpoint, data, config);
    return response.data;
  }

  async delete<T>(endpoint: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(endpoint, config);
    return response.data;
  }
}

export const apiClient = new ApiClient();
```

## Testing Setup

### 1. Install Testing Dependencies
```bash
npm install --save-dev @testing-library/react-native @testing-library/jest-native
npm install --save-dev jest-react-native
```

### 2. Jest Configuration
Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapping: {
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@store/(.*)$': '<rootDir>/src/store/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
    '^@constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@assets/(.*)$': '<rootDir>/src/assets/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-vector-icons)/)',
  ],
};
```

### 3. Test Setup File
Create `jest.setup.js`:
```javascript
import '@testing-library/jest-native/extend-expect';

// Mock react-native-keychain
jest.mock('@react-native-keychain/react-native-keychain', () => ({
  setInternetCredentials: jest.fn().mockResolvedValue(true),
  getInternetCredentials: jest.fn().mockResolvedValue({ username: 'test', password: 'test' }),
  resetInternetCredentials: jest.fn().mockResolvedValue(true),
}));

// Mock react-native-async-storage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock geolocation
jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
}));
```

## Build Scripts and Scripts

### 1. Update package.json Scripts
```json
{
  "scripts": {
    "android": "react-native run-android",
    "ios": "react-native run-ios",
    "lint": "eslint . --ext .js,.jsx,.ts,.tsx",
    "start": "react-native start",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "build:android": "cd android && ./gradlew assembleRelease",
    "build:ios": "react-native run-ios --configuration Release",
    "clean": "react-native clean-project-auto",
    "pod:install": "cd ios && pod install",
    "pod:update": "cd ios && pod update"
  }
}
```

## Development Workflow

### 1. Initial Development Setup
```bash
# Clone the repository and navigate to mobile directory
git clone <repository-url>
cd IncomeMeter/IncomeMeterMobile

# Install dependencies
npm install

# iOS setup
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# In separate terminals:
# iOS
npm run ios

# Android
npm run android
```

### 2. Development Commands
```bash
# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run tests
npm test

# Run linter
npm run lint

# Clean project (if issues occur)
npm run clean
```

## Debugging Setup

### 1. React Native Debugger
```bash
# Install React Native Debugger (macOS)
brew install --cask react-native-debugger

# Or download from GitHub releases
# https://github.com/jhen0409/react-native-debugger/releases
```

### 2. Flipper Integration
```bash
# Install Flipper
# Download from https://fbflipper.com/

# Add Flipper to iOS (already included in recent React Native versions)
cd ios && pod install
```

### 3. VS Code Extensions
Install recommended VS Code extensions:
- React Native Tools
- TypeScript Hero
- Prettier - Code formatter
- ESLint
- Auto Rename Tag
- Bracket Pair Colorizer
- GitLens

## Performance Monitoring

### 1. Install Performance Monitoring
```bash
# React Native Performance Monitor
npm install @react-native-community/performance

# Bundle analyzer
npm install --save-dev react-native-bundle-analyzer
```

### 2. Performance Scripts
Add to `package.json`:
```json
{
  "scripts": {
    "analyze:bundle": "npx react-native bundle --platform android --dev false --entry-file index.js --bundle-output android-bundle.js && npx react-native-bundle-analyzer ./android-bundle.js"
  }
}
```

## Deployment Preparation

### 1. iOS Release Configuration
Update `ios/IncomeMeterMobile/Info.plist`:
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location access to track your routes and calculate distances.</string>
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>This app needs location access to track your routes in the background.</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>This app needs location access to track your routes in the background.</string>
```

### 2. Android Release Configuration
Update `android/app/build.gradle`:
```gradle
android {
    ...
    defaultConfig {
        ...
        versionCode 1
        versionName "1.0.0"
    }
    
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
}
```

### 3. Environment Variables
Create `.env` files:
```bash
# .env.development
API_BASE_URL=https://localhost:7079
ENVIRONMENT=development

# .env.production
API_BASE_URL=https://incomemeter-api-app-cbf9hubqdhcjh7e5.uksouth-01.azurewebsites.net
ENVIRONMENT=production
```

## Next Steps

1. **Complete Core Components**: Implement authentication, route management, and GPS tracking components
2. **API Integration**: Connect with existing IncomeMeter backend APIs
3. **Location Services**: Implement background GPS tracking functionality
4. **State Management**: Set up Redux store with route and user management slices
5. **Testing**: Write comprehensive unit and integration tests
6. **Performance Optimization**: Implement efficient data synchronization and offline storage
7. **Platform-Specific Features**: Add iOS and Android-specific functionality
8. **App Store Preparation**: Prepare assets and metadata for app store submission

## Troubleshooting Common Issues

### Metro Bundler Issues
```bash
# Clear Metro cache
npx react-native start --reset-cache

# Clean project
npm run clean

# Reinstall node_modules
rm -rf node_modules && npm install
```

### iOS Build Issues
```bash
# Clean iOS build
cd ios && xcodebuild clean && cd ..

# Update CocoaPods
cd ios && pod update && cd ..

# Reset iOS simulator
xcrun simctl erase all
```

### Android Build Issues
```bash
# Clean Android build
cd android && ./gradlew clean && cd ..

# Reset Android emulator
emulator -avd <emulator_name> -wipe-data
```

This setup guide provides a comprehensive foundation for developing the IncomeMeter mobile application with full route tracking capabilities, leveraging the existing backend infrastructure while providing an optimal mobile user experience.