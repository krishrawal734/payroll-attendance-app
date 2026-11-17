const pad = (n: number) => String(n).padStart(2, '0');

// Calendar date in the device's time zone (YYYY-MM-DD). toISOString() gives the UTC date,
// which in India is still "yesterday" until 5:30 AM.
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localMonthString(d: Date = new Date()): string {
  return localDateString(d).slice(0, 7);
}

export function previousLocalDateString(d: Date = new Date()): string {
  return localDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
}

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "YYYY-MM" for this month and the previous `count - 1` months, newest first.
export function recentMonths(count = 3, from: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, back) =>
    localMonthString(new Date(from.getFullYear(), from.getMonth() - back, 1))
  );
}

export function monthLabel(monthYear: string): string {
  return `${MONTH_SHORT[Number(monthYear.slice(5, 7)) - 1]} ${monthYear.slice(0, 4)}`;
}
