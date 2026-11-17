import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TextBeeConfig {
  apiKey: string;
  deviceId: string;
  isEnabled: boolean;
  notifySalary: boolean;
  notifyAttendance: boolean;
  notifyPayslip: boolean;
}

const STORAGE_KEY = '@workpulse_textbee_config';

export const DEFAULT_TEXTBEE_CONFIG: TextBeeConfig = {
  apiKey: process.env.EXPO_PUBLIC_TEXTBEE_API_KEY || '',
  deviceId: process.env.EXPO_PUBLIC_TEXTBEE_DEVICE_ID || '',
  isEnabled: false,
  notifySalary: true,
  notifyAttendance: true,
  notifyPayslip: true,
};

export async function getTextBeeConfig(): Promise<TextBeeConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TEXTBEE_CONFIG;
    return { ...DEFAULT_TEXTBEE_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_TEXTBEE_CONFIG;
  }
}

export async function saveTextBeeConfig(config: TextBeeConfig): Promise<boolean> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}
