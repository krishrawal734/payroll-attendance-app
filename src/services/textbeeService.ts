import { getTextBeeConfig, saveTextBeeConfig, TextBeeConfig } from '../config/smsConfig';

export class TextBeeService {
  private formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `+91${digits}`;
    }
    if (digits.length === 12 && digits.startsWith('91')) {
      return `+${digits}`;
    }
    if (phone.startsWith('+')) {
      return phone;
    }
    return `+${digits}`;
  }

  async getConfig(): Promise<TextBeeConfig> {
    return await getTextBeeConfig();
  }

  async saveConfig(config: TextBeeConfig): Promise<boolean> {
    return await saveTextBeeConfig(config);
  }

  async sendSms(
    recipients: string[],
    message: string,
    forcedConfig?: TextBeeConfig
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      const config = forcedConfig || (await getTextBeeConfig());

      if (!config.isEnabled && !forcedConfig) {
        return { success: false, message: 'SMS gateway is currently disabled in settings.' };
      }

      if (!config.apiKey || !config.deviceId) {
        return {
          success: false,
          message: 'TextBee API Key or Device ID is missing. Please configure them in SMS settings.',
        };
      }

      const formattedRecipients = recipients
        .map((p) => this.formatPhoneNumber(p))
        .filter((p) => p.length >= 10);

      if (formattedRecipients.length === 0) {
        return { success: false, message: 'No valid phone numbers provided.' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const url = `https://api.textbee.dev/api/v1/gateway/devices/${config.deviceId.trim()}/send-sms`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': config.apiKey.trim(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recipients: formattedRecipients,
          message: message.trim(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const resData = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMsg =
          resData?.message ||
          resData?.error ||
          `Failed with HTTP status ${response.status} (${response.statusText})`;
        return { success: false, message: errorMsg, data: resData };
      }

      return {
        success: true,
        message: 'SMS dispatched successfully via TextBee SIM gateway.',
        data: resData,
      };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'SMS request timed out. Please check phone connection.' };
      }
      return { success: false, message: err.message || 'SMS dispatch failed' };
    }
  }

  // 1. Salary Disbursal SMS
  async sendSalaryDisbursalSms(
    emp: { fullName: string; mobileNumber: string },
    amount: number,
    mode: string,
    monthYear: string,
    refId?: string
  ) {
    const config = await getTextBeeConfig();
    if (!config.isEnabled || !config.notifySalary) return;

    const refText = refId ? ` (Ref: ${refId})` : '';
    const text = `WorkPulse: Hello ${emp.fullName}, your salary payout of Rs. ${amount.toLocaleString('en-IN')} for ${monthYear} has been disbursed via ${mode}${refText}. Thank you!`;

    return await this.sendSms([emp.mobileNumber], text);
  }

  // 2. Advance Disbursal SMS
  async sendAdvanceDisbursalSms(
    emp: { fullName: string; mobileNumber: string },
    amount: number,
    mode: string,
    activeBalance?: number
  ) {
    const config = await getTextBeeConfig();
    if (!config.isEnabled || !config.notifySalary) return;

    const balanceText =
      activeBalance !== undefined
        ? ` Total active advance due: Rs. ${activeBalance.toLocaleString('en-IN')}.`
        : '';
    const text = `WorkPulse: Hello ${emp.fullName}, advance payment of Rs. ${amount.toLocaleString('en-IN')} has been disbursed via ${mode}.${balanceText}`;

    return await this.sendSms([emp.mobileNumber], text);
  }

  // 3. Attendance Check-In SMS
  async sendCheckInSms(
    emp: { fullName: string; mobileNumber: string },
    timeStr: string,
    dateStr: string
  ) {
    const config = await getTextBeeConfig();
    if (!config.isEnabled || !config.notifyAttendance) return;

    const text = `WorkPulse: Hello ${emp.fullName}, your shift Check-In was recorded at ${timeStr} on ${dateStr}. Status: PRESENT. Have a safe & productive shift!`;

    return await this.sendSms([emp.mobileNumber], text);
  }

  // 4. Attendance Check-Out SMS
  async sendCheckOutSms(
    emp: { fullName: string; mobileNumber: string },
    timeStr: string,
    isNightShift: boolean
  ) {
    const config = await getTextBeeConfig();
    if (!config.isEnabled || !config.notifyAttendance) return;

    const nightText = isNightShift
      ? ' Night Shift Allowance (+Rs. 250) has been credited to your monthly ledger!'
      : '';
    const text = `WorkPulse: Hello ${emp.fullName}, your shift Check-Out was recorded at ${timeStr}.${nightText}`;

    return await this.sendSms([emp.mobileNumber], text);
  }

  // 5. Payslip Ready SMS
  async sendPayslipReadySms(
    emp: { fullName: string; mobileNumber: string },
    monthYear: string,
    netPayable: number
  ) {
    const config = await getTextBeeConfig();
    if (!config.isEnabled || !config.notifyPayslip) return;

    const text = `WorkPulse: Hello ${emp.fullName}, your official salary payslip for ${monthYear} is now ready. Net Take-Home: Rs. ${netPayable.toLocaleString('en-IN')}. Login to WorkPulse to download PDF.`;

    return await this.sendSms([emp.mobileNumber], text);
  }

  // 6. Test SMS
  async sendTestSms(testNumber: string, customConfig?: TextBeeConfig) {
    const text = `WorkPulse: Test message from TextBee SMS Gateway! If you received this, your mobile SIM gateway is connected and active.`;
    return await this.sendSms([testNumber], text, customConfig);
  }
}

export const textbeeService = new TextBeeService();
