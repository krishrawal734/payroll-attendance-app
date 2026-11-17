import { supabase } from './supabaseClient';
import { isSupabaseConfigured } from '../config/supabaseConfig';

// Offline demo mode has no app_settings table, so it uses this fixed rate.
const MOCK_NIGHT_ALLOWANCE = 250;

let cachedNightAllowance: number | null = isSupabaseConfigured() ? null : MOCK_NIGHT_ALLOWANCE;

// Fetches the per-night allowance from Supabase `app_settings` and caches it.
// Throws when the setting is missing so payroll is never computed from a guessed rate.
export async function fetchNightAllowance(): Promise<number> {
  if (!isSupabaseConfigured()) return MOCK_NIGHT_ALLOWANCE;

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'night_allowance')
    .maybeSingle();

  const rate = Number(data?.value);
  if (error || !data || !Number.isFinite(rate)) {
    throw new Error('Night allowance is not configured. Add key "night_allowance" to the Supabase app_settings table.');
  }

  cachedNightAllowance = rate;
  return rate;
}

// Last rate fetched from Supabase, for synchronous rendering (PDFs, exports, labels).
// AuthProvider fetches it before any signed-in screen renders.
export function getNightAllowance(): number {
  if (cachedNightAllowance === null) {
    throw new Error('Night allowance has not been loaded from Supabase yet.');
  }
  return cachedNightAllowance;
}

export interface AttendanceRules {
  fullDayHours: number;
  halfDayHours: number;
}

// Used when app_settings has no hours rows, so check-out never blocks on missing config.
const DEFAULT_ATTENDANCE_RULES: AttendanceRules = { fullDayHours: 8, halfDayHours: 4 };

// Worked hours needed for a full day / half day (app_settings: full_day_hours, half_day_hours).
export async function fetchAttendanceRules(): Promise<AttendanceRules> {
  if (!isSupabaseConfigured()) return DEFAULT_ATTENDANCE_RULES;

  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['full_day_hours', 'half_day_hours']);

  const value = (key: string) => Number(data?.find((row: any) => row.key === key)?.value);
  const fullDayHours = value('full_day_hours');
  const halfDayHours = value('half_day_hours');
  return {
    fullDayHours: Number.isFinite(fullDayHours) && fullDayHours > 0 ? fullDayHours : DEFAULT_ATTENDANCE_RULES.fullDayHours,
    halfDayHours: Number.isFinite(halfDayHours) && halfDayHours > 0 ? halfDayHours : DEFAULT_ATTENDANCE_RULES.halfDayHours,
  };
}

export function mockAttendanceRules(): AttendanceRules {
  return DEFAULT_ATTENDANCE_RULES;
}
