import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const { settings, formatCurrency } = useSettings();
  const { t } = useLanguage();

  // Mock quick stats data
  const quickStats = {
    totalRoutes: 156,
    totalIncome: 12450.75,
    activeDays: 89,
    avgDailyIncome: 139.89,
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const getLanguageDisplay = (language: string) => {
    switch (language) {
      case 'en-GB':
        return 'English (UK)';
      case 'zh-HK':
        return 'Chinese (Hong Kong)';
      default:
        return 'English (UK)';
    }
  };

  const getTimeZoneDisplay = (timeZone: string) => {
    switch (timeZone) {
      case 'Europe/London':
        return 'London (GMT)';
      case 'Asia/Hong_Kong':
        return 'Hong Kong (HKT)';
      default:
        return 'London (GMT)';
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="px-6 py-8 bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex flex-col sm:flex-row sm:items-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-4 sm:mb-0">
              <span className="text-2xl font-bold text-blue-600">
                {getInitials(user.name)}
              </span>
            </div>
            <div className="sm:ml-6 text-white">
              <h1 className="text-2xl font-bold">{user.name}</h1>
              <p className="text-blue-100">{user.email}</p>
              <p className="text-blue-100 text-sm">
                {t('profile.form.memberSince')} {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Content */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('profile.personalInfo')}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.form.name')}</label>
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    {user.name}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.form.email')}</label>
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    {user.email}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.form.phone')}</label>
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    {user.phone || t('common.no')}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('profile.form.address')}</label>
                  <div className="px-3 py-2 border border-gray-300 rounded-md bg-gray-50">
                    {user.address || t('common.no')}
                  </div>
                </div>
              </div>
            </div>

            {/* Account Settings Overview */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('profile.accountDetails')}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="font-medium text-gray-900">Currency</h4>
                    <p className="text-sm text-gray-600">{settings.currency}</p>
                  </div>
                  <a
                    href="/settings"
                    className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
                  >
                    Change
                  </a>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="font-medium text-gray-900">Language</h4>
                    <p className="text-sm text-gray-600">{getLanguageDisplay(settings.language)}</p>
                  </div>
                  <a
                    href="/settings"
                    className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
                  >
                    Change
                  </a>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="font-medium text-gray-900">Time Zone</h4>
                    <p className="text-sm text-gray-600">{getTimeZoneDisplay(settings.timeZone)}</p>
                  </div>
                  <a
                    href="/settings"
                    className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
                  >
                    Change
                  </a>
                </div>

                <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <h4 className="font-medium text-gray-900">Notifications</h4>
                    <p className="text-sm text-gray-600">
                      {settings.emailNotifications ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                  <a
                    href="/settings"
                    className="text-blue-600 hover:text-blue-500 text-sm font-medium transition-colors"
                  >
                    Change
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Quick Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {quickStats.totalRoutes}
                </div>
                <div className="text-sm text-gray-600">Total Routes</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600 mb-1">
                  {formatCurrency(quickStats.totalIncome)}
                </div>
                <div className="text-sm text-gray-600">Total Income</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-1">
                  {quickStats.activeDays}
                </div>
                <div className="text-sm text-gray-600">Active Days</div>
              </div>
              
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-600 mb-1">
                  {formatCurrency(quickStats.avgDailyIncome)}
                </div>
                <div className="text-sm text-gray-600">Avg Daily Income</div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800 mb-6">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-green-100 rounded-full mr-4">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Completed Route: City Center</p>
                  <p className="text-sm text-gray-600">Earned {formatCurrency(185.50)} • 2 hours ago</p>
                </div>
              </div>

              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-blue-100 rounded-full mr-4">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Settings Updated</p>
                  <p className="text-sm text-gray-600">Changed currency to {settings.currency} • 1 day ago</p>
                </div>
              </div>

              <div className="flex items-center p-4 bg-gray-50 rounded-lg">
                <div className="p-2 bg-purple-100 rounded-full mr-4">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Profile Created</p>
                  <p className="text-sm text-gray-600">Welcome to Income Meter! • {new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
            <div>
              <a
                href="/settings"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Edit Settings
              </a>
            </div>

            <div className="text-sm text-gray-500">
              Last updated: {new Date(user.updatedAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;