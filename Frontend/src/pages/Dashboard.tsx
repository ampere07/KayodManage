import React, { useState, useEffect } from 'react';
import { Users, Briefcase, DollarSign, AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import StatsCard from '../components/Dashboard/StatsCard';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import RevenueChart from '../components/Dashboard/RevenueChart';
import RealtimeStats from '../components/Dashboard/RealtimeStats';
import AlertsWidget from '../components/Dashboard/AlertsWidget';
import { useSocket } from '../hooks/useSocket';

interface DashboardStats {
  totalUsers: number;
  activeJobs: number;
  totalRevenue: number;
  pendingFees: number;
  onlineUsers: number;
  newUsersToday: number;
  completedJobsToday: number;
  revenueToday: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeJobs: 0,
    totalRevenue: 0,
    pendingFees: 0,
    onlineUsers: 0,
    newUsersToday: 0,
    completedJobsToday: 0,
    revenueToday: 0
  });
  
  const socket = useSocket('admin');

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('stats:update', (updatedStats: DashboardStats) => {
        setStats(updatedStats);
      });

      socket.on('connection:status', (status) => {
        console.log('Socket connection status:', status);
      });

      return () => {
        socket.off('stats:update');
        socket.off('connection:status');
      };
    }
  }, [socket]);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats', {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      {/* Real-time Connection Status */}
      <RealtimeStats socket={socket} />

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers.toLocaleString()}
          icon={Users}
          trend={{ value: stats.newUsersToday, isPositive: true }}
          color="blue"
        />
        <StatsCard
          title="Active Jobs"
          value={stats.activeJobs.toLocaleString()}
          icon={Briefcase}
          trend={{ value: stats.completedJobsToday, isPositive: true }}
          color="green"
        />
        <StatsCard
          title="Total Revenue"
          value={formatCurrency(stats.totalRevenue)}
          icon={DollarSign}
          trend={{ value: stats.revenueToday, isPositive: true }}
          color="purple"
        />
        <StatsCard
          title="Pending Fees"
          value={formatCurrency(stats.pendingFees)}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          title="Online Users"
          value={stats.onlineUsers.toLocaleString()}
          icon={Activity}
          color="green"
        />
        <StatsCard
          title="New Users Today"
          value={stats.newUsersToday.toLocaleString()}
          icon={TrendingUp}
          color="blue"
        />
        <StatsCard
          title="Revenue Today"
          value={formatCurrency(stats.revenueToday)}
          icon={DollarSign}
          color="indigo"
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>
        <div className="space-y-6">
          <ActivityFeed />
        </div>
      </div>

      {/* Alerts Section */}
      <AlertsWidget />
    </div>
  );
};

export default Dashboard;