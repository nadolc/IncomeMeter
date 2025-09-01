/**
 * Fiscal Year Utilities for Dashboard Period Calculations
 * Handles fiscal year calculations, week numbering, and period boundaries
 */

export interface FiscalYearInfo {
  fiscalYear: number;
  startDate: Date;
  endDate: Date;
}

export interface FiscalWeekInfo {
  weekNumber: number;
  fiscalYear: number;
  startDate: Date;
  endDate: Date;
  isPartialWeek: boolean;
}

/**
 * Parse fiscal year start date from MM-DD format
 */
export const parseFiscalYearStartDate = (fiscalStartDate: string): { month: number; day: number } => {
  const [month, day] = fiscalStartDate.split('-').map(Number);
  return { month: month - 1, day }; // Convert to 0-based month for Date constructor
};

/**
 * Get the fiscal year information for a given date
 */
export const getFiscalYearInfo = (date: Date, fiscalStartDate: string): FiscalYearInfo => {
  const { month, day } = parseFiscalYearStartDate(fiscalStartDate);
  const year = date.getFullYear();
  
  // Determine if we're in the current fiscal year or the next one
  const fiscalYearStartThisYear = new Date(year, month, day);
  const fiscalYearStartNextYear = new Date(year + 1, month, day);
  
  let fiscalYear: number;
  let startDate: Date;
  let endDate: Date;
  
  if (date >= fiscalYearStartThisYear) {
    // We're in fiscal year that started this calendar year
    fiscalYear = year;
    startDate = fiscalYearStartThisYear;
    endDate = new Date(fiscalYearStartNextYear.getTime() - 1); // Day before next fiscal year
  } else {
    // We're in fiscal year that started last calendar year
    fiscalYear = year - 1;
    startDate = new Date(year - 1, month, day);
    endDate = new Date(fiscalYearStartThisYear.getTime() - 1); // Day before this fiscal year
  }
  
  return { fiscalYear, startDate, endDate };
};

/**
 * Get the current fiscal year based on fiscal start date
 */
export const getCurrentFiscalYear = (fiscalStartDate: string): FiscalYearInfo => {
  return getFiscalYearInfo(new Date(), fiscalStartDate);
};

/**
 * Get fiscal week number (1-based) within the fiscal year
 */
export const getFiscalWeekNumber = (date: Date, fiscalStartDate: string): number => {
  const fiscalInfo = getFiscalYearInfo(date, fiscalStartDate);
  const diffTime = date.getTime() - fiscalInfo.startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
};

/**
 * Get the start and end dates for a specific fiscal week
 */
export const getFiscalWeekRange = (fiscalYear: number, weekNumber: number, fiscalStartDate: string): FiscalWeekInfo => {
  const { month, day } = parseFiscalYearStartDate(fiscalStartDate);
  const fiscalYearStart = new Date(fiscalYear, month, day);
  
  // Calculate the start of the week (Monday)
  const daysToAdd = (weekNumber - 1) * 7;
  const weekStart = new Date(fiscalYearStart.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  
  // Adjust to Monday if needed
  const dayOfWeek = weekStart.getDay();
  const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, Monday = 1
  const mondayStart = new Date(weekStart.getTime() + daysToMonday * 24 * 60 * 60 * 1000);
  
  // Week ends on Sunday
  const sundayEnd = new Date(mondayStart.getTime() + 6 * 24 * 60 * 60 * 1000);
  
  // Check if this is a partial week (first or last week of fiscal year)
  const fiscalYearEnd = new Date(fiscalYear + 1, month, day - 1);
  const isPartialWeek = mondayStart < fiscalYearStart || sundayEnd > fiscalYearEnd;
  
  return {
    weekNumber,
    fiscalYear,
    startDate: mondayStart,
    endDate: sundayEnd,
    isPartialWeek
  };
};

/**
 * Get fiscal weeks within a specific month
 */
export const getFiscalWeeksInMonth = (year: number, month: number, fiscalStartDate: string): FiscalWeekInfo[] => {
  const monthStart = new Date(year, month - 1, 1); // month is 1-based
  const monthEnd = new Date(year, month, 0); // Last day of the month
  
  const weeks: FiscalWeekInfo[] = [];
  
  // Find all fiscal weeks that intersect with this month
  const fiscalInfo = getFiscalYearInfo(monthStart, fiscalStartDate);
  const firstWeek = getFiscalWeekNumber(monthStart, fiscalStartDate);
  const lastWeek = getFiscalWeekNumber(monthEnd, fiscalStartDate);
  
  for (let weekNum = firstWeek; weekNum <= lastWeek; weekNum++) {
    const weekInfo = getFiscalWeekRange(fiscalInfo.fiscalYear, weekNum, fiscalStartDate);
    
    // Check if this week intersects with the month
    if (weekInfo.endDate >= monthStart && weekInfo.startDate <= monthEnd) {
      weeks.push(weekInfo);
    }
  }
  
  return weeks;
};

/**
 * Get all months in a fiscal year
 */
export const getFiscalYearMonths = (fiscalYear: number, fiscalStartDate: string): Array<{ month: number; year: number }> => {
  const { month: startMonth, day } = parseFiscalYearStartDate(fiscalStartDate);
  const months: Array<{ month: number; year: number }> = [];
  
  for (let i = 0; i < 12; i++) {
    const monthDate = new Date(fiscalYear, startMonth + i, day);
    months.push({
      month: monthDate.getMonth() + 1, // Convert to 1-based
      year: monthDate.getFullYear()
    });
  }
  
  return months;
};

/**
 * Get the previous period date based on period type and offset
 */
export const getPeriodDate = (
  periodType: 'weekly' | 'monthly' | 'annual', 
  offset: number, 
  fiscalStartDate: string,
  baseDate: Date = new Date()
): Date => {
  const result = new Date(baseDate);
  
  switch (periodType) {
    case 'weekly':
      result.setDate(result.getDate() + (offset * 7));
      break;
    case 'monthly':
      result.setMonth(result.getMonth() + offset);
      break;
    case 'annual':
      const fiscalInfo = getFiscalYearInfo(baseDate, fiscalStartDate);
      const targetFiscalYear = fiscalInfo.fiscalYear + offset;
      const { month, day } = parseFiscalYearStartDate(fiscalStartDate);
      result.setFullYear(targetFiscalYear, month, day);
      break;
  }
  
  return result;
};

/**
 * Format period display text for navigation
 */
export const formatPeriodDisplay = (
  periodType: 'weekly' | 'monthly' | 'annual',
  date: Date,
  fiscalStartDate: string,
  locale: string = 'en-GB'
): string => {
  switch (periodType) {
    case 'weekly': {
      const weekNumber = getFiscalWeekNumber(date, fiscalStartDate);
      const year = date.getFullYear();
      return locale === 'zh-HK' ? `${year}年第${weekNumber}週` : `Week ${weekNumber}, ${year}`;
    }
    case 'monthly': {
      const monthNames = locale === 'zh-HK' 
        ? ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
        : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[date.getMonth()];
      const year = date.getFullYear();
      return locale === 'zh-HK' ? `${year}年${month}` : `${month} ${year}`;
    }
    case 'annual': {
      const fiscalInfo = getFiscalYearInfo(date, fiscalStartDate);
      const startYear = fiscalInfo.fiscalYear;
      const endYear = startYear + 1;
      return locale === 'zh-HK' ? `${startYear}-${endYear}財年` : `FY ${startYear}-${endYear}`;
    }
    default:
      return '';
  }
};

/**
 * Get weekday name based on day index (0=Sunday, 1=Monday, etc.)
 */
export const getWeekdayName = (dayIndex: number, locale: string = 'en-GB'): string => {
  const englishDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chineseDays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  
  return locale === 'zh-HK' ? chineseDays[dayIndex] : englishDays[dayIndex];
};

/**
 * Get month name based on month number (1-12)
 */
export const getMonthName = (monthNumber: number, locale: string = 'en-GB'): string => {
  const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const chineseMonths = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  
  const monthArray = locale === 'zh-HK' ? chineseMonths : englishMonths;
  return monthArray[monthNumber - 1] || '';
};

/**
 * Check if a date is in the current fiscal week
 */
export const isCurrentFiscalWeek = (date: Date, fiscalStartDate: string): boolean => {
  const now = new Date();
  const dateWeek = getFiscalWeekNumber(date, fiscalStartDate);
  const nowWeek = getFiscalWeekNumber(now, fiscalStartDate);
  const dateFiscalYear = getFiscalYearInfo(date, fiscalStartDate).fiscalYear;
  const nowFiscalYear = getFiscalYearInfo(now, fiscalStartDate).fiscalYear;
  
  return dateWeek === nowWeek && dateFiscalYear === nowFiscalYear;
};