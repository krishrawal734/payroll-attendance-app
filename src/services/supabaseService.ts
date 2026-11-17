import { supabase } from './supabaseClient';
import { db } from './mockDatabase';
import {
  Employee,
  AttendanceRecord,
  LeaveRequest,
  SalaryTransaction,
  Payslip,
  AttendanceLocation,
  EmployeeFinancialSummary,
} from '../types';

export class SupabaseService {
  // Helper to check if string is valid UUID
  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  // --- Employee & Auth ---
  async loginWithMobile(mobileNumber: string): Promise<{ success: boolean; user?: Employee; message: string }> {
    try {
      const cleanMobile = mobileNumber.trim().replace(/\D/g, '');
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('mobile_number', cleanMobile)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        return {
          success: false,
          message: 'Mobile number not found or account inactive in cloud database. Please register with Admin.',
        };
      }

      const user: Employee = {
        id: data.id,
        fullName: data.full_name,
        mobileNumber: data.mobile_number,
        role: data.role,
        designation: data.designation,
        baseSalary: Number(data.base_salary),
        salaryType: data.salary_type,
        joiningDate: data.joining_date,
        bankUpiId: data.bank_upi_id,
        isActive: data.is_active,
      };

      return { success: true, user, message: 'Login successful' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Supabase connection failed' };
    }
  }

  async getEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      fullName: d.full_name,
      mobileNumber: d.mobile_number,
      role: d.role,
      designation: d.designation,
      baseSalary: Number(d.base_salary),
      salaryType: d.salary_type,
      joiningDate: d.joining_date,
      bankUpiId: d.bank_upi_id,
      isActive: d.is_active,
    }));
  }

  async getEmployeeById(id: string): Promise<Employee | undefined> {
    if (!this.isUUID(id)) {
      return db.getEmployeeById(id);
    }
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return undefined;
    return {
      id: data.id,
      fullName: data.full_name,
      mobileNumber: data.mobile_number,
      role: data.role,
      designation: data.designation,
      baseSalary: Number(data.base_salary),
      salaryType: data.salary_type,
      joiningDate: data.joining_date,
      bankUpiId: data.bank_upi_id,
      isActive: data.is_active,
    };
  }

  async addEmployee(emp: Omit<Employee, 'id' | 'isActive'>): Promise<{ success: boolean; employee?: Employee; message: string }> {
    // Check if mobile already exists
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('mobile_number', emp.mobileNumber)
      .maybeSingle();

    if (existing) {
      return { success: false, message: 'An employee with this mobile number already exists in Supabase.' };
    }

    const { data, error } = await supabase
      .from('employees')
      .insert([
        {
          full_name: emp.fullName,
          mobile_number: emp.mobileNumber,
          role: emp.role,
          designation: emp.designation,
          base_salary: emp.baseSalary,
          salary_type: emp.salaryType,
          joining_date: emp.joiningDate,
          bank_upi_id: emp.bankUpiId,
        },
      ])
      .select()
      .single();

    if (error || !data) {
      return { success: false, message: error?.message || 'Failed to register employee' };
    }

    return {
      success: true,
      employee: {
        id: data.id,
        fullName: data.full_name,
        mobileNumber: data.mobile_number,
        role: data.role,
        designation: data.designation,
        baseSalary: Number(data.base_salary),
        salaryType: data.salary_type,
        joiningDate: data.joining_date,
        bankUpiId: data.bank_upi_id,
        isActive: data.is_active,
      },
      message: 'Employee registered to Supabase successfully!',
    };
  }

  // --- Attendance ---
  async getAttendance(employeeId?: string): Promise<AttendanceRecord[]> {
    let query = supabase.from('attendance').select('*').order('date', { ascending: false });
    if (employeeId) {
      if (!this.isUUID(employeeId)) return db.getAttendance(employeeId);
      query = query.eq('employee_id', employeeId);
    }
    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      employeeId: d.employee_id,
      date: d.date,
      checkInTime: d.check_in_time,
      checkInLocation: d.check_in_lat
        ? {
            latitude: Number(d.check_in_lat),
            longitude: Number(d.check_in_lng),
            address: d.check_in_address,
          }
        : undefined,
      checkOutTime: d.check_out_time,
      checkOutLocation: d.check_out_lat
        ? {
            latitude: Number(d.check_out_lat),
            longitude: Number(d.check_out_lng),
            address: d.check_out_address,
          }
        : undefined,
      isNightPresent: Boolean(d.is_night_present),
      status: d.status,
      notes: d.notes,
    }));
  }

  async getTodayAttendance(employeeId: string): Promise<AttendanceRecord | undefined> {
    const today = new Date().toISOString().split('T')[0];
    if (!this.isUUID(employeeId)) {
      return db.getTodayAttendance(employeeId);
    }
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();

    if (error || !data) return undefined;
    return {
      id: data.id,
      employeeId: data.employee_id,
      date: data.date,
      checkInTime: data.check_in_time,
      checkInLocation: data.check_in_lat
        ? {
            latitude: Number(data.check_in_lat),
            longitude: Number(data.check_in_lng),
            address: data.check_in_address,
          }
        : undefined,
      checkOutTime: data.check_out_time,
      checkOutLocation: data.check_out_lat
        ? {
            latitude: Number(data.check_out_lat),
            longitude: Number(data.check_out_lng),
            address: data.check_out_address,
          }
        : undefined,
      isNightPresent: Boolean(data.is_night_present),
      status: data.status,
      notes: data.notes,
    };
  }

  async checkIn(employeeId: string, loc: AttendanceLocation): Promise<{ success: boolean; message: string }> {
    const today = new Date().toISOString().split('T')[0];

    if (!this.isUUID(employeeId)) {
      const res = db.checkIn(employeeId, loc);
      return { success: res.success, message: res.message };
    }

    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();

    if (existing && existing.check_in_time) {
      return { success: false, message: 'You have already checked in for today!' };
    }

    const { error } = await supabase.from('attendance').insert([
      {
        employee_id: employeeId,
        date: today,
        check_in_time: new Date().toISOString(),
        check_in_lat: loc.latitude,
        check_in_lng: loc.longitude,
        check_in_address: loc.address,
        is_night_present: false,
        status: 'PRESENT',
      },
    ]);

    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true, message: 'Checked in to Supabase cloud successfully!' };
  }

  async checkOut(employeeId: string, loc: AttendanceLocation): Promise<{ success: boolean; isNightPresent?: boolean; message: string }> {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const isNightPresent = now.getHours() >= 19; // After 7:00 PM

    if (!this.isUUID(employeeId)) {
      const res = db.checkOut(employeeId, loc);
      return { success: res.success, isNightPresent: res.record?.isNightPresent, message: res.message };
    }

    const { data: existing } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();

    if (!existing || !existing.check_in_time) {
      return { success: false, message: 'Please check in first before checking out.' };
    }
    if (existing.check_out_time) {
      return { success: false, message: 'You have already checked out for today.' };
    }

    const { error } = await supabase
      .from('attendance')
      .update({
        check_out_time: now.toISOString(),
        check_out_lat: loc.latitude,
        check_out_lng: loc.longitude,
        check_out_address: loc.address,
        is_night_present: isNightPresent,
      })
      .eq('employee_id', employeeId)
      .eq('date', today);

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      isNightPresent,
      message: isNightPresent
        ? 'Checked out! Auto-marked as Night Present (> 7:00 PM) in cloud.'
        : 'Checked out successfully in cloud.',
    };
  }

  // --- Leaves ---
  async getLeaves(employeeId?: string): Promise<LeaveRequest[]> {
    let query = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
    if (employeeId) {
      if (!this.isUUID(employeeId)) return db.getLeaves(employeeId);
      query = query.eq('employee_id', employeeId);
    }
    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      employeeId: d.employee_id,
      employeeName: d.employee_name,
      leaveType: d.leave_type,
      fromDate: d.from_date,
      toDate: d.to_date,
      reason: d.reason,
      status: d.status,
      adminRemark: d.admin_remark,
      createdAt: d.created_at,
    }));
  }

  async applyLeave(leave: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>): Promise<{ success: boolean; message: string }> {
    if (!this.isUUID(leave.employeeId)) {
      const res = db.applyLeave(leave);
      return { success: res.success, message: res.message };
    }

    const { error } = await supabase.from('leave_requests').insert([
      {
        employee_id: leave.employeeId,
        employee_name: leave.employeeName,
        leave_type: leave.leaveType,
        from_date: leave.fromDate,
        to_date: leave.toDate,
        reason: leave.reason,
        status: 'PENDING',
      },
    ]);

    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Leave request saved to cloud database.' };
  }

  async updateLeaveStatus(leaveId: string, status: 'APPROVED' | 'REJECTED', adminRemark?: string): Promise<{ success: boolean; message: string }> {
    if (!this.isUUID(leaveId)) {
      return db.updateLeaveStatus(leaveId, status, adminRemark);
    }

    const { error } = await supabase
      .from('leave_requests')
      .update({ status, admin_remark: adminRemark })
      .eq('id', leaveId);

    if (error) return { success: false, message: error.message };
    return { success: true, message: `Leave has been ${status.toLowerCase()} in cloud.` };
  }

  // --- Transactions ---
  async getTransactions(employeeId?: string): Promise<SalaryTransaction[]> {
    let query = supabase.from('salary_transactions').select('*').order('created_at', { ascending: false });
    if (employeeId) {
      if (!this.isUUID(employeeId)) return db.getTransactions(employeeId);
      query = query.eq('employee_id', employeeId);
    }
    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      employeeId: d.employee_id,
      employeeName: d.employee_name,
      type: d.type,
      amount: Number(d.amount),
      paymentMode: d.payment_mode,
      referenceId: d.reference_id,
      paymentDate: d.payment_date,
      notes: d.notes,
      createdAt: d.created_at,
    }));
  }

  async recordTransaction(tx: Omit<SalaryTransaction, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string }> {
    if (!this.isUUID(tx.employeeId)) {
      const res = db.recordTransaction(tx);
      return { success: res.success, message: res.message };
    }

    const { error } = await supabase.from('salary_transactions').insert([
      {
        employee_id: tx.employeeId,
        employee_name: tx.employeeName,
        type: tx.type,
        amount: tx.amount,
        payment_mode: tx.paymentMode,
        reference_id: tx.referenceId,
        payment_date: tx.paymentDate,
        notes: tx.notes,
      },
    ]);

    if (error) return { success: false, message: error.message };
    return { success: true, message: 'Transaction recorded in cloud ledger.' };
  }

  // --- Financial Summary ---
  async getEmployeeFinancialSummary(employeeId: string, monthYear?: string): Promise<EmployeeFinancialSummary | null> {
    const emp = await this.getEmployeeById(employeeId);
    if (!emp) return null;

    if (!this.isUUID(employeeId)) {
      return db.getEmployeeFinancialSummary(employeeId, monthYear);
    }

    const txs = await this.getTransactions(employeeId);

    const totalAdvancesTaken = txs
      .filter((t) => t.type === 'ADVANCE_PAID')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalAdvancesRecovered = txs
      .filter((t) => t.type === 'DEDUCTION')
      .reduce((sum, t) => sum + t.amount, 0);

    const activeAdvanceBalance = Math.max(0, totalAdvancesTaken - totalAdvancesRecovered);

    const totalSalaryPaid = txs
      .filter((t) => t.type === 'SALARY_PAYMENT')
      .reduce((sum, t) => sum + t.amount, 0);

    const targetMonth = monthYear || new Date().toISOString().slice(0, 7);
    const attendance = (await this.getAttendance(employeeId)).filter((a) => a.date.startsWith(targetMonth));
    const presentDays = attendance.filter((a) => a.status === 'PRESENT').length;
    const nightPresentDays = attendance.filter((a) => a.isNightPresent).length;
    const leaves = (await this.getLeaves(employeeId)).filter(
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
  async getPayslips(employeeId?: string): Promise<Payslip[]> {
    let query = supabase.from('payslips').select('*').order('month_year', { ascending: false });
    if (employeeId) {
      if (!this.isUUID(employeeId)) return db.getPayslips(employeeId);
      query = query.eq('employee_id', employeeId);
    }
    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      employeeId: d.employee_id,
      employeeName: d.employee_name,
      monthYear: d.month_year,
      totalDays: d.total_days,
      presentDays: d.present_days,
      nightPresentDays: d.night_present_days,
      leavesTaken: d.leaves_taken,
      baseSalary: Number(d.base_salary),
      grossEarnings: Number(d.gross_earnings),
      advanceDeductions: Number(d.advance_deductions),
      netPayable: Number(d.net_payable),
      paymentStatus: d.payment_status,
      generatedAt: d.generated_at,
    }));
  }

  async generatePayslip(employeeId: string, monthYear: string): Promise<{ success: boolean; payslip?: Payslip; message: string }> {
    const emp = await this.getEmployeeById(employeeId);
    if (!emp) return { success: false, message: 'Employee not found.' };

    if (!this.isUUID(employeeId)) {
      return db.generatePayslip(employeeId, monthYear);
    }

    const { data: existing } = await supabase
      .from('payslips')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('month_year', monthYear)
      .maybeSingle();

    if (existing) {
      return {
        success: true,
        payslip: {
          id: existing.id,
          employeeId: existing.employee_id,
          employeeName: existing.employee_name,
          monthYear: existing.month_year,
          totalDays: existing.total_days,
          presentDays: existing.present_days,
          nightPresentDays: existing.night_present_days,
          leavesTaken: existing.leaves_taken,
          baseSalary: Number(existing.base_salary),
          grossEarnings: Number(existing.gross_earnings),
          advanceDeductions: Number(existing.advance_deductions),
          netPayable: Number(existing.net_payable),
          paymentStatus: existing.payment_status,
          generatedAt: existing.generated_at,
        },
        message: 'Payslip already generated for this month in cloud.',
      };
    }

    const attendance = (await this.getAttendance(employeeId)).filter((a) => a.date.startsWith(monthYear));
    const presentDays = attendance.filter((a) => a.status === 'PRESENT').length;
    const nightPresentDays = attendance.filter((a) => a.isNightPresent).length;
    const leaves = (await this.getLeaves(employeeId)).filter(
      (l) => l.status === 'APPROVED' && (l.fromDate.startsWith(monthYear) || l.toDate.startsWith(monthYear))
    );

    const nightAllowance = nightPresentDays * 250;
    const payableDays = Math.min(presentDays + leaves.length, 30);
    const baseEarnings = emp.salaryType === 'monthly'
      ? Math.round((emp.baseSalary / 30) * payableDays)
      : Math.round(emp.baseSalary * presentDays);
    const gross = baseEarnings + nightAllowance;

    const finSummary = await this.getEmployeeFinancialSummary(employeeId, monthYear);
    const advanceDeduction = Math.min(finSummary?.activeAdvanceBalance || 0, gross);
    const net = Math.max(0, gross - advanceDeduction);

    const { data, error } = await supabase
      .from('payslips')
      .insert([
        {
          employee_id: employeeId,
          employee_name: emp.fullName,
          month_year: monthYear,
          total_days: 30,
          present_days: presentDays,
          night_present_days: nightPresentDays,
          leaves_taken: leaves.length,
          base_salary: emp.baseSalary,
          gross_earnings: gross,
          advance_deductions: advanceDeduction,
          net_payable: net,
          payment_status: 'UNPAID',
        },
      ])
      .select()
      .single();

    if (error || !data) {
      return { success: false, message: error?.message || 'Failed to generate payslip' };
    }

    return {
      success: true,
      payslip: {
        id: data.id,
        employeeId: data.employee_id,
        employeeName: data.employee_name,
        monthYear: data.month_year,
        totalDays: data.total_days,
        presentDays: data.present_days,
        nightPresentDays: data.night_present_days,
        leavesTaken: data.leaves_taken,
        baseSalary: Number(data.base_salary),
        grossEarnings: Number(data.gross_earnings),
        advanceDeductions: Number(data.advance_deductions),
        netPayable: Number(data.net_payable),
        paymentStatus: data.payment_status,
        generatedAt: data.generated_at,
      },
      message: `Payslip for ${monthYear} generated and saved to Supabase!`,
    };
  }
}

export const supabaseService = new SupabaseService();
