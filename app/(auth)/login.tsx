import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/store/authContext';
import { ShieldCheck, ArrowRight, UserCheck, Shield } from 'lucide-react-native';

export default function LoginScreen() {
  const [mobileNumber, setMobileNumber] = useState('');
  const { login, isCloudMode } = useAuth();
  const router = useRouter();

  const handleLogin = async (numberToUse?: string) => {
    const target = numberToUse || mobileNumber;
    if (!target || target.trim().length < 10) {
      Alert.alert('Invalid Mobile Number', 'Please enter a valid 10-digit registered mobile number.');
      return;
    }

    const res = await login(target);
    if (res.success && res.user) {
      if (res.user.role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(employee)');
      }
    } else {
      Alert.alert('Access Denied', res.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-slate-50"
    >
      <ScrollView contentContainerClassName="p-6 pt-14 pb-10">
        {/* Top Hero */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 items-center justify-center mb-4">
            <ShieldCheck size={36} color="#4f46e5" />
          </View>
          <Text className="text-3xl font-extrabold text-slate-900 tracking-tight">WorkPulse</Text>
          <Text className="text-sm text-slate-500 mt-1 text-center">
            Employee Attendance & Payroll Platform
          </Text>
         
        </View>

        {/* Login Card */}
        <View className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm mb-8">
          <Text className="text-lg font-bold text-slate-900">Mobile Number Login</Text>
          <Text className="text-xs text-slate-500 mt-1.5 mb-5 leading-5">
            Enter your 10-digit registered mobile number to access your self-service portal.
          </Text>

          <View className="flex-row items-center border border-slate-300 rounded-xl bg-slate-50 mb-4">
            <View className="px-3.5 py-3.5 border-r border-slate-200">
              <Text className="text-base font-bold text-slate-700">+91</Text>
            </View>
            <TextInput
              className="flex-1 px-3.5 py-3.5 text-base text-slate-900 font-semibold"
              placeholder="Enter 10-digit number"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              maxLength={10}
              value={mobileNumber}
              onChangeText={setMobileNumber}
            />
          </View>

          <TouchableOpacity
            className="bg-indigo-600 rounded-xl py-3.5 flex-row items-center justify-center shadow-md shadow-indigo-300"
            activeOpacity={0.8}
            onPress={() => handleLogin()}
          >
            <Text className="text-white text-base font-bold mr-2">Sign In with Mobile</Text>
            <ArrowRight size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Security & Access Notice */}
        <View className="mt-4 bg-slate-100/80 rounded-2xl p-4 border border-slate-200">
          <View className="flex-row items-center mb-1.5">
            <Shield size={16} color="#4f46e5" />
            <Text className="text-xs font-black text-slate-800 uppercase tracking-wider ml-1.5">
              Secure Cloud Access
            </Text>
          </View>
          <Text className="text-xs text-slate-600 leading-relaxed">
            Enter your 10-digit registered mobile number to securely sign in. Your role (Admin or Employee) and assigned factory shifts will be authenticated automatically via cloud database.
          </Text>
          <View className="mt-3 pt-2.5 border-t border-slate-200 flex-row items-center">
            <UserCheck size={14} color="#64748b" />
            <Text className="text-[11px] text-slate-500 font-semibold ml-1.5">
              New employee enrollment? Contact your Company Administrator.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
