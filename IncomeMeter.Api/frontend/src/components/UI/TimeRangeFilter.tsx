import React from 'react';
import { useTranslation } from 'react-i18next';

export interface TimeRangeOption {
  value: string;
  label: string;
  days?: number; // null for 'all'
}

interface TimeRangeFilterProps {
  selectedRange: string;
  onRangeChange: (range: string) => void;
  className?: string;
  label?: string;
}

// Moved to separate utility file to avoid React Fast Refresh issue

const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({
  selectedRange,
  onRangeChange,
  className = "",
  label
}) => {
  const { t } = useTranslation();

  const timeRangeOptions: TimeRangeOption[] = [
    { value: 'all', label: t('routes.filters.timeRange.all') || 'All time' },
    { value: '7_days', label: t('routes.filters.timeRange.last7Days') || 'Last 7 days', days: 7 },
    { value: '14_days', label: t('routes.filters.timeRange.last14Days') || 'Last 14 days', days: 14 },
    { value: '30_days', label: t('routes.filters.timeRange.last30Days') || 'Last 30 days', days: 30 }
  ];

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        value={selectedRange}
        onChange={(e) => onRangeChange(e.target.value)}
        className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
      >
        {timeRangeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimeRangeFilter;