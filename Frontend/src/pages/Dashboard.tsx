import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Briefcase,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import StatsCard from '../components/Dashboard/StatsCard';
import { AreaChart, Area, PieChart, Pie, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

  return (
    <div className="hidden md:flex items-center justify-between mb-6 mt-2">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back! Your service marketplace's performance view</p>
      </div>

      <div className="hidden sm:flex items-center gap-3 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer px-2.5 py-2 rounded-2xl shadow-sm">
        <img
          src={user?.profilePicture || "/src/assets/icons/Default_Icon.webp"}
          alt="Admin Profile"
          className="w-11 h-11 rounded-full object-cover border border-white shadow-sm bg-white"
        />
        <div className="hidden sm:flex flex-col pr-3">
          <span className="text-[15px] font-bold text-gray-900 leading-tight">{user?.firstName ? `${user.firstName} ${user.lastName}` : 'Admin User'}</span>
          <span className="text-[13px] font-semibold text-gray-500 leading-tight mt-0.5">{user?.email || 'admin@company.com'}</span>
        </div>
      </div>
    </div>
  );
}

function StatCards() {
  const navigate = useNavigate();
  const { dashboardStats } = useSocket();
  const { data: comparison } = useDashboardComparison();

  const stats = dashboardStats || {
    totalRevenue: 0,
    totalUsers: 0,
    totalJobs: 0,
    activeJobs: 0,
    pendingFeesCount: 0
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value).replace('PHP', '₱');
  };

  const statCards = [
    {
      icon: DollarSign,
      title: 'Total Revenue',
      value: formatCurrency(stats.totalRevenue),
      trend: comparison ? { value: comparison.revenue.percentage, isPositive: comparison.revenue.percentage >= 0 } : { value: 18.2, isPositive: true },
      color: 'green' as const,
      variant: 'solid' as const,
      onClick: () => navigate('/transactions')
    },
    {
      icon: Users,
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      trend: comparison ? { value: comparison.users.percentage, isPositive: comparison.users.percentage >= 0 } : { value: 12.5, isPositive: true },
      color: 'blue' as const,
      variant: 'default' as const,
      onClick: () => navigate('/users')
    },
    {
      icon: Briefcase,
      title: 'Total Jobs',
      value: stats.totalJobs.toLocaleString(),
      trend: comparison ? { value: comparison.jobs.percentage, isPositive: comparison.jobs.percentage >= 0 } : { value: 2.3, isPositive: false },
      color: 'purple' as const,
      variant: 'default' as const,
      onClick: () => navigate('/jobs')
    },
    {
      icon: AlertCircle,
      title: 'Pending Fees',
      value: stats.pendingFeesCount?.toLocaleString() || '0',
      trend: { value: 24.6, isPositive: true },
      color: 'red' as const,
      variant: 'default' as const,
      onClick: () => navigate('/transactions/fee-records?status=pending')
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {statCards.map((stat) => (
        <div
          key={stat.title}
          onClick={stat.onClick}
          className="cursor-pointer"
        >
          <StatsCard {...stat} />
        </div>
      ))}
    </div>
  );
}

function RevenueChart() {
  const [period, setPeriod] = useState<'week' | 'month' | 'year' | 'overall'>('week');
  const { data: rawChartData = [], isLoading: loading } = useDashboardRevenueChart(period);
  const { dashboardStats } = useSocket();

  const chartData = useMemo(() => {
    return rawChartData.map((d: any) => ({
      ...d,
      name: d.date || d._id,
      revenue: d.totalAmount || d.revenue || 0
    }));
  }, [rawChartData]);

  const displayedTotalRevenue = useMemo(() => {
    if (period === 'overall') return dashboardStats?.totalRevenue || 0;
    return chartData.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0);
  }, [chartData, period, dashboardStats?.totalRevenue]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col">
      <div className="flex items-start sm:items-start justify-between mb-2 sm:mb-4">
        <div>
          <h3 className="text-[17px] sm:text-lg font-semibold text-gray-900 sm:mb-2">Revenue Overview</h3>
          <div className="hidden sm:flex items-center gap-3">
            <h2 className="text-3xl font-bold text-gray-900">₱{displayedTotalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">↓ 100%</span>
          </div>
        </div>

        {/* Mobile Tab Selector */}
        <div className="flex sm:hidden items-center gap-1 mt-0.5">
          {['week', 'month', 'year'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p as any)}
              className={`text-[12px] font-medium px-2.5 py-1 rounded-md transition-colors ${period === p ? 'bg-slate-900 text-white' : 'text-gray-500 hover:text-gray-900'}`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Desktop Select */}
        <div className="hidden sm:block">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="bg-gray-50 border-none text-gray-600 text-sm rounded-full px-4 py-1.5 focus:ring-0 cursor-pointer appearance-none pr-8 relative outline-none"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.2em 1.2em' }}
          >
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
            <option value="overall">All Time</option>
          </select>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0 mt-2">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `₱${value >= 1000 ? (value / 1000).toFixed(0) + 'k' : value}`}
                tick={{ fontSize: 11, fill: '#9ca3af', fontWeight: 500 }}
                dx={-10}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#10b981',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontWeight: 600,
                  padding: '8px 12px',
                  boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)'
                }}
                itemStyle={{ color: 'white' }}
                cursor={{ stroke: '#10b981', strokeWidth: 1, strokeDasharray: '4 4' }}
                formatter={(value: number) => [`₱${value.toLocaleString()}`, 'Revenue']}
                labelStyle={{ display: 'none' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRevenue)"
                activeDot={{ r: 6, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function ActiveAlerts() {
  const navigate = useNavigate();
  const { alerts } = useSocket();
  const { user } = useAuth();
  const [dismissingAlerts, setDismissingAlerts] = useState<Set<string>>(new Set());
  const [localAlerts, setLocalAlerts] = useState(alerts || []);
  const [isResetting, setIsResetting] = useState(false);

  const adminId = user?.id || user?._id || user?.adminId || user?.userId;
  const dismissedAlertsKey = `dismissedAlerts_${adminId}`;

  useEffect(() => {
    const dismissedAlerts = JSON.parse(localStorage.getItem(dismissedAlertsKey) || '[]');
    const filteredAlerts = (alerts || []).filter(alert => !dismissedAlerts.includes(alert._id));
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
    setDismissingAlerts(prev => new Set(prev).add(alertId));

    try {
      const isGeneratedAlert = alertId.startsWith('report_') ||
        alertId.startsWith('verification_') ||
        alertId.startsWith('support_');

      if (isGeneratedAlert) {
        const dismissedAlerts = JSON.parse(localStorage.getItem(dismissedAlertsKey) || '[]');
        dismissedAlerts.push(alertId);
        localStorage.setItem(dismissedAlertsKey, JSON.stringify(dismissedAlerts));
        setLocalAlerts(prev => prev.filter(alert => alert._id !== alertId));
      } else {
        await alertsService.dismissAlert(alertId);
        setLocalAlerts(prev => prev.filter(alert => alert._id !== alertId));
      }
    } catch (error) {
      console.error('Error dismissing alert:', error);
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
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="text-lg font-semibold text-gray-900">Active Alerts</h3>
        <button
          onClick={handleResetAlerts}
          disabled={isResetting}
          className="bg-gray-50 text-gray-600 text-sm rounded-full px-4 py-1.5 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          title="Reset all alerts for testing"
        >
          {isResetting ? 'Resetting...' : 'Reset'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1 no-scrollbar min-h-0">
        {displayAlerts.length > 0 ? (
          displayAlerts.map((alert) => (
            <div
              key={alert._id}
              className={`rounded-xl p-3 sm:p-4 ${getAlertStyle(alert.type)}`}
            >
              <div className="mb-2">
                <h4 className="text-[13px] sm:text-sm font-semibold text-gray-900 mb-0.5">
                  {alert.title || 'New Post Reported'}
                </h4>
                <p className="text-xs sm:text-sm text-gray-600 line-clamp-1">
                  {alert.message || 'Reported for inappropriate content'}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleReview(alert)}
                  className="px-3 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-full hover:bg-gray-800 transition-colors"
                >
                  Review
                </button>
                <button
                  onClick={(e) => handleDismiss(alert._id, e)}
                  disabled={dismissingAlerts.has(alert._id)}
                  className="px-3 py-1 bg-white border border-gray-200 text-gray-700 text-[11px] font-medium rounded-full hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {dismissingAlerts.has(alert._id) ? 'Dismissing...' : 'Dismiss'}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-4 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 mb-2">
              <AlertCircle className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">No active alerts</p>
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

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex-1 overflow-hidden flex flex-col">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex-shrink-0">Today's Activity</h3>

        <div className="flex-1 pr-2 min-h-0">
          <div className="space-y-4 pt-1">
            {todayActivity.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between pb-3 border-b border-gray-50 last:border-0 last:pb-0"
              >
                <span className="text-[13px] sm:text-sm font-medium text-gray-500">{item.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] sm:text-sm font-bold text-gray-900">
                    {item.value.toLocaleString()}
                  </span>
                  {item.highlight && (
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const resolveIconData = (dataItem: any, categories: JobCategory[]) => {
  if (!dataItem) return null;
  const cleanName = dataItem.name.toLowerCase();

  let categoryIconStr = '';
  let iconStr = '';

  const cat = categories.find(c => c.name.toLowerCase() === cleanName);
  if (cat) {
    categoryIconStr = cat.icon || '';
  } else {
    for (const c of categories) {
      const prof = c.professions?.find(p => p.name.toLowerCase() === cleanName);
      if (prof) {
        iconStr = prof.icon || '';
        categoryIconStr = c.icon || '';
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
      'carpentry': 'custom:carpentry-cabinetry.webp',
      'ac refrigeration': 'custom:ac--refrigerator.webp',
      'gardening': 'custom:gardening--landscaping.webp',
      'moving': 'custom:lipat-bahay-mover.webp',
      'computer repair': 'custom:computer-technician.webp',
      'auto mechanic': 'custom:auto-mechanic.webp'
    };
    iconStr = legacyMap[cleanName] || '';
  }

  return getProfessionIconByName(iconStr, categoryIconStr);
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
          <p className="text-emerald-600 font-bold">₱{dataItem.count.toLocaleString()}</p>
          <p className="text-xs text-gray-500 font-medium">{dataItem.jobCount} {dataItem.jobCount === 1 ? 'job' : 'jobs'}</p>
        </div>
      </div>
    );
  }
  return null;
};

const CustomBarXAxisTick = (props: any) => {
  const { x, y, payload, categories } = props;
  const iconData = resolveIconData({ name: payload.value }, categories);

  return (
    <g transform={`translate(${x},${y})`}>
      {iconData?.imagePath && (
        <image x={-18} y={4} width={36} height={36} href={iconData.imagePath} />
      )}
      <foreignObject x={-35} y={45} width={70} height={40}>
        <div style={{ 
          textAlign: 'center', 
          fontSize: '10px', 
          color: '#64748b', 
          fontWeight: 500, 
          lineHeight: '1.2',
          whiteSpace: 'normal',
          wordWrap: 'break-word',
          display: 'flex',
          justifyContent: 'center'
        }}>
          {payload.value}
        </div>
      </foreignObject>
    </g>
  );
};

const POPULAR_JOBS_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#d946ef', '#f43f5e'];

function PopularJobsChart() {
  const [period, setPeriod] = useState<'overall' | 'week' | 'month' | '6months' | 'year'>('overall');
  const [viewType, setViewType] = useState<'pie' | 'bar'>('pie');
  const { data: rawChartData = [], isLoading: loading } = useDashboardPopularJobs(period);
  const [categories, setCategories] = useState<JobCategory[]>([]);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const totalJobs = useMemo(() => {
    return chartData.reduce((acc: number, curr: any) => acc + (curr.count || 0), 0);
  }, [chartData]);

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col relative">
      <style>{`
        .popular-pie-slice {
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s !important;
          transform-origin: 50% 50%;
          cursor: pointer;
        }
        .popular-pie-slice:hover {
          transform: scale(1.05);
          opacity: 0.9;
          z-index: 10;
        }
      `}</style>

      <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0 gap-1.5 sm:gap-3">
        <h3 className="text-[14px] sm:text-lg font-semibold text-gray-900 truncate pr-1">Popular Jobs By Category</h3>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <div className="flex items-center bg-gray-50 rounded-full p-0.5 sm:p-1 border border-gray-100">
            <button
              onClick={() => setViewType('pie')}
              className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-full transition-colors ${viewType === 'pie' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Pie
            </button>
            <button
              onClick={() => setViewType('bar')}
              className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-medium rounded-full transition-colors ${viewType === 'bar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Bar
            </button>
          </div>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="bg-gray-50 border border-gray-100 text-gray-600 text-[10px] sm:text-sm rounded-full px-2 sm:px-4 py-1 sm:py-1.5 focus:ring-0 cursor-pointer appearance-none pr-5 sm:pr-8 relative outline-none"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.3rem center', backgroundSize: '1em 1em' }}
          >
            <option value="overall">All Time</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </div>
      </div>

      <div className="flex-1 w-full relative min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-gray-500">Loading...</div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center opacity-70">
            <p className="text-sm font-medium text-gray-500">No popular jobs found for this timeframe.</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-row items-start justify-between relative px-1 sm:px-4 py-2">
            {viewType === 'pie' && (
              <div className="w-[55%] sm:w-1/2 h-full overflow-y-auto max-h-[300px] md:max-h-[400px] dashboard-scroll flex items-start justify-start pr-1 sm:pr-4 py-2">
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 sm:gap-x-8 gap-y-2 sm:gap-y-4 m-0 p-0 w-full mt-1">
                  {chartData.map((entry: any, index: number) => {
                    const iconData = resolveIconData(entry, categories);
                    return (
                      <li key={`legend-item-${index}`} className="flex items-center justify-between text-sm text-gray-600 w-full" title={entry.name}>
                        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-hidden">
                          <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: POPULAR_JOBS_COLORS[index % POPULAR_JOBS_COLORS.length] }} />
                          {iconData?.imagePath ? (
                            <img src={iconData.imagePath} alt={entry.name} className="w-7 h-7 sm:w-9 sm:h-9 object-contain drop-shadow-sm flex-shrink-0" />
                          ) : (
                            <div className="w-7 h-7 sm:w-9 sm:h-9 opacity-0 flex-shrink-0" />
                          )}
                          <span className="text-[11px] sm:text-[13px] font-semibold text-gray-400 min-w-[12px] sm:min-w-[14px]">{index + 1}.</span>
                          <span className="truncate font-medium text-gray-600 text-[11px] sm:text-[13px]" title={entry.name}>
                            {entry.name}
                          </span>
                        </div>
                        <span className="font-bold text-gray-900 text-[11px] sm:text-[13px] ml-1 sm:ml-2">₱{entry.count.toLocaleString()}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className={`h-full ${viewType === 'pie' ? 'w-1/2 min-h-[160px] sm:min-h-[220px]' : 'w-full pt-4'} relative flex-shrink-0`}>
              {viewType === 'pie' ? (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
                    <span className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">₱{totalJobs.toLocaleString()}</span>
                    <span className="text-[11px] sm:text-xs font-semibold text-emerald-600 mt-0.5">+12% ↑</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={isMobile ? 55 : 70}
                        outerRadius={isMobile ? 75 : 100}
                        paddingAngle={3}
                        dataKey="count"
                        nameKey="name"
                        cornerRadius={5}
                        stroke="none"
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
                </>
              ) : (
                <div className="w-[calc(100%+12px)] sm:w-full h-full -ml-3 sm:ml-0 overflow-x-auto overflow-y-hidden dashboard-scroll">
                  <div className="min-w-[700px] sm:min-w-0 h-full w-full pr-2 sm:pr-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                          tick={<CustomBarXAxisTick categories={categories} />}
                          height={90}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(val) => '₱' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val)}
                          tick={{ fontSize: 10, fill: '#9ca3af', fontWeight: 500 }}
                          dx={-4}
                        />
                        <Tooltip content={<CustomTooltip categories={categories} />} cursor={{ fill: '#f3f4f6', opacity: 0.4 }} />
                        <Bar
                          dataKey="count"
                          radius={[4, 4, 0, 0]}
                          maxBarSize={40}
                        >
                          {chartData.map((_entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={POPULAR_JOBS_COLORS[index % POPULAR_JOBS_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <div className="h-full flex flex-col px-4 md:px-8 py-2 md:py-5 bg-[#f8fafc] overflow-y-auto md:overflow-hidden">
      <Header />
      <StatCards />

      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        {/* Left Column */}
        <div className="flex flex-col gap-4 w-full lg:w-[65%]">
          <div className="h-[260px] lg:h-[370px]">
            <RevenueChart />
          </div>
          <div className="h-[370px]">
            <PopularJobsChart />
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-4 w-full lg:w-[35%]">
          <div className="h-[405px] lg:h-[450px]">
            <ActiveAlerts />
          </div>
          <div className="h-[290px]">
            <ActivityBreakdown />
          </div>
        </div>
      </div>
    </div>
  );
}
