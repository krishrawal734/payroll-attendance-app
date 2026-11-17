import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
} from 'react-native';
import { textbeeService } from '../services/textbeeService';
import { TextBeeConfig, DEFAULT_TEXTBEE_CONFIG } from '../config/smsConfig';
import {
  MessageSquare,
  X,
  Smartphone,
  KeyRound,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Bell,
} from 'lucide-react-native';

interface TextBeeModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TextBeeModal({ visible, onClose }: TextBeeModalProps) {
  const [config, setConfig] = useState<TextBeeConfig>(DEFAULT_TEXTBEE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (visible) {
      loadConfig();
      setTestResult(null);
    }
  }, [visible]);

  const loadConfig = async () => {
    setLoading(true);
    const cfg = await textbeeService.getConfig();
    setConfig(cfg);
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await textbeeService.saveConfig(config);
    setSaving(false);
    if (success) {
      Alert.alert('Settings Saved', 'TextBee SMS gateway configuration updated successfully.');
      onClose();
    } else {
      Alert.alert('Error', 'Failed to save configuration to local storage.');
    }
  };

  const handleSendTestSms = async () => {
    if (!testPhone.trim()) {
      Alert.alert('Missing Number', 'Please enter a 10-digit mobile number to send a test SMS.');
      return;
    }
    if (!config.apiKey.trim() || !config.deviceId.trim()) {
      Alert.alert('Missing Credentials', 'Please enter your TextBee API Key and Device ID first.');
      return;
    }

    setTesting(true);
    setTestResult(null);
    const res = await textbeeService.sendTestSms(testPhone.trim(), config);
    setTesting(false);
    setTestResult(res);

    if (res.success) {
      Alert.alert('Test Dispatched', 'Test SMS command sent to your Android SIM gateway. Check your phone!');
    } else {
      Alert.alert('Test Failed', res.message);
    }
  };

  const openTextBeeWebsite = () => {
    Linking.openURL('https://textbee.dev').catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-3xl max-h-[90%] p-5">
          {/* Header */}
          <View className="flex-row justify-between items-center pb-4 border-b border-slate-100">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 items-center justify-center mr-3">
                <MessageSquare size={20} color="#4f46e5" />
              </View>
              <View>
                <Text className="text-base font-black text-slate-900">TextBee SMS Gateway</Text>
                <Text className="text-xs text-slate-500">Android SIM-based Instant Notifications</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="p-2 bg-slate-100 rounded-full">
              <X size={18} color="#64748b" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color="#4f46e5" />
              <Text className="text-xs text-slate-500 font-medium mt-3">Loading gateway settings...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="py-4 pb-8">
              {/* How it works info box */}
              <TouchableOpacity
                onPress={openTextBeeWebsite}
                className="bg-indigo-50/80 rounded-2xl p-3.5 mb-4 border border-indigo-100 flex-row items-center justify-between"
              >
                <View className="flex-1 mr-2">
                  <Text className="text-xs font-black text-indigo-950">Turn your phone into a free SMS Gateway</Text>
                  <Text className="text-[11px] text-indigo-700 mt-0.5 leading-4">
                    Install TextBee Android app, connect your SIM card, and send zero-cost SMS directly from WorkPulse.
                  </Text>
                </View>
                <ExternalLink size={16} color="#4f46e5" />
              </TouchableOpacity>

              {/* Master Gateway Toggle */}
              <View className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-4 flex-row items-center justify-between">
                <View className="flex-1 mr-3">
                  <Text className="text-sm font-extrabold text-slate-900">Enable SMS Dispatch</Text>
                  <Text className="text-xs text-slate-500 mt-0.5">
                    When enabled, the app will trigger your Android SIM to dispatch notifications.
                  </Text>
                </View>
                <Switch
                  value={config.isEnabled}
                  onValueChange={(val) => setConfig({ ...config, isEnabled: val })}
                  trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
                  thumbColor={config.isEnabled ? '#4f46e5' : '#f8fafc'}
                />
              </View>

              {/* Credentials Section */}
              <Text className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Gateway Credentials
              </Text>

              {/* API Key Input */}
              <View className="mb-3">
                <Text className="text-xs font-bold text-slate-700 mb-1 ml-1 flex-row items-center">
                  TextBee API Key
                </Text>
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <KeyRound size={16} color="#64748b" className="mr-2" />
                  <TextInput
                    className="flex-1 text-xs text-slate-900 font-medium ml-2"
                    placeholder="e.g. tb_live_xxxxxxxxxxxxxxxxxxxxxxxx"
                    placeholderTextColor="#94a3b8"
                    value={config.apiKey}
                    onChangeText={(val) => setConfig({ ...config, apiKey: val })}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Text className="text-[10px] text-slate-400 mt-1 ml-1">
                  Obtained from your dashboard at textbee.dev
                </Text>
              </View>

              {/* Device ID Input */}
              <View className="mb-4">
                <Text className="text-xs font-bold text-slate-700 mb-1 ml-1 flex-row items-center">
                  Android Device ID
                </Text>
                <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                  <Smartphone size={16} color="#64748b" className="mr-2" />
                  <TextInput
                    className="flex-1 text-xs text-slate-900 font-medium ml-2"
                    placeholder="e.g. 660fxxxxxxxxxxxxxxxxxxxx"
                    placeholderTextColor="#94a3b8"
                    value={config.deviceId}
                    onChangeText={(val) => setConfig({ ...config, deviceId: val })}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Text className="text-[10px] text-slate-400 mt-1 ml-1">
                  Shown in the TextBee app on your gateway phone
                </Text>
              </View>

              {/* Automated Triggers */}
              <Text className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Notification Rules
              </Text>

              <View className="bg-slate-50 rounded-2xl p-3 border border-slate-200 mb-5 divide-y divide-slate-200">
                <View className="flex-row justify-between items-center py-2.5">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs font-extrabold text-slate-900">Salary & Advance Disbursals</Text>
                    <Text className="text-[10px] text-slate-500 mt-0.5">
                      Sends payment receipt SMS with amount, mode & reference ID.
                    </Text>
                  </View>
                  <Switch
                    value={config.notifySalary}
                    onValueChange={(val) => setConfig({ ...config, notifySalary: val })}
                    trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
                    thumbColor={config.notifySalary ? '#4f46e5' : '#f8fafc'}
                  />
                </View>

                <View className="flex-row justify-between items-center py-2.5">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs font-extrabold text-slate-900">Attendance Punch (In / Out)</Text>
                    <Text className="text-[10px] text-slate-500 mt-0.5">
                      Sends punch confirmation and notifies if night shift bonus applied.
                    </Text>
                  </View>
                  <Switch
                    value={config.notifyAttendance}
                    onValueChange={(val) => setConfig({ ...config, notifyAttendance: val })}
                    trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
                    thumbColor={config.notifyAttendance ? '#4f46e5' : '#f8fafc'}
                  />
                </View>

                <View className="flex-row justify-between items-center py-2.5">
                  <View className="flex-1 mr-2">
                    <Text className="text-xs font-extrabold text-slate-900">Monthly Payslip Ready</Text>
                    <Text className="text-[10px] text-slate-500 mt-0.5">
                      Sends SMS with Gross, Deductions, and Net Take-Home when slip is created.
                    </Text>
                  </View>
                  <Switch
                    value={config.notifyPayslip}
                    onValueChange={(val) => setConfig({ ...config, notifyPayslip: val })}
                    trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
                    thumbColor={config.notifyPayslip ? '#4f46e5' : '#f8fafc'}
                  />
                </View>
              </View>

              {/* Test SMS Dispatcher */}
              <Text className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2 ml-1">
                Live Test Connection
              </Text>
              <View className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-5">
                <Text className="text-xs text-slate-600 mb-2 font-medium">
                  Verify that your TextBee Android app is active and can dispatch messages:
                </Text>
                <View className="flex-row items-center mb-3">
                  <TextInput
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 mr-2"
                    placeholder="Enter phone number (e.g. 9876543210)"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    value={testPhone}
                    onChangeText={setTestPhone}
                  />
                  <TouchableOpacity
                    className="bg-slate-900 px-4 py-2.5 rounded-xl flex-row items-center active:bg-slate-800"
                    onPress={handleSendTestSms}
                    disabled={testing}
                  >
                    {testing ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Send size={13} color="#ffffff" />
                        <Text className="text-white text-xs font-bold ml-1.5">Test</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {testResult && (
                  <View
                    className={`flex-row items-center p-2.5 rounded-xl ${
                      testResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 size={14} color="#059669" />
                    ) : (
                      <AlertCircle size={14} color="#e11d48" />
                    )}
                    <Text
                      className={`text-xs ml-1.5 flex-1 font-bold ${
                        testResult.success ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      {testResult.message}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View className="flex-row space-x-3">
                <TouchableOpacity
                  className="flex-1 bg-slate-100 py-3 rounded-xl items-center mr-2 active:bg-slate-200"
                  onPress={onClose}
                >
                  <Text className="text-slate-700 text-xs font-bold">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 bg-indigo-600 py-3 rounded-xl items-center flex-row justify-center active:bg-indigo-700"
                  onPress={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <ShieldCheck size={16} color="#ffffff" />
                      <Text className="text-white text-xs font-bold ml-1.5">Save Gateway Settings</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
