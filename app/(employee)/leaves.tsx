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
  StyleSheet,
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

  // Dynamic default dates (Today)
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
      style={styles.screen}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Executive Leave Summary Banner */}
      <View style={styles.summaryBanner}>
        <View style={styles.summaryHeaderRow}>
          <View style={styles.summaryTitleWrap}>
            <CalendarPlus size={16} color="#818cf8" />
            <Text style={styles.summaryTitleText}>My Leaves Overview</Text>
          </View>
          <View style={styles.monthBadge}>
            <Text style={styles.monthBadgeText}>
              {new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' })}
            </Text>
          </View>
        </View>

        <View style={styles.summaryStatsRow}>
          <View style={[styles.statCol, styles.statBorderRight]}>
            <Text style={styles.statValWhite}>{leaves.length}</Text>
            <Text style={styles.statLabel}>Applied</Text>
          </View>
          <View style={[styles.statCol, styles.statBorderRight]}>
            <Text style={styles.statValEmerald}>{approvedLeaves.length}</Text>
            <Text style={styles.statLabelEmerald}>Approved</Text>
          </View>
          <View style={[styles.statCol, styles.statBorderRight]}>
            <Text style={styles.statValAmber}>{pendingLeaves.length}</Text>
            <Text style={styles.statLabelAmber}>Pending</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statValRose}>{rejectedLeaves.length}</Text>
            <Text style={styles.statLabelRose}>Rejected</Text>
          </View>
        </View>
      </View>

      {/* Top Action Card */}
      <View style={styles.topActionCard}>
        <View style={styles.topActionTextWrap}>
          <Text style={styles.topActionTitle}>Apply for Time-Off</Text>
          <Text style={styles.topActionSubtitle}>Submit request for admin approval</Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.toggleFormBtn, showForm ? styles.toggleFormBtnClose : styles.toggleFormBtnNew]}
          onPress={() => setShowForm(!showForm)}
        >
          {showForm ? (
            <>
              <X size={15} color="#334155" />
              <Text style={styles.toggleFormTextClose}>Close</Text>
            </>
          ) : (
            <>
              <CalendarPlus size={15} color="#ffffff" />
              <Text style={styles.toggleFormTextNew}>New Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Apply Leave Form */}
      {showForm && (
        <View style={styles.formCard}>
          <View style={styles.formHeaderRow}>
            <View>
              <Text style={styles.formTitle}>New Leave Application</Text>
              <Text style={styles.formSubtitle}>Choose category and select date range</Text>
            </View>
            <View style={styles.userNameBadge}>
              <Text style={styles.userNameBadgeText}>{user.fullName}</Text>
            </View>
          </View>

          {/* Leave Type Selector */}
          <Text style={styles.inputSectionLabel}>Select Leave Type</Text>
          <View style={styles.leaveTypeRow}>
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
                  style={[
                    styles.typeCard,
                    active ? styles.typeCardActive : styles.typeCardInactive,
                  ]}
                >
                  <IconComp size={18} color={active ? '#ffffff' : '#64748b'} />
                  <Text style={[styles.typeLabel, active ? styles.typeLabelActive : styles.typeLabelInactive]}>
                    {item.label}
                  </Text>
                  <Text style={[styles.typeDesc, active ? styles.typeDescActive : styles.typeDescInactive]}>
                    {item.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Interactive Date Selection Cards */}
          <Text style={styles.inputSectionLabel}>Leave Dates (Tap to pick date)</Text>
          <View style={styles.datesRow}>
            {/* From Date Card */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveDatePicker('FROM')}
              style={styles.datePickerCard}
            >
              <View style={styles.dateCardHeader}>
                <Text style={styles.dateCardSub}>FROM DATE</Text>
                <Calendar size={13} color="#4f46e5" />
              </View>
              <Text style={styles.dateCardMain}>{fromInfo.formatted}</Text>
              <Text style={styles.dateCardDay}>{fromInfo.weekday}</Text>
            </TouchableOpacity>

            {/* Duration Tag */}
            <View style={styles.durationTagWrap}>
              <View style={styles.durationTag}>
                <Text style={styles.durationTagText}>
                  {totalDays} {totalDays === 1 ? 'Day' : 'Days'}
                </Text>
              </View>
            </View>

            {/* To Date Card */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setActiveDatePicker('TO')}
              style={styles.datePickerCard}
            >
              <View style={styles.dateCardHeader}>
                <Text style={styles.dateCardSub}>TO DATE</Text>
                <Calendar size={13} color="#4f46e5" />
              </View>
              <Text style={styles.dateCardMain}>{toInfo.formatted}</Text>
              <Text style={styles.dateCardDay}>{toInfo.weekday}</Text>
            </TouchableOpacity>
          </View>

          {/* Reason for Absence */}
          <Text style={styles.inputSectionLabel}>Reason for Absence *</Text>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Explain reason for absence (e.g. urgent family function, medical rest)"
            placeholderTextColor="#94a3b8"
            multiline
            textAlignVertical="top"
          />

          {/* Quick Suggestions */}
          <View style={styles.suggestionsRow}>
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
                style={styles.suggestionChip}
              >
                <Text style={styles.suggestionChipText}>+ {preset}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.submitBtn}
            onPress={handleApply}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <View style={styles.submitBtnContent}>
                <CheckCircle2 size={16} color="#ffffff" />
                <Text style={styles.submitBtnText}>
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
      <View style={styles.historyHeaderRow}>
        <Text style={styles.historySectionTitle}>
          Application History ({filteredLeaves.length})
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabsWrap}>
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
              style={[styles.filterTabItem, active && styles.filterTabItemActive]}
            >
              <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Leave History List */}
      {loading ? (
        <View style={styles.centerLoadingCard}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading leave requests...</Text>
        </View>
      ) : filteredLeaves.length === 0 ? (
        <View style={styles.emptyCard}>
          <FileText size={36} color="#cbd5e1" />
          <Text style={styles.emptyTitle}>No leave applications found.</Text>
          <Text style={styles.emptySubtitle}>
            {filterTab === 'ALL'
              ? 'You have not submitted any leave requests yet.'
              : `No leaves in ${filterTab.toLowerCase()} status.`}
          </Text>
          {filterTab === 'ALL' && !showForm && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowForm(true)}
              style={styles.emptyActionBtn}
            >
              <Text style={styles.emptyActionBtnText}>Apply for Leave</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        filteredLeaves.map((leave) => {
          const daysCount = calculateDuration(leave.fromDate, leave.toDate);
          const fromDetails = formatDateDetails(leave.fromDate);
          const toDetails = formatDateDetails(leave.toDate);

          const badgeStyles =
            leave.leaveType === 'CASUAL'
              ? { bg: '#eef2ff', border: '#c7d2fe', text: '#4338ca' }
              : leave.leaveType === 'SICK'
              ? { bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce' }
              : { bg: '#fffbeb', border: '#fde68a', text: '#b45309' };

          return (
            <View key={leave.id} style={styles.leaveCard}>
              {/* Header row */}
              <View style={styles.leaveCardHeader}>
                <View style={styles.leaveCardBadgeRow}>
                  <View
                    style={[
                      styles.typePill,
                      { backgroundColor: badgeStyles.bg, borderColor: badgeStyles.border },
                    ]}
                  >
                    <Text style={[styles.typePillText, { color: badgeStyles.text }]}>
                      {leave.leaveType}
                    </Text>
                  </View>
                  <View style={styles.daysPill}>
                    <Text style={styles.daysPillText}>
                      {daysCount} {daysCount === 1 ? 'Day' : 'Days'}
                    </Text>
                  </View>
                </View>

                {leave.status === 'APPROVED' && (
                  <View style={styles.statusApproved}>
                    <CheckCircle2 size={12} color="#059669" />
                    <Text style={styles.statusApprovedText}>Approved</Text>
                  </View>
                )}
                {leave.status === 'REJECTED' && (
                  <View style={styles.statusRejected}>
                    <XCircle size={12} color="#dc2626" />
                    <Text style={styles.statusRejectedText}>Rejected</Text>
                  </View>
                )}
                {leave.status === 'PENDING' && (
                  <View style={styles.statusPending}>
                    <Clock size={12} color="#d97706" />
                    <Text style={styles.statusPendingText}>Pending</Text>
                  </View>
                )}
              </View>

              {/* Date Range Display */}
              <View style={styles.dateRangeBox}>
                <View>
                  <Text style={styles.dateRangeLabel}>START</Text>
                  <Text style={styles.dateRangeVal}>
                    {fromDetails.formatted} ({fromDetails.weekday})
                  </Text>
                </View>
                <Text style={styles.dateRangeArrow}>→</Text>
                <View style={styles.dateRangeEnd}>
                  <Text style={styles.dateRangeLabel}>END</Text>
                  <Text style={styles.dateRangeVal}>
                    {toDetails.formatted} ({toDetails.weekday})
                  </Text>
                </View>
              </View>

              {/* Reason */}
              <View style={styles.reasonWrap}>
                <Text style={styles.reasonLabel}>REASON</Text>
                <Text style={styles.reasonText}>"{leave.reason}"</Text>
              </View>

              {/* Admin note */}
              {leave.adminRemark && (
                <View style={styles.adminRemarkBox}>
                  <Text style={styles.adminRemarkLabel}>Admin Decision Remark:</Text>
                  <Text style={styles.adminRemarkText}>{leave.adminRemark}</Text>
                </View>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 48,
  },
  summaryBanner: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  summaryTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryTitleText: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 6,
  },
  monthBadge: {
    backgroundColor: '#1e1b4b',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4338ca',
  },
  monthBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#c7d2fe',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 12,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statBorderRight: {
    borderRightWidth: 1,
    borderRightColor: '#334155',
  },
  statValWhite: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statValEmerald: {
    color: '#34d399',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabelEmerald: {
    fontSize: 10,
    fontWeight: '700',
    color: '#34d399',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statValAmber: {
    color: '#fbbf24',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabelAmber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fbbf24',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statValRose: {
    color: '#fb7185',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabelRose: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fb7185',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  topActionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  topActionTextWrap: {
    flex: 1,
    marginRight: 8,
  },
  topActionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  topActionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  toggleFormBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  toggleFormBtnNew: {
    backgroundColor: '#4f46e5',
  },
  toggleFormBtnClose: {
    backgroundColor: '#e2e8f0',
  },
  toggleFormTextNew: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
  toggleFormTextClose: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    marginBottom: 18,
  },
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  formSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  userNameBadge: {
    backgroundColor: '#eef2ff',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  userNameBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4338ca',
  },
  inputSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  leaveTypeRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  typeCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeCardActive: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  typeCardInactive: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  typeLabel: {
    fontSize: 12,
    fontWeight: '900',
    marginTop: 6,
  },
  typeLabelActive: {
    color: '#ffffff',
  },
  typeLabelInactive: {
    color: '#1e293b',
  },
  typeDesc: {
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
  },
  typeDescActive: {
    color: '#c7d2fe',
  },
  typeDescInactive: {
    color: '#94a3b8',
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  datePickerCard: {
    flex: 1,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    borderRadius: 16,
    padding: 12,
  },
  dateCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  dateCardSub: {
    fontSize: 9,
    fontWeight: '900',
    color: '#4338ca',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateCardMain: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  dateCardDay: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4f46e5',
    marginTop: 2,
  },
  durationTagWrap: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  durationTag: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  durationTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#3730a3',
  },
  reasonInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 12,
    color: '#0f172a',
    height: 72,
    marginBottom: 8,
    fontWeight: '500',
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 6,
  },
  suggestionChip: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  suggestionChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 12,
    marginLeft: 6,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  historySectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  filterTabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    padding: 3,
    borderRadius: 14,
    marginBottom: 12,
  },
  filterTabItem: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 11,
    alignItems: 'center',
  },
  filterTabItemActive: {
    backgroundColor: '#ffffff',
  },
  filterTabText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
  },
  filterTabTextActive: {
    color: '#4f46e5',
  },
  centerLoadingCard: {
    paddingVertical: 32,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loadingText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 10,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center',
  },
  emptyActionBtn: {
    marginTop: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#4338ca',
  },
  leaveCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  leaveCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  leaveCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  daysPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  daysPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  statusApproved: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  statusApprovedText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#047857',
    marginLeft: 4,
  },
  statusRejected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff1f2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fecdd3',
  },
  statusRejectedText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#be123c',
    marginLeft: 4,
  },
  statusPending: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusPendingText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#b45309',
    marginLeft: 4,
  },
  dateRangeBox: {
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRangeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  dateRangeVal: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  dateRangeArrow: {
    color: '#94a3b8',
    fontWeight: '700',
    fontSize: 14,
  },
  dateRangeEnd: {
    alignItems: 'flex-end',
  },
  reasonWrap: {
    marginBottom: 4,
  },
  reasonLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    fontStyle: 'italic',
    marginTop: 2,
  },
  adminRemarkBox: {
    backgroundColor: '#eef2ff',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4f46e5',
  },
  adminRemarkLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#4338ca',
    textTransform: 'uppercase',
  },
  adminRemarkText: {
    fontSize: 12,
    color: '#1e293b',
    fontWeight: '600',
    marginTop: 2,
  },
});
