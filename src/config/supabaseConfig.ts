// Configuration for your live Supabase project

export const SUPABASE_CONFIG = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xiddgsvdwnktgaeqxwos.supabase.co',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_7jvDGlmHdLEAlT5d28FnuA_hJPBNTqQ',
};

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(SUPABASE_CONFIG.url) &&
    !SUPABASE_CONFIG.url.includes('YOUR_PROJECT_ID') &&
    Boolean(SUPABASE_CONFIG.anonKey) &&
    !SUPABASE_CONFIG.anonKey.includes('YOUR_ANON_KEY')
  );
}
