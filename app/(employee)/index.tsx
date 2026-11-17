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
import { AttendanceRecord, Payslip } from '../../src/types';
import {
  Clock,
  Moon,
  CalendarCheck,
  CalendarX,
  FileText,
  ArrowRight,
  TrendingUp,
  MapPin,
  CheckCircle2,
  Bell,
  BellRing,
} from 'lucide-react-native';
import { isMissedPunch } from '../../src/services/payrollCalc';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | undefined>(undefined);
  const [finSummary, setFinSummary] = useState<any>(null);
  const [userAttendance, setUserAttendance] = useState<AttendanceRecord[]>([]);
  const [recentPayslip, setRecentPayslip] = useState<Payslip | undefined>(undefined);

  const loadData = async () => {
    if (!user) return;
    try {
      const [todayRec, fin, atts, slips] = await Promise.all([
        dataService.getTodayAttendance(user.id),
        dataService.getEmployeeFinancialSummary(user.id),
        dataService.getAttendance(user.id),
        dataService.getPayslips(user.id),
      ]);

      setTodayRecord(todayRec);
      setFinSummary(fin);
      setUserAttendance(atts);
      setRecentPayslip(slips[0]);
      notificationService.scheduleShiftReminders();
    } catch (err) {
      console.error('Failed to load employee dashboard data:', err);
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

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-10"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Welcome Card */}
      <View className="flex-row justify-between items-start mb-5">
        <View>
          <Text className="text-xs text-slate-500 font-medium">Welcome back,</Text>
          <Text className="text-2xl font-black text-slate-900 mt-0.5">{user.fullName}</Text>
          <Text className="text-xs text-slate-500 mt-0.5">
            {user.designation} • +91 {user.mobileNumber}
          </Text>
        </View>
        <View className="bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">
          <Text className="text-indigo-600 text-xs font-bold">
            {dataService.isCloud() ? '🟢 Cloud' : 'Employee'}
          </Text>
        </View>
      </View>

      {/* Today's Punch Widget */}
      <View className="bg-slate-900 rounded-3xl p-5 mb-6 shadow-md shadow-slate-300">
        <View className="flex-row justify-between items-center mb-2.5">
          <View className="flex-row items-center">
            <View
              className={`w-2.5 h-2.5 rounded-full mr-2 ${
                todayRecord?.checkOutTime
                  ? 'bg-slate-400'
                  : todayRecord?.checkInTime
                  ? 'bg-emerald-500'
                  : 'bg-amber-400'
              }`}
            />
            <Text className="text-slate-300 text-xs font-bold uppercase tracking-wider">
              {todayRecord?.checkOutTime
                ? 'Punch Completed for Today'
                : todayRecord?.checkInTime
                ? 'Currently Checked In'
                : 'Not Checked In Yet'}
            </Text>
          </View>
          {todayRecord?.isNightPresent && (
            <View className="flex-row items-center bg-purple-100 px-2 py-0.5 rounded-full">
              <Moon size={11} color="#7c3aed" />
              <Text className="text-purple-700 text-xs font-bold ml-1">Night Present</Text>
            </View>
          )}
        </View>

        <Text className="text-white text-base font-bold mb-1">
          {todayRecord?.checkInTime
            ? `Checked In: ${new Date(todayRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            : 'Remember to check in with GPS upon arrival.'}
        </Text>

        {todayRecord?.checkOutTime && (
          <Text className="text-slate-400 text-xs mb-3">
            Checked Out: {new Date(todayRecord.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        )}

        <TouchableOpacity
          className="bg-indigo-600 py-3 rounded-xl flex-row items-center justify-center mt-3 active:bg-indigo-700"
          activeOpacity={0.8}
          onPress={() => router.push('/(employee)/attendance')}
        >
          <Clock size={16} color="#ffffff" />
          <Text className="text-white text-sm font-bold ml-2">
            {todayRecord?.checkInTime && !todayRecord?.checkOutTime ? 'Punch Out Now' : 'Open Attendance Screen'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Monthly Metrics Grid */}
      <Text className="text-base font-extrabold text-slate-900 mb-3">This Month at a Glance</Text>
      <View className="flex-row flex-wrap justify-between mb-5">
        {/* Present Days */}
        <View className="w-[48%] bg-white rounded-2xl p-4 border border-slate-200 mb-3">
          <View className="w-9 h-9 rounded-xl bg-emerald-50 items-center justify-center mb-2">
            <CalendarCheck size={18} color="#059669" />
          </View>
          <Text className="text-2xl font-black text-slate-900">{finSummary?.presentDays || 0}</Text>
          <Text className="text-xs text-slate-500 mt-0.5 font-medium">Present Days</Text>
        </View>

        {/* Night Present Records (> 7:00 PM) */}
        <View className="w-[48%] bg-purple-50/40 rounded-2xl p-4 border border-purple-200 mb-3">
          <View className="w-9 h-9 rounded-xl bg-purple-100 items-center justify-center mb-2">
            <Moon size={18} color="#7c3aed" />
          </View>
          <Text className="text-2xl font-black text-purple-900">{finSummary?.nightPresentDays || 0}</Text>
          <Text className="text-xs text-purple-700 mt-0.5 font-bold">Night Present (&gt;7 PM)</Text>
        </View>

        {/* Leaves Taken */}
        <View className="w-[48%] bg-white rounded-2xl p-4 border border-slate-200 mb-3">
          <View className="w-9 h-9 rounded-xl bg-amber-50 items-center justify-center mb-2">
            <CalendarX size={18} color="#d97706" />
          </View>
          <Text className="text-2xl font-black text-slate-900">
            {finSummary?.leavesTaken || 0}
          </Text>
          <Text className="text-xs text-slate-500 mt-0.5 font-medium">Paid Leave Days</Text>
        </View>

        {/* Estimated Current Earnings */}
        <View className="w-[48%] bg-white rounded-2xl p-4 border border-slate-200 mb-3">
          <View className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center mb-2">
            <TrendingUp size={18} color="#2563eb" />
          </View>
          <Text className="text-2xl font-black text-blue-900">
            ₹{(finSummary?.estimatedCurrentEarnings || 0).toLocaleString()}
          </Text>
          <Text className="text-xs text-slate-500 mt-0.5 font-medium">Earned this Month</Text>
        </View>
      </View>

      {/* Financial Status Summary */}
      <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-6">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-sm font-bold text-slate-900">Salary & Advance Overview</Text>
          <TouchableOpacity onPress={() => router.push('/(employee)/payslips')}>
            <Text className="text-xs text-indigo-600 font-bold">View Details &gt;</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-between py-2 border-b border-slate-100">
          <Text className="text-xs text-slate-500">Base Monthly Salary</Text>
          <Text className="text-xs font-bold text-slate-900">₹{user.baseSalary.toLocaleString()}</Text>
        </View>

        <View className="flex-row justify-between py-2 border-b border-slate-100">
          <Text className="text-xs text-slate-500">Active Advance Due</Text>
          <Text className="text-xs font-bold text-rose-500">
            - ₹{(finSummary?.activeAdvanceBalance || 0).toLocaleString()}
          </Text>
        </View>

        <View className="flex-row justify-between py-2 px-2 bg-slate-50 rounded-lg mt-1">
          <Text className="text-xs font-bold text-slate-900">Est. Net Take-Home</Text>
          <Text className="text-sm font-black text-emerald-600">
            ₹{(finSummary?.pendingPayable || 0).toLocaleString()}
          </Text>
        </View>

        {recentPayslip && (
          <TouchableOpacity
            className="flex-row items-center bg-indigo-50 p-3 rounded-xl mt-3"
            onPress={() => router.push('/(employee)/payslips')}
          >
            <FileText size={16} color="#4f46e5" />
            <Text className="flex-1 ml-2 text-xs font-bold text-indigo-700">
              Latest Payslip: {recentPayslip.monthYear} ({recentPayslip.paymentStatus})
            </Text>
            <ArrowRight size={14} color="#4f46e5" />
          </TouchableOpacity>
        )}
      </View>

      {/* Recent Attendance Logs */}
      <Text className="text-base font-extrabold text-slate-900 mb-3">Recent Attendance Logs</Text>
      <View className="bg-white rounded-2xl p-3 border border-slate-200">
        {userAttendance.length === 0 ? (
          <View className="p-4 items-center">
            <Text className="text-xs text-slate-400">No attendance logs yet.</Text>
          </View>
        ) : (
          userAttendance.slice(0, 3).map((item) => (
            <View
              key={item.id}
              className="flex-row justify-between items-center py-2.5 border-b border-slate-100 last:border-b-0"
            >
              <View className="flex-row items-center flex-1 mr-2">
                <View className="bg-slate-100 rounded-lg py-1 px-2 items-center mr-3">
                  <Text className="text-xs font-black text-slate-800">{item.date.split('-')[2]}</Text>
                  <Text className="text-[10px] text-slate-500 font-bold uppercase">
                    {new Date(item.date).toLocaleString('default', { month: 'short' })}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-bold text-slate-900">
                    {item.checkInTime ? new Date(item.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                    {' → '}
                    {item.checkOutTime ? new Date(item.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Working'}
                  </Text>
                  <View className="flex-row items-center mt-0.5">
                    <MapPin size={10} color="#94a3b8" />
                    <Text className="text-[11px] text-slate-500 ml-1" numberOfLines={1}>
                      {item.checkInLocation?.address || 'Office Location'}
                    </Text>
                  </View>
                </View>
              </View>

              {isMissedPunch(item) ? (
                <View className="bg-rose-100 px-2 py-1 rounded-md">
                  <Text className="text-[10px] font-bold text-rose-700">Missed Punch-out</Text>
                </View>
              ) : item.status === 'ABSENT' ? (
                <View className="bg-rose-100 px-2 py-1 rounded-md">
                  <Text className="text-[10px] font-bold text-rose-700">Short Shift</Text>
                </View>
              ) : item.status === 'HALF_DAY' ? (
                <View className="bg-amber-100 px-2 py-1 rounded-md">
                  <Text className="text-[10px] font-bold text-amber-700">Half Day{item.isNightPresent ? ' • Night' : ''}</Text>
                </View>
              ) : item.isNightPresent ? (
                <View className="flex-row items-center bg-purple-100 px-2 py-1 rounded-md">
                  <Moon size={10} color="#7c3aed" />
                  <Text className="text-[10px] font-bold text-purple-700 ml-1">Night (&gt;7 PM)</Text>
                </View>
              ) : (
                <View className="flex-row items-center bg-emerald-100 px-2 py-1 rounded-md">
                  <CheckCircle2 size={10} color="#059669" />
                  <Text className="text-[10px] font-bold text-emerald-700 ml-1">Present</Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
