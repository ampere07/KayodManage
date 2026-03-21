import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Briefcase,
  DollarSign,
  AlertCircle,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart4 as BarChartIcon // Lucide has BarChart, BarChart2, BarChart3, BarChart4 with axes
} from 'lucide-react';
import StatsCard from '../components/Dashboard/StatsCard';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useDashboardComparison, useDashboardRevenueChart, useDashboardPopularJobs } from '../hooks/useDashboard';
import { getProfessionIconByName } from '../constants/categoryIcons';
import { settingsService } from '../services';
import { JobCategory } from '../types/configuration.types';
import { alertsService } from '../services';

function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const currentDate = new Date();
  const dateString = currentDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const shortDate = currentDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
  const timeString = currentDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const greeting = currentDate.getHours() < 12
    ? 'Good Morning'
    : currentDate.getHours() < 18
      ? 'Good Afternoon'
      : 'Good Evening';

  return (
    <div className="mb-2 md:mb-3">
      <div className="flex items-start justify-between mb-0.5">
        <h1 className="text-sm sm:text-base md:text-lg font-bold text-gray-1000">
          {greeting}, {user?.name || 'Admin'}
        </h1>
        <div className="text-right md:hidden">
          <p className="text-xs text-gray-900">{timeString}</p>
          <p className="text-xs text-gray-600">{shortDate}</p>
        </div>
      </div>
      <p className="text-xs text-gray-900 mb-1.5 md:mb-2 hidden md:block">
        <span className="hidden sm:inline">{dateString} · </span>{timeString}
      </p>

      <div className="flex gap-1.5 md:gap-2 flex-wrap">
        <button
          onClick={() => navigate('/verifications')}
          className="px-2 sm:px-2.5 md:px-3 py-1 md:py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-xs font-medium whitespace-nowrap"
        >
          <span className="hidden sm:inline">View Verifications</span>
          <span className="sm:hidden">Verify</span>
        </button>
        <button
          onClick={() => navigate('/jobs')}
          className="px-2 sm:px-2.5 md:px-3 py-1 md:py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-xs font-medium whitespace-nowrap"
        >
          <span className="hidden sm:inline">Review Flagged Jobs</span>
          <span className="sm:hidden">Flagged</span>
        </button>
        <button
          onClick={() => navigate('/support')}
          className="px-2 sm:px-2.5 md:px-3 py-1 md:py-1.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-xs font-medium whitespace-nowrap"
        >
          <span className="hidden sm:inline">Manage Customer Service</span>
          <span className="sm:hidden">Support</span>
        </button>
      </div>
    </div>
  );
}

function StatCards() {
  const navigate = useNavigate();
  const { dashboardStats } = useSocket();
  const { data: comparison } = useDashboardComparison();

  const stats = dashboardStats || {
    totalUsers: 0,
    totalJobs: 0,
    activeJobs: 0,
    totalRevenue: 0,
    pendingFees: 0,
    pendingFeesCount: 0
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

  const formatPercentage = (percentage: number) => {
    if (percentage === 0) return '0% vs Last Month';
    const sign = percentage > 0 ? '+' : '';
    return `${sign}${percentage}% vs Last Month`;
  };

  const getChangeType = (percentage: number) => {
    if (percentage > 0) return 'positive' as const;
    if (percentage < 0) return 'negative' as const;
    return 'neutral' as const;
  };

  const statCards = [
    {
      icon: Users,
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      trend: comparison ? { value: comparison.users.percentage, isPositive: comparison.users.percentage >= 0 } : undefined,
      color: 'blue' as const,
      onClick: () => navigate('/users')
    },
    {
      icon: Briefcase,
      title: 'Total Jobs',
      value: stats.totalJobs.toLocaleString(),
      trend: comparison ? { value: comparison.jobs.percentage, isPositive: comparison.jobs.percentage >= 0 } : undefined,
      color: 'green' as const,
      onClick: () => navigate('/jobs')
    },
    {
      icon: DollarSign,
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      trend: comparison ? { value: comparison.revenue.percentage, isPositive: comparison.revenue.percentage >= 0 } : undefined,
      color: 'indigo' as const,
      onClick: () => navigate('/transactions')
    },
    {
      icon: AlertCircle,
      title: 'Pending Fees',
      value: stats.pendingFeesCount?.toLocaleString() || '0',
      trend: undefined,
      color: 'red' as const,
      onClick: () => navigate('/transactions/fee-records?status=pending')
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 sm:gap-2 mb-2 md:mb-3">
      {statCards.map((stat) => (
        <div
          key={stat.title}
          onClick={stat.onClick}
          className="cursor-pointer"
        >
          <StatsCard
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            trend={stat.trend ? { value: stat.trend.value, isPositive: stat.trend.isPositive } : undefined}
            color={stat.color}
          />
        </div>
      ))}
    </div>
  );
}

interface RevenueChartData {
  name: string;
  revenue: number;
  transactions: number;
}

function RevenueChart() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const { data: chartData = [], isLoading: loading } = useDashboardRevenueChart(period);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value).replace('PHP', '₱');
  };

  return (
    <div className="bg-white p-2 sm:p-2.5 md:p-3 rounded-lg border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1.5 md:mb-2">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Revenue Overview</h3>

        <div className="flex gap-1 md:gap-1.5">
          <button
            onClick={() => setPeriod('week')}
            className={`px-1.5 sm:px-2 md:px-2.5 py-0.5 md:py-1 text-xs rounded transition-colors ${period === 'week'
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            Week
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-1.5 sm:px-2 md:px-2.5 py-0.5 md:py-1 text-xs rounded transition-colors ${period === 'month'
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            Month
          </button>
          <button
            onClick={() => setPeriod('year')}
            className={`px-1.5 sm:px-2 md:px-2.5 py-0.5 md:py-1 text-xs rounded transition-colors ${period === 'year'
              ? 'bg-gray-900 text-white'
              : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            Year
          </button>
        </div>
      </div>

      <div className="w-full h-[180px] sm:flex-1 sm:h-auto sm:min-h-[240px] sm:max-h-[280px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-gray-500">Loading...</div>
          </div>
        ) : chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `₱${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  fontSize: '11px'
                }}
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-gray-500">No data available</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActiveAlerts() {
  const navigate = useNavigate();
  const { alerts, socket } = useSocket();
  const { user } = useAuth();
  const [dismissingAlerts, setDismissingAlerts] = useState<Set<string>>(new Set());
  const [localAlerts, setLocalAlerts] = useState(alerts || []);
  const [isResetting, setIsResetting] = useState(false);

  const adminId = user?.id || user?._id || user?.adminId || user?.userId;
  const dismissedAlertsKey = `dismissedAlerts_${adminId}`;

  useEffect(() => {
    console.log('👤 Full user object:', user);
    console.log('🎯 Admin ID resolved:', adminId);
    console.log('🔑 LocalStorage key:', dismissedAlertsKey);
    const dismissedAlerts = JSON.parse(localStorage.getItem(dismissedAlertsKey) || '[]');
    console.log('🚫 Dismissed alerts from localStorage:', dismissedAlerts);
    const filteredAlerts = (alerts || []).filter(alert => !dismissedAlerts.includes(alert._id));
    console.log('✅ Filtered alerts:', filteredAlerts.length, 'of', alerts?.length);
    setLocalAlerts(filteredAlerts);
  }, [alerts, dismissedAlertsKey, adminId, user]);

  const handleResetAlerts = async () => {
    if (!confirm('Reset all alerts? This will make all dismissed alerts visible again for testing.')) {
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch('http://localhost:5000/api/admin/alerts/reset', {
        method: 'POST',
        credentials: 'include'
      });

      const data = await response.json();

      if (data.success) {
        localStorage.removeItem(dismissedAlertsKey);
        alert(`Alerts reset successfully!`);
        window.location.reload();
      } else {
        alert('Failed to reset alerts: ' + data.message);
      }
    } catch (error) {
      console.error('Error resetting alerts:', error);
      alert('Error resetting alerts. Check console for details.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDismiss = async (alertId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    console.log('🗑️ Dismissing alert:', alertId, 'for admin:', adminId);
    console.log('🔑 Using localStorage key:', dismissedAlertsKey);

    setDismissingAlerts(prev => new Set(prev).add(alertId));

    try {
      // Check if this is a generated alert (starts with prefix)
      const isGeneratedAlert = alertId.startsWith('report_') ||
        alertId.startsWith('verification_') ||
        alertId.startsWith('support_');

      console.log('🏷️ Is generated alert:', isGeneratedAlert);

      if (isGeneratedAlert) {
        // For generated alerts, just remove from local state
        // Store dismissed alert IDs in localStorage to persist across sessions
        const dismissedAlerts = JSON.parse(localStorage.getItem(dismissedAlertsKey) || '[]');
        dismissedAlerts.push(alertId);
        localStorage.setItem(dismissedAlertsKey, JSON.stringify(dismissedAlerts));
        console.log('💾 Saved to localStorage:', dismissedAlerts);

        setLocalAlerts(prev => prev.filter(alert => alert._id !== alertId));
      } else {
        // For real Alert documents, call the API
        console.log('🌐 Calling API to dismiss alert');
        await alertsService.dismissAlert(alertId);
        setLocalAlerts(prev => prev.filter(alert => alert._id !== alertId));
      }
    } catch (error) {
      console.error('Error dismissing alert:', error);
      setDismissingAlerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertId);
        return newSet;
      });
    } finally {
      setDismissingAlerts(prev => {
        const newSet = new Set(prev);
        newSet.delete(alertId);
        return newSet;
      });
    }
  };

  const handleReview = (alert: any) => {
    if (alert.category === 'reported_post' || alert.reportId) {
      navigate(`/flagged?reportId=${alert.reportId || alert._id.replace('report_', '')}`);
    } else if (alert.category === 'verification_request' || alert.verificationId) {
      navigate(`/verifications?id=${alert.verificationId || alert._id.replace('verification_', '')}`);
    } else if (alert.category === 'support_ticket' || alert.supportId) {
      navigate(`/support?id=${alert.supportId || alert._id.replace('support_', '')}`);
    } else {
      navigate(`/flagged?alertId=${alert._id}`);
    }
  };

  const getAlertStyle = (type: string) => {
    switch (type) {
      case 'critical':
        return 'border-l-4 border-l-red-500 bg-red-50';
      case 'warning':
        return 'border-l-4 border-l-yellow-500 bg-yellow-50';
      case 'info':
        return 'border-l-4 border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-4 border-l-gray-500 bg-gray-50';
    }
  };

  const displayAlerts = localAlerts || [];

  return (
    <div className="bg-white p-2 sm:p-2.5 md:p-3 rounded-lg border border-gray-200 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1.5 md:mb-2">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900">Active Alerts</h3>
        <button
          onClick={handleResetAlerts}
          disabled={isResetting}
          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Reset all alerts for testing"
        >
          {isResetting ? 'Resetting...' : 'Reset'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 md:space-y-2 max-h-[240px] sm:max-h-[280px]">
        {displayAlerts.length > 0 ? (
          displayAlerts.map((alert) => (
            <div
              key={alert._id}
              className={`border border-gray-200 rounded-lg p-2 md:p-2.5 ${getAlertStyle(alert.type)}`}
            >
              <div className="mb-1 md:mb-1.5">
                <h4 className="text-xs font-semibold text-gray-900 mb-0.5">
                  {alert.title || 'New Post Reported'}
                </h4>
                <p className="text-xs text-gray-600 line-clamp-2">
                  {alert.message || `Job "${alert.jobTitle || 'Test'}" reported for inappropriate content`}
                </p>
              </div>

              <div className="flex gap-1 md:gap-1.5">
                <button
                  onClick={() => handleReview(alert)}
                  className="px-2 md:px-2.5 py-0.5 md:py-1 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 transition-colors"
                >
                  Review
                </button>
                <button
                  onClick={(e) => handleDismiss(alert._id, e)}
                  disabled={dismissingAlerts.has(alert._id)}
                  className="px-2 md:px-2.5 py-0.5 md:py-1 border border-gray-300 text-gray-700 text-xs rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {dismissingAlerts.has(alert._id) ? 'Dismissing...' : 'Dismiss'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-6 md:py-8">
            <div className="inline-flex items-center justify-center w-8 md:w-10 h-8 md:h-10 rounded-full bg-gray-100 mb-1.5 md:mb-2">
              <AlertCircle className="h-4 md:h-5 w-4 md:w-5 text-gray-400" />
            </div>
            <p className="text-xs text-gray-600">No active alerts</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityBreakdown() {
  const { dashboardStats } = useSocket();

  const stats = dashboardStats || {
    newUsersToday: 0,
    newProvidersToday: 0,
    jobsCreatedToday: 0,
    completedJobsToday: 0,
    onlineUsers: 0,
    customers: 0,
    providers: 0,
    verifiedProviders: 0,
    pendingVerifications: 0,
    averageRating: 0
  };

  const todayActivity = [
    { label: 'New Customers', value: stats.newUsersToday || 0 },
    { label: 'New Providers', value: stats.newProvidersToday || 0 },
    { label: 'Jobs Created', value: stats.jobsCreatedToday || 0 },
    { label: 'Jobs Completed', value: stats.completedJobsToday || 0 },
    { label: 'Online Users', value: stats.onlineUsers || 0, highlight: true },
  ];

  const verificationRate = stats.providers > 0
    ? Math.round((stats.verifiedProviders / stats.providers) * 100)
    : 0;

  const userBreakdown = [
    { label: 'Total Customers', value: stats.customers?.toLocaleString() || '0' },
    { label: 'Total Providers', value: stats.providers?.toLocaleString() || '0' },
    {
      label: 'Verified Providers',
      value: `${stats.verifiedProviders || 0} (${verificationRate}%)`
    },
    { label: 'Pending Verifications', value: stats.pendingVerifications?.toLocaleString() || '0' },
    { label: 'Average Rating', value: `${stats.averageRating || '0.0'} ★` },
  ];

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2">
      <div className="bg-white p-2 sm:p-2.5 md:p-3 rounded-lg border border-gray-200">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 md:mb-2.5">Today's Activity</h3>

        <div className="space-y-1.5 sm:space-y-2 md:space-y-2.5">
          {todayActivity.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between pb-1.5 sm:pb-2 md:pb-2.5 border-b border-gray-100 last:border-0"
            >
              <span className="text-xs text-gray-600">{item.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-gray-900">
                  {item.value.toLocaleString()}
                </span>
                {item.highlight && (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-2 sm:p-2.5 md:p-3 rounded-lg border border-gray-200">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-900 mb-1.5 md:mb-2.5">User Breakdown</h3>

        <div className="space-y-1.5 sm:space-y-2 md:space-y-2.5">
          {userBreakdown.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between pb-1.5 sm:pb-2 md:pb-2.5 border-b border-gray-100 last:border-0"
            >
              <span className="text-xs text-gray-600">{item.label}</span>
              <span className="text-xs font-semibold text-gray-900">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const resolveIconData = (dataItem: any, categories: any[]) => {
  if (!dataItem) return getProfessionIconByName('');
  
  let iconStr = dataItem.icon || '';
  let categoryIconStr = '';
  const cleanName = dataItem.name || '';
  const rawName = dataItem.rawName || '';

  if (!iconStr && categories?.length) {
    for (const cat of categories) {
      if (cat.name.toLowerCase() === cleanName.toLowerCase() || cat.name.toLowerCase() === rawName.toLowerCase()) {
        iconStr = cat.icon;
        categoryIconStr = cat.icon;
        break;
      }
      const prof = cat.professions?.find((p: any) => p.name.toLowerCase() === cleanName.toLowerCase() || p.name.toLowerCase() === rawName.toLowerCase());
      if (prof) {
        iconStr = prof.icon;
        categoryIconStr = cat.icon;
        break;
      }
    }
  }

  if (!iconStr) {
    const legacyMap: Record<string, string> = {
      'catering': 'custom:catering.webp',
      'painting': 'custom:painter.webp',
      'beauty': 'custom:beauty--personal-care.webp',
      'cleaning': 'custom:house-cleaning.webp',
      'carpentry': 'custom:carpentry--cabinetry.webp',
      'ac refrigeration': 'custom:ac--refrigerator.webp',
      'gardening': 'custom:gardening--landscaping.webp',
      'moving': 'custom:lipat-bahay-mover.webp',
      'computer repair': 'custom:computer-technician.webp',
      'auto mechanic': 'custom:auto-mechanic.webp'
    };
    iconStr = legacyMap[cleanName.toLowerCase()] || '';
  }

  return getProfessionIconByName(iconStr, categoryIconStr);
};

const CustomXAxisTick = ({ x, y, payload, data, categories }: any) => {
  const dataItem = data.find((d: any) => d.name === payload.value);
  const iconData = resolveIconData(dataItem, categories);
  const words = payload.value.split(' ');

  return (
    <g transform={`translate(${x},${y})`}>
      {iconData?.imagePath ? (
        <image href={iconData.imagePath} x={-20} y={0} height="40px" width="40px" />
      ) : (
        <image href="/src/assets/icons/Default_Icon.webp" x={-20} y={0} height="40px" width="40px" />
      )}
      <text
        x={0}
        y={52}
        textAnchor="middle"
        fill="#6b7280"
        fontSize={9}
      >
        {words.map((word: string, index: number) => (
          <tspan x={0} dy={index === 0 ? 0 : 10} key={index}>
            {word}
          </tspan>
        ))}
      </text>
    </g>
  );
};

const CustomTooltip = ({ active, payload, categories }: any) => {
  if (active && payload && payload.length) {
    const dataItem = payload[0].payload;
    const iconData = resolveIconData(dataItem, categories);

    return (
      <div className="bg-white p-3 border border-gray-100 rounded-xl shadow-lg flex flex-col items-center gap-2">
        {iconData?.imagePath ? (
          <img src={iconData.imagePath} alt={dataItem.name} className="w-12 h-12 object-contain drop-shadow-sm" />
        ) : (
          <img src="/src/assets/icons/Default_Icon.webp" alt="default" className="w-12 h-12" />
        )}
        <div className="text-center">
          <p className="font-semibold text-gray-900 text-sm">{dataItem.name}</p>
          <p className="text-blue-600 font-bold">₱{dataItem.count.toLocaleString()}</p>
          <p className="text-xs text-gray-500 font-medium">{dataItem.jobCount} {dataItem.jobCount === 1 ? 'job' : 'jobs'}</p>
        </div>
      </div>
    );
  }
  return null;
};

const POPULAR_JOBS_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16', '#a855f7', '#14b8a6'];

function PopularJobsChart() {
  const [period, setPeriod] = useState<'overall' | 'week' | 'month' | '6months' | 'year'>('overall');
  const { data: rawChartData = [], isLoading: loading } = useDashboardPopularJobs(period);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'pie'>('pie');

  useEffect(() => {
    settingsService.getJobCategories().then(res => {
      setCategories(res.categories || []);
    }).catch(console.error);
  }, []);

  const chartData = useMemo(() => {
    return rawChartData.map((d: any) => {
      const cleanName = (d.name || '')
        .replace(/_/g, ' ')
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return { ...d, rawName: d.name, name: cleanName };
    });
  }, [rawChartData]);

  return (
    <div className="bg-white p-2 sm:p-2.5 md:p-3 rounded-lg border border-gray-200 h-full flex flex-col relative">
      <style>{`
        .popular-pie-slice {
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s !important;
          transform-origin: 72% 50%;
          cursor: pointer;
        }
        .popular-pie-slice:hover {
          transform: scale(1.08);
          opacity: 0.9;
          z-index: 10;
        }
      `}</style>

      <div className="p-4 sm:p-5 md:p-6 border-b border-gray-100 flex-shrink-0 flex flex-wrap justify-between items-center gap-3">
        <h2 className="text-base sm:text-lg font-bold text-gray-900 whitespace-nowrap">Popular Jobs</h2>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0">
          <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
            {(['overall', 'week', 'month', 'year'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  period === p 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
            <button
              onClick={() => setChartType('bar')}
              title="Display as Bar Chart"
              className={`p-1.5 rounded-md transition-colors ${
                chartType === 'bar' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <BarChartIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('pie')}
              title="Display as Pie Chart"
              className={`p-1.5 rounded-md transition-colors ${
                chartType === 'pie' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <PieChartIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 w-full relative min-h-[300px] h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-gray-500">Loading...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center py-10 opacity-70">
            <p className="text-sm font-medium text-gray-500">No popular jobs found for this timeframe.</p>
          </div>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                interval={0}
                height={100}
                tick={(props) => <CustomXAxisTick {...props} data={chartData} categories={categories} />}
              />
              <YAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `₱${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                tick={{ fontSize: 10, fill: '#6b7280' }}
              />
              <Tooltip
                cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
                content={<CustomTooltip categories={categories} />}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={40}>
                {chartData.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={POPULAR_JOBS_COLORS[index % POPULAR_JOBS_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex justify-center items-center py-4 relative">
            <ul className="grid grid-cols-2 gap-x-3 md:gap-x-6 gap-y-3 sm:gap-y-4 m-0 p-0 absolute top-1/2 -translate-y-1/2 left-0 z-10 max-h-[90%] overflow-y-auto no-scrollbar py-2 px-2 w-[55%] pointer-events-auto">
              {chartData.map((_: any, i: number) => {
                const half = Math.ceil(chartData.length / 2);
                const actualIndex = i % 2 === 0 ? Math.floor(i / 2) : half + Math.floor(i / 2);
                const entry = chartData[actualIndex];
                if (!entry) return <div key={`legend-empty-${i}`} />;
                const iconData = resolveIconData(entry, categories);
                return (
                  <li key={`legend-item-${actualIndex}`} className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base text-gray-700" title={entry.name}>
                    <span className="font-bold text-gray-400 w-3 sm:w-4 text-right flex-shrink-0">{actualIndex + 1}.</span>
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: POPULAR_JOBS_COLORS[actualIndex % POPULAR_JOBS_COLORS.length] }} />
                    {iconData?.imagePath ? (
                      <img src={iconData.imagePath} alt={entry.name} className="w-7 sm:w-10 h-7 sm:h-10 object-contain drop-shadow-sm filter contrast-125 brightness-105 flex-shrink-0" />
                    ) : (
                      <img src="/src/assets/icons/Default_Icon.webp" alt="default" className="w-7 sm:w-10 h-7 sm:h-10 object-contain opacity-50 sepia-[.2] flex-shrink-0" />
                    )}
                    <span className="truncate max-w-[90px] sm:max-w-[120px] md:max-w-[140px] font-medium leading-tight" title={entry.name}>
                      {entry.name}
                    </span>
                  </li>
                );
              })}
            </ul>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="72%"
                  cy="50%"
                  innerRadius={0}
                  outerRadius={140}
                  paddingAngle={0}
                  dataKey="count"
                  nameKey="name"
                >
                  {chartData.map((_entry: any, index: number) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={POPULAR_JOBS_COLORS[index % POPULAR_JOBS_COLORS.length]} 
                      className="popular-pie-slice"
                      style={{ outline: 'none' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip categories={categories} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="h-full flex flex-col overflow-hidden px-1 sm:px-0">
      <Header />
      <StatCards />

      <div className="flex flex-col lg:flex-row gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 md:mb-3">
        <div className="w-full lg:w-[55%]">
          <RevenueChart />
        </div>
        <div className="w-full lg:w-[45%]">
          <ActiveAlerts />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-1.5 sm:gap-2">
        <div className="lg:col-span-1">
          <ActivityBreakdown />
        </div>
        <div className="lg:col-span-2">
          <PopularJobsChart />
        </div>
      </div>
    </div>
  );
}
