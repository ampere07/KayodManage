import React, { useState, useEffect } from 'react';
import { Users, Briefcase, DollarSign, AlertTriangle, TrendingUp, Activity, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import StatsCard from '../components/Dashboard/StatsCard';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import RevenueChart from '../components/Dashboard/RevenueChart';
import RealtimeStats from '../components/Dashboard/RealtimeStats';
import AlertsWidget from '../components/Dashboard/AlertsWidget';
import { useSocket } from '../context/SocketContext';

interface ActivityItem {
  _id: string;
  type: string;
  description: string;
  timestamp?: Date;
  createdAt?: Date;
  userId?: {
    name: string;
    email: string;
  };
  jobId?: {
    title: string;
  };
  metadata?: any;
}

const Dashboard: React.FC = () => {
  const {
    isConnected,
    dashboardStats,
    alerts,
    refreshDashboard,
    refreshAlerts
  } = useSocket();

  // Local state for activities (no longer from socket)
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  // Fetch activities separately via API
  const fetchActivities = async () => {
    try {
      setLoadingActivities(true);
      const response = await fetch('/api/dashboard/activity', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data: ActivityItem[] = await response.json();
        setActivities(data || []);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoadingActivities(false);
    }
  };

  // Load activities on component mount
  useEffect(() => {
    fetchActivities();
  }, []);

  // Fallback stats for when socket data isn't available yet
  const stats = dashboardStats || {
    totalUsers: 0,
    activeJobs: 0,
    totalRevenue: 0,
    pendingFees: 0,
    onlineUsers: 0,
    newUsersToday: 0,
    completedJobsToday: 0,
    revenueToday: 0,
    pendingTransactions: 0
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

  return (
    <div className="space-y-8">
      {/* Real-time Connection Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isConnected ? (
              <>
                <Wifi className="h-5 w-5 text-green-500" />
                <span className="text-sm text-green-700 font-medium">
                  Real-time updates connected
                </span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </>
            ) : (
              <>
                <WifiOff className="h-5 w-5 text-red-500" />
                <span className="text-sm text-red-700 font-medium">
                  Real-time updates disconnected
                </span>
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchActivities}
              disabled={loadingActivities}
              className="flex items-center space-x-2 px-3 py-1 text-sm bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <Activity className={`h-4 w-4 ${loadingActivities ? 'animate-spin' : ''}`} />
              <span>Activity</span>
            </button>
            <button
              onClick={refreshDashboard}
              className="flex items-center space-x-2 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Stats</span>
            </button>
            <button
              onClick={refreshAlerts}
              className="flex items-center space-x-2 px-3 py-1 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Alerts</span>
            </button>
          </div>
        </div>
        {dashboardStats?.timestamp && (
          <p className="text-xs text-gray-500 mt-2">
            Last updated: {new Date(dashboardStats.timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>

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
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-gray-400" />
                <span className="text-xs text-gray-500">API</span>
              </div>
            </div>
            <div className="space-y-3">
              {loadingActivities ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading activities...</p>
                </div>
              ) : activities.length > 0 ? (
                activities.slice(0, 10).map((activity) => (
                  <div key={activity._id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{activity.description}</p>
                      <p className="text-xs text-gray-500">
                        {activity.createdAt || activity.timestamp 
                          ? new Date(activity.createdAt || activity.timestamp).toLocaleTimeString()
                          : 'Unknown time'
                        }
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">
                  No recent activity found
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Active Alerts</h3>
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-gray-400" />
            <span className="text-xs text-gray-500">Live</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts && alerts.length > 0 ? (
            alerts.slice(0, 6).map((alert) => (
              <div
                key={alert._id}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.priority >= 3
                    ? 'border-red-500 bg-red-50'
                    : alert.priority === 2
                    ? 'border-yellow-500 bg-yellow-50'
                    : 'border-blue-500 bg-blue-50'
                }`}
              >
                <h4 className="font-medium text-gray-900 text-sm">{alert.title}</h4>
                <p className="text-xs text-gray-600 mt-1">{alert.message}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(alert.createdAt).toLocaleString()}
                </p>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <p className="text-sm text-gray-500">
                {isConnected ? 'No active alerts' : 'Loading alerts...'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
