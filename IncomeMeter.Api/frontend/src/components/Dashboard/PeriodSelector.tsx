import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { PeriodType } from '../../types';

interface PeriodSelectorProps {
  selectedPeriod: PeriodType;
  onPeriodChange: (period: PeriodType) => void;
  className?: string;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ 
  selectedPeriod, 
  onPeriodChange, 
  className = '' 
}) => {
  const { t } = useLanguage();

  const periods: { key: PeriodType; label: string; shortLabel: string }[] = [
    { key: 'weekly', label: t('dashboard.periods.weekly'), shortLabel: 'Week' },
    { key: 'monthly', label: t('dashboard.periods.monthly'), shortLabel: 'Month' },
    { key: 'annual', label: t('dashboard.periods.annual'), shortLabel: 'Year' },
  ];

  return (
    <div className={`flex space-x-0.5 sm:space-x-1 bg-gray-100 rounded-lg p-0.5 sm:p-1 w-full sm:w-auto ${className}`}>
      {periods.map((period) => (
        <button
          key={period.key}
          onClick={() => onPeriodChange(period.key)}
          className={`
            flex-1 sm:flex-none px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 whitespace-nowrap
            ${
              selectedPeriod === period.key
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-black ring-opacity-5'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }
          `}
          type="button"
        >
          <span className="hidden sm:inline">{period.label}</span>
          <span className="sm:hidden">{period.shortLabel}</span>
        </button>
      ))}
    </div>
  );
};

export default PeriodSelector;