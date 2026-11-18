import React, { useState, useEffect, useCallback } from 'react';
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
import { notificationService } from '../../src/services/notificationService';
import { LeaveRequest } from '../../src/types';
import {
  CalendarDays,
  CheckCircle2,
  XCircle,
  Clock,
  X,
} from 'lucide-react-native';

export default function AdminLeavesScreen() {
  const [tab, setTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [adminRemark, setAdminRemark] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadLeaves = async () => {
    try {
      const data = await dataService.getLeaves();
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
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadLeaves();
  }, []);

  const handleApprove = (leave: LeaveRequest) => {
    Alert.alert(
      'Confirm Approval',
      `Approve ${leave.leaveType} leave for ${leave.employeeName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: async () => {
            setActionLoading(true);
            const res = await dataService.updateLeaveStatus(leave.id, 'APPROVED', 'Approved by Operations Admin');
            setActionLoading(false);
            if (res.success) {
              await notificationService.sendInstantNotification(
                'Leave Approved ✅',
                `${leave.employeeName}'s ${leave.leaveType} leave (${leave.fromDate} to ${leave.toDate}) has been approved.`
              );
              await loadLeaves();
            } else {
              Alert.alert('Error', res.message);
            }
          },
        },
      ]
    );
  };

  const handleRejectPrompt = (leaveId: string) => {
    setSelectedLeaveId(leaveId);
    setAdminRemark('');
    setRejectModalVisible(true);
  };

  const confirmRejection = async () => {
    if (!selectedLeaveId) return;
    setActionLoading(true);
    const res = await dataService.updateLeaveStatus(
      selectedLeaveId,
      'REJECTED',
      adminRemark.trim() || 'Declined due to peak project staffing requirements'
    );
    setActionLoading(false);
    setRejectModalVisible(false);
    if (res.success) {
      await notificationService.sendInstantNotification(
        'Leave Declined ❌',
        'Leave request has been declined by Operations Admin.'
      );
      await loadLeaves();
    } else {
      Alert.alert('Error', res.message);
    }
  };

  const pendingList = leaves.filter((l) => l.status === 'PENDING');
  const historyList = leaves.filter((l) => l.status !== 'PENDING');

  const displayed = tab === 'PENDING' ? pendingList : historyList;

  return (
    <View className="flex-1 bg-slate-50">
      {/* Switcher Tabs */}
      <View className="flex-row p-3 bg-white border-b border-slate-200">
        <TouchableOpacity
          className={`flex-1 py-2.5 items-center rounded-xl mr-2 ${
            tab === 'PENDING' ? 'bg-indigo-50' : ''
          }`}
          onPress={() => setTab('PENDING')}
        >
          <Text
            className={`text-xs font-bold ${
              tab === 'PENDING' ? 'text-indigo-600' : 'text-slate-500'
            }`}
          >
            Pending Review ({pendingList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 py-2.5 items-center rounded-xl ${
            tab === 'HISTORY' ? 'bg-indigo-50' : ''
          }`}
          onPress={() => setTab('HISTORY')}
        >
          <Text
            className={`text-xs font-bold ${
              tab === 'HISTORY' ? 'text-indigo-600' : 'text-slate-500'
            }`}
          >
            Processed History ({historyList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text className="text-xs text-slate-500 font-medium mt-3">Loading cloud leave requests...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="p-4 pb-12"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {displayed.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-slate-200">
              <CalendarDays size={32} color="#cbd5e1" />
              <Text className="text-xs text-slate-400 mt-2">
                {tab === 'PENDING'
                  ? 'No pending leave requests awaiting approval.'
                  : 'No historical leave records.'}
              </Text>
            </View>
          ) : (
            displayed.map((leave) => (
              <View key={leave.id} className="bg-white rounded-2xl p-4 border border-slate-200 mb-3">
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1">
                    <Text className="text-sm font-extrabold text-slate-900">{leave.employeeName}</Text>
                    <View className="bg-slate-100 self-start px-2 py-0.5 rounded-md mt-1">
                      <Text className="text-[10px] font-black text-slate-700">{leave.leaveType} LEAVE</Text>
                    </View>
                  </View>

                  {leave.status === 'APPROVED' && (
                    <View className="flex-row items-center bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <CheckCircle2 size={11} color="#059669" />
                      <Text className="text-[10px] font-bold text-emerald-700 ml-1">Approved</Text>
                    </View>
                  )}
                  {leave.status === 'REJECTED' && (
                    <View className="flex-row items-center bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200">
                      <XCircle size={11} color="#dc2626" />
                      <Text className="text-[10px] font-bold text-rose-700 ml-1">Rejected</Text>
                    </View>
                  )}
                  {leave.status === 'PENDING' && (
                    <View className="flex-row items-center bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                      <Clock size={11} color="#d97706" />
                      <Text className="text-[10px] font-bold text-amber-700 ml-1">Pending</Text>
                    </View>
                  )}
                </View>

                <Text className="text-xs font-bold text-slate-800 mb-1">
                  {leave.fromDate} &nbsp;to&nbsp; {leave.toDate}
                </Text>
                <Text className="text-xs text-slate-500 italic">"{leave.reason}"</Text>

                {leave.adminRemark && (
                  <View className="bg-slate-50 p-2.5 rounded-xl mt-2 border-l-4 border-slate-400">
                    <Text className="text-[10px] font-bold text-slate-500 uppercase">Admin Remark:</Text>
                    <Text className="text-xs text-slate-800 mt-0.5">{leave.adminRemark}</Text>
                  </View>
                )}

                {/* Action Buttons for Pending */}
                {leave.status === 'PENDING' && (
                  <View className="flex-row mt-3.5 pt-3 border-t border-slate-100 space-x-2">
                    <TouchableOpacity
                      className="flex-1 flex-row items-center justify-center py-2.5 rounded-xl bg-rose-50 border border-rose-200 mr-2"
                      onPress={() => handleRejectPrompt(leave.id)}
                      disabled={actionLoading}
                    >
                      <XCircle size={15} color="#dc2626" />
                      <Text className="text-rose-600 font-bold text-xs ml-1.5">Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      className="flex-1 flex-row items-center justify-center py-2.5 rounded-xl bg-emerald-600"
                      onPress={() => handleApprove(leave)}
                      disabled={actionLoading}
                    >
                      <CheckCircle2 size={15} color="#ffffff" />
                      <Text className="text-white font-bold text-xs ml-1.5">Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Rejection Remark Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade">
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View className="w-full bg-white rounded-3xl p-5">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-base font-extrabold text-slate-900">Decline Leave Request</Text>
              <TouchableOpacity onPress={() => setRejectModalVisible(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text className="text-xs text-slate-600 mb-2">Reason for Rejection (Optional note to employee):</Text>
            <TextInput
              className="bg-slate-50 border border-slate-300 rounded-xl p-3 h-20 text-xs text-slate-900 mb-4"
              placeholder="e.g. Critical deployment day, please reschedule"
              multiline
              textAlignVertical="top"
              value={adminRemark}
              onChangeText={setAdminRemark}
            />

            <View className="flex-row justify-end space-x-2">
              <TouchableOpacity
                className="px-3.5 py-2 mr-2"
                onPress={() => setRejectModalVisible(false)}
              >
                <Text className="text-slate-500 font-bold text-xs">Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="bg-rose-600 px-4 py-2 rounded-xl"
                onPress={confirmRejection}
                disabled={actionLoading}
              >
                <Text className="text-white font-bold text-xs">Confirm Rejection</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
