import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { RegisterFormData } from '../../types';
import { register, registerWithGoogle } from '../../utils/api';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Check for Google OAuth parameters
  const googleId = searchParams.get('googleId');
  const googleEmail = searchParams.get('email');
  const googleName = searchParams.get('name');
  const isGoogleSignup = !!(googleId && googleEmail && googleName);
  
  const [formData, setFormData] = useState<RegisterFormData>({
    name: googleName || '',
    email: googleEmail || '',
    phone: '',
    address: '',
    currency: 'GBP',
    language: 'en-GB',
    timeZone: 'Europe/London',
    dateFormat: 'DD/MM/YYYY',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isGoogleSignup && googleId && googleEmail && googleName) {
        // Google OAuth registration
        const result = await registerWithGoogle(googleId, googleEmail, formData.name);
        
        if (result.success && result.token) {
          // Store the token and redirect to dashboard
          localStorage.setItem('accessToken', result.token);
          navigate('/dashboard');
        } else {
          setError(result.message || 'Registration failed. Please try again.');
        }
      } else {
        // Regular email registration (if supported)
        const user = await register(formData);
        // Since register returns a User object, registration was successful
        if (user && user.id) {
          // Registration successful, redirect to login
          navigate('/login');
        } else {
          setError('Registration failed. Please try again.');
        }
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">Income Meter</h1>
          <h2 className="text-2xl font-bold text-gray-900">
            {isGoogleSignup ? 'Complete Your Profile' : 'Create Account'}
          </h2>
          <p className="mt-2 text-gray-600">
            {isGoogleSignup 
              ? 'Just a few more details to get you started'
              : 'Set up your Income Meter profile'
            }
          </p>
          {isGoogleSignup && (
            <div className="mt-4 p-3 bg-green-100 rounded-md">
              <p className="text-sm text-green-800">
                ✓ Signed in with Google as <strong>{googleEmail}</strong>
              </p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Personal Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    readOnly={isGoogleSignup}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isGoogleSignup ? 'bg-gray-100 text-gray-600' : ''}`}
                    placeholder="Enter your full name"
                  />
                  {isGoogleSignup && (
                    <p className="text-xs text-gray-500 mt-1">From your Google account</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    readOnly={isGoogleSignup}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${isGoogleSignup ? 'bg-gray-100 text-gray-600' : ''}`}
                    placeholder="Enter your email address"
                  />
                  {isGoogleSignup && (
                    <p className="text-xs text-gray-500 mt-1">From your Google account</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    required
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+44 7700 900123"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    name="address"
                    rows={3}
                    value={formData.address}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter your address (optional)"
                  />
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800">Preferences</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="GBP">British Pound (GBP)</option>
                    <option value="HKD">Hong Kong Dollar (HKD)</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Choose your preferred currency for displaying income</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Language
                  </label>
                  <select
                    name="language"
                    value={formData.language}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="en-GB">English (UK)</option>
                    <option value="zh-HK">Chinese (Hong Kong)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time Zone
                  </label>
                  <select
                    name="timeZone"
                    value={formData.timeZone}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Asia/Hong_Kong">Hong Kong (HKT)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Format
                  </label>
                  <select
                    name="dateFormat"
                    value={formData.dateFormat}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-md">
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
              <a
                href="/login"
                className="text-blue-600 hover:text-blue-500 font-medium transition-colors duration-200"
              >
                Already have an account? Sign in
              </a>
              
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-6 py-2 rounded-md font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors duration-200"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating Account...
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Terms and Privacy */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-blue-600 hover:text-blue-500">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;