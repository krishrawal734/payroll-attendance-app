import {
  Employee,
  SalaryTransaction,
  AttendanceRecord,
  LeaveRequest,
  EmployeeFinancialSummary,
  Payslip,
} from '../types';

// Month a ledger entry belongs to: the "YYYY-MM" in its notes, else its payment date.
export function transactionMonth(tx: Pick<SalaryTransaction, 'notes' | 'paymentDate'>): string {
  return tx.notes?.match(/\d{4}-\d{2}/)?.[0] || tx.paymentDate.slice(0, 7);
}

const sumAmounts = (txs: SalaryTransaction[]) => txs.reduce((sum, t) => sum + t.amount, 0);

export function salaryPaidForMonth(txs: SalaryTransaction[], employeeId: string, monthYear: string): number {
  return sumAmounts(
    txs.filter((t) => t.type === 'SALARY_PAYMENT' && t.employeeId === employeeId && transactionMonth(t) === monthYear)
  );
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
  const totalSalaryPaid = sumAmounts(ofType('SALARY_PAYMENT'));
  const salaryPaidThisMonth = sumAmounts(ofType('SALARY_PAYMENT').filter(inMonth));
  const advanceRecoveredThisMonth = sumAmounts(ofType('DEDUCTION').filter(inMonth));

  const monthAttendance = attendance.filter((a) => a.date.startsWith(monthYear));
  const presentDays = monthAttendance.filter((a) => a.status === 'PRESENT').length;
  const nightPresentDays = monthAttendance.filter((a) => a.isNightPresent).length;
  const leavesTaken = leaves.filter(
    (l) => l.status === 'APPROVED' && (l.fromDate.startsWith(monthYear) || l.toDate.startsWith(monthYear))
  ).length;

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
