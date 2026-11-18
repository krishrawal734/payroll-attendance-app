import {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  SalaryTransaction,
  EmployeeFinancialSummary,
  Payslip,
} from '../types';

export const NIGHT_SHIFT_ALLOWANCE = 250;
export const MONTHLY_DIVISOR_DAYS = 30;

/**
 * Returns local YYYY-MM (avoids UTC midnight off-by-one-month shift in IST).
 */
export function getLocalMonthYear(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getAdvanceRecoveryNote(monthYear: string): string {
  return `Advance recovery for ${monthYear} salary`;
}

/**
 * Counts actual approved leave days overlapping a given YYYY-MM month.
 * Used strictly for reporting `leavesTaken` — approved leaves are NOT added to paid working days.
 */
export function countApprovedLeaveDaysInMonth(leaves: LeaveRequest[], monthYear: string): number {
  const parts = monthYear.split('-').map(Number);
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;

  const year = parts[0];
  const month = parts[1]; // 1-12
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0); // last day of month

  let totalDays = 0;

  for (const leave of leaves) {
    if (leave.status !== 'APPROVED') continue;
    const fromParts = leave.fromDate?.split('-').map(Number);
    const toParts = leave.toDate?.split('-').map(Number);
    if (!fromParts || fromParts.length !== 3 || !toParts || toParts.length !== 3) continue;

    const fromDate = new Date(fromParts[0], fromParts[1] - 1, fromParts[2]);
    const toDate = new Date(toParts[0], toParts[1] - 1, toParts[2]);
    if (toDate < monthStart || fromDate > monthEnd) continue;

    const overlapStart = fromDate > monthStart ? fromDate : monthStart;
    const overlapEnd = toDate < monthEnd ? toDate : monthEnd;
    const diffDays = Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 86400000) + 1;
    if (diffDays > 0) {
      totalDays += diffDays;
    }
  }

  return totalDays;
}

export function isTransactionForMonth(tx: SalaryTransaction, monthYear: string): boolean {
  if (tx.notes && tx.notes.includes(monthYear)) {
    return true;
  }
  return Boolean(tx.paymentDate && tx.paymentDate.startsWith(monthYear));
}

export interface MonthlyPayrollBreakdown extends EmployeeFinancialSummary {
  leavesTaken: number;
  salaryPaidForMonth: number;
  advanceRecoveredForMonth: number;
  additionalAdvanceToRecover: number;
  netPayableForMonth: number;
}

/**
 * Single source of truth for all payroll, attendance, and advance calculations.
 * Rules:
 * - Only actual verified present days are paid (PRESENT = 1 day, HALF_DAY = 0.5 day).
 *   No leave days or unverified extras are added to salary.
 * - Night Shift checkout (> 7:00 PM) adds ₹250 per verified night shift.
 * - Gross Earnings = Base Earnings + Night Shift Allowance.
 * - Advance Deduction = active advance balance (capped at gross earnings),
 *   preserving already-settled deductions for that month so recalculation stays exact.
 * - Net Payable = max(0, Gross Earnings - Advance Deduction).
 * - Pending Payable = max(0, Net Payable - Salary Already Paid for that month).
 */
export function computeEmployeeMonthlyPayroll(
  emp: Employee,
  allAttendance: AttendanceRecord[],
  allLeaves: LeaveRequest[],
  allTransactions: SalaryTransaction[],
  monthYear?: string
): MonthlyPayrollBreakdown {
  const targetMonth = monthYear || getLocalMonthYear();

  // 1. Verified Attendance for targetMonth
  const monthAttendance = allAttendance.filter((a) => a.date.startsWith(targetMonth));
  const fullPresentDays = monthAttendance.filter((a) => a.status === 'PRESENT').length;
  const halfDays = monthAttendance.filter((a) => a.status === 'HALF_DAY').length;
  const presentDays = fullPresentDays + halfDays * 0.5;
  const nightPresentDays = monthAttendance.filter((a) => a.isNightPresent).length;

  // 2. Approved leaves (informational only — NOT added to salary)
  const leavesTaken = countApprovedLeaveDaysInMonth(allLeaves, targetMonth);

  // 3. Base Earnings + Night Shift Allowance (strictly nothing extra added)
  const payableDays =
    emp.salaryType === 'monthly'
      ? Math.min(presentDays, MONTHLY_DIVISOR_DAYS)
      : presentDays;

  const baseEarnings =
    emp.salaryType === 'monthly'
      ? Math.round((emp.baseSalary / MONTHLY_DIVISOR_DAYS) * payableDays)
      : Math.round(emp.baseSalary * payableDays);

  const nightAllowance = nightPresentDays * NIGHT_SHIFT_ALLOWANCE;
  const estimatedCurrentEarnings = baseEarnings + nightAllowance;

  // 4. Advances & Salary Payments from Ledger
  const totalAdvancesTaken = allTransactions
    .filter((t) => t.type === 'ADVANCE_PAID')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalAdvancesRecovered = allTransactions
    .filter((t) => t.type === 'DEDUCTION')
    .reduce((sum, t) => sum + t.amount, 0);

  const activeAdvanceBalance = Math.max(0, totalAdvancesTaken - totalAdvancesRecovered);

  const totalSalaryPaid = allTransactions
    .filter((t) => t.type === 'SALARY_PAYMENT')
    .reduce((sum, t) => sum + t.amount, 0);

  const salaryPaidForMonth = allTransactions
    .filter((t) => t.type === 'SALARY_PAYMENT' && isTransactionForMonth(t, targetMonth))
    .reduce((sum, t) => sum + t.amount, 0);

  const advanceTakenForMonth = allTransactions
    .filter((t) => t.type === 'ADVANCE_PAID' && isTransactionForMonth(t, targetMonth))
    .reduce((sum, t) => sum + t.amount, 0);

  const recoveryMarker = getAdvanceRecoveryNote(targetMonth);
  const advanceRecoveredForMonth = allTransactions
    .filter((t) => t.type === 'DEDUCTION' && t.notes === recoveryMarker)
    .reduce((sum, t) => sum + t.amount, 0);

  const additionalAdvanceToRecover = Math.min(
    activeAdvanceBalance,
    Math.max(0, estimatedCurrentEarnings - advanceRecoveredForMonth)
  );
  const advanceDeduction = advanceRecoveredForMonth + additionalAdvanceToRecover;
  const netPayableForMonth = Math.max(0, estimatedCurrentEarnings - advanceDeduction);
  const pendingPayable = Math.max(0, netPayableForMonth - salaryPaidForMonth);

  return {
    baseSalary: emp.baseSalary,
    salaryType: emp.salaryType,
    activeAdvanceBalance,
    totalAdvancesTaken,
    totalSalaryPaid,
    presentDays,
    nightPresentDays,
    nightAllowance,
    baseEarnings,
    estimatedCurrentEarnings,
    advanceDeduction,
    pendingPayable,
    leavesTaken,
    salaryPaidForMonth,
    advanceTakenForMonth,
    advanceRecoveredForMonth,
    additionalAdvanceToRecover,
    netPayableForMonth,
  };
}

/**
 * Computes live payment status from actual salary paid vs net payable for that month.
 */
export function computeLivePaymentStatus(
  netPayable: number,
  salaryPaidForMonth: number,
  advanceRecoveredForMonth = 0
): 'PAID' | 'PARTIAL' | 'UNPAID' {
  if (salaryPaidForMonth > 0) {
    return salaryPaidForMonth >= netPayable ? 'PAID' : 'PARTIAL';
  }
  if (netPayable === 0 && advanceRecoveredForMonth > 0) {
    return 'PAID';
  }
  return 'UNPAID';
}

/**
 * Ensures a Payslip object always reflects live verified attendance, advance,
 * and payment calculations (never stale stored rows).
 */
export function syncPayslipWithLiveData(
  payslip: Payslip,
  fin?: EmployeeFinancialSummary | null
): Payslip {
  if (!fin) return payslip;

  const gross = fin.estimatedCurrentEarnings;
  const advDed = fin.advanceDeduction;
  const net = fin.netPayableForMonth ?? Math.max(0, gross - advDed);
  const paid = fin.salaryPaidForMonth || 0;
  const status = computeLivePaymentStatus(net, paid);

  return {
    ...payslip,
    presentDays: fin.presentDays,
    nightPresentDays: fin.nightPresentDays,
    baseSalary: fin.baseSalary,
    grossEarnings: gross,
    advanceDeductions: advDed,
    netPayable: net,
    paymentStatus: status,
  };
}

