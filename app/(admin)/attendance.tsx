import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { dataService } from '../../src/services/dataService';
import { exportService } from '../../src/services/exportService';
import {
  shareAttendanceReportPdf,
  saveAttendanceReportPdfToPhone,
} from '../../src/services/pdfService';
import { AttendanceRecord, Employee } from '../../src/types';
import {
  Clock,
  Moon,
  Search,
  MapPin,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Download,
  Share2,
  Calendar,
  X,
  Check,
  CalendarDays,
  CalendarRange,
} from 'lucide-react-native';
import { localDateString } from '../../src/utils/date';

type PeriodType = 'MONTH' | 'WEEK' | 'TODAY' | 'NIGHT' | 'ALL';

export default function AdminAttendanceScreen() {
  const [filter, setFilter] = useState<PeriodType>('MONTH');
  const [searchQuery, setSearchQuery] = useState('');
  const [allRecords, setAllRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPeriod, setExportPeriod] = useState<PeriodType>('MONTH');

  const today = localDateString();
  const currentMonth = today.slice(0, 7);
  const currentMonthName = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  // 7 days ago calculation
  const past7Date = new Date();
  past7Date.setDate(past7Date.getDate() - 6);
  const past7DateStr = localDateString(past7Date);

  const loadData = async () => {
    try {
      const [recs, emps] = await Promise.all([
        dataService.getAttendance(),
        dataService.getEmployees(),
      ]);
      setAllRecords(recs);
      setEmployees(emps);
    } catch (err: any) {
      console.error('Error loading attendance:', err);
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

  // Helper to extract records and titles by period
  const getRecordsByPeriod = (period: PeriodType) => {
    switch (period) {
      case 'TODAY':
        return {
          records: allRecords.filter((r) => r.date === today),
          periodLabel: `Today (${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})`,
          reportTitle: 'DAILY ATTENDANCE & SHIFT AUDIT REPORT',
          shortLabel: 'Per-Day (Today)',
        };
      case 'WEEK':
        return {
          records: allRecords.filter((r) => r.date >= past7DateStr && r.date <= today),
          periodLabel: `${past7DateStr} to ${today} (Past 7 Days)`,
          reportTitle: 'WEEKLY ATTENDANCE & SHIFT AUDIT REPORT',
          shortLabel: 'Weekly (7 Days)',
        };
      case 'MONTH':
        return {
          records: allRecords.filter((r) => r.date.startsWith(currentMonth)),
          periodLabel: `Full Month - ${currentMonthName}`,
          reportTitle: 'MONTHLY ATTENDANCE & SHIFT AUDIT REPORT',
          shortLabel: 'Full Month',
        };
      case 'NIGHT':
        return {
          records: allRecords.filter((r) => r.isNightPresent),
          periodLabel: 'Night Shifts (>7:00 PM) Audit',
          reportTitle: 'NIGHT SHIFT ATTENDANCE AUDIT REPORT',
          shortLabel: 'Night Shifts',
        };
      case 'ALL':
      default:
        return {
          records: allRecords,
          periodLabel: 'Comprehensive All Historical Records',
          reportTitle: 'MASTER ATTENDANCE & SHIFT AUDIT REPORT',
          shortLabel: 'All Logs',
        };
    }
  };

  // Records for current screen view (with search filter)
  const currentPeriodData = getRecordsByPeriod(filter);
  const filtered = currentPeriodData.records.filter((rec) => {
    if (!searchQuery.trim()) return true;
    const emp = employees.find((e) => e.id === rec.employeeId);
    return emp ? emp.fullName.toLowerCase().includes(searchQuery.toLowerCase()) : false;
  });

  // Get records for export (with search filter applied if user typed a search)
  const getExportData = (period: PeriodType) => {
    const base = getRecordsByPeriod(period);
    if (!searchQuery.trim()) return base;
    const query = searchQuery.toLowerCase();
    const matched = base.records.filter((rec) => {
      const emp = employees.find((e) => e.id === rec.employeeId);
      return emp ? emp.fullName.toLowerCase().includes(query) : false;
    });
    return {
      records: matched,
      periodLabel: `${base.periodLabel} (Filtered: "${searchQuery}")`,
      reportTitle: base.reportTitle,
      shortLabel: base.shortLabel,
    };
  };

  // Export handlers
  const handleSharePdf = async (period: PeriodType) => {
    const { records, periodLabel, reportTitle } = getExportData(period);
    if (records.length === 0) {
      Alert.alert('Notice', `No attendance records found for ${periodLabel}.`);
      return;
    }
    setExporting(true);
    const res = await shareAttendanceReportPdf(records, employees, periodLabel, reportTitle);
    setExporting(false);
    setShowExportModal(false);
    if (!res.success && res.error) {
      Alert.alert('Notice', res.error);
    }
  };

  const handleSavePdf = async (period: PeriodType) => {
    const { records, periodLabel, reportTitle } = getExportData(period);
    if (records.length === 0) {
      Alert.alert('Notice', `No attendance records found for ${periodLabel}.`);
      return;
    }
    setExporting(true);
    const res = await saveAttendanceReportPdfToPhone(records, employees, periodLabel, reportTitle);
    setExporting(false);
    setShowExportModal(false);
    if (!res.success && res.error) {
      Alert.alert('Notice', res.error);
    }
  };

  const handleExportCsv = async (period: PeriodType) => {
    const { records, periodLabel } = getExportData(period);
    if (records.length === 0) {
      Alert.alert('Notice', `No attendance records found for ${periodLabel}.`);
      return;
    }
    setExporting(true);
    await exportService.exportAttendanceReport(records, employees, periodLabel);
    setExporting(false);
    setShowExportModal(false);
  };

  const openExportModal = (initialPeriod?: PeriodType) => {
    setExportPeriod(initialPeriod || filter);
    setShowExportModal(true);
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Search & Export Action Header */}
      <View className="bg-white p-4 border-b border-slate-200">
        <View className="flex-row items-center mb-3">
          <View className="flex-1 flex-row items-center bg-slate-100 rounded-xl px-3 py-1 mr-2">
            <Search size={15} color="#94a3b8" />
            <TextInput
              className="flex-1 py-2 ml-2 text-xs text-slate-900 font-medium"
              placeholder="Search employee attendance..."
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

          {/* Export Report Master Button */}
          <TouchableOpacity
            className="flex-row items-center bg-indigo-600 px-3 py-2.5 rounded-xl shadow-xs active:bg-indigo-700"
            onPress={() => openExportModal()}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <FileText size={14} color="#ffffff" />
                <Text className="text-white text-xs font-black ml-1.5">Export Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Period Filter Scroll Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="flex-row"
          contentContainerClassName="pr-4 space-x-1.5"
        >
          {/* Full Month */}
          <TouchableOpacity
            className={`flex-row items-center px-3 py-1.5 rounded-xl border mr-1.5 ${
              filter === 'MONTH'
                ? 'bg-indigo-600 border-indigo-600 shadow-xs'
                : 'bg-slate-50 border-slate-300'
            }`}
            onPress={() => setFilter('MONTH')}
          >
            <Calendar size={11} color={filter === 'MONTH' ? '#ffffff' : '#64748b'} />
            <Text
              className={`text-[11px] font-bold ml-1 ${
                filter === 'MONTH' ? 'text-white' : 'text-slate-700'
              }`}
            >
              Full Month ({getRecordsByPeriod('MONTH').records.length})
            </Text>
          </TouchableOpacity>

          {/* Weekly (7 Days) */}
          <TouchableOpacity
            className={`flex-row items-center px-3 py-1.5 rounded-xl border mr-1.5 ${
              filter === 'WEEK'
                ? 'bg-indigo-600 border-indigo-600 shadow-xs'
                : 'bg-slate-50 border-slate-300'
            }`}
            onPress={() => setFilter('WEEK')}
          >
            <CalendarRange size={11} color={filter === 'WEEK' ? '#ffffff' : '#64748b'} />
            <Text
              className={`text-[11px] font-bold ml-1 ${
                filter === 'WEEK' ? 'text-white' : 'text-slate-700'
              }`}
            >
              Weekly ({getRecordsByPeriod('WEEK').records.length})
            </Text>
          </TouchableOpacity>

          {/* Today (Per-Day) */}
          <TouchableOpacity
            className={`flex-row items-center px-3 py-1.5 rounded-xl border mr-1.5 ${
              filter === 'TODAY'
                ? 'bg-slate-900 border-slate-900 shadow-xs'
                : 'bg-slate-50 border-slate-300'
            }`}
            onPress={() => setFilter('TODAY')}
          >
            <CalendarDays size={11} color={filter === 'TODAY' ? '#ffffff' : '#64748b'} />
            <Text
              className={`text-[11px] font-bold ml-1 ${
                filter === 'TODAY' ? 'text-white' : 'text-slate-700'
              }`}
            >
              Today ({getRecordsByPeriod('TODAY').records.length})
            </Text>
          </TouchableOpacity>

          {/* Night Present */}
          <TouchableOpacity
            className={`flex-row items-center px-3 py-1.5 rounded-xl border mr-1.5 ${
              filter === 'NIGHT'
                ? 'bg-purple-700 border-purple-700 shadow-xs'
                : 'bg-slate-50 border-purple-200'
            }`}
            onPress={() => setFilter('NIGHT')}
          >
            <Moon size={11} color={filter === 'NIGHT' ? '#ffffff' : '#7c3aed'} />
            <Text
              className={`text-[11px] font-bold ml-1 ${
                filter === 'NIGHT' ? 'text-white' : 'text-purple-700'
              }`}
            >
              Night (&gt;7 PM)
            </Text>
          </TouchableOpacity>

          {/* All Logs */}
          <TouchableOpacity
            className={`px-3 py-1.5 rounded-xl border ${
              filter === 'ALL'
                ? 'bg-slate-800 border-slate-800 shadow-xs'
                : 'bg-slate-50 border-slate-300'
            }`}
            onPress={() => setFilter('ALL')}
          >
            <Text
              className={`text-[11px] font-bold ${
                filter === 'ALL' ? 'text-white' : 'text-slate-600'
              }`}
            >
              All ({allRecords.length})
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Attendance Feed */}
      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text className="text-xs text-slate-500 font-medium mt-3">Fetching cloud attendance logs...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerClassName="p-4 pb-12"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filtered.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center border border-slate-200">
              <Clock size={32} color="#cbd5e1" />
              <Text className="text-xs text-slate-400 mt-2">No attendance records match your filter.</Text>
            </View>
          ) : (
            filtered.map((record) => {
              const emp = employees.find((e) => e.id === record.employeeId);
              return (
                <View key={record.id} className="bg-white rounded-2xl p-3.5 border border-slate-200 mb-2.5 shadow-xs">
                  <View className="flex-row justify-between items-center mb-2.5">
                    <View className="flex-row items-center">
                      <View className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 items-center justify-center mr-2">
                        <Text className="text-[10px] font-black text-indigo-700">
                          {emp?.fullName.slice(0, 2).toUpperCase() || 'EM'}
                        </Text>
                      </View>
                      <View>
                        <Text className="text-xs font-bold text-slate-900">{emp?.fullName || 'Employee'}</Text>
                        <Text className="text-[10px] text-slate-500">{record.date}</Text>
                      </View>
                    </View>

                    {record.isNightPresent ? (
                      <View className="flex-row items-center bg-purple-100 px-2 py-0.5 rounded-full">
                        <Moon size={10} color="#7c3aed" />
                        <Text className="text-[10px] font-bold text-purple-700 ml-1">Night Present (&gt;7 PM)</Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center bg-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={10} color="#059669" />
                        <Text className="text-[10px] font-bold text-emerald-700 ml-1">Regular</Text>
                      </View>
                    )}
                  </View>

                  {/* Timing Grid */}
                  <View className="flex-row bg-slate-50 rounded-xl p-2.5 mb-2">
                    <View className="flex-1">
                      <Text className="text-[10px] text-slate-500 font-bold uppercase">Check-In Time</Text>
                      <Text className="text-xs font-extrabold text-slate-900 mt-0.5">
                        {record.checkInTime
                          ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : '--:--'}
                      </Text>
                    </View>

                    <View className="flex-1">
                      <Text className="text-[10px] text-slate-500 font-bold uppercase">Check-Out Time</Text>
                      <Text
                        className={`text-xs font-extrabold mt-0.5 ${
                          record.isNightPresent ? 'text-purple-700' : 'text-slate-900'
                        }`}
                      >
                        {record.checkOutTime
                          ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Currently Working'}
                      </Text>
                    </View>
                  </View>

                  {/* GPS Location Snippet */}
                  {record.checkInLocation?.address && (
                    <View className="flex-row items-center">
                      <MapPin size={11} color="#64748b" />
                      <Text className="text-[11px] text-slate-500 ml-1" numberOfLines={1}>
                        {record.checkInLocation.address}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* ======================================================== */}
      {/* EXPORT REPORT DIALOG MODAL (Daily / Weekly / Full Month) */}
      {/* ======================================================== */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-5 border-t border-slate-200">
            {/* Modal Header */}
            <View className="flex-row justify-between items-center pb-3 border-b border-slate-100">
              <View>
                <Text className="text-lg font-black text-slate-900">Export Attendance Report</Text>
                <Text className="text-xs text-slate-500 mt-0.5">
                  Select reporting timeframe & export format
                </Text>
              </View>
              <TouchableOpacity
                className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center"
                onPress={() => setShowExportModal(false)}
              >
                <X size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Step 1: Select Period */}
            <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-4 mb-2.5">
              1. Choose Report Period
            </Text>

            <View className="space-y-2">
              {/* Full Month Option */}
              <TouchableOpacity
                className={`flex-row items-center justify-between p-3 rounded-2xl border mb-2 ${
                  exportPeriod === 'MONTH'
                    ? 'bg-indigo-50/80 border-indigo-600'
                    : 'bg-slate-50 border-slate-200'
                }`}
                onPress={() => setExportPeriod('MONTH')}
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View
                    className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${
                      exportPeriod === 'MONTH' ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <Calendar size={18} color={exportPeriod === 'MONTH' ? '#ffffff' : '#64748b'} />
                  </View>
                  <View>
                    <Text className="text-sm font-extrabold text-slate-900">Full Month Report</Text>
                    <Text className="text-xs text-slate-500">{currentMonthName}</Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <View className="bg-indigo-100 px-2 py-0.5 rounded-full mr-2">
                    <Text className="text-[10px] font-bold text-indigo-700">
                      {getRecordsByPeriod('MONTH').records.length} logs
                    </Text>
                  </View>
                  <View
                    className={`w-5 h-5 rounded-full border items-center justify-center ${
                      exportPeriod === 'MONTH' ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                    }`}
                  >
                    {exportPeriod === 'MONTH' && <Check size={12} color="#ffffff" />}
                  </View>
                </View>
              </TouchableOpacity>

              {/* Weekly (7-Days) Option */}
              <TouchableOpacity
                className={`flex-row items-center justify-between p-3 rounded-2xl border mb-2 ${
                  exportPeriod === 'WEEK'
                    ? 'bg-indigo-50/80 border-indigo-600'
                    : 'bg-slate-50 border-slate-200'
                }`}
                onPress={() => setExportPeriod('WEEK')}
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View
                    className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${
                      exportPeriod === 'WEEK' ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <CalendarRange size={18} color={exportPeriod === 'WEEK' ? '#ffffff' : '#64748b'} />
                  </View>
                  <View>
                    <Text className="text-sm font-extrabold text-slate-900">Weekly Report</Text>
                    <Text className="text-xs text-slate-500">Past 7 Days ({past7DateStr} to {today})</Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <View className="bg-indigo-100 px-2 py-0.5 rounded-full mr-2">
                    <Text className="text-[10px] font-bold text-indigo-700">
                      {getRecordsByPeriod('WEEK').records.length} logs
                    </Text>
                  </View>
                  <View
                    className={`w-5 h-5 rounded-full border items-center justify-center ${
                      exportPeriod === 'WEEK' ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                    }`}
                  >
                    {exportPeriod === 'WEEK' && <Check size={12} color="#ffffff" />}
                  </View>
                </View>
              </TouchableOpacity>

              {/* Per-Day / Daily (Today) Option */}
              <TouchableOpacity
                className={`flex-row items-center justify-between p-3 rounded-2xl border mb-2 ${
                  exportPeriod === 'TODAY'
                    ? 'bg-indigo-50/80 border-indigo-600'
                    : 'bg-slate-50 border-slate-200'
                }`}
                onPress={() => setExportPeriod('TODAY')}
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View
                    className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${
                      exportPeriod === 'TODAY' ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                  >
                    <CalendarDays size={18} color={exportPeriod === 'TODAY' ? '#ffffff' : '#64748b'} />
                  </View>
                  <View>
                    <Text className="text-sm font-extrabold text-slate-900">Per-Day Report</Text>
                    <Text className="text-xs text-slate-500">Today's Punches ({today})</Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <View className="bg-indigo-100 px-2 py-0.5 rounded-full mr-2">
                    <Text className="text-[10px] font-bold text-indigo-700">
                      {getRecordsByPeriod('TODAY').records.length} logs
                    </Text>
                  </View>
                  <View
                    className={`w-5 h-5 rounded-full border items-center justify-center ${
                      exportPeriod === 'TODAY' ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'
                    }`}
                  >
                    {exportPeriod === 'TODAY' && <Check size={12} color="#ffffff" />}
                  </View>
                </View>
              </TouchableOpacity>

              {/* Night Shifts Option */}
              <TouchableOpacity
                className={`flex-row items-center justify-between p-3 rounded-2xl border mb-2 ${
                  exportPeriod === 'NIGHT'
                    ? 'bg-purple-50 border-purple-600'
                    : 'bg-slate-50 border-slate-200'
                }`}
                onPress={() => setExportPeriod('NIGHT')}
              >
                <View className="flex-row items-center flex-1 mr-2">
                  <View
                    className={`w-9 h-9 rounded-xl items-center justify-center mr-3 ${
                      exportPeriod === 'NIGHT' ? 'bg-purple-600' : 'bg-slate-200'
                    }`}
                  >
                    <Moon size={18} color={exportPeriod === 'NIGHT' ? '#ffffff' : '#64748b'} />
                  </View>
                  <View>
                    <Text className="text-sm font-extrabold text-slate-900">Night Shift Audit</Text>
                    <Text className="text-xs text-slate-500">Checkouts after 7:00 PM</Text>
                  </View>
                </View>
                <View className="flex-row items-center">
                  <View className="bg-purple-100 px-2 py-0.5 rounded-full mr-2">
                    <Text className="text-[10px] font-bold text-purple-700">
                      {getRecordsByPeriod('NIGHT').records.length} logs
                    </Text>
                  </View>
                  <View
                    className={`w-5 h-5 rounded-full border items-center justify-center ${
                      exportPeriod === 'NIGHT' ? 'bg-purple-600 border-purple-600' : 'border-slate-300'
                    }`}
                  >
                    {exportPeriod === 'NIGHT' && <Check size={12} color="#ffffff" />}
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Step 2: Format & Action Buttons */}
            <Text className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-3 mb-2.5">
              2. Select Export Format
            </Text>

            <View className="space-y-2">
              {/* Share PDF Button */}
              <TouchableOpacity
                className="flex-row items-center justify-center bg-indigo-600 py-3.5 px-4 rounded-2xl shadow-sm mb-2 active:bg-indigo-700"
                onPress={() => handleSharePdf(exportPeriod)}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Share2 size={16} color="#ffffff" />
                    <Text className="text-white text-sm font-black ml-2">
                      Share PDF Directly (WhatsApp / Apps)
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Save PDF to Phone Button */}
              <TouchableOpacity
                className="flex-row items-center justify-center bg-sky-600 py-3.5 px-4 rounded-2xl shadow-sm mb-2 active:bg-sky-700"
                onPress={() => handleSavePdf(exportPeriod)}
                disabled={exporting}
              >
                <Download size={16} color="#ffffff" />
                <Text className="text-white text-sm font-black ml-2">
                  Save PDF to Phone Storage
                </Text>
              </TouchableOpacity>

              {/* Export Excel / CSV Button */}
              <TouchableOpacity
                className="flex-row items-center justify-center bg-emerald-600 py-3.5 px-4 rounded-2xl shadow-sm active:bg-emerald-700"
                onPress={() => handleExportCsv(exportPeriod)}
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
    </View>
  );
}
