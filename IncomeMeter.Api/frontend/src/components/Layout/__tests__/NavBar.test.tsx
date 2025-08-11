import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../../contexts/AuthContext';
import NavBar from '../NavBar';

// Mock the auth context with test data
const mockUser = {
  id: '1',
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01'
};

const mockAuthContext = {
  user: mockUser,
  loading: false,
  login: jest.fn(),
  logout: jest.fn(),
  isAuthenticated: true,
};

// Mock AuthContext
jest.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const renderNavBar = () => {
  return render(
    <BrowserRouter>
      <NavBar />
    </BrowserRouter>
  );
};

describe('NavBar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Desktop Layout', () => {
    beforeAll(() => {
      // Mock large screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
    });

    it('should render logo and navigation links', () => {
      renderNavBar();
      
      expect(screen.getByText('Income Meter')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('should display user name', () => {
      renderNavBar();
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should call logout when logout button is clicked', async () => {
      renderNavBar();
      
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);
      
      await waitFor(() => {
        expect(mockAuthContext.logout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Mobile Layout', () => {
    beforeAll(() => {
      // Mock mobile screen
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      });
    });

    it('should render mobile menu button', () => {
      renderNavBar();
      
      const menuButton = screen.getByLabelText('Toggle menu');
      expect(menuButton).toBeInTheDocument();
    });

    it('should render abbreviated logo on very small screens', () => {
      renderNavBar();
      
      // The component should show "IM" on very small screens
      expect(document.querySelector('.xs\\:hidden')).toBeInTheDocument();
    });

    it('should toggle mobile menu when menu button is clicked', () => {
      renderNavBar();
      
      const menuButton = screen.getByLabelText('Toggle menu');
      fireEvent.click(menuButton);
      
      expect(screen.getByText('Menu')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should close mobile menu when close button is clicked', () => {
      renderNavBar();
      
      // Open menu
      const menuButton = screen.getByLabelText('Toggle menu');
      fireEvent.click(menuButton);
      
      // Close menu
      const closeButton = screen.getByLabelText('Close menu');
      fireEvent.click(closeButton);
      
      expect(screen.queryByText('Menu')).not.toBeInTheDocument();
    });

    it('should show user menu when user button is clicked', () => {
      renderNavBar();
      
      const userButton = screen.getByLabelText('Toggle user menu');
      fireEvent.click(userButton);
      
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
    });
  });

  describe('Navigation Functionality', () => {
    it('should highlight active page', () => {
      // Mock current location
      delete (window as any).location;
      window.location = { ...window.location, pathname: '/dashboard' };
      
      renderNavBar();
      
      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      expect(dashboardLink).toHaveClass('text-blue-600', 'bg-blue-50');
    });

    it('should navigate to correct routes', () => {
      renderNavBar();
      
      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      const profileLink = screen.getByRole('link', { name: 'Profile' });
      const settingsLink = screen.getByRole('link', { name: 'Settings' });
      
      expect(dashboardLink).toHaveAttribute('href', '/dashboard');
      expect(profileLink).toHaveAttribute('href', '/profile');
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });
  });

  describe('Responsive Behavior', () => {
    it('should handle screen size changes', () => {
      const { rerender } = renderNavBar();
      
      // Test desktop view
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
      });
      rerender(
        <BrowserRouter>
          <NavBar />
        </BrowserRouter>
      );
      
      // Desktop elements should be visible
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should be accessible with proper ARIA labels', () => {
      renderNavBar();
      
      expect(screen.getByLabelText('Toggle menu')).toBeInTheDocument();
      expect(screen.getByLabelText('Toggle user menu')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  describe('Touch Interactions', () => {
    it('should handle touch events on mobile', () => {
      renderNavBar();
      
      const menuButton = screen.getByLabelText('Toggle menu');
      
      // Simulate touch event
      fireEvent.touchStart(menuButton);
      fireEvent.touchEnd(menuButton);
      fireEvent.click(menuButton);
      
      expect(screen.getByText('Menu')).toBeInTheDocument();
    });

    it('should close menu when clicking overlay', () => {
      renderNavBar();
      
      // Open menu
      const menuButton = screen.getByLabelText('Toggle menu');
      fireEvent.click(menuButton);
      
      // Click overlay
      const overlay = document.querySelector('.mobile-menu-overlay');
      if (overlay) {
        fireEvent.click(overlay);
      }
      
      expect(screen.queryByText('Menu')).not.toBeInTheDocument();
    });
  });
});