
import React, { createContext, useState, useContext, ReactNode } from 'react';
// Fix: Use PublicUser type which omits sensitive fields.
import { PublicUser } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  // Fix: Use PublicUser type for the user object in the context.
  user: PublicUser | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Fix: Use PublicUser type for the user state.
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const userData = await authService.login(email, password);
      setUser(userData);
    } catch (err: any) {
      setError(err.message || 'Login failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const signUp = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const newUser = await authService.signUp(email, password);
      setUser(newUser);
    } catch (err: any) {
      setError(err.message || 'Sign up failed.');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
  };
  
  const clearError = () => {
    setError(null);
  };

  const value = { user, login, signUp, logout, loading, error, clearError };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
