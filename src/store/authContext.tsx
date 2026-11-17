import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { Employee } from '../types';
import { db } from '../services/mockDatabase';
import { dataService } from '../services/dataService';
import { fetchNightAllowance } from '../services/settingsService';

const USER_STORAGE_KEY = '@workpulse_auth_user';

interface AuthContextType {
  user: Employee | null;
  isLoading: boolean;
  login: (mobileNumber: string) => Promise<{ success: boolean; user?: Employee; message: string }>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  isCloudMode: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  login: async () => ({ success: false, message: '' }),
  logout: async () => {},
  refreshUserData: async () => {},
  isCloudMode: false,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isCloudMode = dataService.isCloud();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (stored) {
          const parsed: Employee = JSON.parse(stored);
          // If stored session is an obsolete demo mock ID (e.g. emp_admin_1), purge it for fresh cloud login
          if (parsed.id && parsed.id.startsWith('emp_') && isCloudMode) {
            await AsyncStorage.removeItem(USER_STORAGE_KEY);
            setUser(null);
          } else {
            // Re-check the account so a deactivated employee loses access; offline keeps the cached session.
            const fresh = await dataService.getEmployeeById(parsed.id);
            if (fresh && !fresh.isActive) {
              await AsyncStorage.removeItem(USER_STORAGE_KEY);
              setUser(null);
              return;
            }
            const current = fresh ?? parsed;
            await fetchNightAllowance();
            setUser(current);
            db.setCurrentUser(current);
            if (fresh) await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fresh));
          }
        }
      } catch (err) {
        console.warn('Failed to restore user session:', err);
      } finally {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (mobileNumber: string) => {
    setIsLoading(true);
    const res = await dataService.loginWithMobile(mobileNumber);
    if (res.success && res.user) {
      try {
        await fetchNightAllowance();
      } catch (err) {
        setIsLoading(false);
        return { success: false, message: (err as Error).message };
      }
      db.setCurrentUser(res.user);
      setUser(res.user);
      try {
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(res.user));
      } catch (err) {
        console.warn('Failed to persist user session:', err);
      }
    }
    setIsLoading(false);
    return res;
  };

  // Each time the app returns to the foreground, sign out an employee who was deactivated meanwhile.
  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const fresh = await dataService.getEmployeeById(user.id).catch(() => undefined);
      if (fresh && !fresh.isActive) await logout();
    });
    return () => sub.remove();
  }, [user]);

  const logout = async () => {
    db.setCurrentUser(null);
    setUser(null);
    try {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
    } catch (err) {
      console.warn('Failed to clear user session:', err);
    }
  };

  const refreshUserData = async () => {
    if (user) {
      if (isCloudMode) {
        const updated = await dataService.getEmployeeById(user.id);
        if (updated) {
          setUser({ ...updated });
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
        }
      } else {
        const updated = db.getEmployeeById(user.id);
        if (updated) setUser({ ...updated });
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUserData, isCloudMode }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
