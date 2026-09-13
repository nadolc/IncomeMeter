import * as Keychain from 'react-native-keychain';

const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
} as const;

interface SecureStorageService {
  setAccessToken: (token: string) => Promise<void>;
  getAccessToken: () => Promise<string | null>;
  removeAccessToken: () => Promise<void>;

  setRefreshToken: (token: string) => Promise<void>;
  getRefreshToken: () => Promise<string | null>;
  removeRefreshToken: () => Promise<void>;

  setUserData: (userData: any) => Promise<void>;
  getUserData: () => Promise<any | null>;
  removeUserData: () => Promise<void>;

  clearAll: () => Promise<void>;
}

class KeychainSecureStorage implements SecureStorageService {
  private readonly keychainOptions: Keychain.Options = {
    service: 'com.incomemetermobile',
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE,
    authenticatePrompt: 'Please authenticate to access your secure data',
    showModal: true,
    kLocalizedFallbackTitle: 'Use Passcode',
  };

  async setAccessToken(token: string): Promise<void> {
    try {
      await Keychain.setInternetCredentials(
        STORAGE_KEYS.ACCESS_TOKEN,
        'access_token',
        token,
        this.keychainOptions
      );
    } catch (error) {
      console.error('Failed to store access token:', error);
      throw new Error('Failed to store access token');
    }
  }

  async getAccessToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(
        STORAGE_KEYS.ACCESS_TOKEN,
        this.keychainOptions
      );
      return credentials ? credentials.password : null;
    } catch (error) {
      console.error('Failed to retrieve access token:', error);
      return null;
    }
  }

  async removeAccessToken(): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(STORAGE_KEYS.ACCESS_TOKEN);
    } catch (error) {
      console.error('Failed to remove access token:', error);
    }
  }

  async setRefreshToken(token: string): Promise<void> {
    try {
      await Keychain.setInternetCredentials(
        STORAGE_KEYS.REFRESH_TOKEN,
        'refresh_token',
        token,
        this.keychainOptions
      );
    } catch (error) {
      console.error('Failed to store refresh token:', error);
      throw new Error('Failed to store refresh token');
    }
  }

  async getRefreshToken(): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(
        STORAGE_KEYS.REFRESH_TOKEN,
        this.keychainOptions
      );
      return credentials ? credentials.password : null;
    } catch (error) {
      console.error('Failed to retrieve refresh token:', error);
      return null;
    }
  }

  async removeRefreshToken(): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Failed to remove refresh token:', error);
    }
  }

  async setUserData(userData: any): Promise<void> {
    try {
      const userDataString = JSON.stringify(userData);
      await Keychain.setInternetCredentials(
        STORAGE_KEYS.USER_DATA,
        'user_data',
        userDataString,
        this.keychainOptions
      );
    } catch (error) {
      console.error('Failed to store user data:', error);
      throw new Error('Failed to store user data');
    }
  }

  async getUserData(): Promise<any | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(
        STORAGE_KEYS.USER_DATA,
        this.keychainOptions
      );
      if (credentials) {
        return JSON.parse(credentials.password);
      }
      return null;
    } catch (error) {
      console.error('Failed to retrieve user data:', error);
      return null;
    }
  }

  async removeUserData(): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(STORAGE_KEYS.USER_DATA);
    } catch (error) {
      console.error('Failed to remove user data:', error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      await Promise.all([
        this.removeAccessToken(),
        this.removeRefreshToken(),
        this.removeUserData(),
      ]);
    } catch (error) {
      console.error('Failed to clear all secure storage:', error);
    }
  }
}

// Fallback storage for devices without Keychain/Keystore support
class AsyncStorageFallback implements SecureStorageService {
  private AsyncStorage = require('@react-native-async-storage/async-storage').default;

  async setAccessToken(token: string): Promise<void> {
    await this.AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
  }

  async getAccessToken(): Promise<string | null> {
    return await this.AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  async removeAccessToken(): Promise<void> {
    await this.AsyncStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  }

  async setRefreshToken(token: string): Promise<void> {
    await this.AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  }

  async getRefreshToken(): Promise<string | null> {
    return await this.AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  async removeRefreshToken(): Promise<void> {
    await this.AsyncStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  }

  async setUserData(userData: any): Promise<void> {
    await this.AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  }

  async getUserData(): Promise<any | null> {
    const userData = await this.AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return userData ? JSON.parse(userData) : null;
  }

  async removeUserData(): Promise<void> {
    await this.AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
  }

  async clearAll(): Promise<void> {
    await Promise.all([
      this.removeAccessToken(),
      this.removeRefreshToken(),
      this.removeUserData(),
    ]);
  }
}

// Create and export storage instance with fallback
const createSecureStorage = async (): Promise<SecureStorageService> => {
  try {
    // Check if Keychain is available
    const canImplyAuthentication = await Keychain.canImplyAuthentication();
    if (canImplyAuthentication) {
      return new KeychainSecureStorage();
    }
  } catch (error) {
    console.warn('Keychain not available, falling back to AsyncStorage:', error);
  }

  // Fallback to AsyncStorage with warning
  console.warn('Using AsyncStorage for token storage. Consider implementing additional security measures.');
  return new AsyncStorageFallback();
};

let storageInstance: SecureStorageService | null = null;

export const getSecureStorage = async (): Promise<SecureStorageService> => {
  if (!storageInstance) {
    storageInstance = await createSecureStorage();
  }
  return storageInstance;
};