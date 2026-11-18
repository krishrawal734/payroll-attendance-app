import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure notification behavior
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  // Silent fallback if notification module is initializing
}

export class NotificationService {
  private hasPermission = false;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      this.hasPermission = finalStatus === 'granted';

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('workpulse-alerts', {
          name: 'WorkPulse Shift & Payroll Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4f46e5',
        });
      }

      return this.hasPermission;
    } catch (err) {
      console.warn('Failed to request notification permission:', err);
      return false;
    }
  }

  // 1. Send Instant Alert (e.g. Leave Approved/Rejected, Advance Paid, Payslip Generated)
  async sendInstantNotification(title: string, body: string, data?: Record<string, any>) {
    try {
      await this.requestPermissions();
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: null, // triggers immediately
      });
      return { success: true };
    } catch (err: any) {
      console.warn('Notification failed:', err.message);
      return { success: false, error: err.message };
    }
  }

  // 2. Schedule Daily Morning & Evening Shift Reminders
  async scheduleShiftReminders() {
    try {
      await this.requestPermissions();
      // Cancel previous scheduled reminders to avoid duplicates
      await Notifications.cancelAllScheduledNotificationsAsync();

      // Morning Punch-In Reminder (9:00 AM)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '☀️ Good Morning! Time to Check In',
          body: 'Tap to punch in with verified GPS location for your shift.',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: Platform.OS === 'android' ? 'workpulse-alerts' : undefined,
          hour: 9,
          minute: 0,
        },
      });

      // Evening Grace Window Reminder (7:00 PM / 19:00)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏳ Day Shift Ending — Punch Out Before 9:00 PM',
          body: 'Day shift ended at 7:00 PM. Punch out before 9:00 PM before Night Shift starts.',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: Platform.OS === 'android' ? 'workpulse-alerts' : undefined,
          hour: 19,
          minute: 0,
        },
      });

      // Night Shift Start Alert (9:00 PM / 21:00)
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌙 Night Shift Started (9:00 PM – 5:00 AM)',
          body: 'Night shift is now active (+₹250 allowance). Open shifts auto punch-out at 5:00 AM.',
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          channelId: Platform.OS === 'android' ? 'workpulse-alerts' : undefined,
          hour: 21,
          minute: 0,
        },
      });

      return { success: true, message: 'Daily shift reminders scheduled (9:00 AM, 7:00 PM & 9:00 PM).' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to schedule reminders' };
    }
  }

  // 3. Quick Test Trigger for User
  async triggerTestReminder(type: 'morning' | 'night' | 'leave' | 'advance') {
    const alerts = {
      morning: {
        title: '☀️ Shift Reminder (9:00 AM)',
        body: 'Office check-in time! Remember to punch in with GPS.',
      },
      night: {
        title: '🌙 Night Shift Credit Active (> 7:00 PM)',
        body: 'Overtime rule unlocked: Checkout after 7:00 PM tagged as Night Present (₹250 bonus)!',
      },
      leave: {
        title: '✅ Leave Approved by Admin',
        body: 'Your leave request has been approved by the Administrator.',
      },
      advance: {
        title: '💰 Advance Disbursed to Passbook',
        body: '₹5,000 cash advance has been recorded and credited to your ledger.',
      },
    };

    const item = alerts[type] || alerts.morning;
    return await this.sendInstantNotification(item.title, item.body);
  }
}

export const notificationService = new NotificationService();
