# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

WorkPulse — Expo SDK 52 / React Native 0.76 / Expo Router v4 app for GPS attendance, night-shift tracking, leave approvals, and payroll (UPI/cash ledger, PDF payslips). Two roles: `admin` and `employee`. Login is registered 10-digit mobile number + a static OTP (`EXPO_PUBLIC_STATIC_OTP` in gitignored `.env.local`, checked in `src/services/otpService.ts` — the single place to swap in real SMS OTP).

## Commands

```bash
npx expo start          # dev server (a = Android, i = iOS, w = web)
npm run android         # expo run:android (native build, uses ./android)
npm run ios             # expo run:ios
npx tsc --noEmit        # type-check (strict mode)
eas build --profile development|preview|production
```

No lint or test setup exists. Type-check is the only automated verification (currently passes clean — keep it that way).

Package manager is npm only (`npm ci`). Yarn drops the `react-native-reanimated` peer dep that `nativewind/babel` requires, breaking bundling; `yarn.lock` is gitignored.

There are no demo accounts; the first admin comes from the commented template at the end of `supabase-setup.sql`.

## Architecture

**Routing / auth gate.** `app/_layout.tsx` wraps everything in `AuthProvider` (`src/store/authContext.tsx`). `app/index.tsx` redirects by `user.role` to `(auth)/login`, `(admin)`, or `(employee)` route groups; each group's `_layout.tsx` defines its tab bar. Session is the `Employee` object persisted in AsyncStorage under `@workpulse_auth_user`.

**Data layer — always go through `dataService`.** Screens import `dataService` (`src/services/dataService.ts`), never the backends directly. `DataService` dispatches each call to either:
- `supabaseService.ts` — cloud backend (Supabase tables `employees`, `attendance`, `leave_requests`, `salary_transactions`, …; migrations/policies in `supabase-setup.sql`). Maps snake_case DB columns ↔ camelCase types in `src/types/index.ts` by hand in every method.
- `mockDatabase.ts` — in-memory `db` singleton with the same API, used when Supabase isn't configured.

Choice is made by `isSupabaseConfigured()` in `src/config/supabaseConfig.ts`. Note it has hardcoded fallback URL/key, so cloud mode is effectively always on unless those are removed. When adding a data operation, implement it in both backends and add the dispatcher method in `DataService`. `authContext` purges stored sessions with mock-style IDs (`emp_…`) in cloud mode.

**Payroll maths lives in `src/services/payrollCalc.ts`** (pure functions shared by both backends): `computeFinancialSummary` (earnings, paid-leave days, advance recovery, pending pay), `shiftStatus` (≥ `full_day_hours` → PRESENT, ≥ `half_day_hours` → HALF_DAY = 0.5 day, else ABSENT = not counted), `payslipStatus`. Change rules there, not in the backends.

**Ledger is the source of truth for money.** `salary_transactions` holds SALARY_PAYMENT / ADVANCE_PAID / DEDUCTION (advance recovery); a transaction's month is the `YYYY-MM` in its notes, else its payment date. `dataService.recordTransaction` refuses salary payments above what is still owed for the month and first records the month's advance recovery as a DEDUCTION; `generatePayslip` does the same. Payslip PAID/PARTIAL/UNPAID is derived from the ledger in `dataService.getPayslips`, not read from the `payment_status` column. Payslips freeze `night_allowance` (total) at generation time.

**Check-out rules** (`checkOut` in both backends): status from `shiftStatus`; Night Present if checkout ≥ 19:00 local or the shift ran past midnight, and only if not ABSENT. `getTodayAttendance` returns today's record or yesterday's still-open shift. Leave validation (no overlaps; approval can't overlap another approved leave) is in `dataService`.

**Missed punch-out:** an open shift older than `MAX_OPEN_SHIFT_HOURS` (16h) is `isMissedPunch` — not paid, employee check-out refused, and only `dataService.adminSetCheckOut` (admin Attendance → "Set Check-out Time") closes it. **Overpayment:** `overpaidAmount` in the summary; "Move to advance" writes an ADVANCE_PAID whose notes start with `OVERPAY_TRANSFER_NOTE`, which also cancels that much salary for the month.

**Inactive staff** (`is_active = false`, toggled in employee detail): can't log in, are signed out on app start/foreground, hidden from Staff (toggle) and dashboard, and listed in payroll only while still owed money.

**Dates:** always use `localDateString()` / `localMonthString()` from `src/utils/date.ts`, never `toISOString().split('T')[0]` (that is the UTC date — wrong in India before 5:30 AM).

**Android alerts** show at most 3 buttons; use `showActionMenu` (`src/utils/actionMenu.ts`) for longer menus.

**Other services (`src/services/`):**
- `locationService.ts` — GPS + reverse geocode; flags mocked locations (`isMocked`, blocked in the attendance screen). A failed GPS fix fails the punch on device (fake fallback location only on web).
- `pdfService.ts` — large HTML templates rendered via `expo-print`, shared via `expo-sharing` (payslips, attendance reports).
- `exportService.ts` — data export for admin attendance/payroll.
- `notificationService.ts` — local notifications (expo-notifications).
- `settingsService.ts` — rates from Supabase `app_settings` (`night_allowance`, `full_day_hours`, `half_day_hours`). Hours fall back to 8/4 if rows are missing. `fetchNightAllowance()` reads fresh and throws if missing (used by payroll calculations); `getNightAllowance()` returns the cached value for sync rendering (PDFs, exports, labels). `AuthProvider` fetches it during login/session restore, so login fails if the setting is absent. Never hardcode the allowance; mock mode uses a fixed 250.

**Styling.** NativeWind v4 (`className`, configured in `babel.config.js`, `metro.config.js`, `global.css`, `tailwind.config.js`) is used in most screens. `app/(employee)/leaves.tsx`, the tab `_layout.tsx` files, and `CalendarPickerModal.tsx` were moved to `StyleSheet.create` to eliminate a css-interop "navigation context" warning — prefer `StyleSheet` for new screens/components that hit that issue, and don't reintroduce NativeWind there. Icons: `lucide-react-native`.

## Environment

`.env` (see `.env.example`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_COMPANY_NAME/ADDRESS/GSTIN` (payslip header, `src/config/companyConfig.ts`). `.env.local`: `EXPO_PUBLIC_STATIC_OTP`. All `EXPO_PUBLIC_*` values are bundled into the client. Supabase RLS policies in `supabase-setup.sql` are fully permissive (`USING (true)`); auth is enforced only client-side, and anyone with the anon key can read every table.

`standalone.bundle` / `standalone_res/` are prebuilt artifacts, not source.
