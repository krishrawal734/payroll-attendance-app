import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Employee } from '../types';
import { db } from '../services/mockDatabase';
import { dataService } from '../services/dataService';

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
  const [isLoading, setIsLoading] = useState(false);
  const isCloudMode = dataService.isCloud();

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (stored) {
          const parsed: Employee = JSON.parse(stored);
          setUser(parsed);
          db.setCurrentUser(parsed);
        } else {
          const currentUser = db.getCurrentUser();
          if (currentUser) setUser(currentUser);
        }
      } catch (err) {
        console.warn('Failed to restore user session:', err);
      }
    };
    restoreSession();
  }, []);

  const login = async (mobileNumber: string) => {
    setIsLoading(true);
    const res = await dataService.loginWithMobile(mobileNumber);
    if (res.success && res.user) {
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
