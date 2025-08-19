import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AuthCallback from '../AuthCallback';
import { AuthProvider } from '../../../contexts/AuthContext';
import { LanguageProvider } from '../../../contexts/LanguageContext';

// Mock the useNavigate hook
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('token=test-token&redirectUrl=%2Fdashboard')]
}));

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <LanguageProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </LanguageProvider>
  </BrowserRouter>
);

describe('AuthCallback Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.setItem.mockClear();
    (fetch as jest.Mock).mockClear();
  });

  it('renders loading state initially', () => {
    render(
      <TestWrapper>
        <AuthCallbackComponent />
      </TestWrapper>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('handles successful token authentication', async () => {
    // Mock successful fetch response
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com'
      })
    });

    render(
      <TestWrapper>
        <AuthCallbackComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'test-token');
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/profile'),
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer test-token'
          }
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('handles error parameter in URL', async () => {
    // Mock useSearchParams to return error
    jest.doMock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useSearchParams: () => [new URLSearchParams('error=Authentication%20failed')]
    }));

    render(
      <TestWrapper>
        <AuthCallback />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login?error=Authentication failed');
    });
  });

  it('handles missing token', async () => {
    // Mock useSearchParams to return no token
    jest.doMock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useSearchParams: () => [new URLSearchParams('')]
    }));

    render(
      <TestWrapper>
        <AuthCallback />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login?error=No token received');
    });
  });

  it('handles profile fetch failure', async () => {
    // Mock failed fetch response
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    render(
      <TestWrapper>
        <AuthCallbackComponent />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'test-token');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    // Should still navigate even if profile fetch fails
    expect(console.error).toHaveBeenCalledWith(
      'Failed to fetch user profile:',
      expect.any(Error)
    );
  });

  it('uses custom redirect URL when provided', async () => {
    // Mock useSearchParams with custom redirect
    jest.doMock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useSearchParams: () => [new URLSearchParams('token=test-token&redirectUrl=%2Fprofile')]
    }));

    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'user-123' })
    });

    render(
      <TestWrapper>
        <AuthCallback />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/profile');
    });
  });
});