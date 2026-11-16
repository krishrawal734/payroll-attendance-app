import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { AttendanceRecord, Employee } from '../types';
import {
  shareAttendanceReportPdf,
  saveAttendanceReportPdfToPhone,
  promptAttendanceExportOptions,
  sharePayrollRegisterPdf,
  savePayrollRegisterPdfToPhone,
  promptPayrollExportOptions,
} from './pdfService';
import { Payslip } from '../types';

export class ExportService {
  // Helper to format values cleanly for CSV
  private escapeCsv(val: any): string {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  // 1. Export Attendance Sheet to Excel/CSV
  async exportAttendanceReport(
    records: AttendanceRecord[],
    employees: Employee[],
    periodLabel?: string
  ): Promise<{ success: boolean; uri?: string; error?: string }> {
    try {
      if (records.length === 0) {
        Alert.alert('Notice', 'No attendance logs found for the selected period.');
        return { success: false, error: 'No data to export' };
      }

      const headers = [
        'Date',
        'Day',
        'Employee ID',
        'Employee Name',
        'Mobile Number',
        'Designation',
        'Salary Model',
        'Base Rate (INR)',
        'Status',
        'Check-In Time',
        'Check-In GPS Lat/Lng',
        'Check-In Full Address',
        'Check-Out Time',
        'Check-Out GPS Lat/Lng',
        'Check-Out Full Address',
        'Work Duration (Hours)',
        'Night Present (>7 PM)',
        'Night Allowance (INR)',
        'Est. Day Wage (INR)',
        'Notes',
      ];

      const rows = records.map((rec) => {
        const emp = employees.find((e) => e.id === rec.employeeId);
        const empCode = `EMP-${rec.employeeId.slice(0, 5).toUpperCase()}`;

        // Day name
        const dParts = rec.date.split('-');
        let dayName = '';
        if (dParts.length === 3) {
          const dObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
          dayName = dObj.toLocaleDateString('en-IN', { weekday: 'short' });
        }

        // Times
        const inTime = rec.checkInTime ? new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'N/A';
        const outTime = rec.checkOutTime ? new Date(rec.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (rec.checkInTime ? 'Shift in Progress' : 'N/A');

        // Duration
        let durationStr = '--';
        if (rec.checkInTime && rec.checkOutTime) {
          const inD = new Date(rec.checkInTime);
          const outD = new Date(rec.checkOutTime);
          const diffMs = outD.getTime() - inD.getTime();
          if (diffMs > 0) {
            const totalM = Math.round(diffMs / 60000);
            const h = Math.floor(totalM / 60);
            const m = totalM % 60;
            durationStr = `${h}h ${m}m`;
          }
        }

        const inGps = rec.checkInLocation ? `${rec.checkInLocation.latitude.toFixed(5)}, ${rec.checkInLocation.longitude.toFixed(5)}` : 'N/A';
        const inAddr = rec.checkInLocation?.address || 'N/A';
        const outGps = rec.checkOutLocation ? `${rec.checkOutLocation.latitude.toFixed(5)}, ${rec.checkOutLocation.longitude.toFixed(5)}` : 'N/A';
        const outAddr = rec.checkOutLocation?.address || (rec.checkOutTime ? 'N/A' : 'Active Shift');
        const allowance = rec.isNightPresent ? 250 : 0;

        // Est Day wage
        let dayWage = 0;
        if (emp) {
          dayWage = (emp.salaryType === 'daily' ? emp.baseSalary : Math.round(emp.baseSalary / 30)) + allowance;
        }

        return [
          this.escapeCsv(rec.date),
          this.escapeCsv(dayName),
          this.escapeCsv(empCode),
          this.escapeCsv(emp?.fullName || 'Unknown Staff'),
          this.escapeCsv(emp?.mobileNumber || 'N/A'),
          this.escapeCsv(emp?.designation || 'Staff'),
          this.escapeCsv(emp?.salaryType?.toUpperCase() || 'MONTHLY'),
          this.escapeCsv(emp?.baseSalary || 0),
          this.escapeCsv(rec.status),
          this.escapeCsv(inTime),
          this.escapeCsv(inGps),
          this.escapeCsv(inAddr),
          this.escapeCsv(outTime),
          this.escapeCsv(outGps),
          this.escapeCsv(outAddr),
          this.escapeCsv(durationStr),
          this.escapeCsv(rec.isNightPresent ? 'YES' : 'NO'),
          this.escapeCsv(allowance),
          this.escapeCsv(dayWage),
          this.escapeCsv(rec.notes || ''),
        ].join(',');
      });

      // Include UTF-8 BOM so Excel opens with proper encoding
      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const safePeriod = (periodLabel || 'Full').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 25);
      const fileName = `Attendance_Report_${safePeriod}.csv`;
      const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      const fileUri = `${targetDir}${fileName}`;

      try {
        const info = await FileSystem.getInfoAsync(fileUri);
        if (info.exists) {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        }
      } catch {}

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${fileName}`,
        });
      }

      return { success: true, uri: fileUri };
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export attendance CSV');
      return { success: false, error: err.message };
    }
  }

  // 2. Export Payroll & Advance Ledger to Excel/CSV
  async exportPayrollReport(
    employees: Employee[],
    summaries: Record<string, any>,
    monthYear: string
  ): Promise<{ success: boolean; uri?: string; error?: string }> {
    try {
      const staff = employees.filter((e) => e.role === 'employee');

      if (staff.length === 0) {
        Alert.alert('Notice', 'No employee records found to generate payroll sheet.');
        return { success: false, error: 'No data' };
      }

      const headers = [
        'Employee Name',
        'Mobile Number',
        'Designation',
        'Salary Model',
        'Base Salary / Rate (INR)',
        'Present Days',
        'Night Shifts (>7 PM)',
        'Night Allowance (INR)',
        'Gross Earnings (INR)',
        'Advance Deductions (INR)',
        'Active Advance Due (INR)',
        'Net Take-Home Payable (INR)',
        'UPI ID for Transfer',
      ];

      const rows = staff.map((emp) => {
        const fin = summaries[emp.id];
        const presentDays = fin?.presentDays || 0;
        const nightShifts = fin?.nightPresentDays || 0;
        const nightBonus = nightShifts * 250;
        const gross = fin?.estimatedCurrentEarnings || 0;
        const activeAdv = fin?.activeAdvanceBalance || 0;
        const advanceDeduction = Math.min(activeAdv, 3000);
        const net = fin?.pendingPayable || 0;

        return [
          this.escapeCsv(emp.fullName),
          this.escapeCsv(emp.mobileNumber),
          this.escapeCsv(emp.designation),
          this.escapeCsv(emp.salaryType.toUpperCase()),
          this.escapeCsv(emp.baseSalary),
          this.escapeCsv(presentDays),
          this.escapeCsv(nightShifts),
          this.escapeCsv(nightBonus),
          this.escapeCsv(gross),
          this.escapeCsv(advanceDeduction),
          this.escapeCsv(activeAdv),
          this.escapeCsv(net),
          this.escapeCsv(emp.bankUpiId || 'Not Set'),
        ].join(',');
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const safeMonth = (monthYear || 'Month').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Payroll_Ledger_${safeMonth}.csv`;
      const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      const fileUri = `${targetDir}${fileName}`;

      try {
        const info = await FileSystem.getInfoAsync(fileUri);
        if (info.exists) {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
        }
      } catch {}

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const isAvailable = await Sharing.isAvailableAsync().catch(() => false);
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: `Export ${fileName}`,
        });
      }

      return { success: true, uri: fileUri };
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Failed to export payroll CSV');
      return { success: false, error: err.message };
    }
  }

  // 3. Export Attendance Report to PDF (Share or Save)
  async exportAttendancePdf(
    records: AttendanceRecord[],
    employees: Employee[],
    periodLabel: string = 'Current Month'
  ) {
    if (records.length === 0) {
      Alert.alert('Notice', 'No attendance logs found for the selected period.');
      return { success: false, error: 'No data to export' };
    }
    return await shareAttendanceReportPdf(records, employees, periodLabel);
  }

  // 4. Save Attendance PDF Directly to Phone
  async saveAttendancePdfToPhone(
    records: AttendanceRecord[],
    employees: Employee[],
    periodLabel: string = 'Current Month'
  ) {
    if (records.length === 0) {
      Alert.alert('Notice', 'No attendance logs found for the selected period.');
      return { success: false, error: 'No data to export' };
    }
    return await saveAttendanceReportPdfToPhone(records, employees, periodLabel);
  }

  // 5. Open Modal/Prompt for User Choice (PDF vs CSV)
  promptAttendanceExport(
    records: AttendanceRecord[],
    employees: Employee[],
    periodLabel: string = 'Current Month',
    onStartLoading?: () => void,
    onEndLoading?: () => void
  ) {
    if (records.length === 0) {
      Alert.alert('Notice', 'No attendance logs found to export.');
      return;
    }

    promptAttendanceExportOptions(
      records,
      employees,
      periodLabel,
      async () => {
        onStartLoading?.();
        await this.exportAttendanceReport(records, employees);
        onEndLoading?.();
      },
      onStartLoading,
      onEndLoading
    );
  }

  // 6. Export Payroll Register to PDF (Share Directly)
  async exportPayrollPdf(
    employees: Employee[],
    summaries: Record<string, any>,
    monthYear: string,
    payslips: Payslip[] = []
  ) {
    return await sharePayrollRegisterPdf(employees, summaries, monthYear, payslips);
  }

  // 7. Save Payroll Register Directly to Phone
  async savePayrollPdfToPhone(
    employees: Employee[],
    summaries: Record<string, any>,
    monthYear: string,
    payslips: Payslip[] = []
  ) {
    return await savePayrollRegisterPdfToPhone(employees, summaries, monthYear, payslips);
  }

  // 8. Open Modal/Prompt for Payroll Export
  promptPayrollExport(
    employees: Employee[],
    summaries: Record<string, any>,
    monthYear: string,
    payslips: Payslip[] = [],
    onStartLoading?: () => void,
    onEndLoading?: () => void
  ) {
    promptPayrollExportOptions(
      employees,
      summaries,
      monthYear,
      payslips,
      async () => {
        onStartLoading?.();
        await this.exportPayrollReport(employees, summaries, monthYear);
        onEndLoading?.();
      },
      onStartLoading,
      onEndLoading
    );
  }
}

export const exportService = new ExportService();
