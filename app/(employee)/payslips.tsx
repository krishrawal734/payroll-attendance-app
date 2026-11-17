import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../src/store/authContext';
import { dataService } from '../../src/services/dataService';
import { shareOrPrintPayslip, promptPayslipOptions } from '../../src/services/pdfService';
import { Payslip, SalaryTransaction } from '../../src/types';
import {
  FileText,
  Share2,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react-native';
import { isOverpayTransfer } from '../../src/services/payrollCalc';

export default function EmployeePayslipsScreen() {
  const { user } = useAuth();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [finSummary, setFinSummary] = useState<any>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [transactions, setTransactions] = useState<SalaryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!user) return;
    try {
      const [fin, slips, txs] = await Promise.all([
        dataService.getEmployeeFinancialSummary(user.id),
        dataService.getPayslips(user.id),
        dataService.getTransactions(user.id),
      ]);
      setFinSummary(fin);
      setPayslips(slips);
      setTransactions(txs);
    } catch (err) {
      console.error('Failed to load payslips:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [user?.id]);

  if (!user) return null;

  const handleSharePayslip = async (payslip: Payslip) => {
    promptPayslipOptions(
      payslip,
      user,
      () => setDownloadingId(payslip.id),
      () => setDownloadingId(null)
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-12"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Financial Standing Banner */}
      <View className="bg-indigo-950 rounded-3xl p-6 mb-5 shadow-sm">
        <Text className="text-indigo-300 text-xs font-bold uppercase tracking-wider">
          Current Financial Standing
        </Text>
        <Text className="text-white text-3xl font-black mt-1.5">
          ₹{(finSummary?.estimatedCurrentEarnings || 0).toLocaleString()}
        </Text>
        <Text className="text-indigo-200 text-xs mt-0.5">Estimated Month-to-Date Earnings</Text>

        <View className="flex-row mt-4 pt-4 border-t border-indigo-900/80">
          <View className="flex-1">
            <Text className="text-[11px] text-indigo-300">Active Advance Due</Text>
            <Text className="text-base font-black text-rose-400 mt-0.5">
              - ₹{(finSummary?.activeAdvanceBalance || 0).toLocaleString()}
            </Text>
          </View>
          <View className="w-px bg-indigo-900 mx-4" />
          <View className="flex-1">
            <Text className="text-[11px] text-indigo-300">Est. Net Take-Home</Text>
            <Text className="text-base font-black text-emerald-400 mt-0.5">
              ₹{(finSummary?.pendingPayable || 0).toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Generated Payslips */}
      <Text className="text-base font-extrabold text-slate-900 mb-3">Generated Payslips</Text>
      {loading ? (
        <View className="py-6 items-center">
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text className="text-xs text-slate-500 font-medium mt-3">Loading payslips...</Text>
        </View>
      ) : payslips.length === 0 ? (
        <View className="bg-white rounded-2xl p-6 items-center border border-slate-200 mb-4">
          <FileText size={32} color="#cbd5e1" />
          <Text className="text-xs text-slate-400 mt-1.5">No payslips generated for this period yet.</Text>
        </View>
      ) : (
        payslips.map((ps) => (
          <View key={ps.id} className="bg-white rounded-2xl p-4 border border-slate-200 mb-3 shadow-xs">
            <View className="flex-row justify-between items-start mb-2.5">
              <View>
                <Text className="text-sm font-extrabold text-slate-900">Month: {ps.monthYear}</Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  Generated on {new Date(ps.generatedAt).toLocaleDateString()}
                </Text>
              </View>
              <View
                className={`px-2 py-0.5 rounded-full border ${
                  ps.paymentStatus === 'PAID'
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-amber-50 border-amber-200'
                }`}
              >
                <Text
                  className={`text-[10px] font-black ${
                    ps.paymentStatus === 'PAID' ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {ps.paymentStatus}
                </Text>
              </View>
            </View>

            {/* Attendance Days */}
            <View className="flex-row items-center bg-slate-50 px-3 py-2 rounded-xl mb-3">
              <Text className="text-xs text-slate-600 font-medium">Present: {ps.presentDays}d</Text>
              <Text className="mx-2 text-slate-300">•</Text>
              <Text className="text-xs text-purple-700 font-bold">
                Night Shifts: {ps.nightPresentDays}d
              </Text>
              <Text className="mx-2 text-slate-300">•</Text>
              <Text className="text-xs text-slate-600 font-medium">Leaves: {ps.leavesTaken}d</Text>
            </View>

            {/* Financial Details */}
            <View className="flex-row justify-between items-center pt-2 border-t border-slate-100">
              <View>
                <Text className="text-[10px] text-slate-500 font-bold uppercase">Net Take-Home</Text>
                <Text className="text-base font-black text-slate-900">₹{ps.netPayable.toLocaleString()}</Text>
              </View>

              <TouchableOpacity
                className="bg-indigo-600 flex-row items-center px-3.5 py-2 rounded-xl shadow-xs"
                disabled={downloadingId === ps.id}
                onPress={() => handleSharePayslip(ps)}
              >
                {downloadingId === ps.id ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Share2 size={14} color="#ffffff" />
                    <Text className="text-white text-xs font-bold ml-1.5">PDF / Share</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Salary & Advance Payment History */}
      <Text className="text-base font-extrabold text-slate-900 mb-3 mt-1">Transaction & Advance History</Text>
      <View className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
        {transactions.length === 0 ? (
          <Text className="text-xs text-slate-400 p-2">No salary or advance transactions recorded.</Text>
        ) : (
          transactions.map((tx) => (
            <View
              key={tx.id}
              className="flex-row justify-between items-center py-3 border-b border-slate-100 last:border-b-0"
            >
              <View className="flex-row items-center flex-1 mr-2">
                <View
                  className={`w-9 h-9 rounded-xl items-center justify-center mr-2.5 ${
                    tx.type === 'ADVANCE_PAID' ? 'bg-rose-50' : 'bg-emerald-50'
                  }`}
                >
                  {tx.type === 'ADVANCE_PAID' ? (
                    <ArrowDownLeft size={16} color="#ef4444" />
                  ) : (
                    <ArrowUpRight size={16} color="#059669" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-900">
                    {isOverpayTransfer(tx)
                      ? 'Overpaid Salary → Advance'
                      : tx.type === 'ADVANCE_PAID'
                      ? 'Advance Received'
                      : tx.type === 'DEDUCTION'
                      ? 'Advance Recovered from Salary'
                      : 'Salary Disbursed'}
                  </Text>
                  <Text className="text-[11px] text-slate-500 mt-0.5">
                    {tx.paymentDate} • Via {tx.paymentMode} {tx.referenceId ? `(${tx.referenceId})` : ''}
                  </Text>
                  {tx.notes && <Text className="text-[10px] text-slate-400 italic mt-0.5">{tx.notes}</Text>}
                </View>
              </View>

              <Text
                className={`text-sm font-black ${
                  tx.type === 'ADVANCE_PAID' ? 'text-rose-500' : 'text-emerald-600'
                }`}
              >
                {tx.type === 'ADVANCE_PAID' ? '+' : ''}₹{tx.amount.toLocaleString()}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
