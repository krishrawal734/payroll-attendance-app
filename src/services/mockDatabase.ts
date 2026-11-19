import {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  SalaryTransaction,
  Payslip,
  AttendanceLocation,
  EmployeeFinancialSummary,
  PaymentMode,
} from '../types';
import {
  computeEmployeeMonthlyPayroll,
  getAdvanceRecoveryNote,
} from './payrollCalculations';
import {
  AUTO_CHECKOUT_ADDRESS,
  AUTO_CHECKOUT_NOTE,
  evaluateAutoCheckout,
  getLocalDateStr,
  isInGraceWindow,
  isNightShiftManualCheckout,
} from './shiftRules';

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

  private processAutoNightCheckouts(employeeId?: string) {
    const now = new Date();
    for (const rec of this.attendance) {
      if (employeeId && rec.employeeId !== employeeId) continue;
      const { shouldAutoClose, cutoffTime } = evaluateAutoCheckout(rec, now);
      if (shouldAutoClose) {
        rec.checkOutTime = cutoffTime.toISOString();
        rec.checkOutLocation = {
          latitude: rec.checkInLocation?.latitude || 0,
          longitude: rec.checkInLocation?.longitude || 0,
          address: AUTO_CHECKOUT_ADDRESS,
        };
        rec.isNightPresent = true;
        rec.notes = AUTO_CHECKOUT_NOTE;
      }
    }
  }

  // --- Attendance Methods ---
  getAttendance(employeeId?: string): AttendanceRecord[] {
    this.processAutoNightCheckouts(employeeId);
    if (employeeId) {
      return this.attendance.filter((a) => a.employeeId === employeeId);
    }
    return [...this.attendance];
  }

  getTodayAttendance(employeeId: string): AttendanceRecord | undefined {
    this.processAutoNightCheckouts(employeeId);
    const activeOpen = this.attendance.find(
      (a) => a.employeeId === employeeId && Boolean(a.checkInTime) && !a.checkOutTime
    );
    if (activeOpen) return activeOpen;

    const today = getLocalDateStr();
    return this.attendance.find((a) => a.employeeId === employeeId && a.date === today);
  }

  checkIn(employeeId: string, location: AttendanceLocation): { success: boolean; record?: AttendanceRecord; message: string } {
    this.processAutoNightCheckouts(employeeId);
    const existing = this.getTodayAttendance(employeeId);
    if (existing && existing.checkInTime && !existing.checkOutTime) {
      return { success: false, message: 'You already have an active open shift. Please punch out first.' };
    }
    if (existing && existing.checkInTime) {
      return { success: false, message: 'You have already checked in for today!' };
    }

    const today = getLocalDateStr();
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

  // Shift Rules: 7 PM – 8:59 PM grace window (normal Day Shift); 9 PM – 5 AM Night Shift (auto punch-out at 5 AM)
  checkOut(employeeId: string, location: AttendanceLocation): { success: boolean; record?: AttendanceRecord; message: string } {
    this.processAutoNightCheckouts(employeeId);
    const existing = this.getTodayAttendance(employeeId);

    if (!existing || !existing.checkInTime) {
      return { success: false, message: 'Please check in first before checking out.' };
    }
    if (existing.checkOutTime) {
      return { success: false, message: 'You have already checked out for today.' };
    }

    const now = new Date();
    const isNightPresent = isNightShiftManualCheckout(now); // true only 9:00 PM – 4:59 AM
    const inGrace = isInGraceWindow(now); // 7:00 PM – 8:59 PM

    existing.checkOutTime = now.toISOString();
    existing.checkOutLocation = location;
    existing.isNightPresent = isNightPresent;
    if (inGrace) {
      existing.notes = 'Punched out during 7:00 PM – 9:00 PM grace window (before Night Shift)';
    } else if (isNightPresent) {
      existing.notes = 'Night Shift Punch-Out (9:00 PM – 5:00 AM)';
    }

    return {
      success: true,
      record: existing,
      message: isNightPresent
        ? 'Checked out during Night Shift (9:00 PM – 5:00 AM)! Marked as Night Present (+₹250).'
        : inGrace
          ? 'Checked out before 9:00 PM Night Shift start (regular Day Shift recorded).'
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

    return { success: true, transaction: newTx, message: 'Transaction recorded successfully.' };
  }

  deleteTransaction(id: string): { success: boolean; message: string } {
    const idx = this.transactions.findIndex((t) => t.id === id);
    if (idx === -1) {
      return { success: false, message: 'Transaction not found.' };
    }
    this.transactions.splice(idx, 1);
    return { success: true, message: 'Transaction removed from ledger.' };
  }

  // Calculate Advance Balance, Pending Salary, and Totals for an employee
  getEmployeeFinancialSummary(employeeId: string, monthYear?: string): EmployeeFinancialSummary | null {
    const emp = this.getEmployeeById(employeeId);
    if (!emp) return null;

    return computeEmployeeMonthlyPayroll(
      emp,
      this.getAttendance(employeeId),
      this.getLeaves(employeeId),
      this.getTransactions(employeeId),
      monthYear
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

    const calc = computeEmployeeMonthlyPayroll(
      emp,
      this.getAttendance(employeeId),
      this.getLeaves(employeeId),
      this.getTransactions(employeeId),
      monthYear
    );

    const gross = calc.estimatedCurrentEarnings;
    const advanceDeduction = calc.advanceDeduction;
    const net = calc.netPayableForMonth;
    const paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' =
      calc.salaryPaidForMonth > 0
        ? calc.salaryPaidForMonth >= net
          ? 'PAID'
          : 'PARTIAL'
        : 'UNPAID';

    const existingIdx = this.payslips.findIndex((p) => p.employeeId === employeeId && p.monthYear === monthYear);
    if (existingIdx !== -1) {
      this.payslips[existingIdx] = {
        ...this.payslips[existingIdx],
        presentDays: calc.presentDays,
        nightPresentDays: calc.nightPresentDays,
        leavesTaken: calc.leavesTaken,
        baseSalary: emp.baseSalary,
        grossEarnings: gross,
        advanceDeductions: advanceDeduction,
        netPayable: net,
        paymentStatus,
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
      presentDays: calc.presentDays,
      nightPresentDays: calc.nightPresentDays,
      leavesTaken: calc.leavesTaken,
      baseSalary: emp.baseSalary,
      grossEarnings: gross,
      advanceDeductions: advanceDeduction,
      netPayable: net,
      paymentStatus,
      generatedAt: new Date().toISOString(),
    };

    this.payslips.unshift(newPayslip);
    return { success: true, payslip: newPayslip, message: `Payslip for ${monthYear} generated successfully.` };
  }

  settleSalaryPayment(params: {
    employeeId: string;
    employeeName: string;
    monthYear: string;
    amount: number;
    paymentMode: PaymentMode;
    referenceId?: string;
    paymentDate: string;
    notes?: string;
  }): { success: boolean; paymentStatus?: 'PAID' | 'PARTIAL'; advanceRecovered?: number; message: string } {
    const emp = this.getEmployeeById(params.employeeId);
    if (!emp) return { success: false, message: 'Employee not found.' };

    const calcBefore = computeEmployeeMonthlyPayroll(
      emp,
      this.getAttendance(params.employeeId),
      this.getLeaves(params.employeeId),
      this.getTransactions(params.employeeId),
      params.monthYear
    );

    this.recordTransaction({
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      type: 'SALARY_PAYMENT',
      amount: params.amount,
      paymentMode: params.paymentMode,
      referenceId: params.referenceId,
      paymentDate: params.paymentDate,
      notes: params.notes || `Salary disbursal for ${params.monthYear} via ${params.paymentMode}`,
    });

    let advanceRecovered = 0;
    if (calcBefore.additionalAdvanceToRecover > 0) {
      this.recordTransaction({
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        type: 'DEDUCTION',
        amount: calcBefore.additionalAdvanceToRecover,
        paymentMode: params.paymentMode,
        referenceId: params.referenceId,
        paymentDate: params.paymentDate,
        notes: getAdvanceRecoveryNote(params.monthYear),
      });
      advanceRecovered = calcBefore.additionalAdvanceToRecover;
    }

    const totalPaidForMonth = calcBefore.salaryPaidForMonth + params.amount;
    const slipIdx = this.payslips.findIndex(
      (p) => p.employeeId === params.employeeId && p.monthYear === params.monthYear
    );
    const targetNet = slipIdx !== -1 ? this.payslips[slipIdx].netPayable : calcBefore.netPayableForMonth;
    const newStatus: 'PAID' | 'PARTIAL' = totalPaidForMonth >= targetNet ? 'PAID' : 'PARTIAL';

    if (slipIdx !== -1) {
      this.payslips[slipIdx] = { ...this.payslips[slipIdx], paymentStatus: newStatus };
    }

    const advNote =
      advanceRecovered > 0
        ? ` Advance of ₹${advanceRecovered.toLocaleString()} settled in passbook.`
        : '';

    return {
      success: true,
      paymentStatus: newStatus,
      advanceRecovered,
      message: `₹${params.amount.toLocaleString()} salary recorded (${newStatus}).${advNote}`,
    };
  }

  deletePayslip(id: string): { success: boolean; message: string } {
    const idx = this.payslips.findIndex((p) => p.id === id);
    if (idx === -1) return { success: false, message: 'Payslip not found.' };
    this.payslips.splice(idx, 1);
    return { success: true, message: 'Payslip deleted successfully.' };
  }
}

export const db = new MockDatabase();
