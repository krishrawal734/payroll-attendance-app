import React, { useState, useEffect, useCallback } from 'react';
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
import { CalendarPlus, Clock, CheckCircle2, XCircle, FileText } from 'lucide-react-native';

export default function EmployeeLeavesScreen() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [leaveType, setLeaveType] = useState<LeaveType>('CASUAL');
  const [fromDate, setFromDate] = useState('2026-11-25');
  const [toDate, setToDate] = useState('2026-11-26');
  const [reason, setReason] = useState('');

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
      reason,
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
      {/* Top Banner & Action */}
      <View className="flex-row justify-between items-center bg-white rounded-2xl p-4 border border-slate-200 mb-4 shadow-xs">
        <View className="flex-1 mr-2">
          <Text className="text-base font-extrabold text-slate-900">Leave Requests</Text>
          <Text className="text-xs text-slate-500 mt-0.5">Apply for time-off and track admin approvals</Text>
        </View>
        <TouchableOpacity
          className="flex-row items-center bg-indigo-600 px-3.5 py-2.5 rounded-xl shadow-xs"
          onPress={() => setShowForm(!showForm)}
        >
          <CalendarPlus size={15} color="#ffffff" />
          <Text className="text-white text-xs font-bold ml-1.5">{showForm ? 'Cancel' : 'New Leave'}</Text>
        </TouchableOpacity>
      </View>

      {/* Apply Leave Form */}
      {showForm && (
        <View className="bg-purple-50/60 rounded-3xl p-5 border border-purple-200 mb-5 shadow-xs">
          <Text className="text-sm font-bold text-slate-900 mb-3">Submit Leave Application</Text>

          {/* Leave Type Selector */}
          <Text className="text-xs font-bold text-slate-600 mb-1.5">Leave Type</Text>
          <View className="flex-row mb-3">
            {(['CASUAL', 'SICK', 'UNPAID'] as LeaveType[]).map((type) => (
              <TouchableOpacity
                key={type}
                className={`flex-1 py-2 items-center rounded-xl border mr-1.5 last:mr-0 ${
                  leaveType === type
                    ? 'bg-indigo-600 border-indigo-600 shadow-xs'
                    : 'bg-white border-slate-300'
                }`}
                onPress={() => setLeaveType(type)}
              >
                <Text
                  className={`text-xs font-bold ${
                    leaveType === type ? 'text-white' : 'text-slate-600'
                  }`}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Dates */}
          <View className="flex-row mb-3 space-x-2">
            <View className="flex-1 mr-2">
              <Text className="text-xs font-bold text-slate-600 mb-1">From Date (YYYY-MM-DD)</Text>
              <TextInput
                className="bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-semibold"
                value={fromDate}
                onChangeText={setFromDate}
                placeholder="2026-11-25"
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-bold text-slate-600 mb-1">To Date (YYYY-MM-DD)</Text>
              <TextInput
                className="bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 font-semibold"
                value={toDate}
                onChangeText={setToDate}
                placeholder="2026-11-26"
              />
            </View>
          </View>

          {/* Reason */}
          <Text className="text-xs font-bold text-slate-600 mb-1">Reason for Absence *</Text>
          <TextInput
            className="bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-xs text-slate-900 h-20 mb-4"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Personal family emergency, medical check-up"
            multiline
            textAlignVertical="top"
          />

          <TouchableOpacity
            className="bg-indigo-600 py-3 rounded-xl items-center shadow-xs"
            onPress={handleApply}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-sm">Submit for Admin Approval</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Leave History List */}
      <Text className="text-base font-extrabold text-slate-900 mb-3">Leave Application History</Text>
      {loading ? (
        <View className="py-6 items-center">
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text className="text-xs text-slate-500 font-medium mt-3">Loading leaves...</Text>
        </View>
      ) : leaves.length === 0 ? (
        <View className="items-center p-8 bg-white rounded-2xl border border-slate-200">
          <FileText size={32} color="#cbd5e1" />
          <Text className="text-xs text-slate-400 mt-2">No leave applications filed yet.</Text>
        </View>
      ) : (
        leaves.map((leave) => (
          <View key={leave.id} className="bg-white rounded-2xl p-4 border border-slate-200 mb-2.5 shadow-xs">
            <View className="flex-row justify-between items-center mb-2">
              <View className="bg-slate-100 px-2.5 py-1 rounded-md">
                <Text className="text-[10px] font-black text-slate-700 tracking-wider">
                  {leave.leaveType} LEAVE
                </Text>
              </View>

              {leave.status === 'APPROVED' && (
                <View className="flex-row items-center bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 size={11} color="#059669" />
                  <Text className="text-[10px] font-bold text-emerald-700 ml-1">Approved</Text>
                </View>
              )}
              {leave.status === 'REJECTED' && (
                <View className="flex-row items-center bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                  <XCircle size={11} color="#dc2626" />
                  <Text className="text-[10px] font-bold text-rose-700 ml-1">Rejected</Text>
                </View>
              )}
              {leave.status === 'PENDING' && (
                <View className="flex-row items-center bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  <Clock size={11} color="#d97706" />
                  <Text className="text-[10px] font-bold text-amber-700 ml-1">Pending Approval</Text>
                </View>
              )}
            </View>

            <Text className="text-sm font-bold text-slate-900 mb-1">
              {leave.fromDate} &nbsp;→&nbsp; {leave.toDate}
            </Text>
            <Text className="text-xs text-slate-600 italic">"{leave.reason}"</Text>

            {leave.adminRemark && (
              <View className="bg-slate-50 p-2.5 rounded-xl mt-2.5 border-l-4 border-indigo-600">
                <Text className="text-[10px] font-bold text-slate-500 uppercase">Admin Note:</Text>
                <Text className="text-xs text-slate-800 mt-0.5">{leave.adminRemark}</Text>
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  );
}
