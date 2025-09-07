import React, { useMemo } from 'react';
import { COMMON_TIMEZONES, getBrowserTimezone, getTimezoneDisplayName } from '../../utils/timezoneUtils';

interface TimezoneSelectorProps {
  value?: string;
  onChange?: (timezone: string) => void;
  className?: string;
  disabled?: boolean;
  showBrowserDetection?: boolean;
  label?: string;
  placeholder?: string;
}

/**
 * Timezone selector component with common timezones and browser detection
 */
export const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({
  value,
  onChange,
  className = "",
  disabled = false,
  showBrowserDetection = true,
  label = "Timezone",
  placeholder = "Select timezone..."
}) => {
  const browserTimezone = getBrowserTimezone();

  // Prepare timezone options
  const timezoneOptions = useMemo(() => {
    const options = Object.entries(COMMON_TIMEZONES).map(([id, name]) => ({
      id,
      name,
      isCurrent: id === value,
      isBrowser: id === browserTimezone
    }));

    // Sort by name for better UX
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, [value, browserTimezone]);

  // Check if browser timezone is in common list
  const browserTimezoneInList = timezoneOptions.some(option => option.isBrowser);

  const handleTimezoneChange = (newTimezone: string) => {
    if (onChange) {
      onChange(newTimezone);
    }
  };

  const handleUseBrowserTimezone = () => {
    handleTimezoneChange(browserTimezone);
  };

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <div className="space-y-2">
        {/* Main timezone selector */}
        <select
          value={value || ""}
          onChange={(e) => handleTimezoneChange(e.target.value)}
          disabled={disabled}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {timezoneOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.isBrowser && " (Browser)"}
              {option.isCurrent && " (Current)"}
            </option>
          ))}
        </select>

        {/* Browser timezone detection */}
        {showBrowserDetection && !disabled && (
          <div className="text-sm">
            {!browserTimezoneInList && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-800">
                      Browser timezone: <span className="font-medium">{getTimezoneDisplayName(browserTimezone)}</span>
                    </p>
                    {value !== browserTimezone && (
                      <p className="text-blue-600 text-xs mt-1">
                        This timezone is not in the common list but can be used.
                      </p>
                    )}
                  </div>
                  {value !== browserTimezone && (
                    <button
                      onClick={handleUseBrowserTimezone}
                      className="ml-2 text-xs font-medium text-blue-600 hover:text-blue-800 underline"
                    >
                      Use This
                    </button>
                  )}
                </div>
              </div>
            )}

            {browserTimezoneInList && value !== browserTimezone && (
              <button
                onClick={handleUseBrowserTimezone}
                className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
              >
                Use browser timezone ({getTimezoneDisplayName(browserTimezone)})
              </button>
            )}

            {value === browserTimezone && (
              <p className="text-green-600 text-xs">
                ✓ Using browser timezone: {getTimezoneDisplayName(browserTimezone)}
              </p>
            )}
          </div>
        )}

        {/* Current selection info */}
        {value && (
          <div className="text-xs text-gray-500">
            Selected: {getTimezoneDisplayName(value)}
            {value === browserTimezone && " (matches browser)"}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Compact timezone selector for inline use
 */
export const CompactTimezoneSelector: React.FC<TimezoneSelectorProps> = ({
  value,
  onChange,
  className = "",
  disabled = false,
  placeholder = "Timezone"
}) => {
  const timezoneOptions = useMemo(() => {
    return Object.entries(COMMON_TIMEZONES).map(([id, name]) => ({
      id,
      name: name.replace(/\s*\([^)]+\)/g, '') // Remove parenthetical info for compact view
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <select
      value={value || ""}
      onChange={(e) => onChange && onChange(e.target.value)}
      disabled={disabled}
      className={`px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${className}`}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {timezoneOptions.map((option) => (
        <option key={option.id} value={option.id}>
          {option.name}
        </option>
      ))}
    </select>
  );
};

/**
 * Timezone display component (read-only)
 */
export const TimezoneDisplay: React.FC<{
  timezone: string;
  showOffset?: boolean;
  className?: string;
}> = ({
  timezone,
  className = ""
}) => {
  const displayName = getTimezoneDisplayName(timezone);
  const currentTime = new Date().toLocaleString('en-US', { 
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className={`text-sm ${className}`}>
      <div className="font-medium text-gray-900">
        {displayName}
      </div>
      <div className="text-gray-500">
        Current time: {currentTime}
      </div>
    </div>
  );
};

export default TimezoneSelector;