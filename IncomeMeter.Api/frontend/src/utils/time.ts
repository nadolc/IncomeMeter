/**
 * Utility functions for time formatting and calculations
 */

/**
 * Formats hours as a human-readable string
 * @param hours - The number of hours (can be decimal)
 * @returns Formatted string like "2h 30m" or "0.5h" or "8h"
 */
export const formatHours = (hours: number): string => {
  if (hours === 0) return '0h';
  
  // If less than 1 hour, show as decimal
  if (hours < 1) {
    return `${hours.toFixed(1)}h`;
  }
  
  const wholeHours = Math.floor(hours);
  const remainingMinutes = Math.round((hours - wholeHours) * 60);
  
  if (remainingMinutes === 0) {
    return `${wholeHours}h`;
  }
  
  return `${wholeHours}h ${remainingMinutes}m`;
};

/**
 * Formats hours as a compact string for small spaces
 * @param hours - The number of hours (can be decimal)
 * @returns Compact string like "2.5h" or "8h"
 */
export const formatHoursCompact = (hours: number): string => {
  if (hours === 0) return '0h';
  
  // Always show as decimal for compact format
  if (hours % 1 === 0) {
    return `${Math.round(hours)}h`;
  }
  
  return `${hours.toFixed(1)}h`;
};

/**
 * Calculates hourly rate from income and hours
 * @param income - Total income amount
 * @param hours - Total hours worked
 * @returns Hourly rate or 0 if hours is 0
 */
export const calculateHourlyRate = (income: number, hours: number): number => {
  if (hours === 0) return 0;
  return income / hours;
};