import {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  SalaryTransaction,
  Payslip,
  AttendanceLocation,
} from '../types';

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
    return { success: true, transaction: newTx, message: 'Transaction recorded successfully.' };
  }

  // Calculate Advance Balance, Pending Salary, and Totals for an employee
  getEmployeeFinancialSummary(employeeId: string) {
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

    // Current month attendance count
    const monthPrefix = new Date().toISOString().slice(0, 7); // e.g. "2026-11"
    const empAttendance = this.getAttendance(employeeId).filter((a) => a.date.startsWith(monthPrefix));
    const presentDays = empAttendance.filter((a) => a.status === 'PRESENT').length;
    const nightPresentDays = empAttendance.filter((a) => a.isNightPresent).length;

    // Estimated current month earnings (Base salary + 200 per night present allowance)
    let estimatedCurrentEarnings = 0;
    if (emp.salaryType === 'monthly') {
      const dailyRate = emp.baseSalary / 30;
      estimatedCurrentEarnings = Math.round(dailyRate * presentDays + nightPresentDays * 200);
    } else {
      estimatedCurrentEarnings = Math.round(emp.baseSalary * presentDays + nightPresentDays * 200);
    }

    const pendingPayable = Math.max(0, estimatedCurrentEarnings - activeAdvanceBalance);

    return {
      baseSalary: emp.baseSalary,
      salaryType: emp.salaryType,
      activeAdvanceBalance,
      totalAdvancesTaken,
      totalSalaryPaid,
      presentDays,
      nightPresentDays,
      estimatedCurrentEarnings,
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

    const existing = this.payslips.find((p) => p.employeeId === employeeId && p.monthYear === monthYear);
    if (existing) {
      return { success: true, payslip: existing, message: 'Payslip already generated for this month.' };
    }

    const empAttendance = this.getAttendance(employeeId).filter((a) => a.date.startsWith(monthYear));
    const presentDays = Math.max(empAttendance.filter((a) => a.status === 'PRESENT').length, 24); // fallback realistic sample
    const nightPresentDays = empAttendance.filter((a) => a.isNightPresent).length || 5;
    const approvedLeaves = this.getLeaves(employeeId).filter((l) => l.status === 'APPROVED').length;

    const nightAllowance = nightPresentDays * 250;
    const gross = emp.salaryType === 'monthly' ? emp.baseSalary + nightAllowance : emp.baseSalary * presentDays + nightAllowance;

    // Deduct active advances
    const finSummary = this.getEmployeeFinancialSummary(employeeId);
    const advanceDeduction = Math.min(finSummary?.activeAdvanceBalance || 0, 3000);
    const net = gross - advanceDeduction;

    const newPayslip: Payslip = {
      id: `ps_${Date.now()}`,
      employeeId,
      employeeName: emp.fullName,
      monthYear,
      totalDays: 30,
      presentDays,
      nightPresentDays,
      leavesTaken: approvedLeaves,
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
}

export const db = new MockDatabase();
