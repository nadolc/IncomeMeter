import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { GoogleSignin, statusCodes, User as GoogleUser } from '@react-native-google-signin/google-signin';
import { Alert } from 'react-native';
import { appConfig } from '../config/environment';
import { getSecureStorage } from '../services/secureStorage';
import { User } from '../types/dashboard';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeGoogleSignIn();
    checkAuthStatus();
  }, []);

  const initializeGoogleSignIn = async () => {
    try {
      if (!appConfig.googleOAuthClientId) {
        console.warn('Google OAuth Client ID not configured');
        return;
      }

      GoogleSignin.configure({
        webClientId: appConfig.googleOAuthClientId,
        offlineAccess: true,
      });
    } catch (error) {
      console.error('Failed to initialize Google Sign-In:', error);
    }
  };

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      const storage = await getSecureStorage();

      // Check if user data and token exist in secure storage
      const [userData, token] = await Promise.all([
        storage.getUserData(),
        storage.getAccessToken(),
      ]);

      if (userData && token) {
        setUser(userData);
      } else {
        // Check if user is signed in with Google
        const isSignedIn = await GoogleSignin.isSignedIn();
        if (isSignedIn) {
          await GoogleSignin.signOut();
        }
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      // Clear any corrupted data
      const storage = await getSecureStorage();
      await storage.clearAll();
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    try {
      setLoading(true);

      if (!appConfig.googleOAuthClientId) {
        throw new Error('Google OAuth not configured');
      }

      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();

      // Sign in with Google
      const googleUser = await GoogleSignin.signIn();

      if (!googleUser.idToken) {
        throw new Error('No ID token received from Google');
      }

      // Call backend API to authenticate and get JWT token
      const authResult = await authenticateWithBackend(googleUser);

      if (authResult.success && authResult.accessToken && authResult.user) {
        // Store tokens and user data securely
        const storage = await getSecureStorage();
        await Promise.all([
          storage.setAccessToken(authResult.accessToken),
          storage.setUserData(authResult.user),
          authResult.refreshToken && storage.setRefreshToken(authResult.refreshToken),
        ]);

        setUser(authResult.user);
      } else {
        throw new Error(authResult.message || 'Authentication failed');
      }
    } catch (error: any) {
      console.error('Login failed:', error);

      // Handle specific Google Sign-In errors
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled the login flow
        return;
      } else if (error.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Sign In', 'Sign in is already in progress');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Error', 'Google Play Services not available');
      } else {
        Alert.alert('Login Failed', error.message || 'An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);

      // Sign out from Google
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) {
        await GoogleSignin.signOut();
      }

      // Clear secure storage
      const storage = await getSecureStorage();
      await storage.clearAll();

      // Call backend logout if needed
      try {
        const response = await fetch(`${appConfig.apiBaseUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        // Don't throw on logout API failure
        if (!response.ok) {
          console.warn('Backend logout failed, but continuing with local logout');
        }
      } catch (error) {
        console.warn('Backend logout request failed:', error);
      }

      setUser(null);
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, clear local state
      setUser(null);
      Alert.alert('Logout', 'Logged out locally due to an error');
    } finally {
      setLoading(false);
    }
  };

  const authenticateWithBackend = async (googleUser: GoogleUser): Promise<{
    success: boolean;
    message: string;
    accessToken?: string;
    refreshToken?: string;
    user?: User;
  }> => {
    try {
      const response = await fetch(`${appConfig.apiBaseUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          googleId: googleUser.user.id,
          email: googleUser.user.email,
          displayName: googleUser.user.name,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        return {
          success: true,
          message: result.message,
          accessToken: result.token,
          user: result.user,
        };
      } else {
        return {
          success: false,
          message: result.message || 'Authentication failed',
        };
      }
    } catch (error) {
      console.error('Backend authentication failed:', error);
      return {
        success: false,
        message: 'Network error during authentication',
      };
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    setUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};