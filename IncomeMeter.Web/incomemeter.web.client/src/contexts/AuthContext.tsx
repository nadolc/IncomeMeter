import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, AuthResponse } from '../types';
import * as authApi from '../utils/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (redirectUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
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
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (token) {
        const userData = await authApi.getProfile();
        setUser(userData);
      }
    } catch (error) {
      localStorage.removeItem('accessToken');
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (redirectUrl?: string) => {
    // Redirect to Google OAuth
    const params = new URLSearchParams();
    if (redirectUrl) {
      params.append('returnUrl', redirectUrl);
    }
    
    const loginUrl = `${import.meta.env.VITE_API_URL || 'https://localhost:7079'}/api/auth/login?${params}`;
    window.location.href = loginUrl;
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('accessToken');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};