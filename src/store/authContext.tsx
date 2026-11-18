import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Employee } from '../types';
import { db } from '../services/mockDatabase';
import { dataService } from '../services/dataService';

const USER_STORAGE_KEY = '@workpulse_auth_user';

interface AuthContextType {
  user: Employee | null;
  isLoading: boolean;
  lookupUserByMobile: (mobileNumber: string) => Promise<{ success: boolean; user?: Employee; message: string }>;
  completeLogin: (authenticatedUser: Employee) => Promise<void>;
  login: (mobileNumber: string) => Promise<{ success: boolean; user?: Employee; message: string }>;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  isCloudMode: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: false,
  lookupUserByMobile: async () => ({ success: false, message: '' }),
  completeLogin: async () => {},
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
            setUser(parsed);
            db.setCurrentUser(parsed);
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

  /**
   * Step 1 of Google Authenticator login:
   * Verifies the mobile number exists and is active, WITHOUT signing the user in yet.
   */
  const lookupUserByMobile = async (mobileNumber: string) => {
    return await dataService.loginWithMobile(mobileNumber);
  };

  /**
   * Step 2 of Google Authenticator login:
   * Called ONLY after the 6-digit Google Authenticator TOTP code is verified.
   */
  const completeLogin = async (authenticatedUser: Employee) => {
    db.setCurrentUser(authenticatedUser);
    setUser(authenticatedUser);
    try {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(authenticatedUser));
    } catch (err) {
      console.warn('Failed to persist user session:', err);
    }
  };

  const login = async (mobileNumber: string) => {
    setIsLoading(true);
    const res = await dataService.loginWithMobile(mobileNumber);
    if (res.success && res.user) {
      await completeLogin(res.user);
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
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        lookupUserByMobile,
        completeLogin,
        login,
        logout,
        refreshUserData,
        isCloudMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
