import React from 'react';
import { useTimezoneChangeNotification } from '../../hooks/useTimezone';
import { getTimezoneDisplayName } from '../../utils/timezoneUtils';

interface TimezoneChangeNotificationProps {
  userTimezone?: string;
  onTimezoneUpdate?: (newTimezone: string) => void;
  className?: string;
}

/**
 * Component that shows a notification when user's browser timezone 
 * differs from their stored timezone preference
 */
export const TimezoneChangeNotification: React.FC<TimezoneChangeNotificationProps> = ({
  userTimezone,
  onTimezoneUpdate,
  className = ""
}) => {
  const { 
    showNotification, 
    changeInfo, 
    dismissNotification, 
    acceptTimezoneChange 
  } = useTimezoneChangeNotification(userTimezone);

  if (!showNotification || !changeInfo) {
    return null;
  }

  const handleAcceptChange = () => {
    const newTimezone = acceptTimezoneChange();
    if (newTimezone && onTimezoneUpdate) {
      onTimezoneUpdate(newTimezone);
    }
  };

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg 
            className="h-5 w-5 text-blue-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-blue-800">
            Timezone Change Detected
          </h3>
          <div className="mt-2 text-sm text-blue-700">
            <p>
              Your browser timezone ({getTimezoneDisplayName(changeInfo.browserTimezone)}) 
              is different from your saved preference ({getTimezoneDisplayName(changeInfo.storedTimezone)}).
            </p>
            <p className="mt-1">
              Would you like to update your timezone setting?
            </p>
          </div>
          
          <div className="mt-4 flex space-x-3">
            <button
              onClick={handleAcceptChange}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors duration-200"
            >
              Update to {getTimezoneDisplayName(changeInfo.browserTimezone)}
            </button>
            <button
              onClick={dismissNotification}
              className="bg-white hover:bg-gray-50 text-blue-600 border border-blue-600 text-sm font-medium px-3 py-1.5 rounded-md transition-colors duration-200"
            >
              Keep Current Setting
            </button>
          </div>
        </div>
        
        <div className="flex-shrink-0 ml-3">
          <button
            onClick={dismissNotification}
            className="text-blue-400 hover:text-blue-600 transition-colors duration-200"
          >
            <span className="sr-only">Dismiss</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact version of the timezone notification for smaller spaces
 */
export const CompactTimezoneChangeNotification: React.FC<TimezoneChangeNotificationProps> = ({
  userTimezone,
  onTimezoneUpdate,
  className = ""
}) => {
  const { 
    showNotification, 
    changeInfo, 
    dismissNotification, 
    acceptTimezoneChange 
  } = useTimezoneChangeNotification(userTimezone);

  if (!showNotification || !changeInfo) {
    return null;
  }

  const handleAcceptChange = () => {
    const newTimezone = acceptTimezoneChange();
    if (newTimezone && onTimezoneUpdate) {
      onTimezoneUpdate(newTimezone);
    }
  };

  return (
    <div className={`bg-yellow-50 border-l-4 border-yellow-400 p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <svg className="h-4 w-4 text-yellow-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-yellow-700">
            Timezone changed to {getTimezoneDisplayName(changeInfo.browserTimezone)}
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handleAcceptChange}
            className="text-xs font-medium text-yellow-800 hover:text-yellow-900 underline"
          >
            Update
          </button>
          <button
            onClick={dismissNotification}
            className="text-yellow-400 hover:text-yellow-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TimezoneChangeNotification;