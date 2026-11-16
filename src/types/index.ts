export type Role = 'admin' | 'employee';

export type SalaryType = 'monthly' | 'daily';

export interface Employee {
  id: string;
  fullName: string;
  mobileNumber: string;
  role: Role;
  designation: string;
  baseSalary: number;
  salaryType: SalaryType;
  joiningDate: string; // YYYY-MM-DD
  isActive: boolean;
  bankUpiId?: string;
}

export interface AttendanceLocation {
  latitude: number;
  longitude: number;
  address?: string;
  isMocked?: boolean;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  checkInTime?: string; // ISO string
  checkInLocation?: AttendanceLocation;
  checkOutTime?: string; // ISO string
  checkOutLocation?: AttendanceLocation;
  isNightPresent: boolean; // Auto true if checkOutTime >= 19:00 (7:00 PM)
  status: 'PRESENT' | 'HALF_DAY' | 'ABSENT' | 'MISSED_PUNCH';
  notes?: string;
}

export type LeaveType = 'CASUAL' | 'SICK' | 'UNPAID';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  adminRemark?: string;
  createdAt: string;
}

export type TransactionType = 'SALARY_PAYMENT' | 'ADVANCE_PAID' | 'BONUS' | 'DEDUCTION';
export type PaymentMode = 'UPI' | 'CASH' | 'BANK_TRANSFER';

export interface SalaryTransaction {
  id: string;
  employeeId: string;
  employeeName: string;
  type: TransactionType;
  amount: number;
  paymentMode: PaymentMode;
  referenceId?: string; // UPI UTR or receipt #
  paymentDate: string; // YYYY-MM-DD
  notes?: string;
  createdAt: string;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  monthYear: string; // e.g. "2026-11"
  totalDays: number;
  presentDays: number;
  nightPresentDays: number;
  leavesTaken: number;
  baseSalary: number;
  grossEarnings: number;
  advanceDeductions: number;
  netPayable: number;
  paymentStatus: 'PAID' | 'UNPAID' | 'PARTIAL';
  generatedAt: string;
}
