import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { dataService } from '../../src/services/dataService';
import { Employee, SalaryType, SalaryTransaction } from '../../src/types';
import {
  UserPlus,
  Search,
  Phone,
  Briefcase,
  ChevronRight,
  X,
  Check,
} from 'lucide-react-native';

export default function AdminEmployeesScreen() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [salaryType, setSalaryType] = useState<SalaryType>('monthly');
  const [bankUpiId, setBankUpiId] = useState('');

  const loadData = async () => {
    try {
      const [allEmps, txs] = await Promise.all([
        dataService.getEmployees(),
        dataService.getTransactions(),
      ]);

      setEmployees(allEmps.filter((e) => e.role === 'employee'));

      // Calculate advance balances map
      const advMap: Record<string, number> = {};
      allEmps.forEach((emp) => {
        const empTxs = txs.filter((t) => t.employeeId === emp.id);
        const taken = empTxs.filter((t) => t.type === 'ADVANCE_PAID').reduce((sum, t) => sum + t.amount, 0);
        const recovered = empTxs.filter((t) => t.type === 'DEDUCTION').reduce((sum, t) => sum + t.amount, 0);
        advMap[emp.id] = Math.max(0, taken - recovered);
      });
      setAdvances(advMap);
    } catch (err: any) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, []);

  const handleRegister = async () => {
    if (!fullName.trim()) {
      Alert.alert('Required Field', 'Please enter employee full name.');
      return;
    }
    const cleanMobile = mobileNumber.trim().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
      Alert.alert('Invalid Mobile', 'Registered mobile number must be exactly 10 digits.');
      return;
    }
    const salary = parseFloat(baseSalary);
    if (isNaN(salary) || salary <= 0) {
      Alert.alert('Invalid Salary', 'Please specify a valid base salary amount.');
      return;
    }

    setSubmitting(true);
    const res = await dataService.addEmployee({
      fullName: fullName.trim(),
      mobileNumber: cleanMobile,
      designation: designation.trim() || 'General Staff',
      baseSalary: salary,
      salaryType,
      role: 'employee',
      joiningDate: new Date().toISOString().split('T')[0],
      bankUpiId: bankUpiId.trim() || undefined,
    });
    setSubmitting(false);

    if (res.success) {
      Alert.alert('Success', `Employee registered! They can now log in using +91 ${cleanMobile}.`);
      setFullName('');
      setMobileNumber('');
      setDesignation('');
      setBaseSalary('');
      setBankUpiId('');
      setModalVisible(false);
      await loadData();
    } else {
      Alert.alert('Registration Failed', res.message);
    }
  };

  const filtered = employees.filter(
    (emp) =>
      emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.mobileNumber.includes(searchQuery) ||
      emp.designation.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View className="flex-1 bg-slate-50">
      {/* Search & Add Action Header */}
      <View className="flex-row p-4 bg-white border-b border-slate-200">
        <View className="flex-1 flex-row items-center bg-slate-100 rounded-xl px-3 py-1 mr-2.5">
          <Search size={16} color="#94a3b8" />
          <TextInput
            className="flex-1 ml-2 text-xs text-slate-900 py-2 font-medium"
            placeholder="Search by name, mobile, or role..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          className="flex-row items-center bg-indigo-600 px-3.5 py-2 rounded-xl shadow-xs"
          onPress={() => setModalVisible(true)}
        >
          <UserPlus size={16} color="#ffffff" />
          <Text className="text-white text-xs font-bold ml-1.5">Add</Text>
        </TouchableOpacity>
      </View>

      {/* Employee List */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text className="text-xs text-slate-500 font-medium mt-3">Connecting to cloud database...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="p-4 pb-12"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
              Registered Workforce ({filtered.length})
            </Text>
            {dataService.isCloud() && (
              <Text className="text-[10px] font-bold text-emerald-600">🟢 Cloud Synced</Text>
            )}
          </View>

          {filtered.length === 0 ? (
            <View className="bg-white rounded-2xl p-6 items-center border border-slate-200 mt-4">
              <Text className="text-slate-500 font-medium text-sm">No employees found.</Text>
            </View>
          ) : (
            filtered.map((emp) => {
              const activeAdv = advances[emp.id] || 0;
              return (
                <TouchableOpacity
                  key={emp.id}
                  className="bg-white rounded-2xl p-3.5 flex-row items-center justify-between border border-slate-200 mb-2.5 shadow-xs"
                  activeOpacity={0.7}
                  onPress={() => {
                    router.push({
                      pathname: '/(admin)/employee-detail',
                      params: { id: emp.id },
                    });
                  }}
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center mr-3 border border-indigo-100">
                      <Text className="text-xs font-black text-indigo-700">
                        {emp.fullName.slice(0, 2).toUpperCase()}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <Text className="text-sm font-bold text-slate-900">{emp.fullName}</Text>
                      <View className="flex-row items-center mt-1">
                        <Briefcase size={11} color="#64748b" />
                        <Text className="text-[11px] text-slate-500 ml-1">{emp.designation}</Text>
                        <Text className="mx-1.5 text-slate-300">•</Text>
                        <Phone size={11} color="#64748b" />
                        <Text className="text-[11px] text-slate-500 ml-1">+91 {emp.mobileNumber}</Text>
                      </View>
                    </View>
                  </View>

                  <View className="flex-row items-center">
                    <View className="items-end mr-2">
                      <Text className="text-xs font-bold text-slate-900">
                        ₹{emp.baseSalary.toLocaleString()}/{emp.salaryType === 'monthly' ? 'mo' : 'day'}
                      </Text>
                      {activeAdv > 0 && (
                        <Text className="text-[10px] font-bold text-rose-500 mt-0.5">
                          Adv: ₹{activeAdv.toLocaleString()}
                        </Text>
                      )}
                    </View>
                    <ChevronRight size={16} color="#cbd5e1" />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Registration Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl p-5 max-h-[85%]">
            <View className="flex-row justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <Text className="text-base font-extrabold text-slate-900">Register New Employee</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView className="pb-5">
              <Text className="text-xs font-bold text-slate-600 mb-1">Full Name *</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 mb-3"
                placeholder="e.g. Sunil Verma"
                value={fullName}
                onChangeText={setFullName}
              />

              <Text className="text-xs font-bold text-slate-600 mb-1">Registered Mobile Number (Login ID) *</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 mb-3"
                placeholder="10-digit mobile number"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobileNumber}
                onChangeText={setMobileNumber}
              />

              <Text className="text-xs font-bold text-slate-600 mb-1">Designation *</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 mb-3"
                placeholder="e.g. Assembly Operator, Field Tech"
                value={designation}
                onChangeText={setDesignation}
              />

              <View className="flex-row mb-3 space-x-2">
                <View className="flex-1 mr-2">
                  <Text className="text-xs font-bold text-slate-600 mb-1">Base Salary (₹) *</Text>
                  <TextInput
                    className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900"
                    placeholder="e.g. 25000"
                    keyboardType="numeric"
                    value={baseSalary}
                    onChangeText={setBaseSalary}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-600 mb-1">Pay Model</Text>
                  <View className="flex-row bg-slate-100 rounded-xl p-1">
                    <TouchableOpacity
                      className={`flex-1 py-2 items-center rounded-lg ${
                        salaryType === 'monthly' ? 'bg-white shadow-xs' : ''
                      }`}
                      onPress={() => setSalaryType('monthly')}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          salaryType === 'monthly' ? 'text-indigo-600' : 'text-slate-500'
                        }`}
                      >
                        Monthly
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`flex-1 py-2 items-center rounded-lg ${
                        salaryType === 'daily' ? 'bg-white shadow-xs' : ''
                      }`}
                      onPress={() => setSalaryType('daily')}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          salaryType === 'daily' ? 'text-indigo-600' : 'text-slate-500'
                        }`}
                      >
                        Daily
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text className="text-xs font-bold text-slate-600 mb-1">Employee UPI ID (for instant transfer)</Text>
              <TextInput
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 mb-4"
                placeholder="e.g. sunil@okhdfcbank"
                value={bankUpiId}
                onChangeText={setBankUpiId}
              />

              <TouchableOpacity
                className="bg-indigo-600 flex-row items-center justify-center py-3.5 rounded-xl shadow-xs mb-8"
                onPress={handleRegister}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Check size={16} color="#ffffff" />
                    <Text className="text-white font-bold text-sm ml-2">Confirm Registration</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
