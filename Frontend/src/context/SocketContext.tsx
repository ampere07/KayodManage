import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
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
  customers: number;
  providers: number;
  activeJobs: number;
  totalJobs: number;
  totalRevenue: number;
  pendingFees: number;
  pendingFeesCount: number;
  onlineUsers: number;
  newUsersToday: number;
  newProvidersToday: number;
  jobsCreatedToday: number;
  completedJobsToday: number;
  revenueToday: number;
  pendingTransactions: number;
  verifiedProviders: number;
  pendingVerifications: number;
  averageRating: string;
  timestamp: Date;
}

interface SocketContextType {
  // Connection status
  isConnected: boolean;

  // Dashboard data only
  dashboardStats: DashboardStats | null;

  // Alerts data
  alerts: Alert[];

  // Socket instance
  socket: Socket | null;

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
  const queryClient = useQueryClient();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Dashboard state
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);

  // Alerts state
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    if (isAuthenticated && user) {
      connectSocket();
    } else {
      disconnectSocket();
    }

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, user]);

  const connectSocket = () => {
    if (socket) {
      socket.disconnect();
    }

    const adminId = user?.id || user?._id || user?.adminId;
    console.log('[Socket] Connecting with admin ID:', adminId);
    console.log('[Socket] User object:', user);

    const newSocket = io('http://localhost:5000/admin', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      timeout: 10000,
      forceNew: true,
      auth: {
        adminId: adminId
      }
    });

    // Connection events
    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connect_error', () => {
      setIsConnected(false);
    });

    // Dashboard events
    newSocket.on('stats:initial', (stats) => {
      setDashboardStats(stats);
    });

    newSocket.on('stats:update', (stats) => {
      setDashboardStats(stats);
    });

    // Alerts events
    newSocket.on('alerts:initial', (alerts) => {
      setAlerts(alerts);
    });

    newSocket.on('alerts:update', (data) => {
      setAlerts(data.alerts);
    });

    newSocket.on('alert:updated', (data) => {
      setAlerts(prev => prev.map(a => a._id === data.alert._id ? data.alert : a));
      if (data.updateType === 'created' && data.alert.priority >= 3) {
        toast.error(`Alert: ${data.alert.title}`);
      }
    });

    // User update events
    newSocket.on('user:updated', (data) => {
      console.log('[Socket] User updated:', data.user.name);

      // Invalidate the users query to trigger a refresh across the app
      queryClient.invalidateQueries({ queryKey: ['users'] });

      // Also specifically invalidate the stats to keep counts accurate
      queryClient.invalidateQueries({ queryKey: ['users', 'counts'] });

      if (data.updateType === 'verified') {
        toast.success(`${data.user.name} is now verified!`);
      }
    });

    // Configuration update events
    newSocket.on('configuration:updated', (data) => {
      console.log('[Socket] Configuration updated:', data.type);
      
      if (data.type === 'profession' && data.action === 'icon-updated') {
        // Invalidate job categories query to refresh profession data
        queryClient.invalidateQueries({ queryKey: ['job-categories'] });
        toast.success('Profession icon updated');
      }
      
      if (data.type === 'category') {
        queryClient.invalidateQueries({ queryKey: ['job-categories'] });
      }
    });

    setSocket(newSocket);
  };

  const disconnectSocket = () => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
    setIsConnected(false);
    setDashboardStats(null);
    setAlerts([]);
  };

  const refreshDashboard = () => {
    if (socket?.connected) {
      socket.emit('request:dashboard');
    }
  };

  const refreshAlerts = () => {
    if (socket?.connected) {
      socket.emit('request:alerts');
    }
  };

  const value: SocketContextType = {
    isConnected,
    dashboardStats,
    alerts,
    socket,
    refreshDashboard,
    refreshAlerts
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
