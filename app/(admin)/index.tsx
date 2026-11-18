import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/store/authContext';
import { dataService } from '../../src/services/dataService';
import { notificationService } from '../../src/services/notificationService';
import { Employee, AttendanceRecord, LeaveRequest } from '../../src/types';
import {
  Users,
  UserCheck,
  Moon,
  AlertCircle,
  IndianRupee,
  Plus,
  ChevronRight,
  CalendarDays,
  FileCheck2,
  BellRing,
} from 'lucide-react-native';

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [totalAdvances, setTotalAdvances] = useState(0);

  const loadDashboard = async () => {
    try {
      const [allEmps, atts, lvs, txs] = await Promise.all([
        dataService.getEmployees(),
        dataService.getAttendance(),
        dataService.getLeaves(),
        dataService.getTransactions(),
      ]);

      const staff = allEmps.filter((e) => e.role === 'employee');
      setEmployees(staff);
      setAttendance(atts);
      setLeaves(lvs);

      // Compute total advance balance
      const taken = txs.filter((t) => t.type === 'ADVANCE_PAID').reduce((sum, t) => sum + t.amount, 0);
      const recovered = txs.filter((t) => t.type === 'DEDUCTION').reduce((sum, t) => sum + t.amount, 0);
      setTotalAdvances(Math.max(0, taken - recovered));
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboard();
  }, []);

  const today = new Date().toISOString().split('T')[0];
  const todayAttendance = attendance.filter((a) => a.date === today);
  const nightPresentCount = attendance.filter((a) => a.isNightPresent).length;
  const pendingLeaves = leaves.filter((l) => l.status === 'PENDING');

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-12"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Top Header & Quick Add */}
      <View className="flex-row justify-between items-center mb-5">
        <View>
          <View className="flex-row items-center">
            <Text className="text-xs text-slate-500 font-bold uppercase tracking-wider">Administrator Control</Text>
            {dataService.isCloud() && (
              <View className="ml-2 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Text className="text-[10px] font-bold text-emerald-700">Cloud Live</Text>
              </View>
            )}
          </View>
          <Text className="text-2xl font-black text-slate-900 mt-0.5">{user?.fullName || 'Administrator'}</Text>
        </View>
        <TouchableOpacity
          className="flex-row items-center bg-indigo-600 px-3.5 py-2.5 rounded-xl"
          onPress={() => router.push('/(admin)/employees')}
        >
          <Plus size={15} color="#ffffff" />
          <Text className="text-white text-xs font-bold ml-1.5">Add Staff</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="py-12 items-center">
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text className="text-xs text-slate-500 font-medium mt-3">Connecting to cloud database...</Text>
        </View>
      ) : (
        <>
          {/* Primary KPI Grid */}
          <View className="flex-row flex-wrap justify-between mb-5">
            {/* Total Employees */}
            <TouchableOpacity
              className="w-[48%] bg-white rounded-2xl p-4 border border-slate-200 mb-3"
              onPress={() => router.push('/(admin)/employees')}
            >
              <View className="w-8 h-8 rounded-lg bg-indigo-50 items-center justify-center mb-2">
                <Users size={16} color="#4f46e5" />
              </View>
              <Text className="text-2xl font-black text-slate-900">{employees.length}</Text>
              <Text className="text-xs text-slate-500 mt-0.5 font-medium">Total Registered Staff</Text>
            </TouchableOpacity>

            {/* Present Today */}
            <TouchableOpacity
              className="w-[48%] bg-white rounded-2xl p-4 border border-slate-200 mb-3"
              onPress={() => router.push('/(admin)/attendance')}
            >
              <View className="w-8 h-8 rounded-lg bg-emerald-50 items-center justify-center mb-2">
                <UserCheck size={16} color="#059669" />
              </View>
              <Text className="text-2xl font-black text-emerald-600">{todayAttendance.length}</Text>
              <Text className="text-xs text-slate-500 mt-0.5 font-medium">Present Today</Text>
            </TouchableOpacity>

            {/* Night Shifts */}
            <TouchableOpacity
              className="w-[48%] bg-purple-50/50 rounded-2xl p-4 border border-purple-200 mb-3"
              onPress={() => router.push('/(admin)/attendance')}
            >
              <View className="w-8 h-8 rounded-lg bg-purple-100 items-center justify-center mb-2">
                <Moon size={16} color="#7c3aed" />
              </View>
              <Text className="text-2xl font-black text-purple-900">{nightPresentCount}</Text>
              <Text className="text-xs text-purple-700 mt-0.5 font-bold">Night Present Logs</Text>
            </TouchableOpacity>

            {/* Pending Leaves */}
            <TouchableOpacity
              className={`w-[48%] rounded-2xl p-4 border mb-3 ${
                pendingLeaves.length > 0
                  ? 'bg-amber-50/80 border-amber-300'
                  : 'bg-white border-slate-200'
              }`}
              onPress={() => router.push('/(admin)/leaves')}
            >
              <View className="w-8 h-8 rounded-lg bg-amber-100 items-center justify-center mb-2">
                <AlertCircle size={16} color="#d97706" />
              </View>
              <Text className="text-2xl font-black text-amber-800">{pendingLeaves.length}</Text>
              <Text className="text-xs text-amber-700 mt-0.5 font-bold">Pending Leaves</Text>
            </TouchableOpacity>
          </View>

          {/* Company Financial & Advance Exposure Card */}
          <View className="bg-slate-900 rounded-3xl p-5 mb-6">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                  Total Active Advance Balance
                </Text>
                <Text className="text-white text-3xl font-black mt-1">
                  ₹{totalAdvances.toLocaleString()}
                </Text>
              </View>
              <View className="bg-slate-800 p-2.5 rounded-xl">
                <IndianRupee size={20} color="#ffffff" />
              </View>
            </View>

            <Text className="text-slate-400 text-xs mt-2 leading-4">
              Across {employees.length} active staff accounts. All payments logged via UPI & Cash.
            </Text>

            <View className="flex-row mt-4 space-x-2">
              <TouchableOpacity
                className="flex-1 bg-slate-800 py-3 rounded-xl items-center mr-2"
                onPress={() => router.push('/(admin)/payroll')}
              >
                <Text className="text-slate-200 text-xs font-bold">Record UPI/Cash</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-indigo-600 py-3 rounded-xl items-center"
                onPress={() => router.push('/(admin)/payroll')}
              >
                <Text className="text-white text-xs font-bold">Generate Payslips</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Operations Hub */}
          <Text className="text-base font-extrabold text-slate-900 mb-3">Operations & Management Hub</Text>
          <View className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            <TouchableOpacity
              className="flex-row items-center p-3.5"
              onPress={() => router.push('/(admin)/employees')}
            >
              <View className="w-10 h-10 rounded-xl bg-indigo-50 items-center justify-center mr-3">
                <Users size={18} color="#4338ca" />
              </View>
              <View className="flex-1 mr-2">
                <Text className="text-sm font-bold text-slate-900">Employee Profiles & Ledger</Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  Select any employee to view salary history, advances & balance.
                </Text>
              </View>
              <ChevronRight size={16} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center p-3.5"
              onPress={() => router.push('/(admin)/attendance')}
            >
              <View className="w-10 h-10 rounded-xl bg-purple-50 items-center justify-center mr-3">
                <Moon size={18} color="#6d28d9" />
              </View>
              <View className="flex-1 mr-2">
                <Text className="text-sm font-bold text-slate-900">Attendance & Night Present</Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  Track GPS coordinates, verify mock locations & &gt;7 PM punches.
                </Text>
              </View>
              <ChevronRight size={16} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center p-3.5"
              onPress={() => router.push('/(admin)/leaves')}
            >
              <View className="w-10 h-10 rounded-xl bg-amber-50 items-center justify-center mr-3">
                <CalendarDays size={18} color="#b45309" />
              </View>
              <View className="flex-1 mr-2">
                <Text className="text-sm font-bold text-slate-900">Leave Approvals Queue</Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  {pendingLeaves.length} request(s) waiting for admin approval/rejection.
                </Text>
              </View>
              <ChevronRight size={16} color="#94a3b8" />
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-row items-center p-3.5"
              onPress={() => router.push('/(admin)/payroll')}
            >
              <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center mr-3">
                <FileCheck2 size={18} color="#15803d" />
              </View>
              <View className="flex-1 mr-2">
                <Text className="text-sm font-bold text-slate-900">Salary Disbursals & Payslips</Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  Calculate take-home, auto-deduct advances & export PDFs.
                </Text>
              </View>
              <ChevronRight size={16} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}
