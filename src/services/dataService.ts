import { isSupabaseConfigured } from '../config/supabaseConfig';
import { supabaseService } from './supabaseService';
import { db } from './mockDatabase';
import {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  SalaryTransaction,
  Payslip,
  AttendanceLocation,
} from '../types';
import { transactionMonth, salaryPaidForMonth, payslipStatus } from './payrollCalc';
import { localDateString } from '../utils/date';

export class DataService {
  isCloud(): boolean {
    return isSupabaseConfigured();
  }

  // --- Auth & Employees ---
  async loginWithMobile(mobileNumber: string): Promise<{ success: boolean; user?: Employee; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.loginWithMobile(mobileNumber);
    }
    return db.loginWithMobile(mobileNumber);
  }

  async getEmployees(): Promise<Employee[]> {
    if (this.isCloud()) {
      return await supabaseService.getEmployees();
    }
    return db.getEmployees();
  }

  async getEmployeeById(id: string): Promise<Employee | undefined> {
    if (this.isCloud()) {
      return await supabaseService.getEmployeeById(id);
    }
    return db.getEmployeeById(id);
  }

  async addEmployee(emp: Omit<Employee, 'id' | 'isActive'>): Promise<{ success: boolean; employee?: Employee; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.addEmployee(emp);
    }
    return db.addEmployee(emp);
  }

  // --- Attendance ---
  async getAttendance(employeeId?: string): Promise<AttendanceRecord[]> {
    if (this.isCloud()) {
      return await supabaseService.getAttendance(employeeId);
    }
    return db.getAttendance(employeeId);
  }

  async getTodayAttendance(employeeId: string): Promise<AttendanceRecord | undefined> {
    if (this.isCloud()) {
      return await supabaseService.getTodayAttendance(employeeId);
    }
    return db.getTodayAttendance(employeeId);
  }

  async checkIn(employeeId: string, loc: AttendanceLocation): Promise<{ success: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.checkIn(employeeId, loc);
    }
    const res = db.checkIn(employeeId, loc);
    return { success: res.success, message: res.message };
  }

  async checkOut(employeeId: string, loc: AttendanceLocation): Promise<{ success: boolean; isNightPresent?: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.checkOut(employeeId, loc);
    }
    const res = db.checkOut(employeeId, loc);
    return { success: res.success, isNightPresent: res.record?.isNightPresent, message: res.message };
  }

  // --- Leaves ---
  async getLeaves(employeeId?: string): Promise<LeaveRequest[]> {
    if (this.isCloud()) {
      return await supabaseService.getLeaves(employeeId);
    }
    return db.getLeaves(employeeId);
  }

  async applyLeave(leave: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>): Promise<{ success: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.applyLeave(leave);
    }
    const res = db.applyLeave(leave);
    return { success: res.success, message: res.message };
  }

  async updateLeaveStatus(leaveId: string, status: 'APPROVED' | 'REJECTED', remark?: string): Promise<{ success: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.updateLeaveStatus(leaveId, status, remark);
    }
    return db.updateLeaveStatus(leaveId, status, remark);
  }

  // --- Transactions & Financials ---
  async getTransactions(employeeId?: string): Promise<SalaryTransaction[]> {
    if (this.isCloud()) {
      return await supabaseService.getTransactions(employeeId);
    }
    return db.getTransactions(employeeId);
  }

  // Salary payments are capped at what is still owed for their month, and record the
  // month's advance recovery first so the advance balance actually goes down.
  async recordTransaction(tx: Omit<SalaryTransaction, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string }> {
    if (tx.type === 'SALARY_PAYMENT') {
      const month = transactionMonth(tx);
      const fin = await this.getEmployeeFinancialSummary(tx.employeeId, month);
      if (!fin) return { success: false, message: 'Employee not found.' };
      if (tx.amount > fin.pendingPayable) {
        return {
          success: false,
          message:
            `Only ₹${fin.pendingPayable.toLocaleString('en-IN')} is pending for ${month} ` +
            `(₹${fin.salaryPaidThisMonth.toLocaleString('en-IN')} already paid, ` +
            `₹${fin.advanceDeduction.toLocaleString('en-IN')} advance recovery). ` +
            'Record any extra amount as an advance instead.',
        };
      }
      const settled = await this.settleAdvanceRecovery(tx.employeeId, tx.employeeName, month);
      if (!settled.success) return settled;
    }
    return this.insertTransaction(tx);
  }

  private async insertTransaction(tx: Omit<SalaryTransaction, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.recordTransaction(tx);
    }
    const res = db.recordTransaction(tx);
    return { success: res.success, message: res.message };
  }

  // Writes the not-yet-recorded part of a month's advance recovery as a DEDUCTION entry.
  private async settleAdvanceRecovery(employeeId: string, employeeName: string, month: string): Promise<{ success: boolean; message: string }> {
    const fin = await this.getEmployeeFinancialSummary(employeeId, month);
    const due = fin ? fin.advanceDeduction - fin.advanceRecoveredThisMonth : 0;
    if (due <= 0) return { success: true, message: '' };

    const res = await this.insertTransaction({
      employeeId,
      employeeName,
      type: 'DEDUCTION',
      amount: due,
      paymentMode: 'CASH',
      paymentDate: localDateString(),
      notes: `Advance recovery for ${month}`,
    });
    return res.success ? res : { success: false, message: `Could not record advance recovery: ${res.message}` };
  }

  async getEmployeeFinancialSummary(employeeId: string, monthYear?: string) {
    if (this.isCloud()) {
      return await supabaseService.getEmployeeFinancialSummary(employeeId, monthYear);
    }
    return db.getEmployeeFinancialSummary(employeeId, monthYear);
  }

  // --- Payslips ---
  // Payment status is derived from the ledger, so it stays correct without updating payslip rows.
  async getPayslips(employeeId?: string): Promise<Payslip[]> {
    const [slips, txs] = await Promise.all([
      this.isCloud() ? supabaseService.getPayslips(employeeId) : db.getPayslips(employeeId),
      this.getTransactions(employeeId),
    ]);
    return slips.map((ps) => this.withPaymentStatus(ps, txs));
  }

  async generatePayslip(employeeId: string, monthYear: string): Promise<{ success: boolean; payslip?: Payslip; message: string }> {
    const emp = await this.getEmployeeById(employeeId);
    if (!emp) return { success: false, message: 'Employee not found.' };

    const res = this.isCloud()
      ? await supabaseService.generatePayslip(employeeId, monthYear)
      : db.generatePayslip(employeeId, monthYear);
    if (!res.success || !res.payslip) return res;

    // The payslip deducts the advance, so record that recovery in the ledger now.
    const settled = await this.settleAdvanceRecovery(employeeId, emp.fullName, monthYear);
    if (!settled.success) return { ...res, success: false, message: settled.message };

    const txs = await this.getTransactions(employeeId);
    return { ...res, payslip: this.withPaymentStatus(res.payslip, txs) };
  }

  private withPaymentStatus(ps: Payslip, txs: SalaryTransaction[]): Payslip {
    const paid = salaryPaidForMonth(txs, ps.employeeId, ps.monthYear);
    return { ...ps, paymentStatus: payslipStatus(ps.netPayable, paid) };
  }

  async deletePayslip(id: string): Promise<{ success: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.deletePayslip(id);
    }
    return db.deletePayslip(id);
  }
}

export const dataService = new DataService();
