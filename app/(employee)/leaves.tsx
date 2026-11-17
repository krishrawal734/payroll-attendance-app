import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../src/store/authContext';
import { dataService } from '../../src/services/dataService';
import { LeaveRequest, LeaveType } from '../../src/types';
import { CalendarPickerModal } from '../../src/components/CalendarPickerModal';
import {
  CalendarPlus,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Calendar,
  Coffee,
  Stethoscope,
  PauseCircle,
  X,
} from 'lucide-react-native';

export default function EmployeeLeavesScreen() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Dynamic default dates (Today and Tomorrow)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [leaveType, setLeaveType] = useState<LeaveType>('CASUAL');
  const [fromDate, setFromDate] = useState<string>(todayStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [reason, setReason] = useState('');
  const [activeDatePicker, setActiveDatePicker] = useState<'FROM' | 'TO' | null>(null);
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  const loadLeaves = async () => {
    if (!user) return;
    try {
      const data = await dataService.getLeaves(user.id);
      setLeaves(data);
    } catch (err) {
      console.error('Failed to load leaves:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, [user?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLeaves();
  }, [user?.id]);

  if (!user) return null;

  // Helper to format date strings
  const formatDateDetails = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return {
          formatted: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
          weekday: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        };
      }
    } catch {}
    return { formatted: dateStr, weekday: '' };
  };

  // Helper to calculate total leave days
  const calculateDuration = (start: string, end: string) => {
    try {
      const s = new Date(start);
      const e = new Date(end);
      const diffTime = e.getTime() - s.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return diffDays > 0 ? diffDays : 1;
    } catch {
      return 1;
    }
  };

  const fromInfo = formatDateDetails(fromDate);
  const toInfo = formatDateDetails(toDate);
  const totalDays = calculateDuration(fromDate, toDate);

  const approvedLeaves = leaves.filter((l) => l.status === 'APPROVED');
  const pendingLeaves = leaves.filter((l) => l.status === 'PENDING');
  const rejectedLeaves = leaves.filter((l) => l.status === 'REJECTED');

  const filteredLeaves = leaves.filter((l) => {
    if (filterTab === 'PENDING') return l.status === 'PENDING';
    if (filterTab === 'APPROVED') return l.status === 'APPROVED';
    if (filterTab === 'REJECTED') return l.status === 'REJECTED';
    return true;
  });

  const handleApply = async () => {
    if (!reason.trim()) {
      Alert.alert('Required Field', 'Please provide a reason for your leave request.');
      return;
    }

    setSubmitting(true);
    const res = await dataService.applyLeave({
      employeeId: user.id,
      employeeName: user.fullName,
      leaveType,
      fromDate,
      toDate,
      reason: reason.trim(),
    });
    setSubmitting(false);

    if (res.success) {
      Alert.alert('Request Submitted', res.message);
      setReason('');
      setShowForm(false);
      await loadLeaves();
    } else {
      Alert.alert('Error', res.message);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-12"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Executive Leave Summary Banner */}
      <View className="bg-slate-900 rounded-3xl p-5 mb-4 shadow-sm border border-slate-800">
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-row items-center">
            <CalendarPlus size={16} color="#818cf8" />
            <Text className="text-indigo-300 text-xs font-black uppercase tracking-wider ml-1.5">
              My Leaves Overview
            </Text>
          </View>
          <View className="bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-700">
            <Text className="text-[10px] font-bold text-indigo-300">
              {new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center bg-slate-800 rounded-2xl p-3 border border-slate-700">
          <View className="items-center flex-1 border-r border-slate-700">
            <Text className="text-white text-xl font-black">{leaves.length}</Text>
            <Text className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Applied</Text>
          </View>
          <View className="items-center flex-1 border-r border-slate-700">
            <Text className="text-emerald-400 text-xl font-black">{approvedLeaves.length}</Text>
            <Text className="text-[10px] font-bold text-emerald-400 uppercase mt-0.5">Approved</Text>
          </View>
          <View className="items-center flex-1 border-r border-slate-700">
            <Text className="text-amber-400 text-xl font-black">{pendingLeaves.length}</Text>
            <Text className="text-[10px] font-bold text-amber-400 uppercase mt-0.5">Pending</Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-rose-400 text-xl font-black">{rejectedLeaves.length}</Text>
            <Text className="text-[10px] font-bold text-rose-400 uppercase mt-0.5">Rejected</Text>
          </View>
        </View>
      </View>

      {/* Top Action Card */}
      <View className="flex-row justify-between items-center bg-white rounded-2xl p-4 border border-slate-200 mb-4 shadow-sm">
        <View className="flex-1 mr-2">
          <Text className="text-base font-extrabold text-slate-900">Apply for Time-Off</Text>
          <Text className="text-xs text-slate-500 mt-0.5">Submit request for admin approval</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          className={`flex-row items-center px-4 py-2.5 rounded-xl ${
            showForm ? 'bg-slate-200' : 'bg-indigo-600'
          }`}
          onPress={() => setShowForm(!showForm)}
        >
          {showForm ? (
            <>
              <X size={14} color="#334155" />
              <Text className="text-slate-700 text-xs font-black ml-1.5">Close</Text>
            </>
          ) : (
            <>
              <CalendarPlus size={14} color="#ffffff" />
              <Text className="text-white text-xs font-black ml-1.5">New Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Apply Leave Form */}
      {showForm && (
        <View className="bg-white rounded-3xl p-5 border border-indigo-100 mb-5 shadow-sm">
          <View className="flex-row justify-between items-center mb-4">
            <View>
              <Text className="text-sm font-black text-slate-900">New Leave Application</Text>
              <Text className="text-[11px] text-slate-500 mt-0.5">Choose leave category and date range</Text>
            </View>
            <View className="bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
              <Text className="text-[10px] font-bold text-indigo-700">{user.fullName}</Text>
            </View>
          </View>

          {/* Leave Type Selector */}
          <Text className="text-xs font-bold text-slate-700 mb-2">Select Leave Type</Text>
          <View className="flex-row mb-4">
            {[
              { type: 'CASUAL' as LeaveType, label: 'Casual', icon: Coffee, desc: 'Personal' },
              { type: 'SICK' as LeaveType, label: 'Sick', icon: Stethoscope, desc: 'Medical' },
              { type: 'UNPAID' as LeaveType, label: 'Unpaid', icon: PauseCircle, desc: 'No Pay' },
            ].map((item) => {
              const active = leaveType === item.type;
              const IconComp = item.icon;

              return (
                <TouchableOpacity
                  key={item.type}
                  activeOpacity={0.7}
                  onPress={() => setLeaveType(item.type)}
                  className={`flex-1 p-3 rounded-2xl border items-center mr-2 last:mr-0 ${
                    active
                      ? 'bg-indigo-600 border-indigo-600 shadow-sm'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <IconComp size={18} color={active ? '#ffffff' : '#64748b'} />
                  <Text
                    className={`text-xs font-black mt-1.5 ${
                      active ? 'text-white' : 'text-slate-800'
                    }`}
                  >
                    {item.label}
                  </Text>
                  <Text
                    className={`text-[9px] font-semibold mt-0.5 ${
                      active ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {item.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Interactive Date Selection Cards */}
          <Text className="text-xs font-bold text-slate-700 mb-2">Leave Dates (Tap to pick date)</Text>
          <View className="flex-row items-center mb-4">
            {/* From Date Card */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveDatePicker('FROM')}
              className="flex-1 bg-indigo-50 border border-indigo-200 rounded-2xl p-3"
            >
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                  FROM DATE
                </Text>
                <Calendar size={13} color="#6366f1" />
              </View>
              <Text className="text-sm font-black text-slate-900">
                {fromInfo.formatted}
              </Text>
              <Text className="text-[10px] font-bold text-indigo-600 mt-0.5">
                {fromInfo.weekday}
              </Text>
            </TouchableOpacity>

            {/* Duration Tag */}
            <View className="px-2 items-center">
              <View className="bg-indigo-100 px-2.5 py-1 rounded-full border border-indigo-200">
                <Text className="text-[10px] font-black text-indigo-700">
                  {totalDays} {totalDays === 1 ? 'Day' : 'Days'}
                </Text>
              </View>
            </View>

            {/* To Date Card */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveDatePicker('TO')}
              className="flex-1 bg-indigo-50 border border-indigo-200 rounded-2xl p-3"
            >
              <View className="flex-row justify-between items-center mb-1">
                <Text className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                  TO DATE
                </Text>
                <Calendar size={13} color="#6366f1" />
              </View>
              <Text className="text-sm font-black text-slate-900">
                {toInfo.formatted}
              </Text>
              <Text className="text-[10px] font-bold text-indigo-600 mt-0.5">
                {toInfo.weekday}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Reason for Absence */}
          <Text className="text-xs font-bold text-slate-700 mb-1.5">Reason for Absence *</Text>
          <TextInput
            className="bg-slate-50 border border-slate-200 rounded-2xl px-3.5 py-2.5 text-xs text-slate-900 h-20 mb-2 font-medium"
            value={reason}
            onChangeText={setReason}
            placeholder="Explain reason for absence (e.g. urgent family function, medical rest)"
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />

          {/* Quick Suggestions */}
          <View className="flex-row flex-wrap mb-4">
            {[
              'Family Function',
              'Medical / Unwell',
              'Urgent Personal Work',
              'Doctor Appointment',
            ].map((preset) => (
              <TouchableOpacity
                key={preset}
                activeOpacity={0.7}
                onPress={() => setReason(preset)}
                className="bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg mr-1.5 mb-1.5"
              >
                <Text className="text-[10px] font-bold text-slate-600">+ {preset}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            className="bg-indigo-600 py-3.5 rounded-2xl items-center shadow-sm"
            onPress={handleApply}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View className="flex-row items-center">
                <CheckCircle2 size={16} color="#ffffff" />
                <Text className="text-white font-black text-xs ml-1.5">
                  Submit Application ({totalDays} {totalDays === 1 ? 'Day' : 'Days'})
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Calendar Picker Modal */}
      <CalendarPickerModal
        visible={activeDatePicker !== null}
        onClose={() => setActiveDatePicker(null)}
        title={activeDatePicker === 'FROM' ? 'Select Start Date (From)' : 'Select End Date (To)'}
        selectedDate={activeDatePicker === 'FROM' ? fromDate : toDate}
        minDate={activeDatePicker === 'TO' ? fromDate : undefined}
        onSelectDate={(picked) => {
          if (activeDatePicker === 'FROM') {
            setFromDate(picked);
            if (toDate < picked) {
              setToDate(picked);
            }
          } else {
            setToDate(picked);
          }
        }}
      />

      {/* Leave Application History Header */}
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-base font-extrabold text-slate-900">
          Application History ({filteredLeaves.length})
        </Text>
      </View>

      {/* Filter Tabs */}
      <View className="flex-row bg-slate-200 p-1 rounded-2xl mb-3">
        {[
          { key: 'ALL' as const, label: `All (${leaves.length})` },
          { key: 'PENDING' as const, label: `Pending (${pendingLeaves.length})` },
          { key: 'APPROVED' as const, label: `Approved (${approvedLeaves.length})` },
          { key: 'REJECTED' as const, label: `Rejected (${rejectedLeaves.length})` },
        ].map((tab) => {
          const active = filterTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              activeOpacity={0.7}
              onPress={() => setFilterTab(tab.key)}
              className={`flex-1 py-1.5 rounded-xl items-center ${
                active ? 'bg-white shadow-sm' : ''
              }`}
            >
              <Text
                className={`text-[10px] font-black ${
                  active ? 'text-indigo-600' : 'text-slate-500'
                }`}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Leave History List */}
      {loading ? (
        <View className="py-8 items-center bg-white rounded-2xl border border-slate-200">
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text className="text-xs text-slate-500 font-medium mt-3">Loading leave requests...</Text>
        </View>
      ) : filteredLeaves.length === 0 ? (
        <View className="items-center p-8 bg-white rounded-2xl border border-slate-200">
          <FileText size={36} color="#cbd5e1" />
          <Text className="text-xs font-bold text-slate-500 mt-2">No leave applications found.</Text>
          <Text className="text-[11px] text-slate-400 mt-0.5 text-center">
            {filterTab === 'ALL'
              ? 'You have not submitted any leave requests yet.'
              : `No leaves in ${filterTab.toLowerCase()} status.`}
          </Text>
          {filterTab === 'ALL' && !showForm && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowForm(true)}
              className="mt-3 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl"
            >
              <Text className="text-xs font-black text-indigo-700">Apply for Leave</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        filteredLeaves.map((leave) => {
          const daysCount = calculateDuration(leave.fromDate, leave.toDate);
          const fromDetails = formatDateDetails(leave.fromDate);
          const toDetails = formatDateDetails(leave.toDate);

          const typeBadgeColor =
            leave.leaveType === 'CASUAL'
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : leave.leaveType === 'SICK'
              ? 'bg-purple-50 border-purple-200 text-purple-700'
              : 'bg-amber-50 border-amber-200 text-amber-700';

          return (
            <View
              key={leave.id}
              className="bg-white rounded-2xl p-4 border border-slate-200 mb-3 shadow-sm"
            >
              {/* Header row */}
              <View className="flex-row justify-between items-center mb-2.5">
                <View className="flex-row items-center">
                  <View className={`px-2.5 py-1 rounded-lg border ${typeBadgeColor}`}>
                    <Text className="text-[10px] font-black uppercase tracking-wider">
                      {leave.leaveType}
                    </Text>
                  </View>
                  <View className="bg-slate-100 px-2 py-0.5 rounded-md ml-2">
                    <Text className="text-[10px] font-bold text-slate-600">
                      {daysCount} {daysCount === 1 ? 'Day' : 'Days'}
                    </Text>
                  </View>
                </View>

                {leave.status === 'APPROVED' && (
                  <View className="flex-row items-center bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 size={12} color="#059669" />
                    <Text className="text-[10px] font-black text-emerald-700 ml-1">Approved</Text>
                  </View>
                )}
                {leave.status === 'REJECTED' && (
                  <View className="flex-row items-center bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                    <XCircle size={12} color="#dc2626" />
                    <Text className="text-[10px] font-black text-rose-700 ml-1">Rejected</Text>
                  </View>
                )}
                {leave.status === 'PENDING' && (
                  <View className="flex-row items-center bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    <Clock size={12} color="#d97706" />
                    <Text className="text-[10px] font-black text-amber-700 ml-1">Pending</Text>
                  </View>
                )}
              </View>

              {/* Date Range Display */}
              <View className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 mb-2.5 flex-row justify-between items-center">
                <View>
                  <Text className="text-[9px] font-bold text-slate-400 uppercase">START</Text>
                  <Text className="text-xs font-black text-slate-900 mt-0.5">
                    {fromDetails.formatted} ({fromDetails.weekday})
                  </Text>
                </View>
                <Text className="text-slate-400 font-bold">→</Text>
                <View className="items-end">
                  <Text className="text-[9px] font-bold text-slate-400 uppercase">END</Text>
                  <Text className="text-xs font-black text-slate-900 mt-0.5">
                    {toDetails.formatted} ({toDetails.weekday})
                  </Text>
                </View>
              </View>

              {/* Reason */}
              <View className="mb-1">
                <Text className="text-[10px] font-bold text-slate-400 uppercase">REASON</Text>
                <Text className="text-xs text-slate-700 font-medium mt-0.5 italic">
                  "{leave.reason}"
                </Text>
              </View>

              {/* Admin note */}
              {leave.adminRemark && (
                <View className="bg-indigo-50 p-2.5 rounded-xl mt-2.5 border-l-4 border-indigo-600">
                  <Text className="text-[9px] font-black text-indigo-700 uppercase">
                    Admin Decision Remark:
                  </Text>
                  <Text className="text-xs text-slate-800 font-semibold mt-0.5">
                    {leave.adminRemark}
                  </Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}
