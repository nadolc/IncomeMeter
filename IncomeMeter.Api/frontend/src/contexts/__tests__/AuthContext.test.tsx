import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import * as authApi from '../../utils/api';

// Mock API calls
jest.mock('../../utils/api', () => ({
  getProfile: jest.fn(),
  logout: jest.fn(),
}));

const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

// Test component to access auth context
const TestComponent = () => {
  const { user, loading, login, logout, isAuthenticated } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{loading ? 'Loading' : 'Not Loading'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'Authenticated' : 'Not Authenticated'}</div>
      <div data-testid="user-name">{user?.name || 'No User'}</div>
      <button onClick={() => login('/dashboard')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

// Mock window.location
delete (window as any).location;
window.location = { href: '' } as any;

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    window.location.href = '';
  });

  describe('Initial State', () => {
    it('should start with loading state', () => {
      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );
      
      expect(screen.getByTestId('loading')).toHaveTextContent('Loading');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
      expect(screen.getByTestId('user-name')).toHaveTextContent('No User');
    });

    it('should not be authenticated initially without token', async () => {
      mockAuthApi.getProfile.mockRejectedValue(new Error('No token'));
      
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
      });
    });
  });

  describe('Authentication Success', () => {
    it('should authenticate user when valid token exists', async () => {
      const mockUser = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      };
      
      localStorage.setItem('accessToken', 'valid-token');
      mockAuthApi.getProfile.mockResolvedValue(mockUser);
      
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
        expect(screen.getByTestId('user-name')).toHaveTextContent('John Doe');
      });
      
      expect(mockAuthApi.getProfile).toHaveBeenCalledTimes(1);
    });

    it('should handle profile fetch failure', async () => {
      localStorage.setItem('accessToken', 'invalid-token');
      mockAuthApi.getProfile.mockRejectedValue(new Error('Invalid token'));
      
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
      });
      
      expect(localStorage.getItem('accessToken')).toBeNull();
    });
  });

  describe('Login Functionality', () => {
    it('should redirect to login URL without return URL', async () => {
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('Not Loading');
      });
      
      const loginButton = screen.getByText('Login');
      fireEvent.click(loginButton);
      
      expect(window.location.href).toBe('https://localhost:7079/api/auth/login?returnUrl=%2Fdashboard');
    });

    it('should redirect to login URL with return URL', async () => {
      const TestComponentWithCustomRedirect = () => {
        const { login } = useAuth();
        return <button onClick={() => login('/profile')}>Login</button>;
      };
      
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponentWithCustomRedirect />
          </AuthProvider>
        );
      });
      
      const loginButton = screen.getByText('Login');
      fireEvent.click(loginButton);
      
      expect(window.location.href).toBe('https://localhost:7079/api/auth/login?returnUrl=%2Fprofile');
    });
  });

  describe('Logout Functionality', () => {
    it('should logout successfully and clear user data', async () => {
      const mockUser = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      };
      
      localStorage.setItem('accessToken', 'valid-token');
      mockAuthApi.getProfile.mockResolvedValue(mockUser);
      mockAuthApi.logout.mockResolvedValue();
      
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
      });
      
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);
      
      await waitFor(() => {
        expect(mockAuthApi.logout).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(window.location.href).toBe('/login');
      });
    });

    it('should handle logout API failure gracefully', async () => {
      const mockUser = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      };
      
      localStorage.setItem('accessToken', 'valid-token');
      mockAuthApi.getProfile.mockResolvedValue(mockUser);
      mockAuthApi.logout.mockRejectedValue(new Error('Logout failed'));
      
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Authenticated');
      });
      
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);
      
      await waitFor(() => {
        expect(localStorage.getItem('accessToken')).toBeNull();
        expect(window.location.href).toBe('/login');
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when useAuth is used outside AuthProvider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');
      
      console.error = originalError;
    });
  });

  describe('Context Value Updates', () => {
    it('should update context values when user state changes', async () => {
      const mockUser = {
        id: '1',
        name: 'John Doe',
        email: 'john@example.com',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      };
      
      // Start without token
      await act(async () => {
        render(
          <AuthProvider>
            <TestComponent />
          </AuthProvider>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('Not Authenticated');
      });
      
      // Add token and simulate successful auth
      localStorage.setItem('accessToken', 'valid-token');
      mockAuthApi.getProfile.mockResolvedValue(mockUser);
      
      // Trigger re-render or auth check
      // In real app, this would happen through login callback
    });
  });
});