-- ============================================================
-- GOOGLE AUTHENTICATOR (TOTP 2FA) MIGRATION FOR WORKPULSE
-- Run this once in your Supabase SQL Editor
-- ============================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS is_2fa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
