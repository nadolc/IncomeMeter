import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import type { PeriodType } from '../../types';

interface PeriodNavigationProps {
  period: PeriodType;
  currentPeriodDisplay: string;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  className?: string;
}

const PeriodNavigation: React.FC<PeriodNavigationProps> = ({
  period,
  currentPeriodDisplay,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onToday,
  className = '',
}) => {
  const { t } = useLanguage();

  const ArrowLeftIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );

  const ArrowRightIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );

  const TodayIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );

  const getPeriodName = () => {
    switch (period) {
        case 'weekly': return t('dashboard.periods.every').toLowerCase() + t('dashboard.periods.weekly').toLowerCase();
        case 'monthly': return t('dashboard.periods.every').toLowerCase() + t('dashboard.periods.monthly').toLowerCase();
        case 'annual': return t('dashboard.periods.every').toLowerCase() + t('dashboard.periods.annual').toLowerCase();
      default: return period;
    }
  };

  return (
    <div className={`flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3 ${className}`}>
      {/* Previous Button */}
      <button
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className={`
          flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
          ${
            canGoPrevious
              ? 'text-gray-700 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'
              : 'text-gray-300 bg-gray-50 cursor-not-allowed'
          }
        `}
        title={t('dashboard.navigation.previousPeriod', { period: getPeriodName() })}
      >
        <ArrowLeftIcon />
        <span className="ml-1 hidden sm:inline">
          {t('dashboard.navigation.previousPeriod', { period: getPeriodName() })}
        </span>
      </button>

      {/* Current Period Display */}
      <div className="flex items-center space-x-3">
        <h2 className="text-lg font-semibold text-gray-900">
          {currentPeriodDisplay}
        </h2>
        
        {/* Today Button */}
        <button
          onClick={onToday}
          className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Go to current period"
        >
          <TodayIcon />
                  <span className="ml-1 hidden sm:inline">{t('dashboard.navigation.today')}</span>
        </button>
      </div>

      {/* Next Button */}
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className={`
          flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200
          ${
            canGoNext
              ? 'text-gray-700 bg-gray-50 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'
              : 'text-gray-300 bg-gray-50 cursor-not-allowed'
          }
        `}
        title={t('dashboard.navigation.nextPeriod', { period: getPeriodName() })}
      >
        <span className="mr-1 hidden sm:inline">
          {t('dashboard.navigation.nextPeriod', { period: getPeriodName() })}
        </span>
        <ArrowRightIcon />
      </button>
    </div>
  );
};

export default PeriodNavigation;