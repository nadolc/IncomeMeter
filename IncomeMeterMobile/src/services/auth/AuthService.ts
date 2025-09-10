import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileTokenResponse } from '../../types';

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

class AuthService {
  private static readonly ACCESS_TOKEN_KEY = '@IncomeMeter:accessToken';
  private static readonly REFRESH_TOKEN_KEY = '@IncomeMeter:refreshToken';
  private static readonly TOKEN_EXPIRY_KEY = '@IncomeMeter:tokenExpiry';
  private static readonly USER_INFO_KEY = '@IncomeMeter:userInfo';

  async storeTokens(tokens: StoredTokens): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.setItem(AuthService.ACCESS_TOKEN_KEY, tokens.accessToken),
        AsyncStorage.setItem(AuthService.REFRESH_TOKEN_KEY, tokens.refreshToken),
        AsyncStorage.setItem(AuthService.TOKEN_EXPIRY_KEY, tokens.expiresAt.toISOString())
      ]);
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  async getStoredToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(AuthService.ACCESS_TOKEN_KEY);
      
      if (token) {
        // Check if token is expired
        const expiryString = await AsyncStorage.getItem(AuthService.TOKEN_EXPIRY_KEY);
        if (expiryString) {
          const expiryDate = new Date(expiryString);
          if (new Date() >= expiryDate) {
            // Token is expired
            return null;
          }
        }
      }
      
      return token;
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  }

  async getStoredRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(AuthService.REFRESH_TOKEN_KEY);
    } catch (error) {
      console.error('Error getting stored refresh token:', error);
      return null;
    }
  }

  async clearStoredTokens(): Promise<void> {
    try {
      await Promise.all([
        AsyncStorage.removeItem(AuthService.ACCESS_TOKEN_KEY),
        AsyncStorage.removeItem(AuthService.REFRESH_TOKEN_KEY),
        AsyncStorage.removeItem(AuthService.TOKEN_EXPIRY_KEY),
        AsyncStorage.removeItem(AuthService.USER_INFO_KEY)
      ]);
    } catch (error) {
      console.error('Error clearing stored tokens:', error);
      throw new Error('Failed to clear authentication tokens');
    }
  }

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getStoredToken();
    return token !== null;
  }

  async storeUserInfo(userInfo: any): Promise<void> {
    try {
      await AsyncStorage.setItem(AuthService.USER_INFO_KEY, JSON.stringify(userInfo));
    } catch (error) {
      console.error('Error storing user info:', error);
      throw new Error('Failed to store user information');
    }
  }

  async getUserInfo(): Promise<any | null> {
    try {
      const userInfoString = await AsyncStorage.getItem(AuthService.USER_INFO_KEY);
      return userInfoString ? JSON.parse(userInfoString) : null;
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }

  async getTokenExpiryTime(): Promise<Date | null> {
    try {
      const expiryString = await AsyncStorage.getItem(AuthService.TOKEN_EXPIRY_KEY);
      return expiryString ? new Date(expiryString) : null;
    } catch (error) {
      console.error('Error getting token expiry:', error);
      return null;
    }
  }

  async isTokenExpired(): Promise<boolean> {
    const expiryTime = await this.getTokenExpiryTime();
    if (!expiryTime) return true;
    
    return new Date() >= expiryTime;
  }

  async getTimeUntilExpiry(): Promise<number> {
    const expiryTime = await this.getTokenExpiryTime();
    if (!expiryTime) return 0;
    
    const now = new Date().getTime();
    const expiry = expiryTime.getTime();
    
    return Math.max(0, expiry - now);
  }
}

export { AuthService };