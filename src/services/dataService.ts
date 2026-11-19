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
  PaymentMode,
} from '../types';

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

  async saveTotpSecret(employeeId: string, secret: string): Promise<{ success: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.saveTotpSecret(employeeId, secret);
    }
    return db.saveTotpSecret(employeeId, secret);
  }

  async resetTotp(employeeId: string): Promise<{ success: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.resetTotp(employeeId);
    }
    return db.resetTotp(employeeId);
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

  async recordTransaction(tx: Omit<SalaryTransaction, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.recordTransaction(tx);
    }
    const res = db.recordTransaction(tx);
    return { success: res.success, message: res.message };
  }

  async deleteTransaction(id: string): Promise<{ success: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.deleteTransaction(id);
    }
    return db.deleteTransaction(id);
  }

  async settleSalaryPayment(params: {
    employeeId: string;
    employeeName: string;
    monthYear: string;
    amount: number;
    paymentMode: PaymentMode;
    referenceId?: string;
    paymentDate: string;
    notes?: string;
  }): Promise<{ success: boolean; paymentStatus?: 'PAID' | 'PARTIAL'; advanceRecovered?: number; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.settleSalaryPayment(params);
    }
    return db.settleSalaryPayment(params);
  }

  async getEmployeeFinancialSummary(employeeId: string, monthYear?: string) {
    if (this.isCloud()) {
      return await supabaseService.getEmployeeFinancialSummary(employeeId, monthYear);
    }
    return db.getEmployeeFinancialSummary(employeeId, monthYear);
  }

  // --- Payslips ---
  async getPayslips(employeeId?: string): Promise<Payslip[]> {
    if (this.isCloud()) {
      return await supabaseService.getPayslips(employeeId);
    }
    return db.getPayslips(employeeId);
  }

  async generatePayslip(employeeId: string, monthYear: string): Promise<{ success: boolean; payslip?: Payslip; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.generatePayslip(employeeId, monthYear);
    }
    return db.generatePayslip(employeeId, monthYear);
  }

  async deletePayslip(id: string): Promise<{ success: boolean; message: string }> {
    if (this.isCloud()) {
      return await supabaseService.deletePayslip(id);
    }
    return db.deletePayslip(id);
  }
}

export const dataService = new DataService();
