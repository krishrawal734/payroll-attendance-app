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
