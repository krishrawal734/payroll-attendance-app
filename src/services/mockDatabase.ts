import {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  SalaryTransaction,
  Payslip,
  AttendanceLocation,
  EmployeeFinancialSummary,
} from '../types';
import { textbeeService } from './textbeeService';

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

  saveTotpSecret(employeeId: string, secret: string): { success: boolean; message: string } {
    const emp = this.employees.find((e) => e.id === employeeId);
    if (!emp) return { success: false, message: 'Employee not found.' };
    emp.totpSecret = secret;
    emp.is2faEnabled = true;
    return { success: true, message: 'Google Authenticator linked successfully!' };
  }

  resetTotp(employeeId: string): { success: boolean; message: string } {
    const emp = this.employees.find((e) => e.id === employeeId);
    if (!emp) return { success: false, message: 'Employee not found.' };
    emp.totpSecret = null;
    emp.is2faEnabled = false;
    return { success: true, message: 'Google Authenticator reset successfully.' };
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

  getTodayAttendance(employeeId: string): AttendanceRecord | undefined {
    const today = new Date().toISOString().split('T')[0];
    return this.attendance.find((a) => a.employeeId === employeeId && a.date === today);
  }

  checkIn(employeeId: string, location: AttendanceLocation): { success: boolean; record?: AttendanceRecord; message: string } {
    const today = new Date().toISOString().split('T')[0];
    const existing = this.getTodayAttendance(employeeId);
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

    const emp = this.getEmployeeById(employeeId);
    if (emp) {
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      textbeeService.sendCheckInSms(emp, timeStr, today).catch(() => {});
    }

    return { success: true, record: newRecord, message: 'Checked in successfully!' };
  }

  // REQUIREMENT 1: If an employee checks out after 7:00 PM (19:00), automatically mark attendance as Night Present
  checkOut(employeeId: string, location: AttendanceLocation): { success: boolean; record?: AttendanceRecord; message: string } {
    const today = new Date().toISOString().split('T')[0];
    const existing = this.getTodayAttendance(employeeId);

    if (!existing || !existing.checkInTime) {
      return { success: false, message: 'Please check in first before checking out.' };
    }
    if (existing.checkOutTime) {
      return { success: false, message: 'You have already checked out for today.' };
    }

    const now = new Date();
    const checkOutIso = now.toISOString();

    // Check if after 7:00 PM (19:00 hours in local time)
    const hours = now.getHours();
    const isNightPresent = hours >= 19; // 19:00 or later = 7:00 PM or later

    existing.checkOutTime = checkOutIso;
    existing.checkOutLocation = location;
    existing.isNightPresent = isNightPresent;

    const emp = this.getEmployeeById(employeeId);
    if (emp) {
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      textbeeService.sendCheckOutSms(emp, timeStr, isNightPresent).catch(() => {});
    }

    return {
      success: true,
      record: existing,
      message: isNightPresent
        ? 'Checked out! Auto-marked as Night Present (Checkout after 7:00 PM).'
        : 'Checked out successfully.',
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

    const emp = this.getEmployeeById(data.employeeId);
    if (emp) {
      if (data.type === 'SALARY_PAYMENT') {
        const monthYear = data.notes?.match(/\d{4}-\d{2}/)?.[0] || data.paymentDate.slice(0, 7);
        textbeeService.sendSalaryDisbursalSms(emp, data.amount, data.paymentMode, monthYear, data.referenceId).catch(() => {});
      } else if (data.type === 'ADVANCE_PAID') {
        const fin = this.getEmployeeFinancialSummary(data.employeeId);
        textbeeService.sendAdvanceDisbursalSms(emp, data.amount, data.paymentMode, fin?.activeAdvanceBalance).catch(() => {});
      }
    }

    return { success: true, transaction: newTx, message: 'Transaction recorded successfully.' };
  }

  // Calculate Advance Balance, Pending Salary, and Totals for an employee
  getEmployeeFinancialSummary(employeeId: string, monthYear?: string): EmployeeFinancialSummary | null {
    const emp = this.getEmployeeById(employeeId);
    if (!emp) return null;

    const txs = this.getTransactions(employeeId);

    // Total advance paid to this employee
    const totalAdvancesTaken = txs
      .filter((t) => t.type === 'ADVANCE_PAID')
      .reduce((sum, t) => sum + t.amount, 0);

    // Total deductions recovered against advances
    const totalAdvancesRecovered = txs
      .filter((t) => t.type === 'DEDUCTION')
      .reduce((sum, t) => sum + t.amount, 0);

    const activeAdvanceBalance = Math.max(0, totalAdvancesTaken - totalAdvancesRecovered);

    // Total salary disbursed historically
    const totalSalaryPaid = txs
      .filter((t) => t.type === 'SALARY_PAYMENT')
      .reduce((sum, t) => sum + t.amount, 0);

    // Month attendance count
    const targetMonth = monthYear || new Date().toISOString().slice(0, 7); // e.g. "2026-11"
    const empAttendance = this.getAttendance(employeeId).filter((a) => a.date.startsWith(targetMonth));
    const presentDays = empAttendance.filter((a) => a.status === 'PRESENT').length;
    const nightPresentDays = empAttendance.filter((a) => a.isNightPresent).length;
    const leaves = this.getLeaves(employeeId).filter(
      (l) => l.status === 'APPROVED' && (l.fromDate.startsWith(targetMonth) || l.toDate.startsWith(targetMonth))
    );

    const nightAllowance = nightPresentDays * 250;
    const payableDays = Math.min(presentDays + leaves.length, 30);
    const baseEarnings = emp.salaryType === 'monthly'
      ? Math.round((emp.baseSalary / 30) * payableDays)
      : Math.round(emp.baseSalary * presentDays);

    const estimatedCurrentEarnings = baseEarnings + nightAllowance;
    const advanceDeduction = Math.min(activeAdvanceBalance, estimatedCurrentEarnings);
    const pendingPayable = Math.max(0, estimatedCurrentEarnings - advanceDeduction);

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
    };
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

    const empAttendance = this.getAttendance(employeeId).filter((a) => a.date.startsWith(monthYear));
    const presentDays = empAttendance.filter((a) => a.status === 'PRESENT').length;
    const nightPresentDays = empAttendance.filter((a) => a.isNightPresent).length;
    const leaves = this.getLeaves(employeeId).filter(
      (l) => l.status === 'APPROVED' && (l.fromDate.startsWith(monthYear) || l.toDate.startsWith(monthYear))
    );

    const nightAllowance = nightPresentDays * 250;
    const payableDays = Math.min(presentDays + leaves.length, 30);
    const baseEarnings = emp.salaryType === 'monthly'
      ? Math.round((emp.baseSalary / 30) * payableDays)
      : Math.round(emp.baseSalary * presentDays);
    const gross = baseEarnings + nightAllowance;

    // Deduct active advances accurately (capped at gross)
    const finSummary = this.getEmployeeFinancialSummary(employeeId, monthYear);
    const advanceDeduction = Math.min(finSummary?.activeAdvanceBalance || 0, gross);
    const net = Math.max(0, gross - advanceDeduction);

    const existingIdx = this.payslips.findIndex((p) => p.employeeId === employeeId && p.monthYear === monthYear);
    if (existingIdx !== -1) {
      this.payslips[existingIdx] = {
        ...this.payslips[existingIdx],
        presentDays,
        nightPresentDays,
        leavesTaken: leaves.length,
        baseSalary: emp.baseSalary,
        grossEarnings: gross,
        advanceDeductions: advanceDeduction,
        netPayable: net,
      };
      textbeeService.sendPayslipReadySms(emp, monthYear, net).catch(() => {});
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
      leavesTaken: leaves.length,
      baseSalary: emp.baseSalary,
      grossEarnings: gross,
      advanceDeductions: advanceDeduction,
      netPayable: net,
      paymentStatus: 'UNPAID',
      generatedAt: new Date().toISOString(),
    };

    this.payslips.unshift(newPayslip);
    textbeeService.sendPayslipReadySms(emp, monthYear, net).catch(() => {});
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
