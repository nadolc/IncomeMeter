import Config from 'react-native-config';

export interface AppConfig {
  apiBaseUrl: string;
  apiTimeout: number;
  googleOAuthClientId: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

const createConfig = (): AppConfig => {
  const isDevelopment = Config.NODE_ENV === 'development';
  const isProduction = Config.NODE_ENV === 'production';

  // Validate required configuration
  if (!Config.API_BASE_URL) {
    throw new Error('API_BASE_URL is required in environment configuration');
  }

  // Platform-specific Google OAuth Client ID
  const googleOAuthClientId = Platform.select({
    android: Config.GOOGLE_OAUTH_CLIENT_ID_ANDROID,
    ios: Config.GOOGLE_OAUTH_CLIENT_ID_IOS,
  }) || '';

  if (!googleOAuthClientId && isProduction) {
    console.warn('Google OAuth Client ID not configured for this platform');
  }

  // Security validation for production
  if (isProduction) {
    if (Config.API_BASE_URL.includes('localhost')) {
      throw new Error('Production API URL cannot contain localhost');
    }
    if (!Config.API_BASE_URL.startsWith('https://')) {
      throw new Error('Production API URL must use HTTPS');
    }
  }

  return {
    apiBaseUrl: Config.API_BASE_URL,
    apiTimeout: parseInt(Config.API_TIMEOUT || '10000', 10),
    googleOAuthClientId,
    isDevelopment,
    isProduction,
  };
};

// Import Platform after the function definition to avoid circular dependency
import { Platform } from 'react-native';

export const appConfig = createConfig();

// Log configuration in development (without sensitive data)
if (__DEV__) {
  console.log('App Configuration:', {
    apiBaseUrl: appConfig.apiBaseUrl,
    apiTimeout: appConfig.apiTimeout,
    isDevelopment: appConfig.isDevelopment,
    isProduction: appConfig.isProduction,
    hasGoogleOAuthClientId: !!appConfig.googleOAuthClientId,
  });
}