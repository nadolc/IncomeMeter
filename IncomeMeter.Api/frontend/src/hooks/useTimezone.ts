import { useState, useEffect, useCallback } from 'react';
import {
  getBrowserTimezone,
  formatDateInTimezone,
  formatTimeInTimezone,
  formatDateTimeInTimezone,
  formatTimeRange,
  detectTimezoneChange,
  isValidTimezone,
  getTimezoneDisplayName,
  COMMON_TIMEZONES
} from '../utils/timezoneUtils';

/**
 * Custom hook for handling timezone operations in React components
 */
export const useTimezone = (userPreferredTimezone?: string) => {
  const [browserTimezone] = useState(getBrowserTimezone());
  const [currentTimezone, setCurrentTimezone] = useState(
    userPreferredTimezone || browserTimezone
  );
  const [timezoneChangeDetected, setTimezoneChangeDetected] = useState(false);

  // Update current timezone when user preference changes
  useEffect(() => {
    if (userPreferredTimezone && isValidTimezone(userPreferredTimezone)) {
      setCurrentTimezone(userPreferredTimezone);
    }
  }, [userPreferredTimezone]);

  // Check for timezone changes
  useEffect(() => {
    if (userPreferredTimezone) {
      const changeInfo = detectTimezoneChange(userPreferredTimezone);
      setTimezoneChangeDetected(changeInfo.shouldPromptUpdate);
    }
  }, [userPreferredTimezone, browserTimezone]);

  // Format functions using current timezone
  const formatDate = useCallback((
    date: Date | string,
    options?: Intl.DateTimeFormatOptions
  ): string => {
    return formatDateInTimezone(date, currentTimezone, options);
  }, [currentTimezone]);

  const formatTime = useCallback((
    date: Date | string,
    use24Hour: boolean = false
  ): string => {
    return formatTimeInTimezone(date, currentTimezone, use24Hour);
  }, [currentTimezone]);

  const formatDateTime = useCallback((
    date: Date | string,
    use24Hour: boolean = false
  ): string => {
    return formatDateTimeInTimezone(date, currentTimezone, use24Hour);
  }, [currentTimezone]);

  const formatTimeRangeInTimezone = useCallback((
    startDate: Date | string,
    endDate: Date | string,
    use24Hour: boolean = false
  ): string => {
    return formatTimeRange(startDate, endDate, currentTimezone, use24Hour);
  }, [currentTimezone]);

  // Get timezone information
  const getTimezoneInfo = useCallback(() => {
    return {
      current: currentTimezone,
      browser: browserTimezone,
      displayName: getTimezoneDisplayName(currentTimezone),
      hasChanged: timezoneChangeDetected,
      isValid: isValidTimezone(currentTimezone)
    };
  }, [currentTimezone, browserTimezone, timezoneChangeDetected]);

  // Get available timezones
  const getAvailableTimezones = useCallback(() => {
    return Object.entries(COMMON_TIMEZONES).map(([id, name]) => ({
      id,
      name,
      isCurrent: id === currentTimezone,
      isBrowser: id === browserTimezone
    }));
  }, [currentTimezone, browserTimezone]);

  // Dismiss timezone change notification
  const dismissTimezoneChange = useCallback(() => {
    setTimezoneChangeDetected(false);
  }, []);

  // Update to browser timezone
  const updateToBrowserTimezone = useCallback(() => {
    setCurrentTimezone(browserTimezone);
    setTimezoneChangeDetected(false);
  }, [browserTimezone]);

  return {
    // Current state
    timezone: currentTimezone,
    browserTimezone,
    timezoneChangeDetected,
    
    // Formatting functions
    formatDate,
    formatTime,
    formatDateTime,
    formatTimeRange: formatTimeRangeInTimezone,
    
    // Information functions
    getTimezoneInfo,
    getAvailableTimezones,
    
    // Actions
    setTimezone: setCurrentTimezone,
    dismissTimezoneChange,
    updateToBrowserTimezone
  };
};

/**
 * Hook specifically for route schedule display and management
 */
export const useRouteTimezone = (userPreferredTimezone?: string) => {
  const timezone = useTimezone(userPreferredTimezone);

  // Format route schedule times
  const formatRouteSchedule = useCallback((route: {
    scheduleStart: Date | string;
    scheduleEnd: Date | string;
  }) => {
    return {
      date: timezone.formatDate(route.scheduleStart),
      timeRange: timezone.formatTimeRange(route.scheduleStart, route.scheduleEnd),
      startTime: timezone.formatTime(route.scheduleStart),
      endTime: timezone.formatTime(route.scheduleEnd),
      startDateTime: timezone.formatDateTime(route.scheduleStart),
      endDateTime: timezone.formatDateTime(route.scheduleEnd)
    };
  }, [timezone]);

  // Format actual route times
  const formatActualTimes = useCallback((route: {
    actualStartTime?: Date | string | null;
    actualEndTime?: Date | string | null;
  }) => {
    return {
      startTime: route.actualStartTime ? timezone.formatTime(route.actualStartTime) : null,
      endTime: route.actualEndTime ? timezone.formatTime(route.actualEndTime) : null,
      startDateTime: route.actualStartTime ? timezone.formatDateTime(route.actualStartTime) : null,
      endDateTime: route.actualEndTime ? timezone.formatDateTime(route.actualEndTime) : null,
      duration: route.actualStartTime && route.actualEndTime ? 
        calculateDuration(new Date(route.actualStartTime), new Date(route.actualEndTime)) : null
    };
  }, [timezone]);

  // Calculate duration between two dates
  const calculateDuration = (start: Date, end: Date): string => {
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return {
    ...timezone,
    formatRouteSchedule,
    formatActualTimes
  };
};

/**
 * Hook for managing timezone change notifications
 */
export const useTimezoneChangeNotification = (userPreferredTimezone?: string) => {
  const [showNotification, setShowNotification] = useState(false);
  const [changeInfo, setChangeInfo] = useState<{
    browserTimezone: string;
    storedTimezone: string;
  } | null>(null);

  useEffect(() => {
    if (userPreferredTimezone) {
      const info = detectTimezoneChange(userPreferredTimezone);
      if (info.shouldPromptUpdate) {
        setShowNotification(true);
        setChangeInfo({
          browserTimezone: info.browserTimezone,
          storedTimezone: info.storedTimezone
        });
      }
    }
  }, [userPreferredTimezone]);

  const dismissNotification = useCallback(() => {
    setShowNotification(false);
  }, []);

  const acceptTimezoneChange = useCallback(() => {
    setShowNotification(false);
    return changeInfo?.browserTimezone;
  }, [changeInfo]);

  return {
    showNotification,
    changeInfo,
    dismissNotification,
    acceptTimezoneChange
  };
};