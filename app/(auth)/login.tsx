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
} from 'react-native';
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
} from 'lucide-react-native';

type AuthStep = 'mobile' | 'setup' | 'verify';

export default function LoginScreen() {
  const router = useRouter();
  const { lookupUserByMobile, completeLogin } = useAuth();

  const [step, setStep] = useState<AuthStep>('mobile');
  const [mobileNumber, setMobileNumber] = useState('');
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
      setErrorMsg(res.message || 'Mobile number not registered. Contact your Admin.');
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
      setErrorMsg('Code did not match. Make sure you added WorkPulse in Google Authenticator and enter the latest 6-digit code.');
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
        setInfoMsg('Opened Google Authenticator! Tap "Add" there, then return here and enter the 6-digit code.');
      } else {
        setErrorMsg(
          'Google Authenticator app was not detected on this device. Install it from Play Store or enter the setup key manually.'
        );
      }
    } catch {
      try {
        await Linking.openURL(uri);
      } catch {
        setErrorMsg(
          'Could not launch Google Authenticator automatically. Open Google Authenticator → Tap "+" → "Enter a setup key" and paste the key below.'
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
      // User dismissed share sheet
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

  const renderOtpBoxes = () => {
    const digits = otpCode.split('');
    return (
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
        {[0, 1, 2, 3, 4, 5].map((index) => {
          const digit = digits[index] || '';
          const isActive = index === otpCode.length || (otpCode.length === 6 && index === 5);
          const isFilled = digit !== '';
          return (
            <View
              key={index}
              style={[
                styles.otpBox,
                isFilled && styles.otpBoxFilled,
                isActive && styles.otpBoxActive,
                errorMsg ? styles.otpBoxError : null,
              ]}
            >
              <Text style={[styles.otpDigit, isFilled && styles.otpDigitFilled]}>
                {digit || '•'}
              </Text>
            </View>
          );
        })}
      </TouchableOpacity>
    );
  };

  const renderCountdownBar = () => {
    const progressPct = (secondsLeft / 30) * 100;
    const isExpiring = secondsLeft <= 5;
    return (
      <View style={styles.timerWrapper}>
        <View style={styles.timerRow}>
          <Clock size={13} color={isExpiring ? '#d97706' : '#64748b'} />
          <Text style={[styles.timerText, isExpiring && styles.timerTextWarn]}>
            Authenticator code refreshes in {secondsLeft}s
          </Text>
        </View>
        <View style={styles.timerTrack}>
          <View
            style={[
              styles.timerFill,
              {
                width: `${progressPct}%`,
                backgroundColor: isExpiring ? '#f59e0b' : '#4f46e5',
              },
            ]}
          />
        </View>
      </View>
    );
  };

  const maskMobile = (num: string) => {
    if (num.length < 4) return num;
    return `••••••${num.slice(-4)}`;
  };

  const totpUri =
    pendingUser && setupSecret
      ? buildTotpUri(setupSecret, `${pendingUser.fullName} (${pendingUser.mobileNumber})`, 'WorkPulse')
      : '';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Hero */}
        <View style={styles.hero}>
          <View style={styles.logoContainer}>
            <WorkPulseLogo size={54} />
          </View>
          <Text style={styles.brandTitle}>WorkPulse</Text>
          <Text style={styles.brandSubtitle}>Employee Attendance & Payroll Platform</Text>
          <View style={styles.authBadge}>
            <ShieldCheck size={13} color="#4f46e5" />
            <Text style={styles.authBadgeText}>Google Authenticator Login</Text>
          </View>
        </View>

        {/* STEP 1: MOBILE NUMBER */}
        {step === 'mobile' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Sign In</Text>
              <Text style={styles.cardSubtitle}>
                Enter your 10-digit registered mobile number, then verify with your 6-digit Google Authenticator code.
              </Text>

              <View style={styles.phoneInputRow}>
                <View style={styles.countryPrefix}>
                  <Text style={styles.countryPrefixText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Enter 10-digit number"
                  placeholderTextColor="#94a3b8"
                  keyboardType="phone-pad"
                  maxLength={10}
                  value={mobileNumber}
                  onChangeText={(val) => {
                    setMobileNumber(val.replace(/\D/g, ''));
                    if (errorMsg) setErrorMsg(null);
                  }}
                  onSubmitEditing={handleMobileContinue}
                  returnKeyType="done"
                />
              </View>

              {errorMsg && (
                <View style={styles.errorBanner}>
                  <AlertCircle size={16} color="#dc2626" />
                  <Text style={styles.errorBannerText}>{errorMsg}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                activeOpacity={0.85}
                disabled={loading}
                onPress={handleMobileContinue}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Continue to Authenticator</Text>
                    <ArrowRight size={18} color="#ffffff" />
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Info Card */}
            <View style={styles.noticeCard}>
              <View style={styles.noticeHeader}>
                <Shield size={15} color="#4f46e5" />
                <Text style={styles.noticeTitle}>GOOGLE AUTHENTICATOR PROTECTED</Text>
              </View>
              <Text style={styles.noticeBody}>
                WorkPulse uses time-based 6-digit codes from Google Authenticator instead of SMS OTPs. It works 100% offline and protects both Admin and Employee accounts.
              </Text>
              <View style={styles.noticeFooter}>
                <UserCheck size={14} color="#64748b" />
                <Text style={styles.noticeFooterText}>
                  First time logging in? You will link Google Authenticator in one tap.
                </Text>
              </View>
            </View>
          </>
        )}

        {/* STEP 2A: FIRST-TIME GOOGLE AUTHENTICATOR SETUP */}
        {step === 'setup' && pendingUser && (
          <View style={styles.card}>
            <TouchableOpacity style={styles.backRow} onPress={handleResetToMobile}>
              <ArrowLeft size={16} color="#4f46e5" />
              <Text style={styles.backText}>Change Mobile Number</Text>
            </TouchableOpacity>

            {/* User Pill */}
            <View style={styles.userIdentityBox}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {pendingUser.fullName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{pendingUser.fullName}</Text>
                <Text style={styles.userMeta}>
                  +91 {pendingUser.mobileNumber} • {pendingUser.role.toUpperCase()}
                </Text>
              </View>
              <View style={styles.setupBadge}>
                <Text style={styles.setupBadgeText}>1st Login</Text>
              </View>
            </View>

            <Text style={styles.cardTitle}>Link Google Authenticator</Text>
            <Text style={styles.cardSubtitle}>
              One-time setup: add WorkPulse to your Google Authenticator app, then enter the 6-digit code below.
            </Text>

            {/* Step 1: One-tap open */}
            <TouchableOpacity
              style={styles.authenticatorBtn}
              activeOpacity={0.85}
              onPress={handleOpenAuthenticatorApp}
            >
              <ExternalLink size={17} color="#ffffff" />
              <Text style={styles.authenticatorBtnText}>Add to Google Authenticator</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.installLinkRow} onPress={handleInstallAuthenticator}>
              <Text style={styles.installLinkText}>
                Don't have Google Authenticator? Install from Play Store →
              </Text>
            </TouchableOpacity>

            {/* QR Code + Manual Key */}
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>OR SCAN QR CODE / COPY SETUP KEY</Text>
              <QrCodeSvg value={totpUri} size={164} />

              <View style={styles.secretKeyBox}>
                <Text style={styles.secretKeyLabel}>Manual Setup Key (Time-based)</Text>
                <Text style={styles.secretKeyValue} selectable>
                  {formatSecretKey(setupSecret)}
                </Text>
                <TouchableOpacity style={styles.copyKeyBtn} onPress={handleShareSecretKey}>
                  <Copy size={13} color="#4f46e5" />
                  <Text style={styles.copyKeyBtnText}>Share / Copy Key</Text>
                </TouchableOpacity>
              </View>
            </View>

            {infoMsg && (
              <View style={styles.infoBanner}>
                <CheckCircle2 size={16} color="#059669" />
                <Text style={styles.infoBannerText}>{infoMsg}</Text>
              </View>
            )}

            {/* Step 2: Enter 6-digit code */}
            <Text style={styles.otpPromptLabel}>
              Enter the 6-digit code shown in Google Authenticator
            </Text>

            {renderOtpBoxes()}
            {renderCountdownBar()}

            {errorMsg && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#dc2626" />
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (loading || otpCode.length < 6) && styles.btnDisabled,
              ]}
              activeOpacity={0.85}
              disabled={loading || otpCode.length < 6}
              onPress={() => handleVerifySetup()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <ShieldCheck size={18} color="#ffffff" />
                  <Text style={styles.primaryBtnText}>Verify & Activate Login</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2B: RETURNING USER 6-DIGIT CODE VERIFICATION */}
        {step === 'verify' && pendingUser && (
          <View style={styles.card}>
            <TouchableOpacity style={styles.backRow} onPress={handleResetToMobile}>
              <ArrowLeft size={16} color="#4f46e5" />
              <Text style={styles.backText}>Change Mobile Number</Text>
            </TouchableOpacity>

            {/* User Pill */}
            <View style={styles.userIdentityBox}>
              <View style={styles.userAvatar}>
                <Text style={styles.userAvatarText}>
                  {pendingUser.fullName.slice(0, 2).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>{pendingUser.fullName}</Text>
                <Text style={styles.userMeta}>
                  +91 {maskMobile(pendingUser.mobileNumber)} • {pendingUser.role.toUpperCase()}
                </Text>
              </View>
              <View style={styles.linkedBadge}>
                <ShieldCheck size={12} color="#059669" />
                <Text style={styles.linkedBadgeText}>2FA Active</Text>
              </View>
            </View>

            <View style={styles.verifyHeaderIcon}>
              <KeyRound size={24} color="#4f46e5" />
            </View>

            <Text style={[styles.cardTitle, { textAlign: 'center' }]}>
              Enter Authenticator Code
            </Text>
            <Text style={[styles.cardSubtitle, { textAlign: 'center' }]}>
              Open Google Authenticator on your phone and enter the 6-digit code for WorkPulse.
            </Text>

            {renderOtpBoxes()}
            {renderCountdownBar()}

            {errorMsg && (
              <View style={styles.errorBanner}>
                <AlertCircle size={16} color="#dc2626" />
                <Text style={styles.errorBannerText}>{errorMsg}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (loading || otpCode.length < 6) && styles.btnDisabled,
              ]}
              activeOpacity={0.85}
              disabled={loading || otpCode.length < 6}
              onPress={() => handleVerifyLogin()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Verify & Sign In</Text>
                  <ArrowRight size={18} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.recoveryNote}>
              <Text style={styles.recoveryNoteText}>
                Lost access to Google Authenticator? Contact your Company Admin to reset your 2FA.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoContainer: {
    width: 78,
    height: 78,
    borderRadius: 22,
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#312e81',
  },
  brandTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  authBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  authBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338ca',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 19,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    marginBottom: 16,
    overflow: 'hidden',
  },
  countryPrefix: {
    paddingHorizontal: 14,
    paddingVertical: 15,
    borderRightWidth: 1,
    borderRightColor: '#e2e8f0',
    backgroundColor: '#f1f5f9',
  },
  countryPrefixText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    letterSpacing: 1,
  },
  primaryBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  authenticatorBtn: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  authenticatorBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  installLinkRow: {
    alignItems: 'center',
    marginBottom: 18,
  },
  installLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4f46e5',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4f46e5',
  },
  userIdentityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
    gap: 10,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4338ca',
  },
  userName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  userMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  setupBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  setupBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#b45309',
  },
  linkedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  linkedBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  qrSection: {
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 18,
  },
  qrLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  secretKeyBox: {
    width: '100%',
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  secretKeyLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 6,
  },
  secretKeyValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 1.2,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
  },
  copyKeyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4f46e5',
  },
  verifyHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  otpPromptLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
    position: 'relative',
  },
  hiddenOtpInput: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.01,
    zIndex: 2,
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
  otpDigit: {
    fontSize: 22,
    fontWeight: '800',
    color: '#cbd5e1',
  },
  otpDigitFilled: {
    color: '#1e1b4b',
  },
  timerWrapper: {
    marginBottom: 16,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginBottom: 6,
  },
  timerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  timerTextWarn: {
    color: '#d97706',
    fontWeight: '700',
  },
  timerTrack: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  timerFill: {
    height: '100%',
    borderRadius: 999,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
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
    marginBottom: 14,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#065f46',
    lineHeight: 17,
  },
  recoveryNote: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  recoveryNoteText: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 16,
  },
  noticeCard: {
    backgroundColor: '#f1f5f9',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  noticeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1e293b',
    letterSpacing: 0.6,
  },
  noticeBody: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },
  noticeFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noticeFooterText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
});
