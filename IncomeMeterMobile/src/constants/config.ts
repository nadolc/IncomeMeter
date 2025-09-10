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

export const ACCESSIBILITY_CONFIG = {
  minimumTouchTarget: 44, // iOS HIG standard
  recommendedTouchTarget: 48, // Android Material Design
  minimumContrast: 4.5, // WCAG AA standard
  preferredContrast: 7.0, // WCAG AAA standard
};

export const COLORS = {
  // High contrast colors for accessibility
  primary: {
    background: '#FFFFFF',
    text: '#1a1a1a',        // 14.3:1 ratio
    contrast: '#000000'      // 21:1 ratio
  },
  
  success: {
    background: '#f0f9f0',
    text: '#1b5e20',        // 7.2:1 ratio
    border: '#4caf50'
  },
  
  error: {
    background: '#fdf2f2',
    text: '#c62828',        // 5.9:1 ratio
    border: '#f44336'
  },
  
  warning: {
    background: '#fffef0',
    text: '#e65100',        // 5.4:1 ratio
    border: '#ff9800'
  }
};

export const TYPOGRAPHY = {
  // Minimum font sizes for accessibility
  small: 14,    // Never go below 14pt for body text
  body: 16,     // Default body text size
  large: 18,    // Large text for better readability
  heading: 20,  // Minimum heading size
  
  // Line height for readability
  lineHeight: {
    small: 1.4,
    body: 1.5,
    large: 1.6
  },
  
  // Font weight for clarity
  fontWeight: {
    regular: '400',
    medium: '500',   // For emphasis without bold
    semibold: '600', // For headings
    bold: '700'      // For strong emphasis only
  }
};