import {
  Employee,
  SalaryTransaction,
  AttendanceRecord,
  LeaveRequest,
  EmployeeFinancialSummary,
  Payslip,
} from '../types';
import { localDateString } from '../utils/date';
import type { AttendanceRules } from './settingsService';

// Status for a finished shift: full day, half day, or too short to count.
export function shiftStatus(checkInIso: string, checkOutIso: string, rules: AttendanceRules): AttendanceRecord['status'] {
  const hours = (new Date(checkOutIso).getTime() - new Date(checkInIso).getTime()) / 3_600_000;
  if (hours >= rules.fullDayHours) return 'PRESENT';
  if (hours >= rules.halfDayHours) return 'HALF_DAY';
  return 'ABSENT';
}

// Night Present: checkout at/after 7:00 PM local, or a shift that ran past midnight into a
// later date. Shifts too short to count earn nothing.
export function isNightShift(status: AttendanceRecord['status'], shiftDate: string, checkOut: Date): boolean {
  return status !== 'ABSENT' && (checkOut.getHours() >= 19 || shiftDate !== localDateString(checkOut));
}

// Error text when an admin-entered check-out time is not usable, else null.
export function invalidCheckOut(checkInIso: string, checkOutIso: string): string | null {
  const out = new Date(checkOutIso).getTime();
  if (Number.isNaN(out)) return 'Invalid check-out time.';
  if (out <= new Date(checkInIso).getTime()) return 'Check-out must be after check-in.';
  if (out > Date.now()) return 'Check-out cannot be in the future.';
  return null;
}

export function checkOutMessage(status: AttendanceRecord['status'], isNightPresent: boolean): string {
  if (status === 'ABSENT') return 'Checked out. Shift was too short to count as a working day.';
  const day = status === 'HALF_DAY' ? 'Half day recorded' : 'Full day recorded';
  return isNightPresent ? `Checked out! ${day} + Night Present (night allowance).` : `Checked out successfully. ${day}.`;
}

// Month a ledger entry belongs to: the "YYYY-MM" in its notes, else its payment date.
export function transactionMonth(tx: Pick<SalaryTransaction, 'notes' | 'paymentDate'>): string {
  return tx.notes?.match(/\d{4}-\d{2}/)?.[0] || tx.paymentDate.slice(0, 7);
}

// Dates (YYYY-MM-DD) from `from` to `to` inclusive.
function datesBetween(from: string, to: string): string[] {
  const [y, m, d] = from.split('-').map(Number);
  const dates: string[] = [];
  for (let day = new Date(y, m - 1, d); localDateString(day) <= to; day.setDate(day.getDate() + 1)) {
    dates.push(localDateString(day));
  }
  return dates;
}

// Paid leave days in the month: approved non-UNPAID leave, each date counted once,
// skipping dates the employee was present anyway.
function paidLeaveDays(leaves: LeaveRequest[], presentDates: Set<string>, monthYear: string): number {
  const days = new Set<string>();
  leaves
    .filter((l) => l.status === 'APPROVED' && l.leaveType !== 'UNPAID')
    .forEach((l) =>
      datesBetween(l.fromDate, l.toDate)
        .filter((date) => date.startsWith(monthYear) && !presentDates.has(date))
        .forEach((date) => days.add(date))
    );
  return days.size;
}

const sumAmounts = (txs: SalaryTransaction[]) => txs.reduce((sum, t) => sum + t.amount, 0);

// Notes prefix of the ADVANCE_PAID entry that moves a month's overpaid salary into the advance
// balance. It also cancels that much salary for the month, so the month stops showing as overpaid.
export const OVERPAY_TRANSFER_NOTE = 'Overpaid salary moved to advance for';

export function isOverpayTransfer(tx: Pick<SalaryTransaction, 'type' | 'notes'>): boolean {
  return tx.type === 'ADVANCE_PAID' && !!tx.notes?.startsWith(OVERPAY_TRANSFER_NOTE);
}

// Salary paid for the month, net of any overpayment already moved to advance.
function netSalaryPaid(txs: SalaryTransaction[], monthYear?: string): number {
  const inScope = (t: SalaryTransaction) => !monthYear || transactionMonth(t) === monthYear;
  return (
    sumAmounts(txs.filter((t) => t.type === 'SALARY_PAYMENT' && inScope(t))) -
    sumAmounts(txs.filter((t) => isOverpayTransfer(t) && inScope(t)))
  );
}

export function salaryPaidForMonth(txs: SalaryTransaction[], employeeId: string, monthYear: string): number {
  return netSalaryPaid(txs.filter((t) => t.employeeId === employeeId), monthYear);
}

// No real shift runs this long, so an open shift older than this was never checked out.
export const MAX_OPEN_SHIFT_HOURS = 16;

// A forgotten check-out. It is not paid, and only an admin can close it (with the real time).
export function isMissedPunch(a: Pick<AttendanceRecord, 'checkInTime' | 'checkOutTime'>, now: number = Date.now()): boolean {
  return !!a.checkInTime && !a.checkOutTime && now - new Date(a.checkInTime).getTime() > MAX_OPEN_SHIFT_HOURS * 3_600_000;
}

// Single source of truth for monthly payroll maths, shared by the Supabase and mock backends.
export function computeFinancialSummary(
  emp: Employee,
  txs: SalaryTransaction[],
  attendance: AttendanceRecord[],
  leaves: LeaveRequest[],
  nightAllowanceRate: number,
  monthYear: string
): EmployeeFinancialSummary {
  const ofType = (type: SalaryTransaction['type']) => txs.filter((t) => t.type === type);
  const inMonth = (t: SalaryTransaction) => transactionMonth(t) === monthYear;

  const totalAdvancesTaken = sumAmounts(ofType('ADVANCE_PAID'));
  const totalAdvancesRecovered = sumAmounts(ofType('DEDUCTION'));
  const activeAdvanceBalance = Math.max(0, totalAdvancesTaken - totalAdvancesRecovered);
  const totalSalaryPaid = netSalaryPaid(txs);
  const salaryPaidThisMonth = netSalaryPaid(txs, monthYear);
  const advanceRecoveredThisMonth = sumAmounts(ofType('DEDUCTION').filter(inMonth));

  const monthAttendance = attendance.filter((a) => a.date.startsWith(monthYear));
  const missedPunchDays = monthAttendance.filter((a) => isMissedPunch(a)).length;
  const workedRecords = monthAttendance.filter(
    (a) => (a.status === 'PRESENT' || a.status === 'HALF_DAY') && !isMissedPunch(a)
  );
  const presentDays = workedRecords.reduce((days, a) => days + (a.status === 'HALF_DAY' ? 0.5 : 1), 0);
  const nightPresentDays = monthAttendance.filter((a) => a.isNightPresent).length;
  const leavesTaken = paidLeaveDays(leaves, new Set(workedRecords.map((a) => a.date)), monthYear);

  const nightAllowance = nightPresentDays * nightAllowanceRate;
  const payableDays = Math.min(presentDays + leavesTaken, 30);
  const baseEarnings = emp.salaryType === 'monthly'
    ? Math.round((emp.baseSalary / 30) * payableDays)
    : Math.round(emp.baseSalary * presentDays);
  const estimatedCurrentEarnings = baseEarnings + nightAllowance;

  // Recover outstanding advance only from earnings not already paid out or recovered this month.
  const plannedRecovery = Math.min(
    activeAdvanceBalance,
    Math.max(0, estimatedCurrentEarnings - advanceRecoveredThisMonth - salaryPaidThisMonth)
  );
  const advanceDeduction = advanceRecoveredThisMonth + plannedRecovery;
  const pendingPayable = Math.max(0, estimatedCurrentEarnings - advanceDeduction - salaryPaidThisMonth);
  const overpaidAmount = Math.max(0, salaryPaidThisMonth - (estimatedCurrentEarnings - advanceDeduction));

  return {
    baseSalary: emp.baseSalary,
    salaryType: emp.salaryType,
    activeAdvanceBalance,
    totalAdvancesTaken,
    totalSalaryPaid,
    presentDays,
    nightPresentDays,
    leavesTaken,
    nightAllowance,
    baseEarnings,
    estimatedCurrentEarnings,
    advanceDeduction,
    advanceRecoveredThisMonth,
    salaryPaidThisMonth,
    pendingPayable,
    overpaidAmount,
    missedPunchDays,
  };
}

export function payslipStatus(netPayable: number, paid: number): Payslip['paymentStatus'] {
  if (netPayable <= 0 || paid >= netPayable) return 'PAID';
  return paid > 0 ? 'PARTIAL' : 'UNPAID';
}

// What is still owed for the month: against the frozen payslip if one exists, else the live estimate.
export function remainingPayable(fin: EmployeeFinancialSummary | null | undefined, payslip?: Payslip): number {
  if (payslip) return Math.max(0, payslip.netPayable - (fin?.salaryPaidThisMonth || 0));
  return fin?.pendingPayable || 0;
}
