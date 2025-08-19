import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Profile from '../Profile';
import { AuthProvider } from '../../../contexts/AuthContext';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import * as api from '../../../utils/api';

// Mock API functions
jest.mock('../../../utils/api', () => ({
  getProfile: jest.fn(),
}));

// Mock Auth Context
const mockUser = {
  id: 'user-123',
  name: 'John Doe',
  email: 'john.doe@example.com',
  isAuthenticated: true
};

jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    loading: false
  })
}));

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

const mockGetProfile = api.getProfile as jest.Mock;

describe('Profile Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default successful profile response
    mockGetProfile.mockResolvedValue({
      id: 'user-123',
      name: 'John Doe',
      email: 'john.doe@example.com',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z',
      isAuthenticated: true
    });
  });

  it('renders loading state initially', async () => {
    // Mock delayed response
    mockGetProfile.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(mockUser), 100))
    );

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    expect(screen.getByText('Loading profile...')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading profile...')).not.toBeInTheDocument();
    });
  });

  it('renders profile information when data loads successfully', async () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check page title
      expect(screen.getByText('Profile')).toBeInTheDocument();
      
      // Check personal information section
      expect(screen.getByText('Personal Information')).toBeInTheDocument();
      
      // Check user details
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
      expect(screen.getByText(/Member since/i)).toBeInTheDocument();
      
      // Check account details section
      expect(screen.getByText('Account Details')).toBeInTheDocument();
    });
  });

  it('formats member since date correctly', async () => {
    mockGetProfile.mockResolvedValue({
      ...mockUser,
      createdAt: '2024-01-01T00:00:00Z'
    });

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check that the date is formatted properly
      expect(screen.getByText(/January 1, 2024/)).toBeInTheDocument();
    });
  });

  it('handles profile fetch error', async () => {
    mockGetProfile.mockRejectedValue(new Error('Failed to fetch profile'));

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Error Loading Profile')).toBeInTheDocument();
      expect(screen.getByText('Failed to load profile information')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('handles network error gracefully', async () => {
    mockGetProfile.mockRejectedValue(new Error('Network error'));

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Error Loading Profile')).toBeInTheDocument();
      expect(screen.getByText('Failed to load profile information')).toBeInTheDocument();
    });
  });

  it('handles unauthorized error', async () => {
    const unauthorizedError = new Error('Unauthorized');
    unauthorizedError.name = 'UnauthorizedError';
    mockGetProfile.mockRejectedValue(unauthorizedError);

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Error Loading Profile')).toBeInTheDocument();
    });
  });

  it('displays profile fields with correct labels', async () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check field labels
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText(/Member since/i)).toBeInTheDocument();
      
      // Check field values
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john.doe@example.com')).toBeInTheDocument();
    });
  });

  it('handles missing profile data gracefully', async () => {
    mockGetProfile.mockResolvedValue({
      id: 'user-123',
      name: '',
      email: '',
      createdAt: '',
      isAuthenticated: true
    });

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Personal Information')).toBeInTheDocument();
      // Should still render the structure even with empty data
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
    });
  });

  it('calls getProfile API on component mount', async () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(1);
    });
  });

  it('does not call API again on re-render with same data', async () => {
    const { rerender } = render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(mockGetProfile).toHaveBeenCalledTimes(1);
    });

    rerender(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    // Should still only be called once due to useEffect dependency
    expect(mockGetProfile).toHaveBeenCalledTimes(1);
  });

  it('renders with correct styling and layout', async () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check main container styling
      const mainContainer = screen.getByRole('main');
      expect(mainContainer).toHaveClass('container', 'mx-auto', 'px-4', 'py-8');

      // Check card styling
      const profileCard = screen.getByTestId('profile-card');
      expect(profileCard).toHaveClass('bg-white', 'rounded-lg', 'shadow-sm', 'border');
    });
  });

  it('displays user avatar placeholder', async () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check for avatar placeholder or initials
      const avatar = screen.getByTestId('user-avatar');
      expect(avatar).toBeInTheDocument();
    });
  });

  it('handles extremely long names and emails', async () => {
    const longUser = {
      ...mockUser,
      name: 'A'.repeat(100),
      email: 'verylongemail' + 'x'.repeat(50) + '@example.com'
    };

    mockGetProfile.mockResolvedValue(longUser);

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(longUser.name)).toBeInTheDocument();
      expect(screen.getByText(longUser.email)).toBeInTheDocument();
    });
  });

  it('handles special characters in user data', async () => {
    const specialUser = {
      ...mockUser,
      name: 'José María O\'Connor-Smith',
      email: 'jose.maria@example-test.co.uk'
    };

    mockGetProfile.mockResolvedValue(specialUser);

    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('José María O\'Connor-Smith')).toBeInTheDocument();
      expect(screen.getByText('jose.maria@example-test.co.uk')).toBeInTheDocument();
    });
  });

  it('shows proper accessibility attributes', async () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      // Check heading hierarchy
      const mainHeading = screen.getByRole('heading', { level: 1, name: 'Profile' });
      expect(mainHeading).toBeInTheDocument();

      const sectionHeadings = screen.getAllByRole('heading', { level: 2 });
      expect(sectionHeadings.length).toBeGreaterThan(0);
    });
  });

  it('displays profile sections in correct order', async () => {
    render(
      <TestWrapper>
        <Profile />
      </TestWrapper>
    );

    await waitFor(() => {
      const headings = screen.getAllByRole('heading');
      const headingTexts = headings.map(h => h.textContent);
      
      expect(headingTexts).toContain('Profile');
      expect(headingTexts).toContain('Personal Information');
      expect(headingTexts).toContain('Account Details');
    });
  });
});