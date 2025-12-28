import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import apiClient from '../utils/apiClient';

interface User {
  id?: string;
  _id?: string;
  username: string;
  role: string;
  adminId?: string;
  userId?: string;
  name?: string;
  email?: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuthStatus = async () => {
    try {
      console.log('[Auth] Checking authentication status...');
      const response = await apiClient.get('/api/auth/check');
      
      console.log('[Auth] Auth check response:', response.data);
      
      if (response.data.success && response.data.isAuthenticated) {
        console.log('[Auth] User authenticated:', response.data.user);
        setIsAuthenticated(true);
        setUser(response.data.user);
      } else {
        console.log('[Auth] User not authenticated');
        setIsAuthenticated(false);
        setUser(null);
      }
    } catch (error) {
      console.error('[Auth] Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const refreshAuth = async () => {
    console.log('[Auth] Manually refreshing auth status...');
    setLoading(true);
    await checkAuthStatus();
  };

  useEffect(() => {
    console.log('[Auth] AuthProvider mounted, checking initial auth status');
    checkAuthStatus();
  }, []);

  // Debug logging for state changes
  useEffect(() => {
    console.log('[Auth] Authentication state changed:', {
      isAuthenticated,
      user: user?.username,
      loading
    });
  }, [isAuthenticated, user, loading]);

  const login = async (username: string, password: string) => {
    try {
      console.log('[Auth] Attempting login for user:', username);
      setLoading(true);
      
      const response = await apiClient.post('/api/auth/login', {
        username,
        password
      });

      console.log('[Auth] Login response:', response.data);

      if (response.data.success) {
        console.log('[Auth] Login successful, updating state');
        
        // Update state immediately
        setIsAuthenticated(true);
        setUser(response.data.user);
        setLoading(false);
        
        // Force a small delay and then double-check auth status
        setTimeout(async () => {
          console.log('[Auth] Double-checking auth status after login...');
          await checkAuthStatus();
        }, 200);
        
        return { success: true };
      } else {
        console.log('[Auth] Login failed:', response.data.error);
        setLoading(false);
        return { success: false, error: response.data.error };
      }
    } catch (error: any) {
      console.error('[Auth] Login error:', error);
      setLoading(false);
      return { 
        success: false, 
        error: error.response?.data?.error || 'Login failed' 
      };
    }
  };

  const logout = async () => {
    try {
      console.log('[Auth] Attempting logout...');
      setLoading(true);
      
      await apiClient.post('/api/auth/logout', {});
      
      console.log('[Auth] Logout successful');
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      // Even if logout request fails, clear local state
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    loading,
    login,
    logout,
    refreshAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
