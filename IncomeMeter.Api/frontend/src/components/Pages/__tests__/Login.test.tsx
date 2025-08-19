import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useSearchParams } from 'react-router-dom';
import Login from '../Login';
import { AuthProvider } from '../../../contexts/AuthContext';
import { LanguageProvider } from '../../../contexts/LanguageContext';

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: jest.fn(),
}));

// Mock the login function from AuthContext
const mockLogin = jest.fn();
jest.mock('../../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../../contexts/AuthContext'),
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: false,
    loading: false
  })
}));

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '',
  },
  writable: true,
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

const mockUseSearchParams = useSearchParams as jest.Mock;

describe('Login Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSearchParams.mockReturnValue([new URLSearchParams(), jest.fn()]);
    window.location.href = '';
  });

  it('renders login page with all elements', () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    // Check main heading and subtitle
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Track your driving income with precision')).toBeInTheDocument();

    // Check Google login button
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();

    // Check features list
    expect(screen.getByText('Real-time analytics and insights')).toBeInTheDocument();
    expect(screen.getByText('Multi-currency support')).toBeInTheDocument();
    expect(screen.getByText('Secure and private data')).toBeInTheDocument();

    // Check footer text
    expect(screen.getByText(/by signing in, you agree to our/i)).toBeInTheDocument();
    expect(screen.getByText('Secure authentication powered by Google')).toBeInTheDocument();
  });

  it('calls login function when Google sign-in button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    await user.click(googleButton);

    expect(mockLogin).toHaveBeenCalledTimes(1);
    expect(mockLogin).toHaveBeenCalledWith('/dashboard');
  });

  it('displays error message when error parameter is present in URL', () => {
    // Mock URL with error parameter
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('error=Authentication%20failed'),
      jest.fn()
    ]);

    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('displays network error message when network error occurs', () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('error=Network%20error.%20Please%20check%20your%20connection.'),
      jest.fn()
    ]);

    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    expect(screen.getByText('Network error. Please check your connection.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('displays unauthorized error message', () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('error=You%20are%20not%20authorized%20to%20perform%20this%20action.'),
      jest.fn()
    ]);

    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    expect(screen.getByText('You are not authorized to perform this action.')).toBeInTheDocument();
  });

  it('renders with correct styling and layout', () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    // Check that the main container has correct classes
    const mainContainer = screen.getByRole('main');
    expect(mainContainer).toHaveClass('min-h-screen', 'flex', 'items-center', 'justify-center');

    // Check Google button styling
    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    expect(googleButton).toHaveClass('w-full', 'bg-white', 'hover:bg-gray-50');
  });

  it('handles login with custom redirect URL', async () => {
    const user = userEvent.setup();

    // Mock URL with returnUrl parameter
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('returnUrl=%2Fprofile'),
      jest.fn()
    ]);

    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    await user.click(googleButton);

    expect(mockLogin).toHaveBeenCalledWith('/profile');
  });

  it('uses default redirect URL when no returnUrl is provided', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    await user.click(googleButton);

    expect(mockLogin).toHaveBeenCalledWith('/dashboard');
  });

  it('displays app title and subtitle correctly', () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    // Check that the Income Meter branding is present
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Track your driving income with precision')).toBeInTheDocument();
  });

  it('renders Google icon in the login button', () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    // The Google button should contain the Google icon (SVG)
    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    const googleIcon = googleButton.querySelector('svg');
    expect(googleIcon).toBeInTheDocument();
  });

  it('renders all feature points', () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    // Check all feature points are displayed
    expect(screen.getByText('Real-time analytics and insights')).toBeInTheDocument();
    expect(screen.getByText('Multi-currency support')).toBeInTheDocument();
    expect(screen.getByText('Secure and private data')).toBeInTheDocument();

    // Check that each feature has a checkmark icon
    const checkIcons = screen.getAllByTestId('check-icon');
    expect(checkIcons).toHaveLength(3);
  });

  it('has proper accessibility attributes', () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    // Check button has proper accessibility
    const googleButton = screen.getByRole('button', { name: /continue with google/i });
    expect(googleButton).toBeEnabled();
    expect(googleButton).not.toHaveAttribute('aria-disabled');

    // Check error messages have alert role when present
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('error=Test%20error'),
      jest.fn()
    ]);

    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('decodes URL-encoded error messages correctly', () => {
    // Test various encoded error messages
    const errorMessages = [
      ['Authentication%20failed', 'Authentication failed'],
      ['Missing%20user%20information', 'Missing user information'],
      ['Network%20error.%20Please%20try%20again.', 'Network error. Please try again.']
    ];

    errorMessages.forEach(([encoded, decoded]) => {
      mockUseSearchParams.mockReturnValue([
        new URLSearchParams(`error=${encoded}`),
        jest.fn()
      ]);

      render(
        <TestWrapper>
          <Login />
        </TestWrapper>
      );

      expect(screen.getByText(decoded)).toBeInTheDocument();
    });
  });

  it('handles empty error parameter gracefully', () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('error='),
      jest.fn()
    ]);

    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    // Should not display empty error message
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});