# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

WorkPulse — Expo SDK 52 / React Native 0.76 / Expo Router v4 app for GPS attendance, night-shift tracking, leave approvals, and payroll (UPI/cash ledger, PDF payslips). Two roles: `admin` and `employee`. Login is by registered 10-digit mobile number only (no password/OTP).

## Commands

```bash
npx expo start          # dev server (a = Android, i = iOS, w = web)
npm run android         # expo run:android (native build, uses ./android)
npm run ios             # expo run:ios
npx tsc --noEmit        # type-check (strict mode)
eas build --profile development|preview|production
```

No lint or test setup exists. Type-check is the only automated verification (currently passes clean — keep it that way).

Package manager is npm (`package-lock.json` is tracked; a stray untracked `yarn.lock` exists — don't commit it).

Demo accounts (from README / seed data): admin `9876543210`; employees `9811122233`, `9822233344`, `9833344455`.

## Architecture

**Routing / auth gate.** `app/_layout.tsx` wraps everything in `AuthProvider` (`src/store/authContext.tsx`). `app/index.tsx` redirects by `user.role` to `(auth)/login`, `(admin)`, or `(employee)` route groups; each group's `_layout.tsx` defines its tab bar. Session is the `Employee` object persisted in AsyncStorage under `@workpulse_auth_user`.

**Data layer — always go through `dataService`.** Screens import `dataService` (`src/services/dataService.ts`), never the backends directly. `DataService` dispatches each call to either:
- `supabaseService.ts` — cloud backend (Supabase tables `employees`, `attendance`, `leave_requests`, `salary_transactions`, …; schema in `supabase-setup.sql`, demo data in `supabase-seed.sql`). Maps snake_case DB columns ↔ camelCase types in `src/types/index.ts` by hand in every method.
- `mockDatabase.ts` — in-memory `db` singleton with the same API, used when Supabase isn't configured.

Choice is made by `isSupabaseConfigured()` in `src/config/supabaseConfig.ts`. Note it has hardcoded fallback URL/key, so cloud mode is effectively always on unless those are removed. When adding a data operation, implement it in both backends and add the dispatcher method in `DataService`. `authContext` purges stored sessions with mock-style IDs (`emp_…`) in cloud mode.

**Business rules duplicated across backends.** Night Present rule (checkout at/after 19:00 local → `isNightPresent = true`, earns `night_allowance` per night) lives in both `mockDatabase.checkOut` and `supabaseService.checkOut`. Payroll/advance calculations similarly — keep both in sync.

**Other services (`src/services/`):**
- `locationService.ts` — GPS + reverse geocode; rejects mocked locations (`isMocked`).
- `pdfService.ts` — large HTML templates rendered via `expo-print`, shared via `expo-sharing` (payslips, attendance reports).
- `exportService.ts` — data export for admin attendance/payroll.
- `notificationService.ts` — local notifications (expo-notifications).
- `settingsService.ts` — payroll rates from Supabase `app_settings` (currently `night_allowance`). `fetchNightAllowance()` reads fresh and throws if missing (used by payroll calculations); `getNightAllowance()` returns the cached value for sync rendering (PDFs, exports, labels). `AuthProvider` fetches it during login/session restore, so login fails if the setting is absent. Never hardcode the allowance; mock mode uses a fixed 250.

**Styling.** NativeWind v4 (`className`, configured in `babel.config.js`, `metro.config.js`, `global.css`, `tailwind.config.js`) is used in most screens. `app/(employee)/leaves.tsx`, the tab `_layout.tsx` files, and `CalendarPickerModal.tsx` were moved to `StyleSheet.create` to eliminate a css-interop "navigation context" warning — prefer `StyleSheet` for new screens/components that hit that issue, and don't reintroduce NativeWind there. Icons: `lucide-react-native`.

## Environment

`.env` (see `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. All `EXPO_PUBLIC_*` values are bundled into the client. Supabase RLS policies in `supabase-setup.sql` are fully permissive (`USING (true)`); auth is enforced only client-side.

`standalone.bundle` / `standalone_res/` are prebuilt artifacts, not source.
