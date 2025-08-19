import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, useSearchParams, useNavigate } from 'react-router-dom';
import Register from '../Register';
import { AuthProvider } from '../../../contexts/AuthContext';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import * as api from '../../../utils/api';

// Mock react-router-dom
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: jest.fn(),
  useNavigate: () => mockNavigate,
}));

// Mock API functions
jest.mock('../../../utils/api', () => ({
  registerWithGoogle: jest.fn(),
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

const mockUseSearchParams = useSearchParams as jest.Mock;
const mockRegisterWithGoogle = api.registerWithGoogle as jest.Mock;

describe('Register Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Default mock for URL params with Google OAuth data
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('googleId=google-123&email=test%40example.com&name=Test%20User'),
      jest.fn()
    ]);
  });

  it('renders registration form with Google user data pre-filled', () => {
    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    // Check page title and subtitle
    expect(screen.getByText('Complete Your Registration')).toBeInTheDocument();
    expect(screen.getByText('Just a few more details to get you started')).toBeInTheDocument();

    // Check form fields are pre-filled
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test@example.com')).toBeInTheDocument();

    // Check form labels
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/address/i)).toBeInTheDocument();

    // Check preference dropdowns
    expect(screen.getByLabelText(/currency/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/language/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/time zone/i)).toBeInTheDocument();

    // Check submit button
    expect(screen.getByRole('button', { name: /complete registration/i })).toBeInTheDocument();
  });

  it('shows error when required URL parameters are missing', () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams(), // Empty params
      jest.fn()
    ]);

    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    expect(screen.getByText(/registration data is missing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /go to login/i })).toBeInTheDocument();
  });

  it('handles form submission successfully', async () => {
    const user = userEvent.setup();
    
    mockRegisterWithGoogle.mockResolvedValueOnce({
      success: true,
      message: 'Registration successful',
      token: 'jwt-token-123',
      user: {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
        isAuthenticated: true
      }
    });

    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    // Fill in additional form fields
    const phoneInput = screen.getByLabelText(/phone/i);
    const addressInput = screen.getByLabelText(/address/i);
    
    await user.type(phoneInput, '+1234567890');
    await user.type(addressInput, '123 Test Street, Test City');

    // Select preferences
    const currencySelect = screen.getByLabelText(/currency/i);
    await user.selectOptions(currencySelect, 'GBP');

    const languageSelect = screen.getByLabelText(/language/i);
    await user.selectOptions(languageSelect, 'en-GB');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /complete registration/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockRegisterWithGoogle).toHaveBeenCalledWith(
        'google-123',
        'test@example.com',
        'Test User'
      );
      expect(localStorage.setItem).toHaveBeenCalledWith('accessToken', 'jwt-token-123');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('displays error message when registration fails', async () => {
    const user = userEvent.setup();
    
    mockRegisterWithGoogle.mockResolvedValueOnce({
      success: false,
      message: 'User already exists'
    });

    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: /complete registration/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('User already exists')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handles network errors during registration', async () => {
    const user = userEvent.setup();
    
    mockRegisterWithGoogle.mockRejectedValueOnce(new Error('Network error'));

    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: /complete registration/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });
  });

  it('validates required fields before submission', async () => {
    const user = userEvent.setup();

    // Mock empty required fields
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('googleId=google-123&email=&name='),
      jest.fn()
    ]);

    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: /complete registration/i });
    await user.click(submitButton);

    // Should not call API if validation fails
    expect(mockRegisterWithGoogle).not.toHaveBeenCalled();
    
    // Check HTML5 validation
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    expect(nameInput).toBeInvalid();
    expect(emailInput).toBeInvalid();
  });

  it('shows loading state during registration', async () => {
    const user = userEvent.setup();
    
    // Mock a delayed response
    mockRegisterWithGoogle.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        success: true,
        token: 'jwt-token',
        user: { id: 'user-123' }
      }), 100))
    );

    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    const submitButton = screen.getByRole('button', { name: /complete registration/i });
    await user.click(submitButton);

    // Check loading state
    expect(screen.getByText(/registering/i)).toBeInTheDocument();
    expect(submitButton).toBeDisabled();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('allows user to go back to login page', async () => {
    const user = userEvent.setup();

    mockUseSearchParams.mockReturnValue([
      new URLSearchParams(), // Empty params to trigger error state
      jest.fn()
    ]);

    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    const loginButton = screen.getByRole('button', { name: /go to login/i });
    await user.click(loginButton);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('decodes URL-encoded parameters correctly', () => {
    mockUseSearchParams.mockReturnValue([
      new URLSearchParams('googleId=google-123&email=test%2B1%40example.com&name=Test%20User%20Jr.'),
      jest.fn()
    ]);

    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    expect(screen.getByDisplayValue('test+1@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test User Jr.')).toBeInTheDocument();
  });

  it('sets default preferences correctly', () => {
    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    const currencySelect = screen.getByLabelText(/currency/i) as HTMLSelectElement;
    const languageSelect = screen.getByLabelText(/language/i) as HTMLSelectElement;
    const timezoneSelect = screen.getByLabelText(/time zone/i) as HTMLSelectElement;

    expect(currencySelect.value).toBe('GBP');
    expect(languageSelect.value).toBe('en-GB');
    expect(timezoneSelect.value).toBe('Europe/London');
  });

  it('updates form fields when user types', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    const phoneInput = screen.getByLabelText(/phone/i);
    const addressInput = screen.getByLabelText(/address/i);

    await user.clear(phoneInput);
    await user.type(phoneInput, '+44 1234 567890');

    await user.clear(addressInput);
    await user.type(addressInput, '456 New Address, London');

    expect(phoneInput).toHaveValue('+44 1234 567890');
    expect(addressInput).toHaveValue('456 New Address, London');
  });

  it('handles form field changes for preferences', async () => {
    const user = userEvent.setup();

    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    const currencySelect = screen.getByLabelText(/currency/i);
    const languageSelect = screen.getByLabelText(/language/i);

    await user.selectOptions(currencySelect, 'HKD');
    await user.selectOptions(languageSelect, 'zh-HK');

    expect(currencySelect).toHaveValue('HKD');
    expect(languageSelect).toHaveValue('zh-HK');
  });

  it('has proper form accessibility attributes', () => {
    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    // Check that all form inputs have labels
    const nameInput = screen.getByLabelText(/name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const phoneInput = screen.getByLabelText(/phone/i);
    const addressInput = screen.getByLabelText(/address/i);

    expect(nameInput).toHaveAttribute('required');
    expect(emailInput).toHaveAttribute('required');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(phoneInput).toHaveAttribute('type', 'tel');

    // Check submit button accessibility
    const submitButton = screen.getByRole('button', { name: /complete registration/i });
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('displays proper currency and language options', () => {
    render(
      <TestWrapper>
        <Register />
      </TestWrapper>
    );

    // Check currency options
    expect(screen.getByRole('option', { name: /british pound/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /hong kong dollar/i })).toBeInTheDocument();

    // Check language options
    expect(screen.getByRole('option', { name: /english.*uk/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /繁體中文.*香港/i })).toBeInTheDocument();
  });
});