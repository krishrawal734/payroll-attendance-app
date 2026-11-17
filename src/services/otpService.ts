// Login OTP. For now this is one static code from EXPO_PUBLIC_STATIC_OTP (set in .env.local).
// To move to real SMS, make sendLoginOtp send a code and verifyLoginOtp check it server-side.
const STATIC_OTP = (process.env.EXPO_PUBLIC_STATIC_OTP || '').trim();

export const OTP_LENGTH = STATIC_OTP.length || 6;

export function isOtpConfigured(): boolean {
  return /^\d{4,8}$/.test(STATIC_OTP);
}

export async function sendLoginOtp(_mobileNumber: string): Promise<{ success: boolean; message: string }> {
  if (!isOtpConfigured()) {
    return { success: false, message: 'Login OTP is not configured. Set EXPO_PUBLIC_STATIC_OTP in .env.local and restart the app.' };
  }
  return { success: true, message: 'Enter the OTP provided by your administrator.' };
}

export async function verifyLoginOtp(_mobileNumber: string, code: string): Promise<boolean> {
  return isOtpConfigured() && code.trim() === STATIC_OTP;
}
