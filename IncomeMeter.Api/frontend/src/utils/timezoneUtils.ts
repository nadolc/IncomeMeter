/**
 * Timezone utility functions for handling datetime operations in React components
 * Ensures consistent timezone handling between frontend and backend
 */

/**
 * Gets the user's browser timezone
 */
export const getBrowserTimezone = (): string => {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
};

/**
 * Common timezone options for user selection
 */
export const COMMON_TIMEZONES: { [key: string]: string } = {
  'UTC': 'UTC',
  'Europe/London': 'London (GMT/BST)',
  'Europe/Paris': 'Paris (CET/CEST)',
  'Europe/Berlin': 'Berlin (CET/CEST)',
  'Europe/Rome': 'Rome (CET/CEST)',
  'Europe/Madrid': 'Madrid (CET/CEST)',
  'America/New_York': 'New York (EST/EDT)',
  'America/Chicago': 'Chicago (CST/CDT)',
  'America/Denver': 'Denver (MST/MDT)',
  'America/Los_Angeles': 'Los Angeles (PST/PDT)',
  'Asia/Tokyo': 'Tokyo (JST)',
  'Asia/Shanghai': 'Shanghai (CST)',
  'Asia/Kolkata': 'Mumbai (IST)',
  'Australia/Sydney': 'Sydney (AEST/AEDT)',
  'Africa/Cairo': 'Cairo (EET/EEST)',
  'America/Sao_Paulo': 'São Paulo (BRT/BRST)'
};

/**
 * Formats a date according to user's timezone and locale preferences
 */
export const formatDateInTimezone = (
  date: Date | string,
  timezone: string = getBrowserTimezone(),
  options: Intl.DateTimeFormatOptions = {}
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  };

  try {
    return new Intl.DateTimeFormat('en-US', {
      ...defaultOptions,
      timeZone: timezone
    }).format(dateObj);
  } catch (error) {
    // Fallback to browser timezone if specified timezone is invalid
    return new Intl.DateTimeFormat('en-US', defaultOptions).format(dateObj);
  }
};

/**
 * Formats time according to user's timezone
 */
export const formatTimeInTimezone = (
  date: Date | string,
  timezone: string = getBrowserTimezone(),
  use24Hour: boolean = false
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Time';
  }

  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24Hour
  };

  try {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: timezone
    }).format(dateObj);
  } catch (error) {
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
  }
};

/**
 * Formats both date and time in user's timezone
 */
export const formatDateTimeInTimezone = (
  date: Date | string,
  timezone: string = getBrowserTimezone(),
  use24Hour: boolean = false
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid DateTime';
  }

  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: !use24Hour
  };

  try {
    return new Intl.DateTimeFormat('en-US', {
      ...options,
      timeZone: timezone
    }).format(dateObj);
  } catch (error) {
    return new Intl.DateTimeFormat('en-US', options).format(dateObj);
  }
};

/**
 * Creates a UTC date from a datetime-local input string treated as being in the specified timezone
 * Also supports creating dates from individual components
 */
export function createDateInTimezone(
  dateTimeString: string,
  timezone?: string
): Date;
export function createDateInTimezone(
  year: number,
  month: number,
  day: number,
  hour?: number,
  minute?: number,
  timezone?: string
): Date;
export function createDateInTimezone(
  yearOrDateTime: number | string,
  monthOrTimezone?: number | string,
  day?: number,
  hour?: number,
  minute?: number,
  timezone?: string
): Date {
  const tz = timezone || (typeof monthOrTimezone === 'string' ? monthOrTimezone : 'Europe/London');
  
  if (typeof yearOrDateTime === 'string') {
    // Handle datetime-local string input: "2024-09-06T10:53"
    try {
      // Parse the datetime string to get components
      const match = yearOrDateTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
      if (!match) {
        throw new Error('Invalid datetime format');
      }
      
      const [, yearStr, monthStr, dayStr, hourStr, minuteStr] = match;
      
      // Convert to numbers
      const year = parseInt(yearStr);
      const month = parseInt(monthStr);
      const day = parseInt(dayStr);
      const hour = parseInt(hourStr);
      const minute = parseInt(minuteStr);
      
      // Use the numeric overload
      return createDateInTimezone(year, month, day, hour, minute, tz);
      
    } catch (error) {
      console.error('Error parsing datetime string:', error);
      return new Date(yearOrDateTime);
    }
  } else {
    // Handle numeric parameters
    const year = yearOrDateTime;
    const month = monthOrTimezone as number;
    
    try {
      // The key insight: we want to create a Date that represents the specified time in the target timezone
      // but expressed as UTC. We'll use a well-tested technique with Intl.DateTimeFormat
      
      
      // Use this approach: create a Date that when formatted in the target timezone shows our desired time
      // We'll iterate to find the UTC time that produces our target local time
      
      // Start with a reasonable estimate
      let testDate = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}T${String(hour || 0).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}:00Z`);
      
      // Format this UTC date in the target timezone
      const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      const formatted = formatter.format(testDate).replace(' ', 'T');
      const desired = `${year}-${String(month).padStart(2, '0')}-${String(day || 1).padStart(2, '0')}T${String(hour || 0).padStart(2, '0')}:${String(minute || 0).padStart(2, '0')}:00`;
      
      if (formatted === desired) {
        // Perfect match, we found the right UTC time
        return testDate;
      }
      
      // Calculate the difference and adjust
      const formattedDate = new Date(formatted);
      const desiredDate = new Date(desired);
      const diff = desiredDate.getTime() - formattedDate.getTime();
      
      // Apply the correction
      return new Date(testDate.getTime() + diff);
      
    } catch (error) {
      console.error('Error in createDateInTimezone numeric version:', error);
      // Simple fallback
      return new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0);
    }
  }
};

/**
 * Converts a date to user's timezone for display
 */
export const toUserTimezone = (
  date: Date | string,
  timezone: string = getBrowserTimezone()
): Date => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) {
    return new Date();
  }

  try {
    // Get the date in the target timezone
    const timeZoneOffset = dateObj.getTimezoneOffset();
    const utc = dateObj.getTime() + (timeZoneOffset * 60000);
    
    // Create a temporary date to get timezone offset
    const tempDate = new Date(dateObj.toLocaleString('en-US', { timeZone: timezone }));
    const targetOffset = new Date().getTimezoneOffset() - tempDate.getTimezoneOffset();
    
    return new Date(utc + (targetOffset * 60000));
  } catch (error) {
    return dateObj;
  }
};

/**
 * Validates if a timezone string is valid
 */
export const isValidTimezone = (timezone: string): boolean => {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Gets timezone offset in hours for a specific timezone
 */
export const getTimezoneOffset = (timezone: string): number => {
  try {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const targetTime = new Date(utc + (0 * 3600000)); // UTC time
    const timezoneTime = new Date(targetTime.toLocaleString('en-US', { timeZone: timezone }));
    
    return (targetTime.getTime() - timezoneTime.getTime()) / (1000 * 60 * 60);
  } catch (error) {
    return 0;
  }
};

/**
 * Compares if two timezones are the same (handles aliases)
 */
export const timezonesAreEqual = (tz1: string, tz2: string): boolean => {
  if (tz1 === tz2) return true;
  
  try {
    const date = new Date();
    const time1 = date.toLocaleString('en-US', { timeZone: tz1 });
    const time2 = date.toLocaleString('en-US', { timeZone: tz2 });
    return time1 === time2;
  } catch (error) {
    return false;
  }
};

/**
 * Detects if user has likely changed timezones based on browser timezone vs stored preference
 */
export const detectTimezoneChange = (storedTimezone: string): {
  hasChanged: boolean;
  browserTimezone: string;
  storedTimezone: string;
  shouldPromptUpdate: boolean;
} => {
  const browserTimezone = getBrowserTimezone();
  const hasChanged = !timezonesAreEqual(browserTimezone, storedTimezone);
  
  return {
    hasChanged,
    browserTimezone,
    storedTimezone,
    shouldPromptUpdate: hasChanged && isValidTimezone(browserTimezone)
  };
};

/**
 * Formats a time range (e.g., "2:00 PM - 6:00 PM") in user's timezone
 */
export const formatTimeRange = (
  startDate: Date | string,
  endDate: Date | string,
  timezone: string = getBrowserTimezone(),
  use24Hour: boolean = false
): string => {
  const startTime = formatTimeInTimezone(startDate, timezone, use24Hour);
  const endTime = formatTimeInTimezone(endDate, timezone, use24Hour);
  return `${startTime} - ${endTime}`;
};

/**
 * Gets a user-friendly timezone display name
 */
export const getTimezoneDisplayName = (timezone: string): string => {
  return COMMON_TIMEZONES[timezone] || timezone;
};

/**
 * Converts schedule period string (HHMM-HHMM) to Date objects in user timezone
 */
export const parseSchedulePeriod = (
  schedulePeriod: string,
  baseDate: Date,
  timezone: string = getBrowserTimezone()
): { start: Date; end: Date } => {
  const parts = schedulePeriod.split('-');
  if (parts.length !== 2) {
    throw new Error('Schedule period must be in format HHMM-HHMM');
  }

  const startTime = parts[0].trim();
  const endTime = parts[1].trim();

  if (startTime.length !== 4 || endTime.length !== 4) {
    throw new Error('Time parts must be 4 digits (HHMM)');
  }

  const startHour = parseInt(startTime.substring(0, 2));
  const startMinute = parseInt(startTime.substring(2, 2));
  const endHour = parseInt(endTime.substring(0, 2));
  const endMinute = parseInt(endTime.substring(2, 2));

  let start = createDateInTimezone(
    baseDate.getFullYear(),
    baseDate.getMonth() + 1,
    baseDate.getDate(),
    startHour,
    startMinute,
    timezone
  );

  let end = createDateInTimezone(
    baseDate.getFullYear(),
    baseDate.getMonth() + 1,
    baseDate.getDate(),
    endHour,
    endMinute,
    timezone
  );

  // Handle next day end times
  if (end <= start) {
    end = new Date(end.getTime() + (24 * 60 * 60 * 1000));
  }

  return { start, end };
};