import "server-only";

/**
 * Format a date into a human-readable string
 * @param date Date to format
 * @returns Formatted date string
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(dateObj);
}

/**
 * Format a date with time into a human-readable string
 * @param date Date to format
 * @returns Formatted date and time string
 */
export function formatDateTime(date: Date | number | string): string {
  const dateObj = date instanceof Date ? date : new Date(date);

  // Return formatted date and time in the format: "Jan 1, 2023, 3:30 PM"
  return dateObj.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}
