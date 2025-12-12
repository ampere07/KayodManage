import React, { useState, useEffect } from 'react';
import { Users, Briefcase, DollarSign, AlertTriangle, TrendingUp, Activity, Wifi, WifiOff, RefreshCw, ArrowUpRight, Clock } from 'lucide-react';
import StatsCard from '../components/Dashboard/StatsCard';
import ActivityFeed from '../components/Dashboard/ActivityFeed';
import RevenueChart from '../components/Dashboard/RevenueChart';
import RealtimeStats from '../components/Dashboard/RealtimeStats';
import AlertsWidget from '../components/Dashboard/AlertsWidget';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
  const {
    isConnected,
    dashboardStats,
    alerts,
    refreshDashboard,
    refreshAlerts
  } = useSocket();

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

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

  useEffect(() => {
    fetchActivities();
  }, []);

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

  const handleAlertClick = (alert: any) => {
    if (alert.category === 'reported_post' || alert.reportId) {
      navigate(`/jobs?reportId=${alert.reportId || alert._id.replace('report_', '')}`);
    } else if (alert.category === 'verification_request' || alert.verificationId) {
      navigate(`/verifications?id=${alert.verificationId || alert._id.replace('verification_', '')}`);
    } else if (alert.category === 'support_ticket' || alert.supportId) {
      navigate(`/support?id=${alert.supportId || alert._id.replace('support_', '')}`);
    } else {
      navigate('/alerts');
    }
  };

  const getCategoryIcon = (category: string) => {
    if (category === 'reported_post') {
      return <AlertTriangle className="h-4 w-4" />;
    } else if (category === 'verification_request') {
      return <Users className="h-4 w-4" />;
    } else if (category === 'support_ticket') {
      return <Activity className="h-4 w-4" />;
    }
    return <AlertTriangle className="h-4 w-4" />;
  };

  const currentDate = new Date();
  const greeting = currentDate.getHours() < 12 ? 'Good Morning' : currentDate.getHours() < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="space-y-4">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl shadow-lg px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{greeting}, Admin</h1>
            <p className="text-sm text-blue-100 mt-0.5">
              {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm ${
              isConnected ? 'bg-green-500/20 border border-green-400/30' : 'bg-red-500/20 border border-red-400/30'
            }`}>
              {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              <span className="font-medium">{isConnected ? 'Live' : 'Offline'}</span>
              {isConnected && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>}
            </div>
            <button onClick={fetchActivities} disabled={loadingActivities} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" title="Refresh Activity">
              <Activity className={`h-4 w-4 ${loadingActivities ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={refreshDashboard} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" title="Refresh Stats">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={refreshAlerts} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors" title="Refresh Alerts">
              <AlertTriangle className="h-4 w-4" />
            </button>
          </div>
        </div>
        {dashboardStats?.timestamp && (
          <p className="text-xs text-blue-200 mt-2 flex items-center space-x-1">
            <Clock className="h-3 w-3" />
            <span>Last updated: {new Date(dashboardStats.timestamp).toLocaleTimeString()}</span>
          </p>
        )}
      </div>

      {/* Compact Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-blue-50">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            {stats.newUsersToday > 0 && (
              <div className="flex items-center space-x-0.5 text-green-600 text-xs font-medium">
                <ArrowUpRight className="h-3 w-3" />
                <span>+{stats.newUsersToday}</span>
              </div>
            )}
          </div>
          <h3 className="text-gray-600 text-xs font-medium">Total Users</h3>
          <p className="text-2xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">New today: {stats.newUsersToday}</p>
        </div>

        {/* Active Jobs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-green-50">
              <Briefcase className="h-5 w-5 text-green-600" />
            </div>
            {stats.completedJobsToday > 0 && (
              <div className="flex items-center space-x-0.5 text-green-600 text-xs font-medium">
                <ArrowUpRight className="h-3 w-3" />
                <span>{stats.completedJobsToday}</span>
              </div>
            )}
          </div>
          <h3 className="text-gray-600 text-xs font-medium">Active Jobs</h3>
          <p className="text-2xl font-bold text-gray-900">{stats.activeJobs.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Completed today: {stats.completedJobsToday}</p>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-purple-50">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            {stats.revenueToday > 0 && (
              <div className="flex items-center space-x-0.5 text-green-600 text-xs font-medium">
                <ArrowUpRight className="h-3 w-3" />
                <span>{formatCurrency(stats.revenueToday)}</span>
              </div>
            )}
          </div>
          <h3 className="text-gray-600 text-xs font-medium">Total Revenue</h3>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
          <p className="text-xs text-gray-500 mt-1">Today: {formatCurrency(stats.revenueToday)}</p>
        </div>

        {/* Pending Fees */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 rounded-lg bg-red-50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
          </div>
          <h3 className="text-gray-600 text-xs font-medium">Pending Fees</h3>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.pendingFees)}</p>
          <p className="text-xs text-gray-500 mt-1">Requires attention</p>
        </div>
      </div>

      {/* Compact Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-green-500 shadow">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-gray-600 text-xs font-medium">Online Users</h3>
              <p className="text-xl font-bold text-gray-900">{stats.onlineUsers.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-blue-500 shadow">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-gray-600 text-xs font-medium">New Users Today</h3>
              <p className="text-xl font-bold text-gray-900">{stats.newUsersToday.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-lg border border-purple-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-500 shadow">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-gray-600 text-xs font-medium">Revenue Today</h3>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(stats.revenueToday)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Activity - Compact Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">Recent Activity</h3>
              <p className="text-xs text-gray-500">Platform events</p>
            </div>
            <div className="p-1.5 rounded-lg bg-blue-50">
              <Activity className="h-4 w-4 text-blue-600" />
            </div>
          </div>
          
          <div className="space-y-2 max-h-[350px] overflow-y-auto custom-scrollbar">
            {loadingActivities ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-xs text-gray-500 mt-2">Loading...</p>
              </div>
            ) : activities.length > 0 ? (
              activities.slice(0, 15).map((activity, index) => (
                <div key={activity._id} className="flex items-start space-x-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-900 leading-relaxed">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {activity.createdAt || activity.timestamp 
                        ? new Date(activity.createdAt || activity.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })
                        : 'Unknown time'
                      }
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compact Alerts Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Active Alerts</h3>
            <p className="text-xs text-gray-500">
              {alerts && alerts.length > 0 ? `${alerts.length} pending` : 'No alerts'}
            </p>
          </div>
          <div className="px-2 py-1 rounded-full bg-red-50 border border-red-200">
            <div className="flex items-center space-x-1.5">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-medium text-red-700">Live</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {alerts && alerts.length > 0 ? (
            alerts.slice(0, 6).map((alert) => (
              <div
                key={alert._id}
                onClick={() => handleAlertClick(alert)}
                className={`p-3 rounded-lg border-l-4 transition-all hover:shadow-md cursor-pointer ${
                  alert.priority >= 4
                    ? 'border-red-500 bg-gradient-to-br from-red-50 to-red-100/50 hover:from-red-100 hover:to-red-200/50'
                    : alert.priority === 3
                    ? 'border-yellow-500 bg-gradient-to-br from-yellow-50 to-yellow-100/50 hover:from-yellow-100 hover:to-yellow-200/50'
                    : 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-200/50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-1.5">
                    <div className={`p-1.5 rounded ${
                      alert.priority >= 4 ? 'bg-red-100 text-red-600' : alert.priority === 3 ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {getCategoryIcon(alert.category)}
                    </div>
                    <h4 className="font-semibold text-gray-900 text-xs">{alert.title}</h4>
                  </div>
                  {alert.priority >= 4 && (
                    <span className="px-1.5 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full">!</span>
                  )}
                </div>
                
                <p className="text-xs text-gray-700 leading-relaxed mb-2 line-clamp-2">{alert.message}</p>
                
                <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
                  <p className="text-xs text-gray-600 font-medium">
                    {new Date(alert.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </p>
                  <span className="text-xs font-semibold text-gray-500 hover:text-gray-700">
                    View →
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-2">
                <AlertTriangle className="h-6 w-6 text-green-600" />
              </div>
              <h4 className="text-sm font-semibold text-gray-900 mb-1">All Clear!</h4>
              <p className="text-xs text-gray-500">
                {isConnected ? 'No active alerts' : 'Connecting...'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
