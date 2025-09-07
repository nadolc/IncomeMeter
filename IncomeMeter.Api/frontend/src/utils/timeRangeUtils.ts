export const getDateRangeFromSelection = (selection: string): { start: Date; end: Date } | null => {
  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  switch (selection) {
    case 'all':
      return null;
    case '7_days': {
      const start = new Date(now);
      start.setDate(now.getDate() - 6); // Last 7 days including today
      start.setHours(0, 0, 0, 0);
      return { start, end: endOfToday };
    }
    case '14_days': {
      const start = new Date(now);
      start.setDate(now.getDate() - 13); // Last 14 days including today
      start.setHours(0, 0, 0, 0);
      return { start, end: endOfToday };
    }
    case '30_days': {
      const start = new Date(now);
      start.setDate(now.getDate() - 29); // Last 30 days including today
      start.setHours(0, 0, 0, 0);
      return { start, end: endOfToday };
    }
    default:
      return null;
  }
};