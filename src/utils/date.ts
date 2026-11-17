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
