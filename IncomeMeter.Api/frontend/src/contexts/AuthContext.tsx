/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import * as authApi from '../utils/api';
import { API_BASE_URL } from '../utils/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (redirectUrl?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
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
    
    const loginUrl = `${API_BASE_URL}/api/auth/login?${params}`;
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
    setUser,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};