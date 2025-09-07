import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import WorkTypeConfigSection from '../Settings/WorkTypeConfig';
import ApiKeyGenerator from '../Settings/ApiKeyGenerator';
import JwtApiTokenGenerator from '../Settings/JwtApiTokenGenerator';
import type { UserSettings } from '../../types';

const Settings: React.FC = () => {
  const { settings, updateSettings } = useSettings();
  const { t, changeLanguage } = useLanguage();
  const [formData, setFormData] = useState<UserSettings>(settings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Debounced auto-save function
  const debouncedSave = useCallback((newSettings: UserSettings) => {
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set saving status immediately
    setSaveStatus('saving');

    // Set new timeout for actual save
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        updateSettings(newSettings);
        setSaveStatus('saved');
        
        // Reset to idle after showing success briefly
        setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      } catch (error) {
        console.error('Failed to save settings:', error);
        setSaveStatus('error');
        
        // Reset to idle after showing error briefly
        setTimeout(() => {
          setSaveStatus('idle');
        }, 3000);
      }
    }, 300); // 300ms delay
  }, [updateSettings]);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    let newFormData: UserSettings;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      newFormData = {
        ...formData,
        [name]: checked,
      };
    } else {
      newFormData = {
        ...formData,
        [name]: value,
      };
      
      // If language is being changed, immediately update the language context
      if (name === 'language' && (value === 'en-GB' || value === 'zh-HK')) {
        await changeLanguage(value);
      }
    }
    
    // Update form data
    setFormData(newFormData);
    
    // Trigger debounced auto-save
    debouncedSave(newFormData);
  };


  const handleReset = () => {
    const defaultSettings: UserSettings = {
      currency: 'GBP',
      language: 'en-GB',
      timeZone: 'Europe/London',
      dateFormat: 'DD/MM/YYYY',
      emailNotifications: true,
      pushNotifications: false,
      defaultChartPeriod: '7',
      showWeekends: true,
      mileageUnit: 'km',
      fiscalYearStartDate: '04-06', // UK tax year default
    };
    
    setFormData(defaultSettings);
    setSaveStatus('idle');
    
    // Trigger auto-save with default settings
    debouncedSave(defaultSettings);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('settings.title')}</h1>
              <p className="text-gray-600 mt-1">Manage your account preferences and settings.</p>
            </div>
            
            {/* Save Status Indicator */}
            <div className="flex items-center space-x-2">
              {saveStatus === 'saving' && (
                <div className="flex items-center text-blue-600">
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm">{t('settings.status.saving') || 'Saving...'}</span>
                </div>
              )}
              {saveStatus === 'saved' && (
                <div className="flex items-center text-green-600">
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                  <span className="text-sm">{t('settings.status.saved') || 'Saved'}</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center text-red-600">
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                  <span className="text-sm">{t('settings.status.error') || 'Error saving'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          <div>
            <div className="space-y-8">
              {/* Currency & Language Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{t('settings.sections.localization')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.form.currency')}
                    </label>
                    <select
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="GBP">{t('settings.currencies.GBP')}</option>
                      <option value="HKD">{t('settings.currencies.HKD')}</option>
                    </select>
                    <p className="text-sm text-gray-500 mt-1">Choose your preferred currency for displaying income</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.form.language')}
                    </label>
                    <select
                      name="language"
                      value={formData.language}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="en-GB">{t('settings.languages.en-GB')}</option>
                      <option value="zh-HK">{t('settings.languages.zh-HK')}</option>
                    </select>
                    <p className="text-sm text-gray-500 mt-1">Select your preferred language</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.form.timeZone')}
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
                    <label className="block text-sm font-medium text-gray-700 mb-2">
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

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {t('settings.form.mileageUnit')}
                    </label>
                    <select
                      name="mileageUnit"
                      value={formData.mileageUnit}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="km">{t('settings.mileageUnits.km')}</option>
                      <option value="mi">{t('settings.mileageUnits.mi')}</option>
                    </select>
                    <p className="text-sm text-gray-500 mt-1">Choose your preferred unit for displaying distances</p>
                  </div>
                </div>
              </div>

              {/* Notifications Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Notifications</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Email Notifications</h4>
                      <p className="text-sm text-gray-600">Receive email updates about your income reports</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="emailNotifications"
                        checked={formData.emailNotifications}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-gray-900">Push Notifications</h4>
                      <p className="text-sm text-gray-600">Get notified about route completions and income updates</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="pushNotifications"
                        checked={formData.pushNotifications}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Dashboard Settings */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Dashboard Settings</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Chart Period
                    </label>
                    <select
                      name="defaultChartPeriod"
                      value={formData.defaultChartPeriod}
                      onChange={handleChange}
                      className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fiscal Year Start Date
                    </label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="date"
                        name="fiscalYearStartDate"
                        value={`2024-${formData.fiscalYearStartDate}`} // Convert MM-DD to full date for input
                        onChange={(e) => {
                          const date = new Date(e.target.value);
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          handleChange({
                            target: {
                              name: 'fiscalYearStartDate',
                              value: `${month}-${day}`,
                              type: 'text'
                            }
                          } as React.ChangeEvent<HTMLInputElement>);
                        }}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => handleChange({
                            target: { name: 'fiscalYearStartDate', value: '04-06', type: 'text' }
                          } as React.ChangeEvent<HTMLInputElement>)}
                          className={`px-3 py-1 text-xs rounded-md border ${
                            formData.fiscalYearStartDate === '04-06' 
                              ? 'bg-blue-100 border-blue-300 text-blue-700'
                              : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          UK (Apr 6)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChange({
                            target: { name: 'fiscalYearStartDate', value: '04-01', type: 'text' }
                          } as React.ChangeEvent<HTMLInputElement>)}
                          className={`px-3 py-1 text-xs rounded-md border ${
                            formData.fiscalYearStartDate === '04-01'
                              ? 'bg-blue-100 border-blue-300 text-blue-700' 
                              : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          HK (Apr 1)
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Set your fiscal year start date for dashboard charts. This affects weekly and annual income calculations.
                    </p>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      name="showWeekends"
                      checked={formData.showWeekends}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="ml-2 text-sm font-medium text-gray-700">
                      Include weekends in reports
                    </label>
                  </div>
                </div>
              </div>

              {/* API Access Section */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('settings.apiAccess.title', 'API Access')}</h2>
                
                {/* JWT API Tokens (Recommended) */}
                <JwtApiTokenGenerator />
                
                {/* Legacy API Keys */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">{t('settings.apiAccess.legacyKeys', 'Legacy API Keys')}</h3>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
                      <p className="text-sm text-yellow-800">
                        <strong>{t('common.notice', 'Notice')}:</strong> {t('settings.apiAccess.deprecationNotice', 'Legacy API keys are still supported but JWT tokens are recommended for new integrations due to enhanced security features.')}
                      </p>
                    </div>
                  </div>
                  <ApiKeyGenerator />
                </div>
              </div>

              {/* Work Types & Income Sources Section */}
              <div>
                <WorkTypeConfigSection />
              </div>
            </div>


            {/* Action Buttons */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <div className="flex justify-start">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-200"
                >
                  Reset to Defaults
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {t('settings.autoSaveNote') || 'Changes are saved automatically'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;