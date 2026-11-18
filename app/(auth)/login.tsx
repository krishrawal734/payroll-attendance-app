import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
  Share,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/store/authContext';
import { dataService } from '../../src/services/dataService';
import {
  generateTotpSecret,
  buildTotpUri,
  verifyTotpCode,
  getTotpRemainingSeconds,
  formatSecretKey,
} from '../../src/services/totpService';
import { Employee } from '../../src/types';
import WorkPulseLogo from '../../src/components/WorkPulseLogo';
import QrCodeSvg from '../../src/components/QrCodeSvg';
import {
  ArrowRight,
  ArrowLeft,
  Shield,
  ShieldCheck,
  KeyRound,
  ExternalLink,
  Copy,
  UserCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  Smartphone,
  X,
  RotateCcw,
} from 'lucide-react-native';

type AuthStep = 'mobile' | 'setup' | 'verify';

const CARD_ELEVATION = {
  elevation: 5,
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.08,
  shadowRadius: 16,
};

const BUTTON_ELEVATION = {
  elevation: 3,
  shadowColor: '#4f46e5',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 10,
};

export default function LoginScreen() {
  const router = useRouter();
  const { lookupUserByMobile, completeLogin } = useAuth();

  const [step, setStep] = useState<AuthStep>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const [pendingUser, setPendingUser] = useState<Employee | null>(null);
  const [setupSecret, setSetupSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(getTotpRemainingSeconds());

  const otpInputRef = useRef<TextInput>(null);

  // Live 30-second countdown timer while on setup or verify step
  useEffect(() => {
    if (step === 'mobile') return;
    setSecondsLeft(getTotpRemainingSeconds());
    const interval = setInterval(() => {
      setSecondsLeft(getTotpRemainingSeconds());
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const navigateToRoleHome = (authenticatedUser: Employee) => {
    if (authenticatedUser.role === 'admin') {
      router.replace('/(admin)');
    } else {
      router.replace('/(employee)');
    }
  };

  const handleMobileContinue = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    const cleaned = mobileNumber.trim().replace(/\D/g, '');
    if (cleaned.length < 10) {
      setErrorMsg('Please enter a valid 10-digit registered mobile number.');
      return;
    }

    setLoading(true);
    const res = await lookupUserByMobile(cleaned);
    setLoading(false);

    if (!res.success || !res.user) {
      setErrorMsg(res.message || 'Mobile number not registered. Contact your Company Admin.');
      return;
    }

    setPendingUser(res.user);
    setOtpCode('');

    if (res.user.is2faEnabled && res.user.totpSecret) {
      setStep('verify');
      setTimeout(() => otpInputRef.current?.focus(), 200);
    } else {
      const freshSecret = generateTotpSecret();
      setSetupSecret(freshSecret);
      setStep('setup');
    }
  };

  const handleVerifySetup = async (codeOverride?: string) => {
    if (!pendingUser || !setupSecret) return;
    const code = (codeOverride ?? otpCode).trim();
    setErrorMsg(null);

    if (code.length !== 6) {
      setErrorMsg('Please enter the 6-digit code shown in Google Authenticator.');
      return;
    }

    const isValid = verifyTotpCode(setupSecret, code, 1);
    if (!isValid) {
      setErrorMsg(
        'Code did not match. Ensure WorkPulse is added in Google Authenticator and enter the latest 6-digit code.'
      );
      return;
    }

    setLoading(true);
    const saveRes = await dataService.saveTotpSecret(pendingUser.id, setupSecret);
    if (!saveRes.success) {
      setLoading(false);
      setErrorMsg(saveRes.message);
      return;
    }

    const updatedUser: Employee = {
      ...pendingUser,
      totpSecret: setupSecret,
      is2faEnabled: true,
    };

    await completeLogin(updatedUser);
    setLoading(false);
    navigateToRoleHome(updatedUser);
  };

  const handleVerifyLogin = async (codeOverride?: string) => {
    if (!pendingUser || !pendingUser.totpSecret) return;
    const code = (codeOverride ?? otpCode).trim();
    setErrorMsg(null);

    if (code.length !== 6) {
      setErrorMsg('Please enter the 6-digit code from Google Authenticator.');
      return;
    }

    const isValid = verifyTotpCode(pendingUser.totpSecret, code, 1);
    if (!isValid) {
      setErrorMsg('Invalid Google Authenticator code. Please check the app and try again.');
      return;
    }

    setLoading(true);
    await completeLogin(pendingUser);
    setLoading(false);
    navigateToRoleHome(pendingUser);
  };

  const handleOtpChange = (text: string) => {
    const digitsOnly = text.replace(/\D/g, '').slice(0, 6);
    setOtpCode(digitsOnly);
    if (errorMsg) setErrorMsg(null);

    if (digitsOnly.length === 6) {
      if (step === 'verify') {
        handleVerifyLogin(digitsOnly);
      } else if (step === 'setup') {
        handleVerifySetup(digitsOnly);
      }
    }
  };

  const handleClearOtp = () => {
    setOtpCode('');
    setErrorMsg(null);
    otpInputRef.current?.focus();
  };

  const handleOpenAuthenticatorApp = async () => {
    if (!pendingUser || !setupSecret) return;
    setErrorMsg(null);
    setInfoMsg(null);

    const accountLabel = `${pendingUser.fullName} (${pendingUser.mobileNumber})`;
    const uri = buildTotpUri(setupSecret, accountLabel, 'WorkPulse');

    try {
      const supported = await Linking.canOpenURL(uri);
      if (supported) {
        await Linking.openURL(uri);
        setInfoMsg(
          'Opened Google Authenticator! Tap "Add" there, then return here and enter the 6-digit code.'
        );
      } else {
        setErrorMsg(
          'Google Authenticator app was not detected. Install it from Play Store or enter the manual key below.'
        );
      }
    } catch {
      try {
        await Linking.openURL(uri);
      } catch {
        setErrorMsg(
          'Could not launch Google Authenticator automatically. Open it manually → "+" → "Enter a setup key".'
        );
      }
    }
  };

  const handleShareSecretKey = async () => {
    if (!setupSecret) return;
    try {
      await Share.share({
        message: setupSecret,
        title: 'WorkPulse Google Authenticator Setup Key',
      });
    } catch {
      // Dismissed share sheet
    }
  };

  const handleInstallAuthenticator = () => {
    const storeUrl =
      Platform.OS === 'ios'
        ? 'https://apps.apple.com/app/google-authenticator/id388497605'
        : 'https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2';
    Linking.openURL(storeUrl).catch(() => {});
  };

  const handleResetToMobile = () => {
    setStep('mobile');
    setPendingUser(null);
    setSetupSecret('');
    setOtpCode('');
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const maskMobile = (num: string) => {
    if (num.length < 4) return num;
    return `••••••${num.slice(-4)}`;
  };

  const totpUri =
    pendingUser && setupSecret
      ? buildTotpUri(setupSecret, `${pendingUser.fullName} (${pendingUser.mobileNumber})`, 'WorkPulse')
      : '';

  const renderOtpBoxes = () => {
    const digits = otpCode.split('');
    return (
      <View className="mb-3">
        <TouchableOpacity
          activeOpacity={1}
          className="flex-row justify-between gap-2 relative"
          onPress={() => otpInputRef.current?.focus()}
        >
          <TextInput
            ref={otpInputRef}
            className="absolute inset-0 w-full h-full z-10"
            style={{ opacity: 0.01 }}
            value={otpCode}
            onChangeText={handleOtpChange}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            caretHidden
          />
          {[0, 1, 2, 3, 4, 5].map((index) => {
            const digit = digits[index] || '';
            const isActive = index === otpCode.length || (otpCode.length === 6 && index === 5);
            const isFilled = digit !== '';

            const boxClasses = errorMsg
              ? 'border-rose-400 bg-rose-50 border-2'
              : isActive
                ? 'border-indigo-600 bg-white border-2'
                : isFilled
                  ? 'border-indigo-400 bg-indigo-50 border-2'
                  : 'border-slate-200 bg-slate-50 border';

            return (
              <View
                key={index}
                className={`flex-1 h-14 rounded-2xl items-center justify-center ${boxClasses}`}
              >
                <Text
                  className={`text-2xl font-extrabold ${
                    errorMsg
                      ? 'text-rose-700'
                      : isFilled
                        ? 'text-indigo-950'
                        : 'text-slate-300'
                  }`}
                >
                  {digit || '•'}
                </Text>
              </View>
            );
          })}
        </TouchableOpacity>

        {otpCode.length > 0 && (
          <View className="flex-row justify-end mt-2">
            <TouchableOpacity
              onPress={handleClearOtp}
              className="flex-row items-center gap-1 px-2 py-1"
            >
              <RotateCcw size={12} color="#64748b" />
              <Text className="text-xs font-semibold text-slate-500">Clear code</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderCountdownBar = () => {
    const progressPct = (secondsLeft / 30) * 100;
    const isExpiring = secondsLeft <= 5;
    return (
      <View className="mb-5">
        <View className="flex-row items-center justify-between mb-1.5 px-0.5">
          <View className="flex-row items-center gap-1.5">
            <Clock size={13} color={isExpiring ? '#d97706' : '#64748b'} />
            <Text
              className={`text-xs font-semibold ${
                isExpiring ? 'text-amber-600' : 'text-slate-500'
              }`}
            >
              {isExpiring ? 'Code expiring soon...' : 'Current code cycle'}
            </Text>
          </View>
          <Text
            className={`text-xs font-extrabold ${
              isExpiring ? 'text-amber-600' : 'text-indigo-600'
            }`}
          >
            {secondsLeft}s
          </Text>
        </View>
        <View className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <View
            className={`h-full rounded-full ${isExpiring ? 'bg-amber-500' : 'bg-indigo-600'}`}
            style={{ width: `${progressPct}%` }}
          />
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-slate-100"
    >
      <StatusBar style="light" />
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Branded Dark Hero Header */}
        <View className="bg-indigo-950 pt-14 pb-16 px-6 rounded-b-[36px] items-center">
          <View className="w-20 h-20 rounded-3xl bg-indigo-900 border border-indigo-700 items-center justify-center mb-3.5">
            <WorkPulseLogo size={54} />
          </View>

          <Text className="text-3xl font-extrabold text-white tracking-tight">WorkPulse</Text>
          <Text className="text-xs font-medium text-indigo-200 mt-1 text-center">
            Employee Attendance & Payroll Platform
          </Text>

          <View className="flex-row items-center gap-1.5 mt-3.5 px-3.5 py-1.5 rounded-full bg-indigo-900 border border-indigo-700">
            <ShieldCheck size={13} color="#34d399" />
            <Text className="text-[11px] font-bold text-indigo-100">
              Google Authenticator Secured
            </Text>
          </View>
        </View>

        {/* Main Floating Card */}
        <View className="-mt-9 mx-5">
          {/* STEP 1: MOBILE NUMBER */}
          {step === 'mobile' && (
            <>
              <View
                className="bg-white rounded-3xl p-6 border border-slate-200"
                style={CARD_ELEVATION}
              >
                {/* Step Pill */}
                <View className="flex-row items-center justify-between mb-4">
                  <View className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200">
                    <Text className="text-[10px] font-extrabold text-indigo-700 tracking-wider">
                      STEP 1 OF 2
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <View className="w-6 h-1.5 rounded-full bg-indigo-600" />
                    <View className="w-2.5 h-1.5 rounded-full bg-slate-200" />
                  </View>
                </View>

                <Text className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Welcome Back
                </Text>
                <Text className="text-xs text-slate-500 mt-1.5 mb-6 leading-5">
             Enter your 10-digit registered mobile number to access your self-service portal.
                </Text>

                {/* Mobile Number Field */}
                <Text className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Registered Mobile Number
                </Text>
                <View
                  className={`flex-row items-center rounded-2xl overflow-hidden mb-4 ${
                    errorMsg
                      ? 'border-2 border-rose-400 bg-rose-50'
                      : isPhoneFocused
                        ? 'border-2 border-indigo-600 bg-white'
                        : 'border border-slate-300 bg-slate-50'
                  }`}
                >
                  <View className="px-3.5 py-4 bg-slate-100 border-r border-slate-200 flex-row items-center gap-1.5">
                    <Smartphone size={15} color="#475569" />
                    <Text className="text-base font-extrabold text-slate-700">+91</Text>
                  </View>
                  <TextInput
                    className="flex-1 px-3.5 py-4 text-base font-bold text-slate-900 tracking-widest"
                    placeholder="98765 43210"
                    placeholderTextColor="#94a3b8"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={mobileNumber}
                    onFocus={() => setIsPhoneFocused(true)}
                    onBlur={() => setIsPhoneFocused(false)}
                    onChangeText={(val) => {
                      setMobileNumber(val.replace(/\D/g, ''));
                      if (errorMsg) setErrorMsg(null);
                    }}
                    onSubmitEditing={handleMobileContinue}
                    returnKeyType="done"
                  />
                  {mobileNumber.length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        setMobileNumber('');
                        setErrorMsg(null);
                      }}
                      className="pr-3.5 pl-2 py-3"
                    >
                      <View className="w-6 h-6 rounded-full bg-slate-200 items-center justify-center">
                        <X size={13} color="#475569" />
                      </View>
                    </TouchableOpacity>
                  )}
                </View>

                {errorMsg && (
                  <View className="flex-row items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-2xl p-3.5 mb-4">
                    <AlertCircle size={16} color="#dc2626" style={{ marginTop: 1 }} />
                    <Text className="flex-1 text-xs font-semibold text-rose-700 leading-5">
                      {errorMsg}
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  className={`bg-indigo-600 rounded-2xl py-4 flex-row items-center justify-center gap-2 ${
                    loading || mobileNumber.length < 10 ? 'opacity-60' : 'opacity-100'
                  }`}
                  style={BUTTON_ELEVATION}
                  activeOpacity={0.85}
                  disabled={loading}
                  onPress={handleMobileContinue}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <Text className="text-white text-base font-bold">
                        Continue to Login
                      </Text>
                      <ArrowRight size={18} color="#ffffff" />
                    </>
                  )}
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

              
            </>
          )}

          {/* STEP 2A: FIRST-TIME GOOGLE AUTHENTICATOR SETUP */}
          {step === 'setup' && pendingUser && (
            <View
              className="bg-white rounded-3xl p-6 border border-slate-200"
              style={CARD_ELEVATION}
            >
              {/* Top Nav + Step Progress */}
              <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 py-1 pr-2"
                  onPress={handleResetToMobile}
                >
                  <ArrowLeft size={16} color="#4f46e5" />
                  <Text className="text-xs font-bold text-indigo-600">Change Number</Text>
                </TouchableOpacity>

                <View className="flex-row items-center gap-1.5">
                  <View className="w-2.5 h-1.5 rounded-full bg-indigo-200" />
                  <View className="w-6 h-1.5 rounded-full bg-indigo-600" />
                </View>
              </View>

              {/* User Identity Pill */}
              <View className="flex-row items-center bg-slate-50 rounded-2xl p-3.5 border border-slate-200 mb-5 gap-3">
                <View className="w-11 h-11 rounded-2xl bg-indigo-600 items-center justify-center">
                  <Text className="text-sm font-extrabold text-white">
                    {pendingUser.fullName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-extrabold text-slate-900" numberOfLines={1}>
                    {pendingUser.fullName}
                  </Text>
                  <Text className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    +91 {pendingUser.mobileNumber} • {pendingUser.role.toUpperCase()}
                  </Text>
                </View>
                <View className="px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200">
                  <Text className="text-[10px] font-extrabold text-amber-800">1st Setup</Text>
                </View>
              </View>

              <Text className="text-xl font-extrabold text-slate-900">
                Link Google Authenticator
              </Text>
              <Text className="text-xs text-slate-500 mt-1 mb-5 leading-5">
                One-time setup: connect WorkPulse to Google Authenticator, then enter the 6-digit code below.
              </Text>

              {/* Part 1: Add to Authenticator */}
              <View className="flex-row items-center gap-2 mb-2.5">
                <View className="w-5 h-5 rounded-full bg-indigo-600 items-center justify-center">
                  <Text className="text-[11px] font-extrabold text-white">1</Text>
                </View>
                <Text className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Add Account to Authenticator
                </Text>
              </View>

              <TouchableOpacity
                className="bg-slate-900 rounded-2xl py-3.5 flex-row items-center justify-center gap-2 mb-2"
                activeOpacity={0.85}
                onPress={handleOpenAuthenticatorApp}
              >
                <ExternalLink size={16} color="#ffffff" />
                <Text className="text-white text-sm font-bold">Open in Google Authenticator</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="items-center py-1 mb-4"
                onPress={handleInstallAuthenticator}
              >
                <Text className="text-xs font-semibold text-indigo-600">
                  Don't have the app? Download from Play Store →
                </Text>
              </TouchableOpacity>

              {/* QR Code + Manual Setup Key */}
              <View className="items-center bg-slate-50 rounded-2xl p-4 border border-slate-200 mb-5">
                <Text className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">
                  Or Scan QR Code / Use Key
                </Text>
                <QrCodeSvg value={totpUri} size={156} />

                <View className="w-full mt-4 bg-white rounded-xl p-3 border border-slate-200 items-center">
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Manual Setup Key
                  </Text>
                  <Text
                    className="text-xs font-extrabold text-slate-900 text-center tracking-widest"
                    style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}
                    selectable
                  >
                    {formatSecretKey(setupSecret)}
                  </Text>
                  <TouchableOpacity
                    className="flex-row items-center gap-1.5 mt-2.5 px-3.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200"
                    onPress={handleShareSecretKey}
                  >
                    <Copy size={13} color="#4f46e5" />
                    <Text className="text-xs font-bold text-indigo-700">Share / Copy Key</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {infoMsg && (
                <View className="flex-row items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 mb-4">
                  <CheckCircle2 size={16} color="#059669" style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-xs font-semibold text-emerald-800 leading-5">
                    {infoMsg}
                  </Text>
                </View>
              )}

              {/* Part 2: Enter 6-Digit Code */}
              <View className="flex-row items-center gap-2 mb-3">
                <View className="w-5 h-5 rounded-full bg-indigo-600 items-center justify-center">
                  <Text className="text-[11px] font-extrabold text-white">2</Text>
                </View>
                <Text className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
                  Enter 6-Digit Code
                </Text>
              </View>

              {renderOtpBoxes()}
              {renderCountdownBar()}

              {errorMsg && (
                <View className="flex-row items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-2xl p-3.5 mb-4">
                  <AlertCircle size={16} color="#dc2626" style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-xs font-semibold text-rose-700 leading-5">
                    {errorMsg}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                className={`bg-indigo-600 rounded-2xl py-4 flex-row items-center justify-center gap-2 ${
                  loading || otpCode.length < 6 ? 'opacity-50' : 'opacity-100'
                }`}
                style={BUTTON_ELEVATION}
                activeOpacity={0.85}
                disabled={loading || otpCode.length < 6}
                onPress={() => handleVerifySetup()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <ShieldCheck size={18} color="#ffffff" />
                    <Text className="text-white text-base font-bold">
                      Verify & Activate Login
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2B: RETURNING USER 6-DIGIT CODE VERIFICATION */}
          {step === 'verify' && pendingUser && (
            <View
              className="bg-white rounded-3xl p-6 border border-slate-200"
              style={CARD_ELEVATION}
            >
              {/* Top Nav + Step Progress */}
              <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity
                  className="flex-row items-center gap-1.5 py-1 pr-2"
                  onPress={handleResetToMobile}
                >
                  <ArrowLeft size={16} color="#4f46e5" />
                  <Text className="text-xs font-bold text-indigo-600">Change Number</Text>
                </TouchableOpacity>

                <View className="flex-row items-center gap-1.5">
                  <View className="w-2.5 h-1.5 rounded-full bg-indigo-200" />
                  <View className="w-6 h-1.5 rounded-full bg-indigo-600" />
                </View>
              </View>

              {/* User Identity Pill */}
              <View className="flex-row items-center bg-slate-50 rounded-2xl p-3.5 border border-slate-200 mb-6 gap-3">
                <View className="w-11 h-11 rounded-2xl bg-indigo-600 items-center justify-center">
                  <Text className="text-sm font-extrabold text-white">
                    {pendingUser.fullName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-extrabold text-slate-900" numberOfLines={1}>
                    {pendingUser.fullName}
                  </Text>
                  <Text className="text-[11px] font-semibold text-slate-500 mt-0.5">
                    +91 {maskMobile(pendingUser.mobileNumber)} • {pendingUser.role.toUpperCase()}
                  </Text>
                </View>
               
              </View>

              {/* Center Authenticator Prompt */}
              <View className="items-center mb-5">
                <View className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 items-center justify-center mb-3">
                  <KeyRound size={26} color="#4f46e5" />
                </View>
                <Text className="text-xl font-extrabold text-slate-900 text-center">
                ENTER OTP TO LOGIN
                </Text>
                <Text className="text-xs text-slate-500 text-center mt-1.5 leading-5 px-2">
               Enter the 6-digit code to securely sign in. This code is  refreshes every 30 seconds.
                </Text>
              </View>

              {renderOtpBoxes()}
              {renderCountdownBar()}

              {errorMsg && (
                <View className="flex-row items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-2xl p-3.5 mb-4">
                  <AlertCircle size={16} color="#dc2626" style={{ marginTop: 1 }} />
                  <Text className="flex-1 text-xs font-semibold text-rose-700 leading-5">
                    {errorMsg}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                className={`bg-indigo-600 rounded-2xl py-4 flex-row items-center justify-center gap-2 ${
                  loading || otpCode.length < 6 ? 'opacity-50' : 'opacity-100'
                }`}
                style={BUTTON_ELEVATION}
                activeOpacity={0.85}
                disabled={loading || otpCode.length < 6}
                onPress={() => handleVerifyLogin()}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Text className="text-white text-base font-bold">Verify & Sign In</Text>
                    <ArrowRight size={18} color="#ffffff" />
                  </>
                )}
              </TouchableOpacity>

              
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
