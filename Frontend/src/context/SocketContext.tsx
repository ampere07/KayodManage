import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

interface Alert {
  _id: string;
  type: string;
  title: string;
  message: string;
  priority: number;
  isActive: boolean;
  createdAt: Date;
}

interface DashboardStats {
  totalUsers: number;
  activeJobs: number;
  totalJobs: number;
  totalRevenue: number;
  pendingFees: number;
  onlineUsers: number;
  newUsersToday: number;
  completedJobsToday: number;
  revenueToday: number;
  pendingTransactions: number;
  timestamp: Date;
}

interface SocketContextType {
  // Connection status
  isConnected: boolean;
  
  // Dashboard data only
  dashboardStats: DashboardStats | null;
  
  // Alerts data
  alerts: Alert[];
  
  // Manual refresh functions
  refreshDashboard: () => void;
  refreshAlerts: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  
  // Alerts state
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[Socket] User authenticated, connecting to admin socket...');
      connectSocket();
    } else {
      console.log('[Socket] User not authenticated, disconnecting socket...');
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, user]);

  const connectSocket = () => {
    if (socket) {
      console.log('[Socket] Socket already exists, disconnecting first...');
      socket.disconnect();
    }

    console.log('[Socket] Creating new admin socket connection...');
    const newSocket = io('http://localhost:5000/admin', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('🔌 [Socket] Connected to admin namespace:', newSocket.id);
      setIsConnected(true);
      toast.success('Real-time updates connected');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 [Socket] Disconnected:', reason);
      setIsConnected(false);
      if (reason !== 'io client disconnect') {
        toast.error('Real-time updates disconnected');
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('🔌 [Socket] Connection error:', error);
      setIsConnected(false);
      toast.error('Failed to connect real-time updates');
    });

    newSocket.on('connection:status', (status) => {
      console.log('🔌 [Socket] Connection status:', status);
    });

    // Dashboard events only
    newSocket.on('stats:initial', (stats) => {
      console.log('📊 [Socket] Initial dashboard stats received');
      setDashboardStats(stats);
    });

    newSocket.on('stats:update', (stats) => {
      console.log('📊 [Socket] Dashboard stats updated');
      setDashboardStats(stats);
    });

    // Alerts events
    newSocket.on('alerts:initial', (alerts) => {
      console.log('🚨 [Socket] Initial alerts received:', alerts.length);
      setAlerts(alerts);
    });

    newSocket.on('alerts:update', (data) => {
      console.log('🚨 [Socket] Alerts updated:', data.alerts.length);
      setAlerts(data.alerts);
    });

    newSocket.on('alert:updated', (data) => {
      console.log('🚨 [Socket] Single alert updated:', data.updateType);
      setAlerts(prev => prev.map(a => a._id === data.alert._id ? data.alert : a));
      if (data.updateType === 'created' && data.alert.priority >= 3) {
        toast.error(`Alert: ${data.alert.title}`);
      }
    });

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socket) {
      console.log('[Socket] Manually disconnecting socket...');
      socket.disconnect();
      setSocket(null);
    }
    setIsConnected(false);
    
    // Clear dashboard data
    setDashboardStats(null);
    setAlerts([]);
  };

  // Manual refresh functions - only for dashboard
  const refreshDashboard = () => {
    if (socket?.connected) {
      console.log('[Socket] Manually requesting dashboard refresh...');
      socket.emit('request:dashboard');
    }
  };

  const refreshAlerts = () => {
    if (socket?.connected) {
      console.log('[Socket] Manually requesting alerts refresh...');
      socket.emit('request:alerts');
    }
  };

  const value: SocketContextType = {
    isConnected,
    dashboardStats,
    alerts,
    refreshDashboard,
    refreshAlerts
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
