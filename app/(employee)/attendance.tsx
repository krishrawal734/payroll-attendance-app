import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../../src/store/authContext';
import { dataService } from '../../src/services/dataService';
import { AttendanceRecord } from '../../src/types';
import { getCurrentAttendanceLocation } from '../../src/services/locationService';
import {
  MapPin,
  Clock,
  Moon,
  CheckCircle,
  Calendar,
  ShieldAlert,
  FileText,
} from 'lucide-react-native';
import { shareAttendanceReportPdf } from '../../src/services/pdfService';

export default function EmployeeAttendanceScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [isGpsMocked, setIsGpsMocked] = useState(false);
  const [now, setNow] = useState(new Date());

  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | undefined>(undefined);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = () => {
    if (!user || history.length === 0) {
      Alert.alert('Notice', 'No attendance records available to export.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const monthStr = todayStr.slice(0, 7);
    const monthName = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    const past7 = new Date();
    past7.setDate(past7.getDate() - 6);
    const past7Str = past7.toISOString().split('T')[0];

    Alert.alert(
      'Export Attendance Report',
      'Choose the attendance period to download or share:',
      [
        {
          text: `📆 Full Month (${monthName})`,
          onPress: async () => {
            const monthRecs = history.filter((r) => r.date.startsWith(monthStr));
            setExporting(true);
            await shareAttendanceReportPdf(
              monthRecs.length > 0 ? monthRecs : history,
              [user],
              `${user.fullName} - ${monthName}`,
              'MONTHLY PERSONAL ATTENDANCE REPORT'
            );
            setExporting(false);
          },
        },
        {
          text: '🗓️ Weekly (Past 7 Days)',
          onPress: async () => {
            const weekRecs = history.filter((r) => r.date >= past7Str && r.date <= todayStr);
            setExporting(true);
            await shareAttendanceReportPdf(
              weekRecs.length > 0 ? weekRecs : history,
              [user],
              `${user.fullName} - Past 7 Days`,
              'WEEKLY PERSONAL ATTENDANCE REPORT'
            );
            setExporting(false);
          },
        },
        {
          text: '📅 Today Only (Per-Day)',
          onPress: async () => {
            const todayRecs = history.filter((r) => r.date === todayStr);
            setExporting(true);
            await shareAttendanceReportPdf(
              todayRecs.length > 0 ? todayRecs : history,
              [user],
              `${user.fullName} - Today (${todayStr})`,
              'DAILY PERSONAL ATTENDANCE REPORT'
            );
            setExporting(false);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    if (!user) return;
    try {
      const [todayRec, atts] = await Promise.all([
        dataService.getTodayAttendance(user.id),
        dataService.getAttendance(user.id),
      ]);
      setTodayRecord(todayRec);
      setHistory(atts);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
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

  const isAfter7PM = now.getHours() >= 19; // 19:00 = 7:00 PM

  const handleCheckIn = async () => {
    setLoading(true);
    const locRes = await getCurrentAttendanceLocation();

    if (!locRes.success || !locRes.location) {
      setLoading(false);
      Alert.alert('GPS Location Required', locRes.error || 'Failed to capture GPS coordinates.');
      return;
    }

    if (locRes.location.isMocked) {
      setIsGpsMocked(true);
      setLoading(false);
      Alert.alert(
        'Fake GPS Detected',
        'Mock location apps are prohibited. Please disable mock location in developer options to punch attendance.'
      );
      return;
    }

    setCurrentLocation(locRes.location.address || 'GPS verified');
    const punchRes = await dataService.checkIn(user.id, locRes.location);
    setLoading(false);

    if (punchRes.success) {
      Alert.alert('Checked In Successfully', `Recorded at: ${new Date().toLocaleTimeString()}\nLocation: ${locRes.location.address}`);
      await loadData();
    } else {
      Alert.alert('Check-In Notice', punchRes.message);
    }
  };

  const handleCheckOut = async () => {
    setLoading(true);
    const locRes = await getCurrentAttendanceLocation();

    if (!locRes.success || !locRes.location) {
      setLoading(false);
      Alert.alert('GPS Location Required', locRes.error || 'Failed to capture GPS coordinates.');
      return;
    }

    if (locRes.location.isMocked) {
      setIsGpsMocked(true);
      setLoading(false);
      Alert.alert('Fake GPS Detected', 'Mock location apps are not allowed.');
      return;
    }

    setCurrentLocation(locRes.location.address || 'GPS verified');
    const punchRes = await dataService.checkOut(user.id, locRes.location);
    setLoading(false);

    if (punchRes.success) {
      const isNight = punchRes.isNightPresent;
      Alert.alert(
        isNight ? '🌙 Night Present Recorded!' : 'Checked Out Successfully',
        punchRes.message
      );
      await loadData();
    } else {
      Alert.alert('Check-Out Notice', punchRes.message);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="p-4 pb-12"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Real-time Clock Card */}
      <View className="bg-slate-900 rounded-3xl p-6 items-center mb-4">
        <Text className="text-slate-400 text-xs font-semibold mb-1">
          {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </Text>
        <Text className="text-white text-3xl font-black tracking-wider">
          {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </Text>

        {/* Night Rule Badge */}
        {isAfter7PM ? (
          <View className="flex-row items-center bg-purple-950/80 border border-purple-600 px-3 py-2 rounded-xl mt-3.5">
            <Moon size={15} color="#c084fc" />
            <Text className="text-purple-200 text-xs font-bold ml-2 flex-1">
              Night Shift Rule Active: Punching out now marks attendance as NIGHT PRESENT.
            </Text>
          </View>
        ) : (
          <View className="flex-row items-center bg-slate-800 px-3 py-2 rounded-xl mt-3.5">
            <Clock size={14} color="#94a3b8" />
            <Text className="text-slate-400 text-xs ml-2 flex-1">
              Standard shift. Check out after 7:00 PM for Night Present credit.
            </Text>
          </View>
        )}
      </View>

      {/* GPS Status Card */}
      <View className="bg-white rounded-2xl p-4 border border-slate-200 mb-5">
        <View className="flex-row items-center mb-1">
          <MapPin size={16} color="#4f46e5" />
          <Text className="text-sm font-bold text-slate-900 ml-1.5">Mandatory GPS Verification</Text>
        </View>
        <Text className="text-xs text-slate-500 leading-4">
          Every punch captures precision latitude and longitude to verify office presence.
        </Text>

        {currentLocation && (
          <View className="bg-slate-50 p-2.5 rounded-xl mt-2.5 border border-slate-100">
            <Text className="text-[10px] font-bold text-slate-500 uppercase">Last Verified Location:</Text>
            <Text className="text-xs text-slate-900 mt-0.5">{currentLocation}</Text>
          </View>
        )}

        {isGpsMocked && (
          <View className="flex-row items-center bg-rose-50 p-2.5 rounded-lg mt-2 border border-rose-200">
            <ShieldAlert size={15} color="#dc2626" />
            <Text className="text-xs text-rose-600 font-bold ml-1.5 flex-1">
              Mock / Fake location detected. Disable mock locations to continue.
            </Text>
          </View>
        )}
      </View>

      {/* Punch Action Buttons */}
      <View className="mb-6">
        {loading ? (
          <View className="p-6 items-center bg-white rounded-2xl border border-slate-200">
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text className="mt-3 text-xs text-slate-600 font-bold">
              Acquiring GPS coordinates & verifying...
            </Text>
          </View>
        ) : (
          <>
            {/* Check In Button */}
            <TouchableOpacity
              className={`rounded-2xl p-4 flex-row items-center mb-3 ${
                todayRecord?.checkInTime ? 'bg-slate-400 opacity-60' : 'bg-emerald-600'
              }`}
              disabled={!!todayRecord?.checkInTime}
              onPress={handleCheckIn}
            >
              <CheckCircle size={22} color="#ffffff" />
              <View className="ml-3.5 flex-1">
                <Text className="text-white text-base font-black tracking-wide">PUNCH IN (GPS)</Text>
                <Text className="text-white/80 text-xs mt-0.5">
                  {todayRecord?.checkInTime
                    ? `Done at ${new Date(todayRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'Tap to record arrival'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Check Out Button */}
            <TouchableOpacity
              className={`rounded-2xl p-4 flex-row items-center ${
                !todayRecord?.checkInTime || !!todayRecord?.checkOutTime
                  ? 'bg-slate-400 opacity-60'
                  : 'bg-indigo-600'
              }`}
              disabled={!todayRecord?.checkInTime || !!todayRecord?.checkOutTime}
              onPress={handleCheckOut}
            >
              {isAfter7PM ? <Moon size={22} color="#ffffff" /> : <Clock size={22} color="#ffffff" />}
              <View className="ml-3.5 flex-1">
                <Text className="text-white text-base font-black tracking-wide">
                  {isAfter7PM ? 'PUNCH OUT (NIGHT PRESENT)' : 'PUNCH OUT (GPS)'}
                </Text>
                <Text className="text-white/80 text-xs mt-0.5">
                  {todayRecord?.checkOutTime
                    ? `Done at ${new Date(todayRecord.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : isAfter7PM
                    ? 'Qualifies for Night Present (> 7 PM)'
                    : 'Tap when leaving shift'}
                </Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Attendance History */}
      <View className="mt-2">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-base font-extrabold text-slate-900">My Attendance Records</Text>
          {history.length > 0 && (
            <TouchableOpacity
              className="flex-row items-center bg-indigo-600 px-3 py-1.5 rounded-xl"
              onPress={handleExportPdf}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <FileText size={13} color="#ffffff" />
                  <Text className="text-white text-xs font-bold ml-1.5">Export PDF</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
        {history.length === 0 ? (
          <Text className="text-xs text-slate-400">No attendance records recorded yet.</Text>
        ) : (
          history.map((record) => (
            <View key={record.id} className="bg-white rounded-2xl p-3.5 border border-slate-200 mb-2.5">
              <View className="flex-row justify-between items-center mb-2.5">
                <View className="flex-row items-center">
                  <Calendar size={13} color="#64748b" />
                  <Text className="text-xs font-bold text-slate-800 ml-1.5">{record.date}</Text>
                </View>
                {record.isNightPresent ? (
                  <View className="flex-row items-center bg-purple-100 px-2 py-0.5 rounded-full">
                    <Moon size={10} color="#7c3aed" />
                    <Text className="text-[10px] font-bold text-purple-700 ml-1">Night Present (&gt;7 PM)</Text>
                  </View>
                ) : (
                  <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-bold text-emerald-700">Regular Present</Text>
                  </View>
                )}
              </View>

              <View className="flex-row justify-between bg-slate-50 p-2.5 rounded-xl">
                <View className="flex-1">
                  <Text className="text-[10px] text-slate-500 font-bold uppercase">Check-In</Text>
                  <Text className="text-xs font-extrabold text-slate-900 mt-0.5">
                    {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                  </Text>
                </View>

                <View className="flex-1">
                  <Text className="text-[10px] text-slate-500 font-bold uppercase">Check-Out</Text>
                  <Text className={`text-xs font-extrabold mt-0.5 ${record.isNightPresent ? 'text-purple-700' : 'text-slate-900'}`}>
                    {record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}
                  </Text>
                </View>
              </View>

              {record.checkInLocation?.address && (
                <View className="flex-row items-center mt-2">
                  <MapPin size={11} color="#94a3b8" />
                  <Text className="text-[11px] text-slate-500 ml-1" numberOfLines={1}>
                    {record.checkInLocation.address}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
