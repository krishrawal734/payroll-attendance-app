import React from 'react';
import { Tabs, useRouter, Redirect } from 'expo-router';
import { TouchableOpacity, Text, View, StyleSheet, Alert } from 'react-native';
import { LayoutDashboard, Clock, CalendarDays, FileSpreadsheet, LogOut } from 'lucide-react-native';
import { useAuth } from '../../src/store/authContext';

export default function EmployeeLayout() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    Alert.alert('Log out?', 'You will need your mobile number and OTP to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  // Signed out elsewhere (e.g. deactivated while the app was open).
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#ffffff',
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: '#0f172a',
        },
        tabBarActiveTintColor: '#4f46e5',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e2e8f0',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerRight: () => (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
          >
            <LogOut size={18} color="#ef4444" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'GPS Attendance',
          tabBarLabel: 'Punch',
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaves"
        options={{
          title: 'My Leaves',
          tabBarLabel: 'Leaves',
          tabBarIcon: ({ color, size }) => <CalendarDays size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="payslips"
        options={{
          title: 'Salary & Payslips',
          tabBarLabel: 'Payroll',
          tabBarIcon: ({ color, size }) => <FileSpreadsheet size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
  },
  logoutText: {
    marginLeft: 6,
    color: '#ef4444',
    fontWeight: '600',
    fontSize: 13,
  },
});
