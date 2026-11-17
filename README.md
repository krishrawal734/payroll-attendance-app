# Employee Attendance & Payroll App (WorkPulse)

A complete React Native Expo mobile application for Employee GPS Attendance, Night Shift Overtime, Leave Approvals, and Payroll Ledger with UPI/Cash Tracking.

Built with **Expo SDK 52**, **Expo Router (v4)**, **expo-location**, **expo-print**, and **expo-sharing**.

---

## 🚀 Quick Start

1. Install dependencies with **npm** (not yarn — yarn skips `react-native-reanimated`, which NativeWind needs):
   ```bash
   npm ci
   ```
2. Configure environment:
   - `.env` — `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and optional company details (`EXPO_PUBLIC_COMPANY_NAME`, `EXPO_PUBLIC_COMPANY_ADDRESS`, `EXPO_PUBLIC_COMPANY_GSTIN`) printed on payslips.
   - `.env.local` (gitignored) — `EXPO_PUBLIC_STATIC_OTP=<4-8 digits>`, the login OTP. Share it with staff privately.
3. Set up Supabase: open your project → **SQL Editor** → run `supabase-setup.sql`. It creates `app_settings` (night allowance ₹250, full day 8h, half day 4h — edit values there, not in code) and the table permissions the app needs.
4. Start the dev server and open the app:
   ```bash
   npx expo start
   ```
   Press `a` for Android, `i` for iOS Simulator, `w` for web.

---

## 🔑 Signing In

Login is **registered mobile number + OTP**. Create the first admin by filling in and uncommenting the last block of `supabase-setup.sql`. Admins register every other employee from the **Staff** screen.

> The OTP is currently one static code from `.env.local`. It keeps casual users out, but it is shared by everyone and is bundled into the app — replace `src/services/otpService.ts` with a real SMS OTP before wider rollout.

---

## 📋 Implemented Requirements Breakdown

1. **Attendance & Night Present Logic (`app/(employee)/attendance.tsx`)**:
   - Check-in & Check-out with mandatory GPS capture.
   - **Working day rule**: shifts of 8h+ count as a full day, 4–8h as a half day, under 4h are not counted (hours set in `app_settings`).
   - **Night Present Rule**: a checkout at or after 7:00 PM (or after midnight on an overnight shift) sets `isNightPresent = true` and earns the `night_allowance` from `app_settings`, if the shift is at least a half day.
   - Real-time digital clock with live night rule indicator.
2. **Location Tracking & Anti-Fraud (`src/services/locationService.ts`)**:
   - Precise latitude, longitude, and reverse-geocoded physical address saved on every punch.
   - Mock Location (Fake GPS) detector checks `isMocked` and blocks fraudulent punches.
3. **Leave Management (`app/(employee)/leaves.tsx` & `app/(admin)/leaves.tsx`)**:
   - Employees apply for Casual, Sick, or Unpaid leaves with reason.
   - Admin approves or rejects requests with optional administrative remarks.
4. **Employee Management (`app/(admin)/employees.tsx`)**:
   - Admin registers employees with Full Name, 10-digit mobile number, base salary, pay cycle (Monthly/Daily), and UPI ID.
   - Employees log in strictly using their registered mobile numbers.
5. **Salary & Payslip Generation (`app/(admin)/payroll.tsx` & `src/services/pdfService.ts`)**:
   - Monthly gross calculation based on present days and night shift allowances.
   - Instant HTML-to-PDF payslip generation with company branding.
   - Native one-tap WhatsApp / Document sharing using `expo-sharing`.
   - Recording salary payments via UPI or Cash with voucher/UTR references.
6. **Advance & Payment History Ledger (`app/(admin)/employee-detail.tsx`)**:
   - Select any employee to inspect their passbook.
   - View complete salary history, advances taken, advances recovered, and net pending salary.
   - Direct UPI intent launcher (`upi://pay?pa=...`) for one-tap payments in GPay/PhonePe.
7. **Employee Dashboard (`app/(employee)/index.tsx`)**:
   - Self-service dashboard showing only their personal stats: today's punch state, present count, night present count, leave records, and advance balance.
8. **Admin Dashboard (`app/(admin)/index.tsx`)**:
   - Executive dashboard displaying total staff, live headcount, night shift counters, pending leave alerts, and total company advance exposure.

---

## 📁 Project Architecture

```text
payroll-attendance-app/
├── app/
│   ├── _layout.tsx                 # Root layout & Auth Provider
│   ├── index.tsx                   # Auth gate & role redirector
│   ├── (auth)/
│   │   └── login.tsx               # Registered mobile number login
│   ├── (employee)/                 # Employee role tabs
│   │   ├── _layout.tsx
│   │   ├── index.tsx               # Employee Dashboard (Req 7)
│   │   ├── attendance.tsx          # GPS Punch & > 7 PM Night Present (Req 1, 2)
│   │   ├── leaves.tsx              # Apply & Track Leaves (Req 3)
│   │   └── payslips.tsx            # View Payslips & Advances (Req 5, 7)
│   └── (admin)/                    # Admin role tabs
│       ├── _layout.tsx
│       ├── index.tsx               # Admin Dashboard (Req 8)
│       ├── employees.tsx           # Employee Directory & Registration (Req 4)
│       ├── employee-detail.tsx     # Full Salary & Advance Ledger (Req 6)
│       ├── attendance.tsx          # Live Attendance & Night Present Tracker (Req 1, 8)
│       ├── leaves.tsx              # Approve / Reject Queue (Req 3, 8)
│       └── payroll.tsx             # Salary Disbursals & PDF Payslips (Req 5, 8)
└── src/
    ├── types/index.ts              # Data contracts & TypeScript interfaces
    ├── store/authContext.tsx       # Auth state & role switcher
    └── services/
        ├── mockDatabase.ts         # In-memory reactive database with business logic
        ├── locationService.ts      # GPS acquisition & mock detection
        └── pdfService.ts           # PDF payslip generator & WhatsApp share
```
