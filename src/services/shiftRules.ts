/**
 * Centralized WorkPulse Shift & Auto Punch-Out Rules
 *
 * - Day Shift ends at 7:00 PM (19:00).
 * - Grace Window: 7:00 PM – 8:59 PM (19:00 – 20:59)
 *   Employees who did not punch out at 7:00 PM can still punch out normally
 *   before Night Shift begins at 9:00 PM.
 * - Night Shift Window: 9:00 PM – 5:00 AM (21:00 – 05:00)
 *   Working into/during 9:00 PM – 5:00 AM qualifies as Night Present (+₹250).
 * - Automatic Punch-Out: 5:00 AM (05:00)
 *   Any open shift not punched out by 5:00 AM is automatically punched out at 5:00 AM
 *   and marked as Night Present.
 */

export const DAY_SHIFT_END_HOUR = 19; // 7:00 PM
export const NIGHT_SHIFT_START_HOUR = 21; // 9:00 PM
export const NIGHT_SHIFT_END_HOUR = 5; // 5:00 AM

export const AUTO_CHECKOUT_ADDRESS = 'Auto Punch-Out at 5:00 AM (Night Shift 9 PM – 5 AM)';
export const AUTO_CHECKOUT_NOTE = 'Auto Punch-Out at 5:00 AM (Night Shift 9 PM – 5 AM)';

/**
 * Returns local YYYY-MM-DD string (avoids UTC midnight date-shift issues in IST).
 */
export function getLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 7:00 PM – 8:59 PM: Grace period to punch out before Night Shift starts at 9:00 PM.
 */
export function isInGraceWindow(now: Date = new Date()): boolean {
  const h = now.getHours();
  return h >= DAY_SHIFT_END_HOUR && h < NIGHT_SHIFT_START_HOUR;
}

/**
 * 9:00 PM – 4:59 AM: Active Night Shift window.
 */
export function isInNightShiftWindow(now: Date = new Date()): boolean {
  const h = now.getHours();
  return h >= NIGHT_SHIFT_START_HOUR || h < NIGHT_SHIFT_END_HOUR;
}

/**
 * Computes the exact 5:00 AM automatic punch-out cutoff Date for a shift.
 */
export function getAutoCheckoutCutoff(shiftDateStr: string, checkInIso?: string): Date {
  const [y, m, d] = shiftDateStr.split('-').map(Number);
  const checkInDate = checkInIso ? new Date(checkInIso) : null;

  // If employee punched in after midnight (00:00–04:59) on shiftDateStr,
  // auto punch-out is 5:00 AM that same morning.
  if (
    checkInDate &&
    !isNaN(checkInDate.getTime()) &&
    getLocalDateStr(checkInDate) === shiftDateStr &&
    checkInDate.getHours() < NIGHT_SHIFT_END_HOUR
  ) {
    return new Date(y, m - 1, d, NIGHT_SHIFT_END_HOUR, 0, 0, 0);
  }

  // Otherwise (day or evening punch-in), auto punch-out is 5:00 AM the next morning.
  return new Date(y, m - 1, d + 1, NIGHT_SHIFT_END_HOUR, 0, 0, 0);
}

/**
 * Returns whether an open attendance shift has passed its 5:00 AM auto punch-out time.
 */
export function evaluateAutoCheckout(
  record: { date: string; checkInTime?: string; checkOutTime?: string },
  now: Date = new Date()
): { shouldAutoClose: boolean; cutoffTime: Date } {
  const cutoffTime = getAutoCheckoutCutoff(record.date, record.checkInTime);
  if (!record.checkInTime || record.checkOutTime) {
    return { shouldAutoClose: false, cutoffTime };
  }
  return {
    shouldAutoClose: now.getTime() >= cutoffTime.getTime(),
    cutoffTime,
  };
}

/**
 * Determines whether a manual punch-out counts as Night Present.
 * - Before 9:00 PM (including 7:00 PM – 8:59 PM grace window): Normal Day Shift (false)
 * - 9:00 PM – 4:59 AM: Night Shift (true)
 */
export function isNightShiftManualCheckout(checkOutDate: Date = new Date()): boolean {
  return isInNightShiftWindow(checkOutDate);
}
