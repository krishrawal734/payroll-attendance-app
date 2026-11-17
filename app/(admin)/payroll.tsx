import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { dataService } from '../../src/services/dataService';
import {
  shareOrPrintPayslip,
  promptPayslipOptions,
  sharePayrollRegisterPdf,
  savePayrollRegisterPdfToPhone,
} from '../../src/services/pdfService';
import { exportService } from '../../src/services/exportService';
import { remainingPayable } from '../../src/services/payrollCalc';
import { Employee, Payslip, PaymentMode } from '../../src/types';
import {
  FileSpreadsheet,
  FileText,
  Share2,
  CheckCircle2,
  IndianRupee,
  Clock,
  X,
  Download,
  Calendar,
  Wallet,
  Coins,
  TrendingDown,
  TrendingUp,
  Search,
  Check,
  Building2,
} from 'lucide-react-native';
import { localDateString, recentMonths, MONTH_SHORT } from '../../src/utils/date';

type PayrollFilterType = 'ALL' | 'ADVANCE' | 'SLIP_DONE' | 'SLIP_PENDING';

export default function AdminPayrollScreen() {
  const monthOptions = useMemo(() => recentMonths(), []);
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]);
  const [payrollFilter, setPayrollFilter] = useState<PayrollFilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allPayslips, setAllPayslips] = useState<Payslip[]>([]);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPdfId, setLoadingPdfId] = useState<string | null>(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [exporting, setExporting] = useState(false);

  // Quick Payment Recording State
  const [payAmount, setPayAmount] = useState('');
  const [payMode, setPayMode] = useState<PaymentMode>('UPI');
  const [payRef, setPayRef] = useState('');
  const [submittingPay, setSubmittingPay] = useState(false);

  const loadData = async (month: string = selectedMonth) => {
    try {
      setLoading(true);
      const [allEmps, slips] = await Promise.all([
        dataService.getEmployees(),
        dataService.getPayslips(),
      ]);

      const staff = allEmps.filter((e) => e.role === 'employee');
      setEmployees(staff);
      setAllPayslips(slips);

      // Load financial summaries for the selected month
      const sumMap: Record<string, any> = {};
      await Promise.all(
        staff.map(async (emp) => {
          const fin = await dataService.getEmployeeFinancialSummary(emp.id, month);
          sumMap[emp.id] = fin;
        })
      );
      setSummaries(sumMap);
    } catch (err) {
      console.error('Failed to load payroll data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(selectedMonth);
  }, [selectedMonth]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(selectedMonth);
  }, [selectedMonth]);

  // Former staff stay listed only while they are still owed money for the month (final settlement).
  const staff = employees.filter(
    (e) =>
      e.role === 'employee' &&
      (e.isActive ||
        remainingPayable(
          summaries[e.id],
          allPayslips.find((p) => p.employeeId === e.id && p.monthYear === selectedMonth)
        ) > 0)
  );

  // Compute Grand Financial Totals for Executive Banner
  let totalGross = 0;
  let totalNight = 0;
  let totalAdvRec = 0;
  let totalActiveAdv = 0;
  let totalNet = 0;

  staff.forEach((emp) => {
    const fin = summaries[emp.id];
    const payslip = allPayslips.find(
      (p) => p.employeeId === emp.id && p.monthYear === selectedMonth
    );
    const gross = payslip ? payslip.grossEarnings : (fin?.estimatedCurrentEarnings || 0);
    const night = payslip ? payslip.nightAllowance : (fin?.nightAllowance || 0);
    const active = fin?.activeAdvanceBalance || 0;
    const advRec = payslip ? payslip.advanceDeductions : (fin?.advanceDeduction || 0);
    const net = remainingPayable(fin, payslip);

    totalGross += gross;
    totalNight += night;
    totalAdvRec += advRec;
    totalActiveAdv += active;
    totalNet += net;
  });

  // Filter staff based on tabs & search
  const filteredStaff = staff.filter((emp) => {
    const fin = summaries[emp.id];
    const payslip = allPayslips.find(
      (p) => p.employeeId === emp.id && p.monthYear === selectedMonth
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        emp.fullName.toLowerCase().includes(q) ||
        emp.designation.toLowerCase().includes(q) ||
        emp.mobileNumber.includes(q);
      if (!match) return false;
    }

    if (payrollFilter === 'ADVANCE') {
      return (fin?.activeAdvanceBalance || 0) > 0;
    }
    if (payrollFilter === 'SLIP_DONE') {
      return !!payslip;
    }
    if (payrollFilter === 'SLIP_PENDING') {
      return !payslip;
    }
    return true;
  });

  // Export handlers
  const handleShareRegisterPdf = async () => {
    setExporting(true);
    const res = await sharePayrollRegisterPdf(staff, summaries, selectedMonth, allPayslips);
    setExporting(false);
    setExportModalVisible(false);
    if (!res.success && res.error) {
      Alert.alert('Notice', res.error);
    }
  };

  const handleSaveRegisterPdf = async () => {
    setExporting(true);
    const res = await savePayrollRegisterPdfToPhone(staff, summaries, selectedMonth, allPayslips);
    setExporting(false);
    setExportModalVisible(false);
    if (!res.success && res.error) {
      Alert.alert('Notice', res.error);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    await exportService.exportPayrollReport(staff, summaries, selectedMonth, allPayslips);
    setExporting(false);
    setExportModalVisible(false);
  };

  const handleGeneratePayslip = async (emp: Employee) => {
    const res = await dataService.generatePayslip(emp.id, selectedMonth);
    Alert.alert(res.success ? 'Payslip Generated' : 'Notice', res.message);
    if (res.success) {
      await loadData(selectedMonth);
    }
  };

  const handleSharePayslipPdf = async (ps: Payslip) => {
    const emp = await dataService.getEmployeeById(ps.employeeId);
    if (!emp) return;

    promptPayslipOptions(
      ps,
      emp,
      () => setLoadingPdfId(ps.id),
      () => setLoadingPdfId(null),
      async () => {
        const res = await dataService.generatePayslip(emp.id, selectedMonth);
        Alert.alert(res.success ? 'Payslip Recalculated' : 'Notice', res.message);
        if (res.success) {
          await loadData(selectedMonth);
        }
      },
      async () => {
        Alert.alert(
          'Delete Payslip',
          `Delete payslip for ${emp.fullName}? Status will reset back to Pending Slip.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                const res = await dataService.deletePayslip(ps.id);
                if (res.success) {
                  await loadData(selectedMonth);
                } else {
                  Alert.alert('Error', res.message);
                }
              },
            },
          ]
        );
      }
    );
  };

  const openPaymentModal = (emp: Employee) => {
    setSelectedEmp(emp);
    const fin = summaries[emp.id];
    const payslip = allPayslips.find(
      (p) => p.employeeId === emp.id && p.monthYear === selectedMonth
    );
    setPayAmount(String(remainingPayable(fin, payslip)));
    setPaymentModalVisible(true);
  };

  const handleMoveOverpayment = (emp: Employee, amount: number) => {
    Alert.alert(
      'Move overpayment to advance?',
      `${emp.fullName} was paid ₹${amount.toLocaleString('en-IN')} more than earned for ${selectedMonth}. ` +
        'Moving it to advance means it will be recovered automatically from future salary.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move to Advance',
          onPress: async () => {
            const res = await dataService.moveOverpaymentToAdvance(emp.id, emp.fullName, selectedMonth);
            Alert.alert(res.success ? 'Done' : 'Error', res.message);
            if (res.success) await loadData(selectedMonth);
          },
        },
      ]
    );
  };

  const handleConfirmDisbursal = async () => {
    if (!selectedEmp) return;
    const val = parseFloat(payAmount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please provide a valid payment amount.');
      return;
    }

    setSubmittingPay(true);
    const res = await dataService.recordTransaction({
      employeeId: selectedEmp.id,
      employeeName: selectedEmp.fullName,
      type: 'SALARY_PAYMENT',
      amount: val,
      paymentMode: payMode,
      referenceId: payRef.trim() || undefined,
      paymentDate: localDateString(),
      notes: `Salary disbursal for ${selectedMonth} via ${payMode}`,
    });
    setSubmittingPay(false);

    if (res.success) {
      Alert.alert('Payment Recorded', res.message);
      setPaymentModalVisible(false);
      await loadData(selectedMonth);
    } else {
      Alert.alert('Error', res.message);
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Header: Month Switcher & Export Register Button */}
      <View className="bg-white p-4 border-b border-slate-200">
        <View className="flex-row justify-between items-center mb-3">
          <View>
            <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Payroll Cycle
            </Text>
            <Text className="text-lg font-black text-slate-900 mt-0.5">{selectedMonth}</Text>
          </View>

          <View className="flex-row items-center">
            {/* Export Register Button */}
            <TouchableOpacity
              className="flex-row items-center bg-indigo-600 px-3 py-2 rounded-xl mr-2.5 shadow-xs active:bg-indigo-700"
              onPress={() => setExportModalVisible(true)}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <FileText size={14} color="#ffffff" />
                  <Text className="text-white text-xs font-black ml-1.5">Export Register</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Month Switcher Pills */}
            <View className="flex-row bg-slate-100 rounded-xl p-1">
              {monthOptions.map((m) => {
                const label = MONTH_SHORT[Number(m.slice(5, 7)) - 1];
                const active = selectedMonth === m;
                return (
                  <TouchableOpacity
                    key={m}
                    className={`px-2.5 py-1 rounded-lg ${active ? 'bg-white shadow-xs' : ''}`}
                    onPress={() => setSelectedMonth(m)}
                  >
                    <Text
                      className={`text-xs font-bold ${active ? 'text-indigo-600' : 'text-slate-500'}`}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-slate-100 rounded-xl px-3 py-1 mb-3">
          <Search size={14} color="#94a3b8" />
          <TextInput
            className="flex-1 py-1.5 ml-2 text-xs text-slate-900 font-medium"
            placeholder="Search by staff name, designation or phone..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={14} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          <TouchableOpacity
            className={`px-3 py-1.5 rounded-xl border mr-1.5 ${
              payrollFilter === 'ALL'
                ? 'bg-slate-900 border-slate-900 shadow-xs'
                : 'bg-slate-50 border-slate-300'
            }`}
            onPress={() => setPayrollFilter('ALL')}
          >
            <Text
              className={`text-[11px] font-bold ${
                payrollFilter === 'ALL' ? 'text-white' : 'text-slate-700'
              }`}
            >
              All Staff ({staff.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`px-3 py-1.5 rounded-xl border mr-1.5 ${
              payrollFilter === 'ADVANCE'
                ? 'bg-rose-600 border-rose-600 shadow-xs'
                : 'bg-slate-50 border-rose-200'
            }`}
            onPress={() => setPayrollFilter('ADVANCE')}
          >
            <Text
              className={`text-[11px] font-bold ${
                payrollFilter === 'ADVANCE' ? 'text-white' : 'text-rose-700'
              }`}
            >
              With Advance Due ({staff.filter((e) => (summaries[e.id]?.activeAdvanceBalance || 0) > 0).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`px-3 py-1.5 rounded-xl border mr-1.5 ${
              payrollFilter === 'SLIP_DONE'
                ? 'bg-emerald-600 border-emerald-600 shadow-xs'
                : 'bg-slate-50 border-emerald-200'
            }`}
            onPress={() => setPayrollFilter('SLIP_DONE')}
          >
            <Text
              className={`text-[11px] font-bold ${
                payrollFilter === 'SLIP_DONE' ? 'text-white' : 'text-emerald-700'
              }`}
            >
              Slip Created ({allPayslips.filter((p) => p.monthYear === selectedMonth).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`px-3 py-1.5 rounded-xl border ${
              payrollFilter === 'SLIP_PENDING'
                ? 'bg-amber-600 border-amber-600 shadow-xs'
                : 'bg-slate-50 border-amber-200'
            }`}
            onPress={() => setPayrollFilter('SLIP_PENDING')}
          >
            <Text
              className={`text-[11px] font-bold ${
                payrollFilter === 'SLIP_PENDING' ? 'text-white' : 'text-amber-700'
              }`}
            >
              Pending Slip ({staff.filter((e) => !allPayslips.some((p) => p.employeeId === e.id && p.monthYear === selectedMonth)).length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Content Feed */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text className="text-xs text-slate-500 font-medium mt-3">
            Loading cloud payroll & advance ledger...
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="p-4 pb-12"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Executive Financial Summary Banner */}
          <View className="bg-slate-900 rounded-3xl p-5 mb-5 shadow-sm border border-slate-800">
            <View className="flex-row justify-between items-center mb-3">
              <View className="flex-row items-center">
                <Wallet size={16} color="#818cf8" />
                <Text className="text-indigo-300 text-xs font-black uppercase tracking-wider ml-1.5">
                  Monthly Disbursals Overview
                </Text>
              </View>
              <View className="bg-indigo-900/60 px-2.5 py-0.5 rounded-full border border-indigo-700">
                <Text className="text-[10px] font-bold text-indigo-300">{selectedMonth}</Text>
              </View>
            </View>

            {/* Net Payout Prominent Header */}
            <View className="mb-4">
              <Text className="text-slate-400 text-xs">Total Net Disbursable Take-Home</Text>
              <Text className="text-white text-3xl font-black mt-0.5">
                ₹{totalNet.toLocaleString('en-IN')}
              </Text>
            </View>

            {/* 4-Item Breakdown Grid */}
            <View className="grid grid-cols-2 gap-2 bg-slate-800/60 rounded-2xl p-3 border border-slate-700/60">
              <View className="flex-row justify-between items-center pb-2 border-b border-slate-700/60">
                <Text className="text-slate-400 text-xs">Gross Earnings</Text>
                <Text className="text-white text-xs font-extrabold">
                  ₹{totalGross.toLocaleString('en-IN')}
                </Text>
              </View>
              <View className="flex-row justify-between items-center pb-2 border-b border-slate-700/60">
                <Text className="text-purple-300 text-xs">Night Allowances</Text>
                <Text className="text-purple-300 text-xs font-extrabold">
                  + ₹{totalNight.toLocaleString('en-IN')}
                </Text>
              </View>
              <View className="flex-row justify-between items-center pt-2">
                <Text className="text-rose-400 text-xs">Advance Deductions</Text>
                <Text className="text-rose-400 text-xs font-extrabold">
                  - ₹{totalAdvRec.toLocaleString('en-IN')}
                </Text>
              </View>
              <View className="flex-row justify-between items-center pt-2">
                <Text className="text-amber-400 text-xs">Active Advances Due</Text>
                <Text className="text-amber-400 text-xs font-extrabold">
                  ₹{totalActiveAdv.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
          </View>

          {/* Section Heading */}
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-extrabold text-slate-900">
              Workforce Disbursal Register ({filteredStaff.length})
            </Text>
            <Text className="text-xs text-slate-500 font-semibold">{selectedMonth}</Text>
          </View>

          {filteredStaff.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-slate-200">
              <Clock size={32} color="#cbd5e1" />
              <Text className="text-xs text-slate-400 mt-2 font-medium">
                No employees match the selected payroll filter.
              </Text>
            </View>
          ) : (
            filteredStaff.map((emp) => {
              const fin = summaries[emp.id];
              const payslip = allPayslips.find(
                (p) => p.employeeId === emp.id && p.monthYear === selectedMonth
              );

              const presentDays = payslip?.presentDays ?? (fin?.presentDays || 0);
              const nightShifts = payslip?.nightPresentDays ?? (fin?.nightPresentDays || 0);
              const nightBonus = payslip?.nightAllowance ?? (fin?.nightAllowance || 0);
              const activeAdv = fin?.activeAdvanceBalance || 0;
              const netPayable = remainingPayable(fin, payslip);
              const isPaid = payslip?.paymentStatus === 'PAID';

              return (
                <View
                  key={emp.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 mb-3 shadow-xs"
                >
                  {/* Top Employee Row */}
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-row items-center flex-1 mr-2">
                      <View className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 items-center justify-center mr-2.5">
                        <Text className="text-xs font-black text-indigo-700">
                          {emp.fullName.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-extrabold text-slate-900" numberOfLines={1}>
                          {emp.fullName}
                        </Text>
                        <Text className="text-xs text-slate-500" numberOfLines={1}>
                          {emp.designation} • Base: ₹{emp.baseSalary.toLocaleString()}/{emp.salaryType}
                        </Text>
                      </View>
                    </View>

                    {payslip ? (
                      <View className="flex-row items-center bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle2 size={11} color="#059669" />
                        <Text className="text-[10px] font-bold text-emerald-700 ml-1">
                          {isPaid ? 'Paid' : 'Slip Ready'}
                        </Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <Clock size={11} color="#d97706" />
                        <Text className="text-[10px] font-bold text-amber-700 ml-1">Pending Slip</Text>
                      </View>
                    )}
                  </View>

                  {/* Banking / UPI details */}
                  <View className="flex-row justify-between items-center bg-slate-50 px-3 py-1.5 rounded-xl mb-3">
                    <Text className="text-[10px] font-bold text-slate-500">PAYOUT CHANNEL</Text>
                    <Text className="text-[11px] font-bold text-indigo-700">
                      {emp.bankUpiId ? `UPI: ${emp.bankUpiId}` : 'Cash Voucher'}
                    </Text>
                  </View>

                  {/* 4-Item Financial Metrics Grid */}
                  <View className="flex-row bg-slate-50 rounded-2xl p-2.5 mb-3.5 border border-slate-100">
                    <View className="flex-1 items-center border-r border-slate-200">
                      <Text className="text-[10px] font-bold text-slate-500 uppercase">Present Days</Text>
                      <Text className="text-xs font-black text-slate-900 mt-0.5">
                        {presentDays}
                      </Text>
                    </View>
                    <View className="flex-1 items-center border-r border-slate-200">
                      <Text className="text-[10px] font-bold text-purple-700 uppercase">Night Shifts</Text>
                      <Text className="text-xs font-black text-purple-700 mt-0.5">
                        {nightShifts} (+₹{nightBonus})
                      </Text>
                    </View>
                    <View className="flex-1 items-center border-r border-slate-200">
                      <Text className="text-[10px] font-bold text-rose-500 uppercase">Advance Due</Text>
                      <Text className="text-xs font-black text-rose-500 mt-0.5">
                        - ₹{activeAdv.toLocaleString()}
                      </Text>
                    </View>
                    <View className="flex-1 items-center">
                      <Text className="text-[10px] font-bold text-emerald-600 uppercase">Net Payable</Text>
                      <Text className="text-xs font-black text-emerald-600 mt-0.5">
                        ₹{netPayable.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  {(fin?.overpaidAmount || 0) > 0 && (
                    <View className="flex-row items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">
                      <Text className="text-[11px] font-bold text-rose-700 flex-1 mr-2">
                        Overpaid ₹{fin.overpaidAmount.toLocaleString('en-IN')} this month
                      </Text>
                      <TouchableOpacity
                        className="bg-rose-600 rounded-lg px-2.5 py-1.5"
                        onPress={() => handleMoveOverpayment(emp, fin.overpaidAmount)}
                      >
                        <Text className="text-white text-[10px] font-bold">Move to advance</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {(fin?.missedPunchDays || 0) > 0 && (
                    <View className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
                      <Text className="text-[11px] font-bold text-amber-700">
                        {fin.missedPunchDays} missed punch-out(s) not paid. Fix them in Attendance.
                      </Text>
                    </View>
                  )}

                  {/* Action Buttons */}
                  <View className="flex-row space-x-2">
                    {!payslip ? (
                      <TouchableOpacity
                        className="flex-1 flex-row items-center justify-center bg-indigo-600 py-2.5 rounded-xl mr-2 shadow-xs active:bg-indigo-700"
                        onPress={() => handleGeneratePayslip(emp)}
                      >
                        <FileSpreadsheet size={14} color="#ffffff" />
                        <Text className="text-white text-xs font-black ml-1.5">Generate Payslip</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        className="flex-1 flex-row items-center justify-center bg-indigo-50 border border-indigo-200 py-2.5 rounded-xl mr-2 active:bg-indigo-100"
                        disabled={loadingPdfId === payslip.id}
                        onPress={() => handleSharePayslipPdf(payslip)}
                      >
                        {loadingPdfId === payslip.id ? (
                          <ActivityIndicator size="small" color="#4f46e5" />
                        ) : (
                          <>
                            <Share2 size={14} color="#4f46e5" />
                            <Text className="text-indigo-600 text-xs font-black ml-1.5">
                              Share Payslip PDF
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl shadow-xs ${
                        netPayable > 0 ? 'bg-emerald-600 active:bg-emerald-700' : 'bg-slate-300'
                      }`}
                      disabled={netPayable <= 0}
                      onPress={() => openPaymentModal(emp)}
                    >
                      <IndianRupee size={14} color="#ffffff" />
                      <Text className="text-white text-xs font-black ml-1.5">
                        {netPayable > 0 ? 'Record Pay (UPI/Cash)' : 'Nothing Pending'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ======================================================== */}
      {/* EXPORT PAYROLL REGISTER MODAL (PDF & Excel Choice) */}
      {/* ======================================================== */}
      <Modal
        visible={exportModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setExportModalVisible(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-5 border-t border-slate-200">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center pb-3 border-b border-slate-100">
              <View>
                <Text className="text-lg font-black text-slate-900">
                  Export Payroll Register
                </Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  Monthly disbursal ledger for {selectedMonth} ({staff.length} staff)
                </Text>
              </View>
              <TouchableOpacity
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                onPress={() => setExportModalVisible(false)}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Financial Preview Box */}
            <View className="bg-slate-50 rounded-2xl p-3.5 my-4 border border-slate-200">
              <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Disbursal Statement Preview
              </Text>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs text-slate-600">Total Gross Wages:</Text>
                <Text className="text-xs font-black text-slate-900">
                  ₹{totalGross.toLocaleString('en-IN')}
                </Text>
              </View>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs text-purple-700">Night Allowances (&gt;7 PM):</Text>
                <Text className="text-xs font-black text-purple-700">
                  + ₹{totalNight.toLocaleString('en-IN')}
                </Text>
              </View>
              <View className="flex-row justify-between mb-1.5">
                <Text className="text-xs text-rose-600">Advance Recoveries:</Text>
                <Text className="text-xs font-black text-rose-600">
                  - ₹{totalAdvRec.toLocaleString('en-IN')}
                </Text>
              </View>
              <View className="flex-row justify-between pt-2 border-t border-slate-200">
                <Text className="text-xs font-black text-slate-900">Net Take-Home Disbursable:</Text>
                <Text className="text-sm font-black text-emerald-600">
                  ₹{totalNet.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {/* Export Actions */}
            <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Select Export Format
            </Text>

            <View className="space-y-2">
              {/* Share PDF Button */}
              <TouchableOpacity
                className="flex-row items-center justify-center bg-indigo-600 py-3.5 px-4 rounded-2xl shadow-sm mb-2 active:bg-indigo-700"
                onPress={handleShareRegisterPdf}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Share2 size={16} color="#ffffff" />
                    <Text className="text-white text-sm font-black ml-2">
                      Share PDF Register (WhatsApp / Bank / CA)
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Save PDF to Phone Button */}
              <TouchableOpacity
                className="flex-row items-center justify-center bg-sky-600 py-3.5 px-4 rounded-2xl shadow-sm mb-2 active:bg-sky-700"
                onPress={handleSaveRegisterPdf}
                disabled={exporting}
              >
                <Download size={16} color="#ffffff" />
                <Text className="text-white text-sm font-black ml-2">
                  Save PDF Register to Phone Storage
                </Text>
              </TouchableOpacity>

              {/* Export Excel / CSV Button */}
              <TouchableOpacity
                className="flex-row items-center justify-center bg-emerald-600 py-3.5 px-4 rounded-2xl shadow-sm active:bg-emerald-700"
                onPress={handleExportCsv}
                disabled={exporting}
              >
                <FileSpreadsheet size={16} color="#ffffff" />
                <Text className="text-white text-sm font-black ml-2">
                  Export Excel / CSV Spreadsheet
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Disbursal Payment Modal */}
      <Modal visible={paymentModalVisible} transparent animationType="slide">
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-5 max-h-[80%]">
            <View className="flex-row justify-between items-center mb-3 pb-2 border-b border-slate-100">
              <View>
                <Text className="text-base font-extrabold text-slate-900">
                  Record Disbursal Payment
                </Text>
                <Text className="text-xs text-slate-500">
                  {selectedEmp?.fullName} ({selectedEmp?.designation})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPaymentModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs font-bold text-slate-600 mb-1">Disbursal Amount (₹) *</Text>
            <TextInput
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 mb-3 font-semibold"
              keyboardType="numeric"
              value={payAmount}
              onChangeText={setPayAmount}
            />

            <Text className="text-xs font-bold text-slate-600 mb-1">Payment Method *</Text>
            <View className="flex-row mb-3">
              {(['UPI', 'CASH', 'BANK_TRANSFER'] as PaymentMode[]).map((mode) => (
                <TouchableOpacity
                  key={mode}
                  className={`flex-1 py-2 items-center rounded-xl border mr-1.5 last:mr-0 ${
                    payMode === mode
                      ? 'bg-indigo-600 border-indigo-600 shadow-xs'
                      : 'bg-slate-50 border-slate-300'
                  }`}
                  onPress={() => setPayMode(mode)}
                >
                  <Text
                    className={`text-xs font-bold ${
                      payMode === mode ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    {mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-xs font-bold text-slate-600 mb-1">
              Transaction Reference / Voucher Note
            </Text>
            <TextInput
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 mb-4"
              placeholder={payMode === 'UPI' ? 'UPI UTR # e.g. 43920192831' : 'Cash Voucher # 409'}
              value={payRef}
              onChangeText={setPayRef}
            />

            <TouchableOpacity
              className="bg-emerald-600 py-3.5 rounded-xl items-center shadow-xs mb-8"
              onPress={handleConfirmDisbursal}
              disabled={submittingPay}
            >
              {submittingPay ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text className="text-white font-bold text-sm">Confirm & Log Payment</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
