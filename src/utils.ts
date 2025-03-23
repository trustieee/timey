/**
 * Utility functions for consistent date/time handling
 */

// Format to get YYYY-MM-DD in local time
export function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Format to get a full ISO datetime string WITHOUT timezone suffix (in local time)
export function getLocalISOString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  
  // Format: YYYY-MM-DDTHH:mm:ss.sss (local time with no timezone suffix)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}

// Get previous date string in local time
export function getPreviousDateString(date: string): string {
  // Create date from the string, will be interpreted in local timezone
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  
  // Get local date components
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

// Parse a date string to a Date object, ensuring local time interpretation
export function parseLocalDate(dateString: string): Date {
  // For YYYY-MM-DD format
  if (dateString.length === 10) {
    const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
    return new Date(year, month - 1, day); // month is 0-indexed in JS Date
  }
  
  // For full datetime strings without timezone (assumes local time)
  return new Date(dateString);
}

// Format a user-friendly date display (e.g., "January 1, 2024")
export function formatDisplayDate(dateString: string): string {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Format MM/DD/YYYY date for clock display
export function formatClockDate(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Format time in 12-hour format (HH:MM AM/PM)
export function formatClockTime(date: Date = new Date()): string {
  const hours = date.getHours() % 12 || 12; // Convert 0 to 12 for 12 AM
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';
  return `${hours}:${minutes}:${seconds} ${ampm}`;
} 