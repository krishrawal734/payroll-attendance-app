import { supabase } from './supabaseClient';
import { db } from './mockDatabase';
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

export class SupabaseService {
  // Helper to check if string is valid UUID
  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  }

  // Helper to map Supabase employee row to Employee type
  private mapEmployee(d: any): Employee {
    return {
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
      totpSecret: d.totp_secret ?? null,
      is2faEnabled: Boolean(d.is_2fa_enabled && d.totp_secret),
    };
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

      const user = this.mapEmployee(data);
      return { success: true, user, message: 'Account verified' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Supabase connection failed' };
    }
  }

  async saveTotpSecret(employeeId: string, secret: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          totp_secret: secret,
          is_2fa_enabled: true,
        })
        .eq('id', employeeId);

      if (error) {
        if (error.message?.includes('totp_secret') || error.message?.includes('is_2fa_enabled')) {
          return {
            success: false,
            message:
              'Database is missing 2FA columns. Please run supabase-2fa-migration.sql in your Supabase SQL Editor first.',
          };
        }
        return { success: false, message: error.message || 'Failed to save Google Authenticator setup' };
      }

      return { success: true, message: 'Google Authenticator linked successfully!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to save Authenticator setup' };
    }
  }

  async resetTotp(employeeId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('employees')
        .update({
          totp_secret: null,
          is_2fa_enabled: false,
        })
        .eq('id', employeeId);

      if (error) {
        return { success: false, message: error.message || 'Failed to reset Google Authenticator' };
      }

      return {
        success: true,
        message: 'Google Authenticator reset. The user will be prompted to set it up again on next login.',
      };
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to reset Authenticator' };
    }
  }

  async getEmployees(): Promise<Employee[]> {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) return [];

    return data.map((d: any) => this.mapEmployee(d));
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
    return this.mapEmployee(data);
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

  // Helper to map Supabase attendance row to AttendanceRecord
  private mapAttendance(d: any): AttendanceRecord {
    return {
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
    };
  }

  /**
   * Automatically punches out any open shift whose 5:00 AM Night Shift cutoff has passed.
   * Ensures reliable auto punch-out at 5:00 AM even if the phone was off overnight.
   */
  private async processAutoNightCheckouts(employeeId?: string): Promise<void> {
    try {
      let query = supabase
        .from('attendance')
        .select('*')
        .not('check_in_time', 'is', null)
        .is('check_out_time', null);

      if (employeeId) {
        if (!this.isUUID(employeeId)) return;
        query = query.eq('employee_id', employeeId);
      }

      const { data: openRows } = await query;
      if (!openRows || openRows.length === 0) return;

      const now = new Date();
      for (const row of openRows) {
        const { shouldAutoClose, cutoffTime } = evaluateAutoCheckout(
          {
            date: row.date,
            checkInTime: row.check_in_time,
            checkOutTime: row.check_out_time,
          },
          now
        );

        if (shouldAutoClose) {
          await supabase
            .from('attendance')
            .update({
              check_out_time: cutoffTime.toISOString(),
              check_out_address: AUTO_CHECKOUT_ADDRESS,
              is_night_present: true,
              notes: AUTO_CHECKOUT_NOTE,
            })
            .eq('id', row.id);
        }
      }
    } catch {
      // Non-fatal — retry on next load
    }
  }

  // --- Attendance ---
  async getAttendance(employeeId?: string): Promise<AttendanceRecord[]> {
    if (employeeId && !this.isUUID(employeeId)) {
      return db.getAttendance(employeeId);
    }

    await this.processAutoNightCheckouts(employeeId);

    let query = supabase.from('attendance').select('*').order('date', { ascending: false });
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    const { data, error } = await query;
    if (error || !data) return [];

    return data.map((d: any) => this.mapAttendance(d));
  }

  async getTodayAttendance(employeeId: string): Promise<AttendanceRecord | undefined> {
    if (!this.isUUID(employeeId)) {
      return db.getTodayAttendance(employeeId);
    }

    await this.processAutoNightCheckouts(employeeId);

    // 1. Check if employee has an active open overnight shift (e.g., 9 PM – 4:59 AM)
    const { data: openShift } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (openShift) {
      return this.mapAttendance(openShift);
    }

    // 2. Otherwise fetch today's local date record
    const today = getLocalDateStr();
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('date', today)
      .maybeSingle();

    if (error || !data) return undefined;
    return this.mapAttendance(data);
  }

  async checkIn(employeeId: string, loc: AttendanceLocation): Promise<{ success: boolean; message: string }> {
    if (!this.isUUID(employeeId)) {
      const res = db.checkIn(employeeId, loc);
      return { success: res.success, message: res.message };
    }

    await this.processAutoNightCheckouts(employeeId);

    // Prevent check-in if an overnight shift is still open
    const { data: activeOpen } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)
      .limit(1)
      .maybeSingle();

    if (activeOpen) {
      return { success: false, message: 'You already have an active open shift. Please punch out first.' };
    }

    const today = getLocalDateStr();
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
    if (!this.isUUID(employeeId)) {
      const res = db.checkOut(employeeId, loc);
      return { success: res.success, isNightPresent: res.record?.isNightPresent, message: res.message };
    }

    await this.processAutoNightCheckouts(employeeId);

    // Find active open shift (supports overnight 9 PM – 5 AM checkout after midnight)
    const { data: openShift } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employeeId)
      .not('check_in_time', 'is', null)
      .is('check_out_time', null)
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!openShift) {
      const today = getLocalDateStr();
      const { data: todayRow } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('date', today)
        .maybeSingle();

      if (todayRow?.check_out_time) {
        return { success: false, message: 'You have already checked out for today.' };
      }
      return { success: false, message: 'Please check in first before checking out.' };
    }

    const now = new Date();
    const isNightPresent = isNightShiftManualCheckout(now); // true only 9:00 PM – 4:59 AM
    const inGrace = isInGraceWindow(now); // 7:00 PM – 8:59 PM

    const { error } = await supabase
      .from('attendance')
      .update({
        check_out_time: now.toISOString(),
        check_out_lat: loc.latitude,
        check_out_lng: loc.longitude,
        check_out_address: loc.address,
        is_night_present: isNightPresent,
        notes: inGrace
          ? 'Punched out during 7:00 PM – 9:00 PM grace window (before Night Shift)'
          : isNightPresent
            ? 'Night Shift Punch-Out (9:00 PM – 5:00 AM)'
            : undefined,
      })
      .eq('id', openShift.id);

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      isNightPresent,
      message: isNightPresent
        ? 'Checked out during Night Shift (9:00 PM – 5:00 AM)! Marked as Night Present (+₹250).'
        : inGrace
          ? 'Checked out before 9:00 PM Night Shift start (regular Day Shift recorded).'
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
    return { success: true, message: 'Leave application submitted successfully.' };
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

    const [txs, attendance, leaves] = await Promise.all([
      this.getTransactions(employeeId),
      this.getAttendance(employeeId),
      this.getLeaves(employeeId),
    ]);

    return computeEmployeeMonthlyPayroll(emp, attendance, leaves, txs, monthYear);
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
      presentDays: Number(d.present_days),
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

    const [txs, attendance, leaves] = await Promise.all([
      this.getTransactions(employeeId),
      this.getAttendance(employeeId),
      this.getLeaves(employeeId),
    ]);

    const calc = computeEmployeeMonthlyPayroll(emp, attendance, leaves, txs, monthYear);
    const gross = calc.estimatedCurrentEarnings;
    const advanceDeduction = calc.advanceDeduction;
    const net = calc.netPayableForMonth;
    const paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' =
      calc.salaryPaidForMonth > 0
        ? calc.salaryPaidForMonth >= net
          ? 'PAID'
          : 'PARTIAL'
        : 'UNPAID';

    const { data: existing } = await supabase
      .from('payslips')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('month_year', monthYear)
      .maybeSingle();

    if (existing) {
      // Recalculate and update the existing payslip with verified attendance
      const { data, error } = await supabase
        .from('payslips')
        .update({
          present_days: calc.presentDays,
          night_present_days: calc.nightPresentDays,
          leaves_taken: calc.leavesTaken,
          base_salary: emp.baseSalary,
          gross_earnings: gross,
          advance_deductions: advanceDeduction,
          net_payable: net,
          payment_status: paymentStatus,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error || !data) {
        return { success: false, message: error?.message || 'Failed to update payslip' };
      }

      return {
        success: true,
        payslip: {
          id: data.id,
          employeeId: data.employee_id,
          employeeName: data.employee_name,
          monthYear: data.month_year,
          totalDays: data.total_days,
          presentDays: Number(data.present_days),
          nightPresentDays: data.night_present_days,
          leavesTaken: data.leaves_taken,
          baseSalary: Number(data.base_salary),
          grossEarnings: Number(data.gross_earnings),
          advanceDeductions: Number(data.advance_deductions),
          netPayable: Number(data.net_payable),
          paymentStatus: data.payment_status,
          generatedAt: data.generated_at,
        },
        message: 'Payslip refreshed & updated with latest verified attendance.',
      };
    }

    const { data, error } = await supabase
      .from('payslips')
      .insert([
        {
          employee_id: employeeId,
          employee_name: emp.fullName,
          month_year: monthYear,
          total_days: 30,
          present_days: calc.presentDays,
          night_present_days: calc.nightPresentDays,
          leaves_taken: calc.leavesTaken,
          base_salary: emp.baseSalary,
          gross_earnings: gross,
          advance_deductions: advanceDeduction,
          net_payable: net,
          payment_status: paymentStatus,
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
        presentDays: Number(data.present_days),
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

  /**
   * Records a salary disbursal, automatically settles any active advance deduction
   * for that month (without ever double-deducting), and updates the payslip status
   * to PAID or PARTIAL.
   */
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
    if (!this.isUUID(params.employeeId)) {
      return db.settleSalaryPayment(params);
    }

    const emp = await this.getEmployeeById(params.employeeId);
    if (!emp) return { success: false, message: 'Employee not found.' };

    // Snapshot pre-payment calculation to know exact remaining advance recovery for this month
    const [txsBefore, attendance, leaves] = await Promise.all([
      this.getTransactions(params.employeeId),
      this.getAttendance(params.employeeId),
      this.getLeaves(params.employeeId),
    ]);
    const calcBefore = computeEmployeeMonthlyPayroll(emp, attendance, leaves, txsBefore, params.monthYear);

    // 1. Record SALARY_PAYMENT transaction
    const payRes = await this.recordTransaction({
      employeeId: params.employeeId,
      employeeName: params.employeeName,
      type: 'SALARY_PAYMENT',
      amount: params.amount,
      paymentMode: params.paymentMode,
      referenceId: params.referenceId,
      paymentDate: params.paymentDate,
      notes: params.notes || `Salary disbursal for ${params.monthYear} via ${params.paymentMode}`,
    });

    if (!payRes.success) {
      return { success: false, message: payRes.message };
    }

    // 2. Auto-settle any unrecovered advance deduction for this month (never double-deducts)
    let advanceRecovered = 0;
    if (calcBefore.additionalAdvanceToRecover > 0) {
      const dedRes = await this.recordTransaction({
        employeeId: params.employeeId,
        employeeName: params.employeeName,
        type: 'DEDUCTION',
        amount: calcBefore.additionalAdvanceToRecover,
        paymentMode: params.paymentMode,
        referenceId: params.referenceId,
        paymentDate: params.paymentDate,
        notes: getAdvanceRecoveryNote(params.monthYear),
      });
      if (dedRes.success) {
        advanceRecovered = calcBefore.additionalAdvanceToRecover;
      }
    }

    // 3. Recompute total paid for the month and update payslip status (PAID or PARTIAL)
    const totalPaidForMonth = calcBefore.salaryPaidForMonth + params.amount;
    const { data: existingSlip } = await supabase
      .from('payslips')
      .select('*')
      .eq('employee_id', params.employeeId)
      .eq('month_year', params.monthYear)
      .maybeSingle();

    const targetNet = existingSlip ? Number(existingSlip.net_payable) : calcBefore.netPayableForMonth;
    const newStatus: 'PAID' | 'PARTIAL' = totalPaidForMonth >= targetNet ? 'PAID' : 'PARTIAL';

    if (existingSlip) {
      await supabase
        .from('payslips')
        .update({ payment_status: newStatus })
        .eq('id', existingSlip.id);
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

  async deletePayslip(id: string): Promise<{ success: boolean; message: string }> {
    if (!this.isUUID(id)) {
      return db.deletePayslip(id);
    }
    const { error } = await supabase.from('payslips').delete().eq('id', id);
    if (error) {
      return { success: false, message: error.message || 'Failed to delete payslip' };
    }
    return { success: true, message: 'Payslip deleted successfully.' };
  }
}

export const supabaseService = new SupabaseService();
