import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import LanguageSwitcher from '../Common/LanguageSwitcher';

const Login: React.FC = () => {
  const { login } = useAuth();
  const { t } = useLanguage();

  const handleGoogleLogin = () => {
    login('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      {/* Language Switcher */}
      <div className="absolute top-4 right-4">
        <LanguageSwitcher showText={false} />
      </div>
      
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-blue-600 mb-2">{t('app.title')}</h1>
          <h2 className="text-2xl font-bold text-gray-900">{t('auth.login.title')}</h2>
          <p className="mt-2 text-gray-600">{t('auth.login.subtitle')}</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="space-y-6">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex justify-center items-center px-4 py-3 border border-transparent rounded-md shadow-sm bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {t('auth.login.googleButton')}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">{t('auth.login.newAccount')}</span>
              </div>
            </div>

            <div className="text-center">
              <a
                href="/register"
                className="text-blue-600 hover:text-blue-500 font-medium transition-colors duration-200"
              >
{t('auth.login.createAccount')}
              </a>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-xs text-gray-500 text-center space-y-2">
              <p>{t('auth.login.terms')}</p>
              <p>{t('auth.login.secureAuth')}</p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mt-8">
          <h3 className="text-sm font-medium text-gray-900 text-center mb-4">
            {t('app.subtitle')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 flex items-center justify-center rounded-full bg-blue-100">
                <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 mt-2">{t('features.realTimeAnalytics')}</p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto h-8 w-8 flex items-center justify-center rounded-full bg-green-100">
                <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 mt-2">{t('features.multiCurrency')}</p>
            </div>
            
            <div className="text-center">
              <div className="mx-auto h-8 w-8 flex items-center justify-center rounded-full bg-purple-100">
                <svg className="h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <p className="text-sm text-gray-600 mt-2">{t('features.securePrivate')}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;