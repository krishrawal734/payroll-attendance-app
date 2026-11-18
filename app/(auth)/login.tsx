import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Share,
  Animated,
  StatusBar,
} from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
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
  ShieldCheck,
  KeyRound,
  ExternalLink,
  Copy,
  AlertCircle,
  CheckCircle2,
  QrCode,
  Smartphone,
  Lock,
  WifiOff,
  X,
  RefreshCw,
} from 'lucide-react-native';

type AuthStep = 'mobile' | 'setup' | 'verify';
type SetupTab = 'qr' | 'key';

export default function LoginScreen() {
  const router = useRouter();
  const { lookupUserByMobile, completeLogin } = useAuth();

  const [step, setStep] = useState<AuthStep>('mobile');
  const [setupTab, setSetupTab] = useState<SetupTab>('qr');
  const [mobileNumber, setMobileNumber] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [pendingUser, setPendingUser] = useState<Employee | null>(null);
  const [setupSecret, setSetupSecret] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(getTotpRemainingSeconds());

  const otpInputRef = useRef<TextInput>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Smooth step transition animation
  const animateStepTransition = (nextStep: AuthStep) => {
    fadeAnim.setValue(0);
    slideAnim.setValue(18);
    setStep(nextStep);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Subtle horizontal shake on invalid OTP
  const triggerOtpShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 45, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

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
    setVerifiedSuccess(true);
    setTimeout(() => {
      if (authenticatedUser.role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(employee)');
      }
    }, 450);
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
      setErrorMsg(res.message || 'Mobile number not found. Contact your Admin to register.');
      return;
    }

    setPendingUser(res.user);
    setOtpCode('');
    setVerifiedSuccess(false);

    if (res.user.is2faEnabled && res.user.totpSecret) {
      animateStepTransition('verify');
      setTimeout(() => otpInputRef.current?.focus(), 260);
    } else {
      const freshSecret = generateTotpSecret();
      setSetupSecret(freshSecret);
      setSetupTab('qr');
      animateStepTransition('setup');
    }
  };

  const handleVerifySetup = async (codeOverride?: string) => {
    if (!pendingUser || !setupSecret || loading) return;
    const code = (codeOverride ?? otpCode).trim();
    setErrorMsg(null);

    if (code.length !== 6) {
      setErrorMsg('Enter the 6-digit code shown in Google Authenticator.');
      triggerOtpShake();
      return;
    }

    const isValid = verifyTotpCode(setupSecret, code, 1);
    if (!isValid) {
      setErrorMsg('Code did not match. Ensure WorkPulse is added in Google Authenticator and enter the latest 6 digits.');
      triggerOtpShake();
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
    if (!pendingUser || !pendingUser.totpSecret || loading) return;
    const code = (codeOverride ?? otpCode).trim();
    setErrorMsg(null);

    if (code.length !== 6) {
      setErrorMsg('Enter the 6-digit code from Google Authenticator.');
      triggerOtpShake();
      return;
    }

    const isValid = verifyTotpCode(pendingUser.totpSecret, code, 1);
    if (!isValid) {
      setErrorMsg('Invalid authenticator code. Please check Google Authenticator and try again.');
      triggerOtpShake();
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

  const handleOpenAuthenticatorApp = async () => {
    if (!pendingUser || !setupSecret) return;
    setErrorMsg(null);
    setInfoMsg(null);

    const accountLabel = `${pendingUser.fullName} (${pendingUser.mobileNumber})`;
    const uri = buildTotpUri(setupSecret, accountLabel, 'WorkPulse');

    try {
      await Linking.openURL(uri);
      setInfoMsg('Opened Google Authenticator! Tap "Add", then return here and enter the 6-digit code.');
    } catch {
      setErrorMsg(
        'Could not launch Google Authenticator automatically. Install it from Play Store or copy the setup key manually.'
      );
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
      // dismissed
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
    setPendingUser(null);
    setSetupSecret('');
    setOtpCode('');
    setErrorMsg(null);
    setInfoMsg(null);
    setVerifiedSuccess(false);
    animateStepTransition('mobile');
  };

  const maskMobile = (num: string) => {
    if (num.length < 4) return num;
    return `••••••${num.slice(-4)}`;
  };

  const totpUri =
    pendingUser && setupSecret
      ? buildTotpUri(setupSecret, `${pendingUser.fullName} (${pendingUser.mobileNumber})`, 'WorkPulse')
      : '';

  // Circular SVG 30s TOTP countdown ring
  const renderCountdownRing = () => {
    const ringSize = 26;
    const strokeWidth = 2.8;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - secondsLeft / 30);
    const isExpiring = secondsLeft <= 5;
    const ringColor = isExpiring ? '#f59e0b' : '#4f46e5';

    return (
      <View style={styles.countdownRow}>
        <View style={styles.ringWrap}>
          <Svg width={ringSize} height={ringSize}>
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="#e2e8f0"
              strokeWidth={strokeWidth}
              fill="none"
            />
            <Circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={ringColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
            />
          </Svg>
          <Text style={[styles.ringSeconds, isExpiring && { color: '#d97706' }]}>
            {secondsLeft}
          </Text>
        </View>
        <Text style={[styles.countdownLabel, isExpiring && styles.countdownLabelWarn]}>
          {isExpiring ? `Refreshing code in ${secondsLeft}s…` : `Code valid for ${secondsLeft}s`}
        </Text>
        {otpCode.length > 0 && !verifiedSuccess && (
          <TouchableOpacity
            onPress={() => {
              setOtpCode('');
              setErrorMsg(null);
              otpInputRef.current?.focus();
            }}
            style={styles.clearOtpBtn}
          >
            <RefreshCw size={11} color="#64748b" />
            <Text style={styles.clearOtpText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Split 3 + 3 OTP boxes matching Google Authenticator's "123 456" layout
  const renderOtpBoxes = () => {
    const digits = otpCode.split('');
    const renderBox = (index: number) => {
      const digit = digits[index] || '';
      const isActive = index === otpCode.length || (otpCode.length === 6 && index === 5);
      const isFilled = digit !== '';
      return (
        <View
          key={index}
          style={[
            styles.otpBox,
            isFilled && styles.otpBoxFilled,
            isActive && !verifiedSuccess && styles.otpBoxActive,
            errorMsg ? styles.otpBoxError : null,
            verifiedSuccess ? styles.otpBoxSuccess : null,
          ]}
        >
          <Text
            style={[
              styles.otpDigit,
              isFilled && styles.otpDigitFilled,
              verifiedSuccess && styles.otpDigitSuccess,
            ]}
          >
            {digit || ''}
          </Text>
          {!isFilled && !isActive && <View style={styles.otpPlaceholderDot} />}
          {!isFilled && isActive && !verifiedSuccess && <View style={styles.otpCursorBar} />}
        </View>
      );
    };

    return (
      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.otpContainer}
          onPress={() => otpInputRef.current?.focus()}
        >
          <TextInput
            ref={otpInputRef}
            style={styles.hiddenOtpInput}
            value={otpCode}
            onChangeText={handleOtpChange}
            keyboardType="number-pad"
            maxLength={6}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            caretHidden
          />
          <View style={styles.otpGroup}>
            {[0, 1, 2].map(renderBox)}
          </View>
          <View style={styles.otpDividerDash} />
          <View style={styles.otpGroup}>
            {[3, 4, 5].map(renderBox)}
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderUserBanner = (isFirstLogin: boolean) => {
    if (!pendingUser) return null;
    const isAdmin = pendingUser.role === 'admin';
    return (
      <View style={styles.userCard}>
        <View style={[styles.userAvatar, isAdmin && styles.userAvatarAdmin]}>
          <Text style={[styles.userAvatarText, isAdmin && styles.userAvatarTextAdmin]}>
            {pendingUser.fullName.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.userName} numberOfLines={1}>
              {pendingUser.fullName}
            </Text>
          </View>
          <View style={styles.userMetaRow}>
            <Text style={styles.userMetaText}>
              +91 {isFirstLogin ? pendingUser.mobileNumber : maskMobile(pendingUser.mobileNumber)}
            </Text>
            <View style={[styles.rolePill, isAdmin ? styles.rolePillAdmin : styles.rolePillEmp]}>
              <Text style={[styles.rolePillText, isAdmin ? styles.rolePillTextAdmin : styles.rolePillTextEmp]}>
                {isAdmin ? 'ADMIN' : 'EMPLOYEE'}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.switchBtn} onPress={handleResetToMobile}>
          <Text style={styles.switchBtnText}>Switch</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* PREMIUM DARK HERO HEADER */}
          <View style={styles.heroBanner}>
            {/* Subtle ambient glow behind logo */}
            <Svg
              width={280}
              height={220}
              viewBox="0 0 280 220"
              style={styles.heroGlowSvg}
              pointerEvents="none"
            >
              <Defs>
                <RadialGradient id="heroGlow" cx="50%" cy="45%" r="50%">
                  <Stop offset="0%" stopColor="#4f46e5" stopOpacity="0.45" />
                  <Stop offset="60%" stopColor="#06b6d4" stopOpacity="0.12" />
                  <Stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Circle cx="140" cy="100" r="110" fill="url(#heroGlow)" />
            </Svg>

            <View style={styles.logoGlassBadge}>
              <WorkPulseLogo size={50} />
            </View>

            <View style={styles.brandTitleRow}>
              <Text style={styles.brandWork}>Work</Text>
              <Text style={styles.brandPulse}>Pulse</Text>
            </View>
            <Text style={styles.brandTagline}>
              Smart Workforce Attendance & Payroll
            </Text>

            {/* 2-Step Progress Stepper */}
            <View style={styles.stepperRow}>
              <View style={styles.stepItem}>
                <View style={[styles.stepDot, step === 'mobile' ? styles.stepDotActive : styles.stepDotDone]}>
                  {step === 'mobile' ? (
                    <Text style={styles.stepDotNum}>1</Text>
                  ) : (
                    <CheckCircle2 size={12} color="#ffffff" />
                  )}
                </View>
                <Text style={[styles.stepLabel, step === 'mobile' && styles.stepLabelActive]}>
                  Mobile ID
                </Text>
              </View>

              <View style={[styles.stepConnector, step !== 'mobile' && styles.stepConnectorActive]} />

              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    step !== 'mobile' ? styles.stepDotActive : styles.stepDotIdle,
                    verifiedSuccess && styles.stepDotDone,
                  ]}
                >
                  {verifiedSuccess ? (
                    <CheckCircle2 size={12} color="#ffffff" />
                  ) : (
                    <Text style={[styles.stepDotNum, step === 'mobile' && styles.stepDotNumIdle]}>
                      2
                    </Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, step !== 'mobile' && styles.stepLabelActive]}>
                  {step === 'setup' ? 'Link 2FA' : 'Authenticator'}
                </Text>
              </View>
            </View>
          </View>

          {/* FLOATING CONTENT SHEET */}
          <Animated.View
            style={[
              styles.contentWrapper,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* STEP 1: MOBILE NUMBER */}
            {step === 'mobile' && (
              <>
                <View style={styles.mainCard}>
                  <View style={styles.cardHeaderRow}>
                    <View>
                      <Text style={styles.cardTitle}>Welcome Back</Text>
                      <Text style={styles.cardSubtitle}>
                        Sign in with your registered mobile & Google Authenticator
                      </Text>
                    </View>
                  </View>

                  <View style={styles.inputLabelRow}>
                    <Text style={styles.inputLabel}>REGISTERED MOBILE NUMBER</Text>
                    <Text
                      style={[
                        styles.digitCounter,
                        mobileNumber.length === 10 && styles.digitCounterComplete,
                      ]}
                    >
                      {mobileNumber.length}/10
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.phoneInputBox,
                      phoneFocused && styles.phoneInputBoxFocused,
                      errorMsg ? styles.phoneInputBoxError : null,
                    ]}
                  >
                    <View style={styles.countryCodeChip}>
                      <Text style={styles.countryFlag}>🇮🇳</Text>
                      <Text style={styles.countryCodeText}>+91</Text>
                    </View>
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="98765 43210"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={mobileNumber}
                      onFocus={() => setPhoneFocused(true)}
                      onBlur={() => setPhoneFocused(false)}
                      onChangeText={(val) => {
                        setMobileNumber(val.replace(/\D/g, ''));
                        if (errorMsg) setErrorMsg(null);
                      }}
                      onSubmitEditing={handleMobileContinue}
                      returnKeyType="done"
                    />
                    {mobileNumber.length > 0 && (
                      <TouchableOpacity
                        style={styles.clearInputBtn}
                        onPress={() => {
                          setMobileNumber('');
                          setErrorMsg(null);
                        }}
                      >
                        <X size={14} color="#64748b" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {errorMsg && (
                    <View style={styles.errorBanner}>
                      <AlertCircle size={16} color="#dc2626" />
                      <Text style={styles.errorBannerText}>{errorMsg}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      (loading || mobileNumber.length < 10) && styles.btnMuted,
                    ]}
                    activeOpacity={0.88}
                    disabled={loading}
                    onPress={handleMobileContinue}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Continue with Authenticator</Text>
                        <View style={styles.btnArrowCircle}>
                          <ArrowRight size={15} color="#4f46e5" />
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Feature Trust Strip */}
                <View style={styles.trustGrid}>
                  <View style={styles.trustChip}>
                    <View style={[styles.trustIconBox, { backgroundColor: '#eef2ff' }]}>
                      <ShieldCheck size={15} color="#4f46e5" />
                    </View>
                    <Text style={styles.trustTitle}>2FA Verified</Text>
                    <Text style={styles.trustSub}>Google Auth</Text>
                  </View>

                  <View style={styles.trustChip}>
                    <View style={[styles.trustIconBox, { backgroundColor: '#ecfeff' }]}>
                      <WifiOff size={15} color="#0891b2" />
                    </View>
                    <Text style={styles.trustTitle}>Offline Codes</Text>
                    <Text style={styles.trustSub}>No SMS wait</Text>
                  </View>

                  <View style={styles.trustChip}>
                    <View style={[styles.trustIconBox, { backgroundColor: '#ecfdf5' }]}>
                      <Lock size={15} color="#059669" />
                    </View>
                    <Text style={styles.trustTitle}>Role Locked</Text>
                    <Text style={styles.trustSub}>Admin & Staff</Text>
                  </View>
                </View>

                <Text style={styles.footerHelpText}>
                  New employee? Ask your Company Administrator to register your mobile number.
                </Text>
              </>
            )}

            {/* STEP 2A: FIRST-TIME GOOGLE AUTHENTICATOR SETUP */}
            {step === 'setup' && pendingUser && (
              <View style={styles.mainCard}>
                {renderUserBanner(true)}

                {/* STEP 1 BLOCK */}
                <View style={styles.setupStepHeader}>
                  <View style={styles.stepPill}>
                    <Text style={styles.stepPillText}>STEP 1</Text>
                  </View>
                  <Text style={styles.setupStepTitle}>Link Google Authenticator</Text>
                </View>
                <Text style={styles.setupStepDesc}>
                  Tap below to add WorkPulse directly to Google Authenticator on this phone.
                </Text>

                <TouchableOpacity
                  style={styles.darkActionBtn}
                  activeOpacity={0.88}
                  onPress={handleOpenAuthenticatorApp}
                >
                  <Smartphone size={17} color="#38bdf8" />
                  <Text style={styles.darkActionBtnText}>Open in Google Authenticator</Text>
                  <ExternalLink size={14} color="#94a3b8" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.storeLinkRow} onPress={handleInstallAuthenticator}>
                  <Text style={styles.storeLinkText}>
                    Need the app? Download Google Authenticator →
                  </Text>
                </TouchableOpacity>

                {/* Segmented Toggle: QR Code vs Manual Key */}
                <View style={styles.segmentContainer}>
                  <TouchableOpacity
                    style={[styles.segmentTab, setupTab === 'qr' && styles.segmentTabActive]}
                    onPress={() => setSetupTab('qr')}
                  >
                    <QrCode size={14} color={setupTab === 'qr' ? '#4f46e5' : '#64748b'} />
                    <Text style={[styles.segmentText, setupTab === 'qr' && styles.segmentTextActive]}>
                      QR Code
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.segmentTab, setupTab === 'key' && styles.segmentTabActive]}
                    onPress={() => setSetupTab('key')}
                  >
                    <KeyRound size={14} color={setupTab === 'key' ? '#4f46e5' : '#64748b'} />
                    <Text style={[styles.segmentText, setupTab === 'key' && styles.segmentTextActive]}>
                      Manual Key
                    </Text>
                  </TouchableOpacity>
                </View>

                {setupTab === 'qr' ? (
                  <View style={styles.qrCard}>
                    <QrCodeSvg value={totpUri} size={156} />
                    <Text style={styles.qrHint}>
                      Scan with Google Authenticator from another phone
                    </Text>
                  </View>
                ) : (
                  <View style={styles.keyCard}>
                    <Text style={styles.keyCardLabel}>TIME-BASED SECRET KEY</Text>
                    <Text style={styles.keyCardValue} selectable>
                      {formatSecretKey(setupSecret)}
                    </Text>
                    <TouchableOpacity style={styles.copyPillBtn} onPress={handleShareSecretKey}>
                      <Copy size={13} color="#4f46e5" />
                      <Text style={styles.copyPillText}>Share / Copy Setup Key</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {infoMsg && (
                  <View style={styles.infoBanner}>
                    <CheckCircle2 size={16} color="#059669" />
                    <Text style={styles.infoBannerText}>{infoMsg}</Text>
                  </View>
                )}

                <View style={styles.sectionDivider} />

                {/* STEP 2 BLOCK */}
                <View style={styles.setupStepHeader}>
                  <View style={[styles.stepPill, { backgroundColor: '#ecfdf5' }]}>
                    <Text style={[styles.stepPillText, { color: '#059669' }]}>STEP 2</Text>
                  </View>
                  <Text style={styles.setupStepTitle}>Enter 6-Digit Code</Text>
                </View>
                <Text style={styles.setupStepDesc}>
                  Enter the live 6-digit code shown under WorkPulse to finish linking.
                </Text>

                {renderOtpBoxes()}
                {renderCountdownRing()}

                {errorMsg && (
                  <View style={styles.errorBanner}>
                    <AlertCircle size={16} color="#dc2626" />
                    <Text style={styles.errorBannerText}>{errorMsg}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    verifiedSuccess && styles.successBtn,
                    (loading || otpCode.length < 6) && !verifiedSuccess && styles.btnMuted,
                  ]}
                  activeOpacity={0.88}
                  disabled={loading || otpCode.length < 6 || verifiedSuccess}
                  onPress={() => handleVerifySetup()}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : verifiedSuccess ? (
                    <>
                      <CheckCircle2 size={18} color="#ffffff" />
                      <Text style={styles.primaryBtnText}>Authenticator Linked!</Text>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} color="#ffffff" />
                      <Text style={styles.primaryBtnText}>Verify & Activate Account</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 2B: RETURNING USER 6-DIGIT VERIFICATION */}
            {step === 'verify' && pendingUser && (
              <>
                <View style={styles.mainCard}>
                  {renderUserBanner(false)}

                  <View style={styles.verifyHeroIcon}>
                    {verifiedSuccess ? (
                      <CheckCircle2 size={28} color="#059669" />
                    ) : (
                      <KeyRound size={26} color="#4f46e5" />
                    )}
                  </View>

                  <Text style={[styles.cardTitle, { textAlign: 'center' }]}>
                    {verifiedSuccess ? 'Verified!' : 'Authenticator Verification'}
                  </Text>
                  <Text style={[styles.cardSubtitle, { textAlign: 'center', marginBottom: 22 }]}>
                    {verifiedSuccess
                      ? 'Signing you into WorkPulse…'
                      : 'Open Google Authenticator and enter the 6-digit code for WorkPulse'}
                  </Text>

                  {renderOtpBoxes()}
                  {renderCountdownRing()}

                  {errorMsg && (
                    <View style={styles.errorBanner}>
                      <AlertCircle size={16} color="#dc2626" />
                      <Text style={styles.errorBannerText}>{errorMsg}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.primaryBtn,
                      verifiedSuccess && styles.successBtn,
                      (loading || otpCode.length < 6) && !verifiedSuccess && styles.btnMuted,
                    ]}
                    activeOpacity={0.88}
                    disabled={loading || otpCode.length < 6 || verifiedSuccess}
                    onPress={() => handleVerifyLogin()}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : verifiedSuccess ? (
                      <>
                        <CheckCircle2 size={18} color="#ffffff" />
                        <Text style={styles.primaryBtnText}>Access Granted</Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.primaryBtnText}>Verify & Sign In</Text>
                        <View style={styles.btnArrowCircle}>
                          <ArrowRight size={15} color="#4f46e5" />
                        </View>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.backLinkBottom} onPress={handleResetToMobile}>
                  <ArrowLeft size={14} color="#4f46e5" />
                  <Text style={styles.backLinkBottomText}>Use a different mobile number</Text>
                </TouchableOpacity>

                <Text style={styles.footerHelpText}>
                  Lost your phone or reinstalled Google Authenticator? Ask your Company Admin to reset your 2FA from the Admin Panel.
                </Text>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 36,
  },

  // --- HERO BANNER ---
  heroBanner: {
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 52,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowSvg: {
    position: 'absolute',
    top: -10,
    alignSelf: 'center',
  },
  logoGlassBadge: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: 'rgba(79, 70, 229, 0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(129, 140, 248, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  brandWork: {
    fontSize: 30,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.6,
  },
  brandPulse: {
    fontSize: 30,
    fontWeight: '800',
    color: '#38bdf8',
    letterSpacing: -0.6,
  },
  brandTagline: {
    fontSize: 12.5,
    color: '#94a3b8',
    fontWeight: '500',
    marginTop: 4,
  },

  // --- STEPPER ---
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#4f46e5',
  },
  stepDotDone: {
    backgroundColor: '#10b981',
  },
  stepDotIdle: {
    backgroundColor: 'rgba(148,163,184,0.22)',
  },
  stepDotNum: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  stepDotNumIdle: {
    color: '#94a3b8',
  },
  stepLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#94a3b8',
  },
  stepLabelActive: {
    color: '#f8fafc',
    fontWeight: '700',
  },
  stepConnector: {
    width: 26,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(148,163,184,0.25)',
    marginHorizontal: 10,
  },
  stepConnectorActive: {
    backgroundColor: '#10b981',
  },

  // --- FLOATING SHEET ---
  contentWrapper: {
    paddingHorizontal: 18,
    marginTop: -28,
  },
  mainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 4,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  cardHeaderRow: {
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 5,
    lineHeight: 19,
  },

  // --- PHONE INPUT ---
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.6,
  },
  digitCounter: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  digitCounterComplete: {
    color: '#059669',
  },
  phoneInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    marginBottom: 18,
    paddingRight: 10,
  },
  phoneInputBoxFocused: {
    borderColor: '#4f46e5',
    backgroundColor: '#ffffff',
  },
  phoneInputBoxError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  countryCodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  countryFlag: {
    fontSize: 15,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 1.5,
  },
  clearInputBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- PRIMARY CTA ---
  primaryBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    elevation: 3,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  successBtn: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
  },
  btnMuted: {
    opacity: 0.55,
    elevation: 0,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15.5,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  btnArrowCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- TRUST GRID ---
  trustGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  trustChip: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  trustIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  trustTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  trustSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },

  // --- USER IDENTITY BANNER ---
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
    gap: 11,
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarAdmin: {
    backgroundColor: '#eef2ff',
    borderColor: '#c7d2fe',
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#047857',
  },
  userAvatarTextAdmin: {
    color: '#4338ca',
  },
  userName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  userMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  userMetaText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748b',
  },
  rolePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillAdmin: {
    backgroundColor: '#eef2ff',
  },
  rolePillEmp: {
    backgroundColor: '#ecfdf5',
  },
  rolePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  rolePillTextAdmin: {
    color: '#4338ca',
  },
  rolePillTextEmp: {
    color: '#047857',
  },
  switchBtn: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  switchBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },

  // --- SETUP SCREEN ---
  setupStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stepPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#eef2ff',
  },
  stepPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#4338ca',
    letterSpacing: 0.6,
  },
  setupStepTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  setupStepDesc: {
    fontSize: 12.5,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 14,
  },
  darkActionBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  darkActionBtnText: {
    color: '#ffffff',
    fontSize: 14.5,
    fontWeight: '700',
  },
  storeLinkRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  storeLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f46e5',
  },

  // --- SEGMENTED TOGGLE ---
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginTop: 2,
    marginBottom: 12,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentTabActive: {
    backgroundColor: '#ffffff',
    elevation: 1,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  segmentText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748b',
  },
  segmentTextActive: {
    color: '#4f46e5',
  },
  qrCard: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrHint: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '500',
    marginTop: 10,
    textAlign: 'center',
  },
  keyCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  keyCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  keyCardValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 1.5,
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  copyPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 20,
  },

  // --- VERIFY ICON ---
  verifyHeroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    borderWidth: 1.5,
    borderColor: '#c7d2fe',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },

  // --- SPLIT 3+3 OTP BOXES ---
  otpContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  hiddenOtpInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.01,
    zIndex: 2,
  },
  otpGroup: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  otpDividerDash: {
    width: 10,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginHorizontal: 7,
  },
  otpBox: {
    flex: 1,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxFilled: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
  },
  otpBoxActive: {
    borderColor: '#4f46e5',
    borderWidth: 2,
    backgroundColor: '#ffffff',
  },
  otpBoxError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  otpBoxSuccess: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  otpDigit: {
    fontSize: 22,
    fontWeight: '800',
    color: '#94a3b8',
  },
  otpDigitFilled: {
    color: '#1e1b4b',
  },
  otpDigitSuccess: {
    color: '#047857',
  },
  otpPlaceholderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#cbd5e1',
    position: 'absolute',
  },
  otpCursorBar: {
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: '#4f46e5',
    position: 'absolute',
  },

  // --- COUNTDOWN RING ---
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 18,
  },
  ringWrap: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSeconds: {
    position: 'absolute',
    fontSize: 9.5,
    fontWeight: '800',
    color: '#4338ca',
  },
  countdownLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  countdownLabelWarn: {
    color: '#d97706',
    fontWeight: '700',
  },
  clearOtpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    marginLeft: 4,
  },
  clearOtpText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },

  // --- BANNERS ---
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#b91c1c',
    lineHeight: 17,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
    lineHeight: 17,
  },

  // --- FOOTER ---
  backLinkBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
  },
  backLinkBottomText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4f46e5',
  },
  footerHelpText: {
    fontSize: 11.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 16,
    paddingHorizontal: 14,
  },
});
