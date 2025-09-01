/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { UserSettings } from '../types';

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date) => string;
}

const defaultSettings: UserSettings = {
  currency: 'GBP',
  language: 'en-GB',
  timeZone: 'Europe/London',
  dateFormat: 'DD/MM/YYYY',
  emailNotifications: true,
  pushNotifications: false,
  defaultChartPeriod: '7',
  showWeekends: true,
  mileageUnit: 'mi',
  fiscalYearStartDate: '04-06', // UK tax year default
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);

  useEffect(() => {
    // Load settings from localStorage or API
    const savedSettings = localStorage.getItem('userSettings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.error('Failed to parse saved settings:', error);
      }
    }
  }, []);

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    localStorage.setItem('userSettings', JSON.stringify(updatedSettings));
  };

  const formatCurrency = (amount: number): string => {
    const locale = settings.language;
    const currency = settings.currency;
    
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (date: Date): string => {
    const locale = settings.language;
    
    switch (settings.dateFormat) {
      case 'MM/DD/YYYY':
        return date.toLocaleDateString('en-US');
      case 'YYYY-MM-DD':
        return date.toISOString().split('T')[0];
      default: // DD/MM/YYYY
        return date.toLocaleDateString(locale);
    }
  };

  const value: SettingsContextType = {
    settings,
    updateSettings,
    formatCurrency,
    formatDate,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};