# Employee Attendance & Payroll App (WorkPulse)

A complete React Native Expo mobile application for Employee GPS Attendance, Night Shift Overtime, Leave Approvals, and Payroll Ledger with UPI/Cash Tracking.

Built with **Expo SDK 52**, **Expo Router (v4)**, **expo-location**, **expo-print**, and **expo-sharing**.

---

## 🚀 Quick Start

1. Open your terminal and navigate to the project directory:
   ```bash
   cd C:\Users\mrbha\.gemini\antigravity\scratch\payroll-attendance-app
   ```
2. Start the Expo development server:
   ```bash
   npx expo start
   ```
3. Press:
   - `a` to open on an Android emulator or scan QR with **Expo Go** on Android.
   - `i` to open in iOS Simulator (on macOS) or scan QR with Camera on iPhone.
   - `w` to open and preview on Web (`http://localhost:8081`).

---

## 🔑 Pre-Registered Accounts (Instant Testing)

| Role | Name | Registered Mobile Number | Description |
| :--- | :--- | :--- | :--- |
| **Admin** | Vikram Mehta | `9876543210` | Full administrative access to staff, attendance, leaves & payroll |
| **Employee** | Ramesh Kumar | `9811122233` | Monthly salary staff with night shift history & payslips |
| **Employee** | Priya Sharma | `9822233344` | Assembly supervisor with leave approvals & night shift logs |
| **Employee** | Amit Patel | `9833344455` | Daily wage logistics worker with cash advances |

*(You can also register any new employee directly from the Admin screen using their 10-digit mobile number!)*

---

## 📋 Implemented Requirements Breakdown

1. **Attendance & Night Present Logic (`app/(employee)/attendance.tsx`)**:
   - Check-in & Check-out with mandatory GPS capture.
   - **Night Present Rule**: Any checkout at or after 7:00 PM (19:00) automatically sets `isNightPresent = true` and awards night shift allowance.
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
