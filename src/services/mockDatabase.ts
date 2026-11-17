import {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  SalaryTransaction,
  Payslip,
  AttendanceLocation,
  EmployeeFinancialSummary,
} from '../types';
import { getNightAllowance, mockAttendanceRules } from './settingsService';
import { computeFinancialSummary, shiftStatus, checkOutMessage } from './payrollCalc';
import { localDateString, localMonthString, previousLocalDateString } from '../utils/date';

class MockDatabase {
  private employees: Employee[] = [];
  private attendance: AttendanceRecord[] = [];
  private leaves: LeaveRequest[] = [];
  private transactions: SalaryTransaction[] = [];
  private payslips: Payslip[] = [];

  // Current session state
  private currentUser: Employee | null = null;

  // --- Auth & Employee Methods ---
  loginWithMobile(mobileNumber: string): { success: boolean; user?: Employee; message: string } {
    const cleanMobile = mobileNumber.trim().replace(/\D/g, '');
    const user = this.employees.find((emp) => emp.mobileNumber === cleanMobile && emp.isActive);
    if (!user) {
      return {
        success: false,
        message: 'Mobile number not found or account inactive. Contact Admin to register your number.',
      };
    }
    this.currentUser = user;
    return { success: true, user, message: 'Login successful' };
  }

  getCurrentUser(): Employee | null {
    return this.currentUser;
  }

  setCurrentUser(user: Employee | null) {
    this.currentUser = user;
  }

  getEmployees(): Employee[] {
    return [...this.employees];
  }

  getEmployeeById(id: string): Employee | undefined {
    return this.employees.find((e) => e.id === id);
  }

  addEmployee(data: Omit<Employee, 'id' | 'isActive'>): { success: boolean; employee?: Employee; message: string } {
    const existing = this.employees.find((e) => e.mobileNumber === data.mobileNumber);
    if (existing) {
      return { success: false, message: 'An employee with this mobile number already exists.' };
    }
    const newEmp: Employee = {
      ...data,
      id: `emp_${Date.now()}`,
      isActive: true,
    };
    this.employees.unshift(newEmp);
    return { success: true, employee: newEmp, message: 'Employee registered successfully!' };
  }

  // --- Attendance Methods ---
  getAttendance(employeeId?: string): AttendanceRecord[] {
    if (employeeId) {
      return this.attendance.filter((a) => a.employeeId === employeeId);
    }
    return [...this.attendance];
  }

  // Today's record, or last night's shift if it is still open (checked in, not out) after midnight.
  getTodayAttendance(employeeId: string): AttendanceRecord | undefined {
    const today = localDateString();
    const yesterday = previousLocalDateString();
    const mine = this.attendance.filter((a) => a.employeeId === employeeId);
    return (
      mine.find((a) => a.date === today) ??
      mine.find((a) => a.date === yesterday && a.checkInTime && !a.checkOutTime)
    );
  }

  checkIn(employeeId: string, location: AttendanceLocation): { success: boolean; record?: AttendanceRecord; message: string } {
    const today = localDateString();
    const existing = this.getTodayAttendance(employeeId);
    if (existing && existing.date !== today) {
      return { success: false, message: `Please check out of your shift from ${existing.date} first.` };
    }
    if (existing && existing.checkInTime) {
      return { success: false, message: 'You have already checked in for today!' };
    }

    const newRecord: AttendanceRecord = {
      id: `att_${Date.now()}`,
      employeeId,
      date: today,
      checkInTime: new Date().toISOString(),
      checkInLocation: location,
      isNightPresent: false,
      status: 'PRESENT',
    };

    if (existing) {
      const idx = this.attendance.findIndex((a) => a.id === existing.id);
      this.attendance[idx] = { ...this.attendance[idx], ...newRecord };
    } else {
      this.attendance.unshift(newRecord);
    }

    return { success: true, record: newRecord, message: 'Checked in successfully!' };
  }

  // REQUIREMENT 1: If an employee checks out after 7:00 PM (19:00), automatically mark attendance as Night Present
  checkOut(employeeId: string, location: AttendanceLocation): { success: boolean; record?: AttendanceRecord; message: string } {
    const existing = this.getTodayAttendance(employeeId);

    if (!existing || !existing.checkInTime) {
      return { success: false, message: 'Please check in first before checking out.' };
    }
    if (existing.checkOutTime) {
      return { success: false, message: 'You have already checked out for today.' };
    }

    const now = new Date();
    const checkOutIso = now.toISOString();

    const status = shiftStatus(existing.checkInTime, checkOutIso, mockAttendanceRules());
    // After 7:00 PM (local time), or a shift that ran past midnight into a later date; too-short shifts earn nothing.
    const isNightPresent = status !== 'ABSENT' && (now.getHours() >= 19 || existing.date !== localDateString(now));

    existing.checkOutTime = checkOutIso;
    existing.checkOutLocation = location;
    existing.isNightPresent = isNightPresent;
    existing.status = status;

    return {
      success: true,
      record: existing,
      message: checkOutMessage(status, isNightPresent),
    };
  }

  // --- Leave Management ---
  getLeaves(employeeId?: string): LeaveRequest[] {
    if (employeeId) {
      return this.leaves.filter((l) => l.employeeId === employeeId);
    }
    return [...this.leaves];
  }

  applyLeave(data: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>): { success: boolean; leave?: LeaveRequest; message: string } {
    const newLeave: LeaveRequest = {
      ...data,
      id: `lv_${Date.now()}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    this.leaves.unshift(newLeave);
    return { success: true, leave: newLeave, message: 'Leave request submitted to Admin for approval.' };
  }

  updateLeaveStatus(leaveId: string, status: 'APPROVED' | 'REJECTED', adminRemark?: string): { success: boolean; message: string } {
    const leave = this.leaves.find((l) => l.id === leaveId);
    if (!leave) {
      return { success: false, message: 'Leave request not found.' };
    }
    leave.status = status;
    if (adminRemark) leave.adminRemark = adminRemark;
    return { success: true, message: `Leave has been ${status.toLowerCase()}.` };
  }

  // --- Salary, Advances & Ledger ---
  getTransactions(employeeId?: string): SalaryTransaction[] {
    if (employeeId) {
      return this.transactions.filter((t) => t.employeeId === employeeId);
    }
    return [...this.transactions];
  }

  recordTransaction(data: Omit<SalaryTransaction, 'id' | 'createdAt'>): { success: boolean; transaction?: SalaryTransaction; message: string } {
    const newTx: SalaryTransaction = {
      ...data,
      id: `tx_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    this.transactions.unshift(newTx);

    return { success: true, transaction: newTx, message: 'Transaction recorded successfully.' };
  }

  // Calculate Advance Balance, Pending Salary, and Totals for an employee
  getEmployeeFinancialSummary(employeeId: string, monthYear?: string): EmployeeFinancialSummary | null {
    const emp = this.getEmployeeById(employeeId);
    if (!emp) return null;

    const targetMonth = monthYear || localMonthString(); // e.g. "2026-11"
    return computeFinancialSummary(
      emp,
      this.getTransactions(employeeId),
      this.getAttendance(employeeId),
      this.getLeaves(employeeId),
      getNightAllowance(),
      targetMonth
    );
  }

  // --- Payslips ---
  getPayslips(employeeId?: string): Payslip[] {
    if (employeeId) {
      return this.payslips.filter((p) => p.employeeId === employeeId);
    }
    return [...this.payslips];
  }

  generatePayslip(employeeId: string, monthYear: string): { success: boolean; payslip?: Payslip; message: string } {
    const emp = this.getEmployeeById(employeeId);
    if (!emp) return { success: false, message: 'Employee not found.' };

    const fin = this.getEmployeeFinancialSummary(employeeId, monthYear);
    if (!fin) return { success: false, message: 'Employee not found.' };

    const { presentDays, nightPresentDays, nightAllowance, leavesTaken, advanceDeduction } = fin;
    const gross = fin.estimatedCurrentEarnings;
    const net = Math.max(0, gross - advanceDeduction);

    const existingIdx = this.payslips.findIndex((p) => p.employeeId === employeeId && p.monthYear === monthYear);
    if (existingIdx !== -1) {
      this.payslips[existingIdx] = {
        ...this.payslips[existingIdx],
        presentDays,
        nightPresentDays,
        nightAllowance,
        leavesTaken,
        baseSalary: emp.baseSalary,
        grossEarnings: gross,
        advanceDeductions: advanceDeduction,
        netPayable: net,
      };
      return {
        success: true,
        payslip: this.payslips[existingIdx],
        message: `Payslip for ${monthYear} refreshed & updated successfully.`,
      };
    }

    const newPayslip: Payslip = {
      id: `ps_${Date.now()}`,
      employeeId,
      employeeName: emp.fullName,
      monthYear,
      totalDays: 30,
      presentDays,
      nightPresentDays,
      nightAllowance,
      leavesTaken,
      baseSalary: emp.baseSalary,
      grossEarnings: gross,
      advanceDeductions: advanceDeduction,
      netPayable: net,
      paymentStatus: 'UNPAID',
      generatedAt: new Date().toISOString(),
    };

    this.payslips.unshift(newPayslip);
    return { success: true, payslip: newPayslip, message: `Payslip for ${monthYear} generated successfully.` };
  }

  deletePayslip(id: string): { success: boolean; message: string } {
    const idx = this.payslips.findIndex((p) => p.id === id);
    if (idx === -1) return { success: false, message: 'Payslip not found.' };
    this.payslips.splice(idx, 1);
    return { success: true, message: 'Payslip deleted successfully.' };
  }
}

export const db = new MockDatabase();
