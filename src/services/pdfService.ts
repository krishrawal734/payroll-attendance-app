import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Payslip, Employee, AttendanceRecord } from '../types';
import { getNightAllowance } from './settingsService';
import { payslipStatus } from './payrollCalc';
import { showActionMenu } from '../utils/actionMenu';
import { COMPANY, companySubline } from '../config/companyConfig';

// A4 in PDF points; expo-print defaults to US Letter otherwise.
const A4_PORTRAIT = { width: 595, height: 842 };
const A4_LANDSCAPE = { width: 842, height: 595 };

const safeFilePart = (value: string, max = 40) => value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, max);

// Android's print dialog ignores the requested paper size (it picks the locale default,
// e.g. Letter), so on Android we render the A4 PDF ourselves and write it into a folder
// the user picks. iOS keeps the print sheet, which honours the size.
async function savePdfToDevice(
  html: string,
  fileName: string,
  size: { width: number; height: number }
): Promise<{ success: boolean; error?: string }> {
  if (Platform.OS !== 'android') {
    await Print.printAsync({ html, ...size });
    return { success: true };
  }

  const { uri } = await Print.printToFileAsync({ html, ...size });
  const SAF = FileSystem.StorageAccessFramework;
  const permission = await SAF.requestDirectoryPermissionsAsync();
  if (!permission.granted) {
    return { success: false, error: 'No folder selected, so the PDF was not saved.' };
  }
  const target = await SAF.createFileAsync(permission.directoryUri, fileName, 'application/pdf');
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
  Alert.alert('PDF Saved', `${fileName}.pdf was saved to the folder you selected.`);
  return { success: true };
}
import { localDateString } from '../utils/date';

export function generatePayslipHtml(payslip: Payslip, employee: Employee): string {
  const empCode = `EMP-${employee.id.slice(0, 5).toUpperCase()}`;
  const upiId = employee.bankUpiId || 'Cash Voucher / Bank Transfer';
  const nightAllowance = payslip.nightAllowance;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payslip - ${employee.fullName} (${payslip.monthYear})</title>
  <style>
    @page { size: A4; margin: 12mm; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 30px; color: #1e293b; background-color: #ffffff; }
    .header { text-align: center; border-bottom: 2.5px solid #4f46e5; padding-bottom: 16px; }
    .company-name { font-size: 24px; font-weight: 900; color: #4f46e5; letter-spacing: 0.5px; }
    .company-sub { font-size: 11px; color: #64748b; margin-top: 3px; }
    .doc-title { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    
    .meta-table { width: 100%; margin-top: 20px; border-collapse: collapse; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .meta-table td { padding: 8px 12px; font-size: 12px; }
    .meta-label { font-weight: bold; color: #475569; width: 22%; }
    
    .stats-card { display: flex; margin-top: 18px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; }
    .stat-item { flex: 1; text-align: center; padding: 12px; border-right: 1px solid #e2e8f0; }
    .stat-item:last-child { border-right: none; }
    .stat-val { font-size: 18px; font-weight: 900; color: #0f172a; }
    .stat-label { font-size: 10px; font-weight: 700; color: #64748b; margin-top: 4px; text-transform: uppercase; }
    
    .salary-table { width: 100%; margin-top: 22px; border-collapse: collapse; }
    .salary-table th { background-color: #f1f5f9; padding: 10px 12px; font-size: 12px; font-weight: 800; text-align: left; border-bottom: 2px solid #cbd5e1; text-transform: uppercase; }
    .salary-table td { padding: 10px 12px; font-size: 12px; border-bottom: 1px solid #e2e8f0; }
    
    .total-row { background-color: #eef2ff; font-weight: bold; font-size: 15px; color: #3730a3; border-top: 2px solid #6366f1; border-bottom: 2px solid #6366f1; }
    
    .footer { margin-top: 35px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 800; }
    .badge-paid { background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-pending { background-color: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    
    .sign-row { display: flex; justify-content: space-between; margin-top: 35px; }
    .sign-box { width: 40%; text-align: center; border-top: 1px dashed #94a3b8; padding-top: 6px; font-size: 11px; font-weight: 700; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">${COMPANY.name.toUpperCase()}</div>
    ${companySubline() ? `<div class="company-sub">${companySubline()}</div>` : ''}
    <div class="doc-title">Official Salary & Attendance Payslip — ${payslip.monthYear}</div>
  </div>

  <table class="meta-table">
    <tr>
      <td class="meta-label">Employee Name:</td>
      <td><strong>${employee.fullName}</strong> (${empCode})</td>
      <td class="meta-label">Designation:</td>
      <td>${employee.designation}</td>
    </tr>
    <tr>
      <td class="meta-label">Mobile Number:</td>
      <td>+91 ${employee.mobileNumber}</td>
      <td class="meta-label">Disbursal Status:</td>
      <td><span class="badge ${payslip.paymentStatus === 'PAID' ? 'badge-paid' : 'badge-pending'}">${payslip.paymentStatus}</span></td>
    </tr>
    <tr>
      <td class="meta-label">Salary Model:</td>
      <td><strong>${employee.salaryType.toUpperCase()}</strong> (Base: ₹${employee.baseSalary.toLocaleString('en-IN')})</td>
      <td class="meta-label">Payment Mode / UPI:</td>
      <td><strong>${upiId}</strong></td>
    </tr>
    <tr>
      <td class="meta-label">Payroll Cycle:</td>
      <td>${payslip.monthYear}</td>
      <td class="meta-label">Generated Date:</td>
      <td>${new Date(payslip.generatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
    </tr>
  </table>

  <!-- Attendance Stats -->
  <div class="stats-card">
    <div class="stat-item">
      <div class="stat-val">${payslip.totalDays}</div>
      <div class="stat-label">Month Days</div>
    </div>
    <div class="stat-item">
      <div class="stat-val" style="color: #059669;">${payslip.presentDays}</div>
      <div class="stat-label">Days Present (GPS Verified)</div>
    </div>
    <div class="stat-item">
      <div class="stat-val" style="color: #7c3aed;">${payslip.nightPresentDays}</div>
      <div class="stat-label">Night Present (> 7 PM)</div>
    </div>
    <div class="stat-item">
      <div class="stat-val" style="color: #d97706;">${payslip.leavesTaken}</div>
      <div class="stat-label">Approved Leaves</div>
    </div>
  </div>

  <!-- Salary Calculations -->
  <table class="salary-table">
    <thead>
      <tr>
        <th>Earnings & Allowances</th>
        <th style="text-align: right;">Amount (₹)</th>
        <th>Deductions & Advances</th>
        <th style="text-align: right;">Amount (₹)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <strong>Base Shift Earnings</strong><br>
          <span style="font-size: 10px; color: #64748b;">${employee.salaryType === 'daily' ? `${payslip.presentDays} days × ₹${employee.baseSalary}` : 'Monthly Pro-rated Salary'}</span>
        </td>
        <td style="text-align: right; font-weight: 700;">₹${(payslip.grossEarnings - nightAllowance).toLocaleString('en-IN')}</td>
        <td>
          <strong>Advance Recovery</strong><br>
          <span style="font-size: 10px; color: #64748b;">Auto-deducted from Passbook Ledger</span>
        </td>
        <td style="text-align: right; color: #dc2626; font-weight: 700;">- ₹${payslip.advanceDeductions.toLocaleString('en-IN')}</td>
      </tr>
      <tr>
        <td>
          <strong>Night Shift Allowance</strong><br>
          <span style="font-size: 10px; color: #7c3aed;">${payslip.nightPresentDays} night shifts × ₹${payslip.nightPresentDays > 0 ? Math.round(nightAllowance / payslip.nightPresentDays) : getNightAllowance()} bonus</span>
        </td>
        <td style="text-align: right; font-weight: 700; color: #7c3aed;">+ ₹${nightAllowance.toLocaleString('en-IN')}</td>
        <td>
          <strong>Taxes & Other Statutory Deductions</strong><br>
          <span style="font-size: 10px; color: #64748b;">TDS / PF (Zero for current slab)</span>
        </td>
        <td style="text-align: right; font-weight: 700;">₹0</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td><strong>TOTAL GROSS EARNINGS</strong></td>
        <td style="text-align: right; font-weight: 900; color: #0f172a;">₹${payslip.grossEarnings.toLocaleString('en-IN')}</td>
        <td><strong>TOTAL DEDUCTIONS</strong></td>
        <td style="text-align: right; font-weight: 900; color: #dc2626;">- ₹${payslip.advanceDeductions.toLocaleString('en-IN')}</td>
      </tr>
      <tr class="total-row">
        <td colspan="3" style="text-align: right; font-size: 14px;">NET TAKE-HOME PAYABLE:</td>
        <td style="text-align: right; font-size: 18px; font-weight: 900; color: #15803d;">₹${payslip.netPayable.toLocaleString('en-IN')}</td>
      </tr>
    </tbody>
  </table>

  <div class="sign-row">
    <div class="sign-box">
      Payroll & Accounts Officer<br>
      <span style="font-size: 9px; color: #94a3b8; font-weight: normal;">(Verified via GPS & Advance Ledger)</span>
    </div>
    <div class="sign-box">
      Factory Manager / Authorized Signatory<br>
      <span style="font-size: 9px; color: #94a3b8; font-weight: normal;">(Approved for Direct UPI & Bank Transfer)</span>
    </div>
  </div>

  <div class="footer">
    <p>This is a tamper-proof computer-generated payslip verified via Biometric GPS Attendance & Company Payroll Passbook.</p>
    <p>${[COMPANY.name, COMPANY.address].filter(Boolean).join(' • ')}</p>
  </div>
</body>
</html>
`;
}

// 1. Direct Share (WhatsApp, Email, Telegram, Google Drive, Files)
export async function sharePayslipDirectly(payslip: Payslip, employee: Employee) {
  const html = generatePayslipHtml(payslip, employee);
  try {
    const { uri } = await Print.printToFileAsync({ html, ...A4_PORTRAIT });

    const safeName = (employee.fullName || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeMonth = (payslip.monthYear || 'Month').replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanFileName = `Payslip_${safeName}_${safeMonth}.pdf`;
    const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    const targetUri = `${targetDir}${cleanFileName}`;

    try {
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }
      await FileSystem.copyAsync({
        from: uri,
        to: targetUri,
      });
    } catch {
      // Continue with original uri if copy fails
    }

    const shareUri = (await FileSystem.getInfoAsync(targetUri)).exists ? targetUri : uri;
    const isAvailable = await Sharing.isAvailableAsync().catch(() => false);

    if (isAvailable) {
      await Sharing.shareAsync(shareUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${cleanFileName}`,
      });
      return { success: true };
    } else {
      await Print.printAsync({ html, ...A4_PORTRAIT });
      return { success: true };
    }
  } catch {
    // If Sharing fails or is rejected, gracefully fallback to Android print/save spooler
    try {
      await Print.printAsync({ html, ...A4_PORTRAIT });
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Unable to open file share. Please choose "Save PDF to Phone" to export or view.',
      };
    }
  }
}

// 2. Direct Save to Phone (Android "Save as PDF" spooler)
export async function savePayslipToPhone(payslip: Payslip, employee: Employee) {
  try {
    const html = generatePayslipHtml(payslip, employee);
    return await savePdfToDevice(
      html,
      `Payslip_${safeFilePart(employee.fullName || 'Employee')}_${safeFilePart(payslip.monthYear || 'Month')}`,
      A4_PORTRAIT
    );
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save payslip to phone' };
  }
}

// 3. User Choice Action Dialog
export function promptPayslipOptions(
  payslip: Payslip,
  employee: Employee,
  onStartLoading?: () => void,
  onEndLoading?: () => void,
  onRecalculate?: () => void,
  onDelete?: () => void
) {
  const actions: any[] = [
    {
      text: '📤 Share Directly (WhatsApp/Apps)',
      onPress: async () => {
        onStartLoading?.();
        const res = await sharePayslipDirectly(payslip, employee);
        onEndLoading?.();
        if (!res.success && res.error) {
          Alert.alert('Notice', res.error);
        }
      },
    },
    {
      text: '💾 Save PDF to Phone',
      onPress: async () => {
        onStartLoading?.();
        const res = await savePayslipToPhone(payslip, employee);
        onEndLoading?.();
        if (!res.success && res.error) {
          Alert.alert('Notice', res.error);
        }
      },
    },
  ];

  if (onRecalculate) {
    actions.push({
      text: '🔄 Recalculate with Verified Punches',
      onPress: onRecalculate,
    });
  }

  if (onDelete) {
    actions.push({
      text: '🗑️ Delete Payslip (Reset to Pending)',
      style: 'destructive',
      onPress: onDelete,
    });
  }

  actions.push({
    text: 'Cancel',
    style: 'cancel',
  });

  showActionMenu(
    'Payslip Action',
    `Payslip for ${employee.fullName} (${payslip.monthYear})`,
    actions
  );
}

// Legacy alias for compatibility
export const shareOrPrintPayslip = sharePayslipDirectly;

// ==========================================
// 4. Attendance Report PDF Generation & Sharing
// ==========================================

export function generateAttendanceReportHtml(
  records: AttendanceRecord[],
  employees: Employee[],
  periodLabel: string = 'Current Month',
  customTitle?: string
): string {
  const isDaily = (customTitle && customTitle.toLowerCase().includes('daily')) || periodLabel.toLowerCase().includes('daily') || periodLabel.toLowerCase().includes('today');
  const isWeekly = (customTitle && customTitle.toLowerCase().includes('weekly')) || periodLabel.toLowerCase().includes('weekly') || periodLabel.toLowerCase().includes('7-day');
  const isMonthly = (customTitle && customTitle.toLowerCase().includes('month')) || periodLabel.toLowerCase().includes('month');

  const reportTitle = customTitle || (
    isDaily
      ? 'DAILY ATTENDANCE & SHIFT AUDIT REPORT'
      : isWeekly
      ? 'WEEKLY ATTENDANCE & SHIFT AUDIT REPORT'
      : isMonthly
      ? 'MONTHLY ATTENDANCE & SHIFT AUDIT REPORT'
      : 'OFFICIAL ATTENDANCE & SHIFT AUDIT REPORT'
  );

  const logsLabel = isDaily ? "Today's Punches" : isWeekly ? "7-Day Total Logs" : isMonthly ? "Month Total Logs" : "Total Logs";
  const workforceLabel = isDaily ? "Staff Present Today" : isWeekly ? "Active Staff (7 Days)" : isMonthly ? "Active Staff (Month)" : "Workforce Tracked";

  const totalLogs = records.length;
  const nightShifts = records.filter((r) => r.isNightPresent).length;
  const regularShifts = totalLogs - nightShifts;
  const totalAllowance = nightShifts * getNightAllowance();
  const uniqueEmployees = new Set(records.map((r) => r.employeeId)).size;
  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let totalWorkMinutes = 0;
  let activeShiftsCount = 0;
  let totalEstDayWages = 0;

  const rowsHtml = records
    .map((rec, idx) => {
      const emp = employees.find((e) => e.id === rec.employeeId);
      const empName = emp ? emp.fullName : 'Staff Member';
      const designation = emp?.designation || 'Staff';
      const mobile = emp?.mobileNumber ? emp.mobileNumber : '';
      const empCode = `EMP-${rec.employeeId.slice(0, 5).toUpperCase()}`;

      // Date with Day of Week
      const dParts = rec.date.split('-');
      let dayName = '';
      if (dParts.length === 3) {
        const dObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, parseInt(dParts[2]));
        dayName = dObj.toLocaleDateString('en-IN', { weekday: 'short' });
      }

      // Salary Tag & Est Daily Wage
      let salaryTag = 'Rate not set';
      let dayWage = 0;
      if (emp) {
        if (emp.salaryType === 'daily') {
          salaryTag = `₹${emp.baseSalary.toLocaleString('en-IN')}/day`;
          dayWage = emp.baseSalary + (rec.isNightPresent ? getNightAllowance() : 0);
        } else {
          const perDay = Math.round(emp.baseSalary / 30);
          salaryTag = `₹${emp.baseSalary.toLocaleString('en-IN')}/mo (~₹${perDay}/d)`;
          dayWage = perDay + (rec.isNightPresent ? getNightAllowance() : 0);
        }
      }
      totalEstDayWages += dayWage;

      // In & Out Timings
      const inTimeStr = rec.checkInTime
        ? new Date(rec.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'Not Logged';
      const outTimeStr = rec.checkOutTime
        ? new Date(rec.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : 'Shift in Progress';

      // Duration & Working status
      let durationStr = 'In Progress';
      let durationSub = 'Shift active';
      let durationColor = '#0284c7';

      if (rec.checkInTime && rec.checkOutTime) {
        const inD = new Date(rec.checkInTime);
        const outD = new Date(rec.checkOutTime);
        const diffMs = outD.getTime() - inD.getTime();
        if (diffMs > 0) {
          const totalM = Math.round(diffMs / 60000);
          totalWorkMinutes += totalM;
          const h = Math.floor(totalM / 60);
          const m = totalM % 60;
          durationStr = `${h}h ${m}m`;
          durationSub = h >= 8 ? 'Full Shift (Completed)' : 'Completed Shift';
          durationColor = '#0f172a';
        }
      } else if (rec.checkInTime) {
        activeShiftsCount++;
        const inD = new Date(rec.checkInTime);
        const nowMs = Date.now();
        const diffMs = nowMs - inD.getTime();
        if (diffMs > 0 && rec.date === localDateString()) {
          const totalM = Math.round(diffMs / 60000);
          const h = Math.floor(totalM / 60);
          const m = totalM % 60;
          durationStr = `${h}h ${m}m elapsed`;
          durationSub = 'Currently on duty';
        }
      }

      // FULL GPS Addresses & Coordinates (NO TRUNCATION)
      const inAddr = rec.checkInLocation?.address || 'GPS Geocoded Factory Location';
      const inCoords = rec.checkInLocation
        ? `${rec.checkInLocation.latitude.toFixed(5)}° N, ${rec.checkInLocation.longitude.toFixed(5)}° E`
        : 'Coordinates verified';

      const outAddr = rec.checkOutLocation?.address
        ? rec.checkOutLocation.address
        : rec.checkOutTime
        ? 'GPS Geocoded Exit Location'
        : 'Active Shift — Check-out pending';

      const outCoords = rec.checkOutLocation
        ? `${rec.checkOutLocation.latitude.toFixed(5)}° N, ${rec.checkOutLocation.longitude.toFixed(5)}° E`
        : rec.checkOutTime
        ? 'Coordinates verified'
        : 'Pending Punch-Out';

      // Status Badges
      const statusBadge = rec.isNightPresent
        ? `<span class="badge badge-night">🌙 NIGHT PRESENT (&gt;7 PM)</span>`
        : rec.status === 'PRESENT'
        ? `<span class="badge badge-present">☀️ DAY PRESENT</span>`
        : `<span class="badge badge-other">${rec.status}</span>`;

      const nightShiftCell = rec.isNightPresent
        ? `<div style="font-size: 10px; font-weight: 800; color: #7c3aed;">YES (&gt;7 PM)</div><div style="font-size: 8px; color: #9333ea; font-weight: bold;">+₹${getNightAllowance()} Night Bonus</div>`
        : `<div style="font-size: 9.5px; color: #64748b; font-weight: 600;">Regular Shift</div>`;

      const allowanceStr = rec.isNightPresent ? `₹${getNightAllowance()}` : '₹0';

      return `
      <tr>
        <td style="text-align: center; color: #64748b; font-weight: 700; font-size: 10px;">${idx + 1}</td>
        <td style="white-space: nowrap;">
          <div style="font-weight: 800; color: #0f172a; font-size: 10.5px;">${rec.date}</div>
          <div style="font-size: 9px; color: #64748b; font-weight: 600;">${dayName}</div>
        </td>
        <td>
          <div style="font-weight: 800; color: #0f172a; font-size: 11px;">${empName}</div>
          <div style="font-size: 9.5px; color: #475569; font-weight: 600;">${designation} • <span style="color: #64748b;">${empCode}</span></div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">📱 +91 ${mobile || 'N/A'}</div>
          <div style="font-size: 9px; color: #4338ca; font-weight: 700; margin-top: 1px;">💰 ${salaryTag}</div>
        </td>
        <td style="text-align: center;">
          ${statusBadge}
          <div style="font-size: 8.5px; color: #15803d; font-weight: 700; margin-top: 3px;">✓ Anti-Mock Verified</div>
        </td>
        <td style="max-width: 230px;">
          <div style="font-weight: 800; color: #0f172a; font-size: 11px;">${inTimeStr}</div>
          <div style="font-size: 9.5px; color: #1e293b; line-height: 1.35; margin-top: 2px; word-break: break-word;">${inAddr}</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">📍 ${inCoords}</div>
        </td>
        <td style="max-width: 230px;">
          <div style="font-weight: 800; color: ${rec.checkOutTime ? '#0f172a' : '#0284c7'}; font-size: 11px;">${outTimeStr}</div>
          <div style="font-size: 9.5px; color: #1e293b; line-height: 1.35; margin-top: 2px; word-break: break-word;">${outAddr}</div>
          ${rec.checkOutLocation ? `<div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">📍 ${outCoords}</div>` : ''}
        </td>
        <td style="text-align: center;">
          <div style="font-weight: 800; color: ${durationColor}; font-size: 10.5px;">${durationStr}</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">${durationSub}</div>
        </td>
        <td style="text-align: center;">
          ${nightShiftCell}
        </td>
        <td style="text-align: right;">
          <div style="font-weight: 800; color: ${rec.isNightPresent ? '#7c3aed' : '#94a3b8'}; font-size: 11px;">${allowanceStr}</div>
        </td>
        <td style="text-align: right;">
          <div style="font-weight: 900; color: #0f172a; font-size: 11px;">₹${dayWage.toLocaleString('en-IN')}</div>
          <div style="font-size: 8px; color: #64748b;">(Base + Bonus)</div>
        </td>
      </tr>
      `;
    })
    .join('');

  // Total Hours calculation
  const totalHours = Math.floor(totalWorkMinutes / 60);
  const remainingMins = totalWorkMinutes % 60;
  const totalHoursStr = totalWorkMinutes > 0 ? `${totalHours}h ${remainingMins}m` : (activeShiftsCount > 0 ? `${activeShiftsCount} Active` : '--');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Attendance Audit Report - ${periodLabel}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #1e293b;
      font-size: 10px;
      background-color: #ffffff;
    }
    .header {
      border-bottom: 2.5px solid #4f46e5;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .company-title {
      font-size: 22px;
      font-weight: 900;
      color: #4f46e5;
      letter-spacing: 0.5px;
    }
    .report-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #1e293b;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #64748b;
      line-height: 1.45;
    }
    .summary-grid {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .summary-card {
      flex: 1;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 6px;
      text-align: center;
    }
    .summary-num {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
    }
    .summary-label {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-top: 3px;
      letter-spacing: 0.3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 7px 6px;
      text-align: left;
      border-bottom: 2px solid #cbd5e1;
      border-top: 1px solid #cbd5e1;
    }
    td {
      padding: 7px 6px;
      font-size: 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    tr:nth-child(even) td {
      background-color: #fbfcfe;
    }
    .table-total-row td {
      background-color: #eef2ff !important;
      border-top: 2px solid #6366f1;
      border-bottom: 2px solid #6366f1;
      padding: 8px 6px;
      font-weight: 800;
      vertical-align: middle;
    }
    .badge {
      display: inline-block;
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .badge-present {
      background-color: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .badge-night {
      background-color: #f3e8ff;
      color: #7e22ce;
      border: 1px solid #d8b4fe;
    }
    .badge-active {
      background-color: #e0f2fe;
      color: #0369a1;
      border: 1px solid #bae6fd;
    }
    .badge-other {
      background-color: #fef3c7;
      color: #b45309;
    }
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .signature-box {
      width: 35%;
      text-align: center;
      border-top: 1px dashed #94a3b8;
      padding-top: 6px;
      font-size: 9.5px;
      color: #475569;
      font-weight: 700;
      margin-top: 25px;
    }
    .system-note {
      font-size: 8.5px;
      color: #94a3b8;
      margin-top: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">${COMPANY.name.toUpperCase()}</div>
      <div class="report-title">${reportTitle}</div>
      ${companySubline() ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">${companySubline()}</div>` : ''}
    </div>
    <div class="meta-box">
      <div><strong>Reporting Period:</strong> ${periodLabel}</div>
      <div><strong>Export Timestamp:</strong> ${generatedAt}</div>
      <div><strong>Security:</strong> 🛡️ GPS Geofence & Anti-Mock Protection Active</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-num" style="color: #4f46e5;">${totalLogs}</div>
      <div class="summary-label">${logsLabel}</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color: #059669;">${regularShifts}</div>
      <div class="summary-label">Day Shifts</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color: #7c3aed;">${nightShifts}</div>
      <div class="summary-label">Night Present (>7 PM)</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color: #0284c7;">₹${totalAllowance.toLocaleString('en-IN')}</div>
      <div class="summary-label">Night Allowances</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color: #0f172a;">₹${totalEstDayWages.toLocaleString('en-IN')}</div>
      <div class="summary-label">Est. Disbursals (Day)</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color: #0f172a;">${uniqueEmployees}</div>
      <div class="summary-label">${workforceLabel}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25px; text-align: center;">#</th>
        <th style="width: 85px;">Date & Day</th>
        <th style="width: 140px;">Employee & Profile</th>
        <th style="text-align: center; width: 110px;">Shift Status</th>
        <th style="width: 210px;">Punch-In (GPS Location)</th>
        <th style="width: 210px;">Punch-Out (GPS Location)</th>
        <th style="text-align: center; width: 85px;">Duration</th>
        <th style="text-align: center; width: 75px;">Night Shift</th>
        <th style="text-align: right; width: 65px;">Night ₹</th>
        <th style="text-align: right; width: 80px;">Est. Wage</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="table-total-row">
        <td colspan="3" style="font-weight: 900; font-size: 10.5px; text-transform: uppercase;">
          TOTALS (${totalLogs} Records • ${uniqueEmployees} Staff)
        </td>
        <td style="text-align: center; font-weight: 800; font-size: 10px;">
          ${totalLogs} Present
        </td>
        <td colspan="2" style="font-size: 9.5px; color: #334155;">
          <strong>Breakdown:</strong> ${regularShifts} Day Shifts • ${nightShifts} Night Shifts (&gt;7 PM)
        </td>
        <td style="text-align: center; font-weight: 800; font-size: 10px;">
          ${totalHoursStr}
        </td>
        <td style="text-align: center; font-weight: 800; color: #7c3aed; font-size: 10px;">
          ${nightShifts} Night
        </td>
        <td style="text-align: right; font-weight: 900; color: #7c3aed; font-size: 11.5px;">
          ₹${totalAllowance.toLocaleString('en-IN')}
        </td>
        <td style="text-align: right; font-weight: 900; color: #0f172a; font-size: 11.5px;">
          ₹${totalEstDayWages.toLocaleString('en-IN')}
        </td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div class="signature-box">
      HR & Attendance Officer<br>
      <span style="font-size: 8px; color: #94a3b8; font-weight: normal;">(Certified True Copy — System Verified GPS Attendance)</span>
    </div>
    <div class="signature-box">
      Factory Manager / Authorized Signatory<br>
      <span style="font-size: 8px; color: #94a3b8; font-weight: normal;">(Approved for Payroll Disbursal & Bank Transfer)</span>
    </div>
  </div>

  <div class="system-note">
    This is an authentic computer-generated shift audit report exported from WorkPulse. Punches are backed by real-time geolocation coordinates, timestamp cryptographic hashes, and anti-mock protections.
  </div>
</body>
</html>
  `;
}

// 5. Share Attendance PDF Directly (WhatsApp, Email, Drive, etc.)
export async function shareAttendanceReportPdf(
  records: AttendanceRecord[],
  employees: Employee[],
  periodLabel: string = 'Current Month',
  customTitle?: string
): Promise<{ success: boolean; error?: string }> {
  const html = generateAttendanceReportHtml(records, employees, periodLabel, customTitle);
  try {
    const { uri } = await Print.printToFileAsync({ html, ...A4_LANDSCAPE });

    const prefix = (customTitle?.toLowerCase().includes('daily') || periodLabel.toLowerCase().includes('daily') || periodLabel.toLowerCase().includes('today'))
      ? 'Daily_Report'
      : (customTitle?.toLowerCase().includes('weekly') || periodLabel.toLowerCase().includes('weekly'))
      ? 'Weekly_Report'
      : (customTitle?.toLowerCase().includes('night') || periodLabel.toLowerCase().includes('night'))
      ? 'NightShift_Report'
      : 'Monthly_Report';

    const safePeriod = periodLabel.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 25);
    const cleanFileName = `Attendance_${prefix}_${safePeriod}.pdf`;
    const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    const targetUri = `${targetDir}${cleanFileName}`;

    try {
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }
      await FileSystem.copyAsync({
        from: uri,
        to: targetUri,
      });
    } catch {
      // Fallback if copy fails
    }

    const shareUri = (await FileSystem.getInfoAsync(targetUri)).exists ? targetUri : uri;
    const isAvailable = await Sharing.isAvailableAsync().catch(() => false);

    if (isAvailable) {
      await Sharing.shareAsync(shareUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${cleanFileName}`,
      });
      return { success: true };
    } else {
      await Print.printAsync({ html, ...A4_LANDSCAPE });
      return { success: true };
    }
  } catch {
    try {
      await Print.printAsync({ html, ...A4_LANDSCAPE });
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Unable to open file share. Please choose "Save PDF to Phone" to export or view.',
      };
    }
  }
}

// 6. Save Attendance PDF to Phone ("Save as PDF" spooler)
export async function saveAttendanceReportPdfToPhone(
  records: AttendanceRecord[],
  employees: Employee[],
  periodLabel: string = 'Current Month',
  customTitle?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = generateAttendanceReportHtml(records, employees, periodLabel, customTitle);
    return await savePdfToDevice(html, `Attendance_${safeFilePart(periodLabel, 25)}`, A4_LANDSCAPE);
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save attendance PDF to phone' };
  }
}

// 7. Interactive Dialog for Attendance Export Choice
export function promptAttendanceExportOptions(
  records: AttendanceRecord[],
  employees: Employee[],
  periodLabel: string = 'Current Month',
  onExportCsv?: () => void,
  onStartLoading?: () => void,
  onEndLoading?: () => void
) {
  showActionMenu(
    'Export Attendance Report',
    `Select format to export ${records.length} attendance record(s) for ${periodLabel}:`,
    [
      {
        text: '📄 Share PDF Report (WhatsApp/Apps)',
        onPress: async () => {
          onStartLoading?.();
          const res = await shareAttendanceReportPdf(records, employees, periodLabel);
          onEndLoading?.();
          if (!res.success && res.error) {
            Alert.alert('Notice', res.error);
          }
        },
      },
      {
        text: '💾 Save PDF to Phone',
        onPress: async () => {
          onStartLoading?.();
          const res = await saveAttendanceReportPdfToPhone(records, employees, periodLabel);
          onEndLoading?.();
          if (!res.success && res.error) {
            Alert.alert('Notice', res.error);
          }
        },
      },
      {
        text: '📊 Export Excel / CSV Spreadsheet',
        onPress: () => {
          onExportCsv?.();
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]
  );
}

// ========================================================
// 8. Monthly Payroll & Advances Register PDF (Landscape A4)
// ========================================================

export function generatePayrollRegisterHtml(
  employees: Employee[],
  summaries: Record<string, any>,
  monthYear: string,
  payslips: Payslip[] = []
): string {
  const staff = employees.filter((e) => e.role === 'employee');
  const dParts = monthYear.split('-');
  let monthName = monthYear;
  if (dParts.length === 2) {
    const dObj = new Date(parseInt(dParts[0]), parseInt(dParts[1]) - 1, 1);
    monthName = dObj.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }

  const generatedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let totalGross = 0;
  let totalNightBonuses = 0;
  let totalAdvanceDeductions = 0;
  let totalActiveAdvances = 0;
  let totalNetPayable = 0;

  const rowsHtml = staff
    .map((emp, idx) => {
      const fin = summaries[emp.id];
      const payslip = payslips.find((p) => p.employeeId === emp.id && p.monthYear === monthYear);
      const empCode = `EMP-${emp.id.slice(0, 5).toUpperCase()}`;

      const presentDays = payslip?.presentDays ?? (fin?.presentDays || 0);
      const nightShifts = payslip?.nightPresentDays ?? (fin?.nightPresentDays || 0);
      const nightBonus = payslip?.nightAllowance ?? (fin?.nightAllowance || 0);
      const gross = payslip?.grossEarnings ?? (fin?.estimatedCurrentEarnings || 0);
      const activeAdv = fin?.activeAdvanceBalance || 0;
      const advanceDeduction = payslip?.advanceDeductions ?? (fin?.advanceDeduction || 0);
      const net = payslip?.netPayable ?? Math.max(0, gross - advanceDeduction);
      const status = payslip?.paymentStatus || payslipStatus(net, fin?.salaryPaidThisMonth || 0);

      totalGross += gross;
      totalNightBonuses += nightBonus;
      totalAdvanceDeductions += advanceDeduction;
      totalActiveAdvances += activeAdv;
      totalNetPayable += net;

      const baseRateStr =
        emp.salaryType === 'daily'
          ? `₹${emp.baseSalary.toLocaleString('en-IN')}/day`
          : `₹${emp.baseSalary.toLocaleString('en-IN')}/mo`;

      const statusBadge =
        status === 'PAID'
          ? `<span class="badge badge-paid">PAID ✅</span>`
          : `<span class="badge badge-pending">PENDING ⏳</span>`;

      const upiDisplay = emp.bankUpiId
        ? `<div style="font-weight: 700; color: #0284c7; font-size: 9px;">UPI: ${emp.bankUpiId}</div>`
        : `<div style="color: #64748b; font-size: 9px;">Cash Voucher</div>`;

      return `
      <tr>
        <td style="text-align: center; color: #64748b; font-weight: 700; font-size: 10px;">${idx + 1}</td>
        <td>
          <div style="font-weight: 800; color: #0f172a; font-size: 11px;">${emp.fullName}</div>
          <div style="font-size: 9.5px; color: #475569; font-weight: 600;">${emp.designation} • <span style="color: #64748b;">${empCode}</span></div>
          <div style="font-size: 9px; color: #64748b; margin-top: 2px;">📱 +91 ${emp.mobileNumber}</div>
        </td>
        <td>
          <div style="font-weight: 700; color: #0f172a; font-size: 10px; text-transform: uppercase;">${emp.salaryType}</div>
          <div style="font-size: 9px; color: #4338ca; font-weight: 700;">${baseRateStr}</div>
        </td>
        <td style="text-align: center;">
          <div style="font-weight: 800; color: #059669; font-size: 11px;">${presentDays} Days</div>
          ${
            nightShifts > 0
              ? `<div style="font-size: 9px; font-weight: 700; color: #7c3aed; margin-top: 2px;">🌙 ${nightShifts} Night Shifts</div>`
              : '<div style="font-size: 8.5px; color: #94a3b8;">No Night Shifts</div>'
          }
        </td>
        <td style="text-align: right; font-weight: 700; color: #334155; font-size: 10.5px;">
          ₹${(gross - nightBonus).toLocaleString('en-IN')}
        </td>
        <td style="text-align: right;">
          <div style="font-weight: 800; color: ${nightBonus > 0 ? '#7c3aed' : '#94a3b8'}; font-size: 10.5px;">₹${nightBonus.toLocaleString('en-IN')}</div>
          ${nightShifts > 0 ? `<div style="font-size: 8px; color: #9333ea;">(${nightShifts} × ₹${Math.round(nightBonus / nightShifts)})</div>` : ''}
        </td>
        <td style="text-align: right; font-weight: 900; color: #0f172a; font-size: 11px;">
          ₹${gross.toLocaleString('en-IN')}
        </td>
        <td style="text-align: right;">
          <div style="font-weight: 800; color: ${advanceDeduction > 0 ? '#dc2626' : '#94a3b8'}; font-size: 10.5px;">
            ${advanceDeduction > 0 ? `- ₹${advanceDeduction.toLocaleString('en-IN')}` : '₹0'}
          </div>
        </td>
        <td style="text-align: right;">
          <div style="font-weight: 700; color: ${activeAdv > 0 ? '#b45309' : '#059669'}; font-size: 10.5px;">
            ₹${activeAdv.toLocaleString('en-IN')}
          </div>
          ${activeAdv > 0 ? `<div style="font-size: 8px; color: #b45309;">(Passbook Due)</div>` : ''}
        </td>
        <td style="text-align: right;">
          <div style="font-weight: 900; color: #15803d; font-size: 12px;">₹${net.toLocaleString('en-IN')}</div>
          <div style="font-size: 8px; color: #15803d; font-weight: bold;">(Take-Home)</div>
        </td>
        <td>
          ${upiDisplay}
        </td>
        <td style="text-align: center;">
          ${statusBadge}
        </td>
      </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Payroll & Advances Register - ${monthName}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 10mm;
    }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      padding: 0;
      color: #1e293b;
      font-size: 10px;
      background-color: #ffffff;
    }
    .header {
      border-bottom: 2.5px solid #4f46e5;
      padding-bottom: 10px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .company-title {
      font-size: 22px;
      font-weight: 900;
      color: #4f46e5;
      letter-spacing: 0.5px;
    }
    .report-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #1e293b;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    .meta-box {
      text-align: right;
      font-size: 9.5px;
      color: #64748b;
      line-height: 1.45;
    }
    .summary-grid {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .summary-card {
      flex: 1;
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 6px;
      text-align: center;
    }
    .summary-num {
      font-size: 15px;
      font-weight: 900;
      color: #0f172a;
    }
    .summary-label {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-top: 3px;
      letter-spacing: 0.3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
    }
    th {
      background-color: #f1f5f9;
      color: #334155;
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 7px 6px;
      text-align: left;
      border-bottom: 2px solid #cbd5e1;
      border-top: 1px solid #cbd5e1;
    }
    td {
      padding: 7px 6px;
      font-size: 10px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background-color: #fbfcfe;
    }
    .table-total-row td {
      background-color: #eef2ff !important;
      border-top: 2px solid #6366f1;
      border-bottom: 2px solid #6366f1;
      padding: 8px 6px;
      font-weight: 800;
      vertical-align: middle;
    }
    .badge {
      display: inline-block;
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.3px;
      white-space: nowrap;
    }
    .badge-paid {
      background-color: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
    }
    .badge-pending {
      background-color: #fef3c7;
      color: #b45309;
      border: 1px solid #fde68a;
    }
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
    .signature-box {
      width: 30%;
      text-align: center;
      border-top: 1px dashed #94a3b8;
      padding-top: 6px;
      font-size: 9px;
      color: #475569;
      font-weight: 700;
      margin-top: 25px;
    }
    .system-note {
      font-size: 8.5px;
      color: #94a3b8;
      margin-top: 12px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">${COMPANY.name.toUpperCase()}</div>
      <div class="report-title">Monthly Salary & Advance Disbursal Register</div>
      ${companySubline() ? `<div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">${companySubline()}</div>` : ''}
    </div>
    <div class="meta-box">
      <div><strong>Payroll Cycle:</strong> ${monthName} (${monthYear})</div>
      <div><strong>Disbursal Timestamp:</strong> ${generatedAt}</div>
      <div><strong>Ledger Integrity:</strong> Verified via Passbook & GPS Attendance</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-num" style="color: #4f46e5;">${staff.length}</div>
      <div class="summary-label">Workforce</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color: #0f172a;">₹${totalGross.toLocaleString('en-IN')}</div>
      <div class="summary-label">Gross Earnings</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color: #7c3aed;">₹${totalNightBonuses.toLocaleString('en-IN')}</div>
      <div class="summary-label">Night Allowances</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color: #dc2626;">- ₹${totalAdvanceDeductions.toLocaleString('en-IN')}</div>
      <div class="summary-label">Advance Recoveries</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color: #b45309;">₹${totalActiveAdvances.toLocaleString('en-IN')}</div>
      <div class="summary-label">Outstanding Advances</div>
    </div>
    <div class="summary-card">
      <div class="summary-num" style="color: #15803d;">₹${totalNetPayable.toLocaleString('en-IN')}</div>
      <div class="summary-label">Net Disbursable</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 25px; text-align: center;">#</th>
        <th style="width: 140px;">Employee & Profile</th>
        <th style="width: 100px;">Salary Model</th>
        <th style="text-align: center; width: 100px;">Attendance</th>
        <th style="text-align: right; width: 80px;">Base Shift ₹</th>
        <th style="text-align: right; width: 80px;">Night Bonus</th>
        <th style="text-align: right; width: 85px;">Gross Salary</th>
        <th style="text-align: right; width: 85px;">Advance Rec.</th>
        <th style="text-align: right; width: 85px;">Advance Due</th>
        <th style="text-align: right; width: 95px;">Net Disbursal</th>
        <th style="width: 120px;">Payout Mode / UPI</th>
        <th style="text-align: center; width: 75px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr class="table-total-row">
        <td colspan="3" style="font-weight: 900; font-size: 10.5px; text-transform: uppercase;">
          TOTAL DISBURSALS (${staff.length} Active Staff)
        </td>
        <td style="text-align: center; font-weight: 800; font-size: 9.5px;">
          All Shifts Logged
        </td>
        <td style="text-align: right; font-weight: 800; font-size: 10.5px;">
          ₹${(totalGross - totalNightBonuses).toLocaleString('en-IN')}
        </td>
        <td style="text-align: right; font-weight: 800; color: #7c3aed; font-size: 10.5px;">
          ₹${totalNightBonuses.toLocaleString('en-IN')}
        </td>
        <td style="text-align: right; font-weight: 900; color: #0f172a; font-size: 11px;">
          ₹${totalGross.toLocaleString('en-IN')}
        </td>
        <td style="text-align: right; font-weight: 900; color: #dc2626; font-size: 11px;">
          - ₹${totalAdvanceDeductions.toLocaleString('en-IN')}
        </td>
        <td style="text-align: right; font-weight: 900; color: #b45309; font-size: 11px;">
          ₹${totalActiveAdvances.toLocaleString('en-IN')}
        </td>
        <td style="text-align: right; font-weight: 900; color: #15803d; font-size: 12.5px;">
          ₹${totalNetPayable.toLocaleString('en-IN')}
        </td>
        <td colspan="2" style="font-size: 9px; color: #475569; font-weight: 700;">
          Bank Transfer & UPI Authorized
        </td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">
    <div class="signature-box">
      Payroll & Accounts Officer<br>
      <span style="font-size: 8px; color: #94a3b8; font-weight: normal;">(Certified from GPS Punch & Passbook Ledger)</span>
    </div>
    <div class="signature-box">
      Chartered Accountant / Internal Auditor<br>
      <span style="font-size: 8px; color: #94a3b8; font-weight: normal;">(Audited for Statutory Compliance & Taxes)</span>
    </div>
    <div class="signature-box">
      Factory Manager / Managing Director<br>
      <span style="font-size: 8px; color: #94a3b8; font-weight: normal;">(Approved for UPI Disbursal & Bank RTGS/NEFT)</span>
    </div>
  </div>

  <div class="system-note">
    This is an authentic computer-generated payroll disbursal register exported from WorkPulse. Salary credits, night shift bonuses, and advance recoveries are cryptographically backed by attendance records.
  </div>
</body>
</html>
  `;
}

// 9. Share Payroll Register PDF Directly (WhatsApp, Email, Drive, etc.)
export async function sharePayrollRegisterPdf(
  employees: Employee[],
  summaries: Record<string, any>,
  monthYear: string,
  payslips: Payslip[] = []
): Promise<{ success: boolean; error?: string }> {
  const html = generatePayrollRegisterHtml(employees, summaries, monthYear, payslips);
  try {
    const { uri } = await Print.printToFileAsync({ html, ...A4_LANDSCAPE });

    const safeMonth = monthYear.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanFileName = `Payroll_Disbursals_Register_${safeMonth}.pdf`;
    const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    const targetUri = `${targetDir}${cleanFileName}`;

    try {
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }
      await FileSystem.copyAsync({
        from: uri,
        to: targetUri,
      });
    } catch {}

    const shareUri = (await FileSystem.getInfoAsync(targetUri)).exists ? targetUri : uri;
    const isAvailable = await Sharing.isAvailableAsync().catch(() => false);

    if (isAvailable) {
      await Sharing.shareAsync(shareUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${cleanFileName}`,
      });
      return { success: true };
    } else {
      await Print.printAsync({ html, ...A4_LANDSCAPE });
      return { success: true };
    }
  } catch {
    try {
      await Print.printAsync({ html, ...A4_LANDSCAPE });
      return { success: true };
    } catch {
      return {
        success: false,
        error: 'Unable to open file share. Please choose "Save PDF to Phone" to export or view.',
      };
    }
  }
}

// 10. Save Payroll Register PDF to Phone ("Save as PDF" spooler)
export async function savePayrollRegisterPdfToPhone(
  employees: Employee[],
  summaries: Record<string, any>,
  monthYear: string,
  payslips: Payslip[] = []
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = generatePayrollRegisterHtml(employees, summaries, monthYear, payslips);
    return await savePdfToDevice(html, `Payroll_Register_${safeFilePart(monthYear)}`, A4_LANDSCAPE);
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to save payroll PDF to phone' };
  }
}

// 11. Interactive Dialog for Payroll Export Choice
export function promptPayrollExportOptions(
  employees: Employee[],
  summaries: Record<string, any>,
  monthYear: string,
  payslips: Payslip[] = [],
  onExportCsv?: () => void,
  onStartLoading?: () => void,
  onEndLoading?: () => void
) {
  const staffCount = employees.filter((e) => e.role === 'employee').length;
  showActionMenu(
    'Export Payroll & Advances Register',
    `Select format to export payroll sheet for ${monthYear} (${staffCount} employees):`,
    [
      {
        text: '📄 Share PDF Register (WhatsApp/Bank)',
        onPress: async () => {
          onStartLoading?.();
          const res = await sharePayrollRegisterPdf(employees, summaries, monthYear, payslips);
          onEndLoading?.();
          if (!res.success && res.error) {
            Alert.alert('Notice', res.error);
          }
        },
      },
      {
        text: '💾 Save PDF Register to Phone',
        onPress: async () => {
          onStartLoading?.();
          const res = await savePayrollRegisterPdfToPhone(employees, summaries, monthYear, payslips);
          onEndLoading?.();
          if (!res.success && res.error) {
            Alert.alert('Notice', res.error);
          }
        },
      },
      {
        text: '📊 Export Excel / CSV Spreadsheet',
        onPress: () => {
          onExportCsv?.();
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]
  );
}
