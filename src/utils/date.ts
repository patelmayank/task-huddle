// Bug #7: Timezone-aware date utilities
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { format, parseISO } from 'date-fns';

/**
 * Formats a date string for due dates, preserving the date regardless of timezone
 * @param dateString - ISO date string or date-only string
 * @param timezone - Target timezone (defaults to user's timezone)
 */
export const formatDueDate = (dateString: string, timezone?: string): string => {
  try {
    const userTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // If it's a date-only string (YYYY-MM-DD), treat it as local date
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return format(parseISO(dateString), 'PPP');
    }
    
    // For timestamp strings, use timezone conversion
    return formatInTimeZone(new Date(dateString), userTimezone, 'PPP');
  } catch (error) {
    console.error('Error formatting date:', error);
    return format(new Date(dateString), 'PPP');
  }
};

/**
 * Converts a date to a date-only string for storage
 * @param date - Date object or string
 */
export const toDateOnlyString = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toISOString().split('T')[0];
};

/**
 * Safely parses a date string with timezone handling
 * @param dateString - Date string to parse
 * @param timezone - Source timezone
 */
export const parseZonedDate = (dateString: string, timezone?: string): Date => {
  try {
    if (timezone) {
      return toZonedTime(dateString, timezone);
    }
    return new Date(dateString);
  } catch (error) {
    console.error('Error parsing zoned date:', error);
    return new Date(dateString);
  }
};