import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Linking,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { dataService } from '../../src/services/dataService';
import { notificationService } from '../../src/services/notificationService';
import { Employee, SalaryTransaction, AttendanceRecord, TransactionType, PaymentMode } from '../../src/types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  PlusCircle,
  X,
  Send,
  ChevronLeft,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react-native';

export default function EmployeeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [fin, setFin] = useState<any>(null);
  const [transactions, setTransactions] = useState<SalaryTransaction[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetting2fa, setResetting2fa] = useState(false);

  // Form State
  const [txType, setTxType] = useState<TransactionType>('ADVANCE_PAID');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('UPI');
  const [referenceId, setReferenceId] = useState('');
  const [notes, setNotes] = useState('');

  const loadData = async () => {
    if (!id) return;
    try {
      const [emp, f, txs, att] = await Promise.all([
        dataService.getEmployeeById(id),
        dataService.getEmployeeFinancialSummary(id),
        dataService.getTransactions(id),
        dataService.getAttendance(id),
      ]);
      setEmployee(emp || null);
      setFin(f);
      setTransactions(txs);
      setAttendance(att);
    } catch (err) {
      console.error('Failed to load employee details:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50">
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text className="text-xs text-slate-500 font-medium mt-3">Loading employee profile from cloud...</Text>
      </View>
    );
  }

  if (!employee) {
    return (
      <View className="flex-1 justify-center items-center bg-slate-50 p-6">
        <Text className="text-slate-700 font-bold text-base">Employee not found.</Text>
        <TouchableOpacity className="mt-4 px-4 py-2 bg-indigo-600 rounded-xl" onPress={() => router.back()}>
          <Text className="text-white font-bold text-xs">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nightPresentCount = attendance.filter((a) => a.isNightPresent).length;

  const handleRecordPayment = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    const res = await dataService.recordTransaction({
      employeeId: employee.id,
      employeeName: employee.fullName,
      type: txType,
      amount: val,
      paymentMode,
      referenceId: referenceId.trim() || undefined,
      paymentDate: new Date().toISOString().split('T')[0],
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (res.success) {
      await notificationService.sendInstantNotification(
        txType === 'ADVANCE_PAID' ? 'Advance Disbursed 💰' : 'Salary Disbursed 💵',
        `₹${val.toLocaleString()} recorded for ${employee.fullName} via ${paymentMode}.`
      );
      Alert.alert('Recorded', res.message);
      setAmount('');
      setReferenceId('');
      setNotes('');
      setModalVisible(false);
      await loadData();
    } else {
      Alert.alert('Error', res.message);
    }
  };

  const openUpiIntent = () => {
    if (!employee.bankUpiId) {
      Alert.alert('No UPI ID', 'This employee has no registered UPI ID.');
      return;
    }
    const upiUrl = `upi://pay?pa=${employee.bankUpiId}&pn=${encodeURIComponent(employee.fullName)}&am=${amount || 1000}&cu=INR`;
    Linking.openURL(upiUrl).catch(() => {
      Alert.alert('Notice', 'No UPI application (GPay, PhonePe, Paytm) installed to handle the intent.');
    });
  };

  const handleResetAuthenticator = () => {
    Alert.alert(
      'Reset Google Authenticator?',
      `This will unlink Google Authenticator for ${employee.fullName}. On their next login, they will be asked to link Google Authenticator again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset 2FA',
          style: 'destructive',
          onPress: async () => {
            setResetting2fa(true);
            const res = await dataService.resetTotp(employee.id);
            setResetting2fa(false);
            if (res.success) {
              Alert.alert('Authenticator Reset', res.message);
              await loadData();
            } else {
              Alert.alert('Error', res.message);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-12"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Top Back & Header */}
      <TouchableOpacity className="flex-row items-center mb-3" onPress={() => router.back()}>
        <ChevronLeft size={18} color="#4f46e5" />
        <Text className="text-indigo-600 font-bold text-xs ml-1">Back to Directory</Text>
      </TouchableOpacity>

      {/* Profile Card */}
      <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-4">
        <View className="flex-row items-center mb-4">
          <View className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 items-center justify-center mr-3">
            <Text className="text-base font-black text-indigo-700">
              {employee.fullName.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-black text-slate-900">{employee.fullName}</Text>
            <Text className="text-xs text-slate-500 mt-0.5">{employee.designation}</Text>
            <Text className="text-xs text-indigo-600 font-bold mt-0.5">+91 {employee.mobileNumber}</Text>
          </View>
        </View>

        <View className="flex-row pt-3 border-t border-slate-100">
          <View className="flex-1">
            <Text className="text-[10px] text-slate-500 uppercase font-bold">Base Salary</Text>
            <Text className="text-xs font-black text-slate-900 mt-0.5">
              ₹{employee.baseSalary.toLocaleString()}/{employee.salaryType}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-[10px] text-slate-500 uppercase font-bold">Night Present</Text>
            <Text className="text-xs font-black text-purple-700 mt-0.5">
              {nightPresentCount} shift(s)
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-[10px] text-slate-500 uppercase font-bold">UPI ID</Text>
            <Text className="text-xs font-bold text-slate-900 mt-0.5" numberOfLines={1}>
              {employee.bankUpiId || 'Not Set'}
            </Text>
          </View>
        </View>

        {/* Google Authenticator 2FA Status & Reset */}
        <View
          style={{
            marginTop: 14,
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: '#f1f5f9',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShieldCheck
              size={16}
              color={employee.is2faEnabled ? '#059669' : '#d97706'}
            />
            <View>
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
                Google Authenticator
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: employee.is2faEnabled ? '#047857' : '#b45309',
                  marginTop: 1,
                }}
              >
                {employee.is2faEnabled ? 'Linked & Active' : 'Pending First-Time Setup'}
              </Text>
            </View>
          </View>

          {employee.is2faEnabled && (
            <TouchableOpacity
              disabled={resetting2fa}
              onPress={handleResetAuthenticator}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: 10,
                backgroundColor: '#fef2f2',
                borderWidth: 1,
                borderColor: '#fecaca',
                opacity: resetting2fa ? 0.5 : 1,
              }}
            >
              <RotateCcw size={13} color="#dc2626" />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626' }}>
                {resetting2fa ? 'Resetting...' : 'Reset 2FA'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Financial Health & Advance Passbook */}
      <View className="bg-indigo-950 rounded-3xl p-5 mb-5">
        <Text className="text-indigo-300 text-[10px] font-black uppercase tracking-wider">
          EMPLOYEE PASSBOOK
        </Text>

        <View className="flex-row my-3.5 space-x-3">
          {/* Active Advance Due */}
          <View className="flex-1 mr-2">
            <Text className="text-indigo-200 text-xs">Active Advance Due</Text>
            <Text className="text-2xl font-black text-rose-400 mt-0.5">
              ₹{(fin?.activeAdvanceBalance || 0).toLocaleString()}
            </Text>
            <Text className="text-indigo-400 text-[10px] mt-0.5">
              Total Taken: ₹{(fin?.totalAdvancesTaken || 0).toLocaleString()}
            </Text>
          </View>

          {/* Pending Salary */}
          <View className="flex-1">
            <Text className="text-indigo-200 text-xs">Pending Take-Home</Text>
            <Text className="text-2xl font-black text-emerald-400 mt-0.5">
              ₹{(fin?.pendingPayable || 0).toLocaleString()}
            </Text>
            <Text className="text-indigo-400 text-[10px] mt-0.5">
              Earned: ₹{(fin?.estimatedCurrentEarnings || 0).toLocaleString()}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          className="bg-indigo-600 rounded-xl py-3 flex-row items-center justify-center"
          onPress={() => setModalVisible(true)}
        >
          <PlusCircle size={16} color="#ffffff" />
          <Text className="text-white text-xs font-bold ml-2">
            Record Advance or Salary Payment
          </Text>
        </TouchableOpacity>
      </View>

      {/* Complete Transaction & Advance Ledger History */}
      <Text className="text-base font-extrabold text-slate-900 mb-3">
        Payment & Advance Ledger ({transactions.length})
      </Text>

      {transactions.length === 0 ? (
        <View className="bg-white p-6 rounded-2xl items-center border border-slate-200">
          <Text className="text-xs text-slate-400">No historical transactions recorded.</Text>
        </View>
      ) : (
        transactions.map((tx) => (
          <View
            key={tx.id}
            className="bg-white rounded-2xl p-3.5 flex-row justify-between items-center border border-slate-200 mb-2.5"
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
                  {tx.type === 'ADVANCE_PAID'
                    ? 'Advance Disbursed'
                    : tx.type === 'SALARY_PAYMENT'
                    ? 'Salary Disbursed'
                    : tx.type}
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

      {/* Payment / Advance Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4 pb-2 border-b border-slate-100">
              <Text className="text-base font-extrabold text-slate-900">
                Record Payment / Advance
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView className="pb-5">
              {/* Type Switcher */}
              <Text className="text-xs font-bold text-slate-600 mb-1">Transaction Purpose</Text>
              <View className="flex-row mb-3">
                <TouchableOpacity
                  className={`flex-1 py-2.5 items-center rounded-xl mr-2 ${
                    txType === 'ADVANCE_PAID' ? 'bg-rose-600' : 'bg-slate-100'
                  }`}
                  onPress={() => setTxType('ADVANCE_PAID')}
                >
                  <Text
                    className={`text-xs font-bold ${
                      txType === 'ADVANCE_PAID' ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    Advance Payment
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 py-2.5 items-center rounded-xl ${
                    txType === 'SALARY_PAYMENT' ? 'bg-emerald-600' : 'bg-slate-100'
                  }`}
                  onPress={() => setTxType('SALARY_PAYMENT')}
                >
                  <Text
                    className={`text-xs font-bold ${
                      txType === 'SALARY_PAYMENT' ? 'text-white' : 'text-slate-600'
                    }`}
                  >
                    Salary Disbursal
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Amount */}
              <Text className="text-xs font-bold text-slate-600 mb-1">Amount (₹) *</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 mb-3 font-semibold"
                placeholder="e.g. 5000"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />

              {/* Payment Mode */}
              <Text className="text-xs font-bold text-slate-600 mb-1">Payment Mode *</Text>
              <View className="flex-row mb-3">
                {(['UPI', 'CASH', 'BANK_TRANSFER'] as PaymentMode[]).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    className={`flex-1 py-2 items-center rounded-xl border mr-1.5 last:mr-0 ${
                      paymentMode === mode
                        ? 'bg-indigo-600 border-indigo-600'
                        : 'bg-slate-50 border-slate-300'
                    }`}
                    onPress={() => setPaymentMode(mode)}
                  >
                    <Text
                      className={`text-xs font-bold ${
                        paymentMode === mode ? 'text-white' : 'text-slate-600'
                      }`}
                    >
                      {mode}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* UPI Quick Action */}
              {paymentMode === 'UPI' && employee.bankUpiId && (
                <TouchableOpacity
                  className="flex-row items-center bg-indigo-50 p-2.5 rounded-xl mb-3 border border-indigo-100"
                  onPress={openUpiIntent}
                >
                  <Send size={14} color="#4f46e5" />
                  <Text className="text-xs font-bold text-indigo-700 ml-1.5">
                    Launch UPI App (to: {employee.bankUpiId})
                  </Text>
                </TouchableOpacity>
              )}

              {/* Reference ID */}
              <Text className="text-xs font-bold text-slate-600 mb-1">Reference / Receipt Note</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 mb-3"
                placeholder={paymentMode === 'UPI' ? 'UPI UTR # e.g. 43920192831' : 'Cash Voucher # or Slip No'}
                value={referenceId}
                onChangeText={setReferenceId}
              />

              {/* Notes */}
              <Text className="text-xs font-bold text-slate-600 mb-1">Notes (Optional)</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 h-16 mb-4"
                placeholder="e.g. Emergency advance, requested for medical bills"
                multiline
                value={notes}
                onChangeText={setNotes}
              />

              <TouchableOpacity
                className="bg-indigo-600 py-3.5 rounded-xl items-center mb-8"
                onPress={handleRecordPayment}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-white font-bold text-sm">Save to Ledger</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
