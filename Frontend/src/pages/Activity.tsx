import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Shield,
  UserCheck,
  UserX,
  Ban,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Calendar,
  Activity as ActivityIcon,
  MousePointerClick,
  Briefcase,
  Filter as FilterIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { usersService, transactionsService } from '../services';
import { UserDetailsModal, TransactionDetailsModal } from '../components/Modals';
import { getInitials } from '../utils';
import { useActivityLogs } from '../hooks';
import { useSocket } from '../context/SocketContext';
import StatsCard from '../components/Dashboard/StatsCard';
import type { User, Transaction } from '../types';

interface AdminInfo {
  _id: string;
  name: string;
  email: string;
  userType?: string;
}

interface TargetInfo {
  _id: string;
  name?: string;
  email?: string;
  title?: string;
  subject?: string;
  description?: string;
  type?: string;
}

interface ActivityLog {
  _id: string;
  adminId: AdminInfo;
  actionType: 'verification_approved' | 'verification_rejected' | 'user_restricted' | 'user_suspended' | 'user_banned' | 'user_unrestricted' | 'transaction_completed' | 'transaction_failed' | 'support_closed' | 'support_reopened' | 'admin_login' | 'job_hidden' | 'job_unhidden' | 'job_deleted' | 'job_restored';
  description: string;
  targetType?: 'user' | 'transaction' | 'support' | 'verification' | 'job';
  targetId?: TargetInfo;
  metadata?: any;
  ipAddress?: string;
  createdAt: Date;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  verification_approved: <UserCheck className="h-4 w-4" />,
  verification_rejected: <UserX className="h-4 w-4" />,
  user_restricted: <Shield className="h-4 w-4" />,
  user_suspended: <Clock className="h-4 w-4" />,
  user_banned: <Ban className="h-4 w-4" />,
  user_unrestricted: <UserCheck className="h-4 w-4" />,
  transaction_completed: <CheckCircle className="h-4 w-4" />,
  transaction_failed: <XCircle className="h-4 w-4" />,
  support_closed: <MessageSquare className="h-4 w-4" />,
  support_reopened: <MessageSquare className="h-4 w-4" />,
  admin_login: <Shield className="h-4 w-4" />,
  job_hidden: <XCircle className="h-4 w-4" />,
  job_unhidden: <CheckCircle className="h-4 w-4" />,
  job_deleted: <XCircle className="h-4 w-4" />,
  job_restored: <CheckCircle className="h-4 w-4" />
};

const ACTION_COLORS: Record<string, string> = {
  verification_approved: 'bg-green-100 text-green-700',
  verification_rejected: 'bg-red-100 text-red-700',
  user_restricted: 'bg-orange-100 text-orange-700',
  user_suspended: 'bg-yellow-100 text-yellow-700',
  user_banned: 'bg-red-100 text-red-700',
  user_unrestricted: 'bg-green-100 text-green-700',
  transaction_completed: 'bg-green-100 text-green-700',
  transaction_failed: 'bg-red-100 text-red-700',
  support_closed: 'bg-gray-100 text-gray-700',
  support_reopened: 'bg-blue-100 text-blue-700',
  admin_login: 'bg-purple-100 text-purple-700',
  job_hidden: 'bg-orange-100 text-orange-700',
  job_unhidden: 'bg-green-100 text-green-700',
  job_deleted: 'bg-red-100 text-red-700',
  job_restored: 'bg-green-100 text-green-700'
};

const ACTION_LABELS: Record<string, string> = {
  verification_approved: 'Verification Approved',
  verification_rejected: 'Verification Rejected',
  user_restricted: 'User Restricted',
  user_suspended: 'User Suspended',
  user_banned: 'User Banned',
  user_unrestricted: 'User Unrestricted',
  transaction_completed: 'Transaction Completed',
  transaction_failed: 'Transaction Failed',
  support_closed: 'Support Closed',
  support_reopened: 'Support Reopened',
  admin_login: 'Admin Login',
  job_hidden: 'Job Hidden',
  job_unhidden: 'Job Restored',
  job_deleted: 'Job Deleted',
  job_restored: 'Job Restored'
};

const USER_ACTIONS = [
  'verification_approved',
  'verification_rejected',
  'user_restricted',
  'user_suspended',
  'user_banned',
  'user_unrestricted'
];

const JOB_ACTIONS = [
  'job_hidden',
  'job_unhidden',
  'job_deleted',
  'job_restored'
];

const SYSTEM_ACTIONS = [
  'transaction_completed',
  'transaction_failed',
  'support_closed',
  'support_reopened',
  'admin_login'
];

const Activity: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { data: activities = [], isLoading: loading, refetch } = useActivityLogs();
  const { socket } = useSocket();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'user' | 'job' | 'system'>('all');
  const [highlightedActivityId, setHighlightedActivityId] = useState<string | null>(null);
  const activityRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20
  });

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);

  // Real-time socket listener for new activity logs
  useEffect(() => {
    console.log('🔍 Activity page mounted, checking socket:', {
      socketExists: !!socket,
      socketConnected: socket?.connected,
      socketId: socket?.id
    });

    if (!socket) {
      console.log('⚠️ Socket not available in Activity page');
      return;
    }

    console.log('✅ Setting up activity:new listener, socket connected:', socket.connected);

    const handleNewActivity = (data: any) => {
      console.log('🔔 ========================================');
      console.log('🔔 NEW ACTIVITY LOG RECEIVED!');
      console.log('🔔 Data:', data);
      console.log('🔔 ========================================');

      // Log before invalidation
      console.log('📤 About to invalidate queries...');

      // Invalidate and immediately refetch
      queryClient.invalidateQueries({
        queryKey: ['activity'],
        refetchType: 'active'
      });

      console.log('✅ Queries invalidated');

      // Also trigger manual refetch
      console.log('📤 About to manually refetch...');
      refetch().then(() => {
        console.log('✅ Manual refetch completed');
      }).catch((err) => {
        console.error('❌ Manual refetch failed:', err);
      });

      toast.success('New activity log', {
        duration: 2000,
        icon: '📝'
      });
    };

    socket.on('activity:new', handleNewActivity);
    console.log('📡 Listener registered for activity:new event');

    // Test the socket connection
    socket.emit('test:ping', { page: 'activity' });

    // Listen for test response
    socket.on('test:pong', (data) => {
      console.log('🏓 Received test:pong:', data);
    });

    return () => {
      console.log('🧹 Cleaning up activity:new listener');
      socket.off('activity:new', handleNewActivity);
      socket.off('test:pong');
    };
  }, [socket, queryClient, refetch]);

  const formatDescriptionWithDuration = (activity: ActivityLog) => {
    const { description, actionType, metadata } = activity;

    if (
      (actionType === 'user_restricted' ||
        actionType === 'user_suspended' ||
        actionType === 'user_banned') &&
      metadata?.duration
    ) {
      const duration = metadata.duration;
      let durationText = '';

      if (duration === -1) {
        durationText = 'indefinitely';
      } else if (duration === 1) {
        durationText = 'for 1 day';
      } else {
        durationText = `for ${duration} days`;
      }

      return `${description} ${durationText}`;
    }

    return description;
  };

  const handleActivityClick = useCallback(async (activity: ActivityLog) => {
    // Determine target from either targetId or metadata/description if targetId is missing
    let targetType = activity.targetType;
    let targetId = typeof activity.targetId === 'object' ? activity.targetId?._id : activity.targetId;

    // Fallback detection for refund/transaction actions if targetType is missing
    if (!targetType && (activity.actionType === 'transaction_completed' || activity.actionType === 'transaction_failed')) {
      targetType = 'transaction';
      // Try to extract ID from description if targetId is missing
      if (!targetId) {
        const idMatch = activity.description.match(/[a-f\d]{24}/i);
        if (idMatch) targetId = idMatch[0];
      }
    }

    if (!targetId || !targetType) return;

    try {
      switch (targetType) {
        case 'user':
          const user = await usersService.getUserById(targetId);
          if (user) {
            setSelectedUser(user);
            setUserModalOpen(true);
          }
          break;

        case 'transaction':
          const transaction = await transactionsService.getTransactionById(targetId);
          if (transaction) {
            setSelectedTransaction(transaction as any);
            setTransactionModalOpen(true);
          }
          break;

        case 'support':
          navigate('/support');
          break;

        case 'verification':
          navigate('/verifications');
          break;

        case 'job':
          navigate('/jobs');
          break;
      }
    } catch (error) {
      console.error('Error fetching activity target:', error);
      toast.error('Failed to load details');
    }
  }, [navigate]);

  const filteredActivities = useMemo(() => {
    return activities.filter((activity: ActivityLog) => {
      const matchesSearch =
        (activity.adminId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        activity.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activity.adminId?.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (activity.targetId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (activity.targetId?.email?.toLowerCase().includes(searchTerm.toLowerCase()) || false);

      const matchesAction = actionFilter === 'all' || activity.actionType === actionFilter;

      const matchesType =
        typeFilter === 'all' ||
        (typeFilter === 'user' && USER_ACTIONS.includes(activity.actionType)) ||
        (typeFilter === 'job' && JOB_ACTIONS.includes(activity.actionType)) ||
        (typeFilter === 'system' && SYSTEM_ACTIONS.includes(activity.actionType));

      return matchesSearch && matchesAction && matchesType;
    });
  }, [activities, searchTerm, actionFilter, typeFilter]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm, actionFilter, typeFilter]);

  const paginatedActivities = filteredActivities.slice(
    (pagination.page - 1) * pagination.limit,
    pagination.page * pagination.limit
  );

  const totalPages = Math.ceil(filteredActivities.length / pagination.limit);

  const totalActivityLogs = activities.length;
  const userActivityLogs = activities.filter((activity: ActivityLog) => USER_ACTIONS.includes(activity.actionType)).length;
  const systemActivityLogs = activities.filter((activity: ActivityLog) => SYSTEM_ACTIONS.includes(activity.actionType)).length;

  // Handle activity ID from URL parameter
  useEffect(() => {
    const activityId = searchParams.get('id');
    if (activityId && activities.length > 0 && !highlightedActivityId) {
      console.log('Processing activity ID from URL:', activityId);
      // Find the activity
      const activity = activities.find((a: ActivityLog) => a._id === activityId);
      if (activity) {
        console.log('Activity found:', activity);
        // Set as highlighted
        setHighlightedActivityId(activityId);

        // Find which page this activity is on
        const activityIndex = filteredActivities.findIndex((a: ActivityLog) => a._id === activityId);
        console.log('Activity index in filtered list:', activityIndex);
        if (activityIndex !== -1) {
          const targetPage = Math.floor(activityIndex / pagination.limit) + 1;
          console.log('Setting page to:', targetPage);
          setPagination(prev => ({ ...prev, page: targetPage }));
        }
      } else {
        console.log('Activity not found in activities list');
        // Activity not found, clear the URL param
        setSearchParams({});
      }
    }
  }, [searchParams, activities, filteredActivities, pagination.limit, highlightedActivityId, setSearchParams]);

  // Separate effect for scrolling after pagination updates and opening modal
  useEffect(() => {
    const activityId = searchParams.get('id');
    if (activityId && highlightedActivityId === activityId && activities.length > 0) {
      // Wait for pagination to render
      const scrollTimer = setTimeout(() => {
        const element = activityRefs.current[activityId];

        if (element) {
          console.log('Scrolling to activity:', activityId);
          console.log('Element found:', element);

          // Use scrollIntoView which is more reliable
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });

          // After scrolling, open the modal for this activity
          setTimeout(() => {
            const activity = activities.find((a: ActivityLog) => a._id === activityId);
            if (activity) {
              console.log('Opening modal for activity:', activity);
              handleActivityClick(activity);
            }
          }, 800);
        } else {
          console.log('Element not found for activity:', activityId);
          console.log('Available refs:', Object.keys(activityRefs.current));
        }
      }, 500);

      // Remove highlight after 6 seconds
      const highlightTimer = setTimeout(() => {
        setHighlightedActivityId(null);
        setSearchParams({});
      }, 6000);

      return () => {
        clearTimeout(scrollTimer);
        clearTimeout(highlightTimer);
      };
    }
  }, [pagination.page, highlightedActivityId, searchParams, setSearchParams, activities, handleActivityClick]);

  return (
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50 mt-16 md:mt-0 h-screen overflow-hidden text-gray-700">
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <ActivityIcon className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Activity Center
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Track and monitor all administrative actions and system events across the platform
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="cursor-pointer" onClick={() => setTypeFilter('all')}>
              <StatsCard
                title="Total Activity"
                value={totalActivityLogs.toString()}
                icon={ActivityIcon}
                color="blue"
                variant="tinted"
                isActive={typeFilter === 'all'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setTypeFilter('user')}>
              <StatsCard
                title="User Actions"
                value={userActivityLogs.toString()}
                icon={UserCheck}
                color="purple"
                variant="tinted"
                isActive={typeFilter === 'user'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setTypeFilter('job')}>
              <StatsCard
                title="Job Actions"
                value={activities.filter((activity: ActivityLog) => JOB_ACTIONS.includes(activity.actionType)).length.toString()}
                icon={Briefcase}
                color="orange"
                variant="tinted"
                isActive={typeFilter === 'job'}
                smallIcon={true}
              />
            </div>
            <div className="cursor-pointer" onClick={() => setTypeFilter('system')}>
              <StatsCard
                title="System Actions"
                value={systemActivityLogs.toString()}
                icon={Shield}
                color="green"
                variant="tinted"
                isActive={typeFilter === 'system'}
                smallIcon={true}
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by admin, description, or target..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto no-scrollbar pb-0.5 md:pb-0 shrink-0">
            <div className="flex items-center gap-2 bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm">
              <FilterIcon className="h-4 w-4 text-gray-400" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="bg-transparent border-none text-xs font-black text-gray-600 focus:outline-none focus:ring-0 cursor-pointer pr-8"
              >
                <option value="all">All Actions</option>
                <option value="verification_approved">Verification Approved</option>
                <option value="verification_rejected">Verification Rejected</option>
                <option value="user_restricted">User Restricted</option>
                <option value="user_suspended">User Suspended</option>
                <option value="user_banned">User Banned</option>
                <option value="user_unrestricted">User Unrestricted</option>
                <option value="transaction_completed">Transaction Completed</option>
                <option value="transaction_failed">Transaction Failed</option>
                <option value="support_closed">Support Closed</option>
                <option value="support_reopened">Support Reopened</option>
                <option value="admin_login">Admin Login</option>
                <option value="job_hidden">Job Hidden</option>
                <option value="job_unhidden">Job Restored</option>
                <option value="job_deleted">Job Deleted</option>
                <option value="job_restored">Job Restored</option>
              </select>
            </div>

            {/* Mobile-only Limit */}
            <div className="flex md:hidden items-center gap-1.5">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
              <select 
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="hidden md:flex items-center gap-2 md:order-3 shrink-0">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
              <select 
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full border-4 border-gray-100 border-t-blue-600 animate-spin" />
                <ActivityIcon className="absolute inset-0 m-auto h-6 w-6 text-blue-600 animate-pulse" />
              </div>
              <div className="flex flex-col items-center italic">
                <p className="text-sm font-black text-gray-900 tracking-widest uppercase">Loading Activity Logs</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Fetching System Events</p>
              </div>
            </div>
          ) : filteredActivities.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <ActivityIcon className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No activity logs found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white">
                <table className="min-w-full">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-10 border-b-2 border-gray-300">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Admin</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Target</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white border-b border-gray-300">
                    {paginatedActivities.map((activity: ActivityLog) => (
                      <tr
                        key={activity._id}
                        ref={(el) => {
                          activityRefs.current[activity._id] = el as HTMLTableRowElement;
                          // Scroll immediately when the highlighted element is rendered
                          const activityId = searchParams.get('id');
                          if (el && activityId === activity._id && highlightedActivityId === activityId) {
                            console.log('Element rendered, scrolling immediately');
                            setTimeout(() => {
                              el.scrollIntoView({
                                behavior: 'smooth',
                                block: 'center',
                                inline: 'nearest'
                              });
                            }, 100);
                          }
                        }}
                        onClick={() => handleActivityClick(activity)}
                        className={`transition-all duration-200 ${(activity.targetId && activity.targetType) ||
                          ((activity.actionType === 'transaction_completed' || activity.actionType === 'transaction_failed') && activity.description.match(/[a-f\d]{24}/i))
                          ? 'hover:bg-gray-100 cursor-pointer'
                          : 'hover:bg-gray-50'
                        } ${highlightedActivityId === activity._id
                            ? 'bg-yellow-100 ring-2 ring-yellow-400'
                            : ''
                          }`}
                      >
                        <td className="px-6 py-2.5 whitespace-nowrap border-b border-gray-300">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
                              <span className="text-sm font-bold text-blue-600 uppercase">
                                {activity.adminId?.name ? getInitials(activity.adminId.name) : 'N/A'}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-bold text-gray-900 truncate">{activity.adminId?.name || 'Unknown Admin'}</div>
                                {activity.adminId?.userType === 'superadmin' && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 border border-purple-100 shadow-sm shadow-purple-50/50">
                                    Super Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{activity.adminId?.email || 'No email'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-current shadow-sm ${ACTION_COLORS[activity.actionType] || 'bg-gray-50 text-gray-700 border-gray-200'
                            }`}>
                            {ACTION_ICONS[activity.actionType] || <ActivityIcon className="h-4 w-4" />}
                            {ACTION_LABELS[activity.actionType] || activity.actionType}
                          </span>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-300">
                          <div className="text-sm text-gray-900 max-w-[300px]">{formatDescriptionWithDuration(activity)}</div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-300">
                          {(() => {
                            const isTransactionAction = activity.actionType === 'transaction_completed' || activity.actionType === 'transaction_failed';
                            const hasInferredId = activity.description.match(/[a-f\d]{24}/i);
                            const showTransactionTarget = isTransactionAction && hasInferredId && !activity.targetId;

                            if (activity.targetId || showTransactionTarget) {
                              return (
                                <div className="text-sm">
                                  <div className="font-medium text-gray-900 truncate max-w-[200px] flex items-center gap-2">
                                    {typeof activity.targetId === 'object' && activity.targetId !== null ? (
                                      activity.targetId.name ||
                                      activity.targetId.title ||
                                      activity.targetId.subject ||
                                      activity.targetId.description ||
                                      ((activity.targetType === 'transaction' || isTransactionAction) ? 'Transaction' : 'Target')
                                    ) : (
                                      (activity.targetType === 'transaction' || showTransactionTarget || isTransactionAction) ? 'Transaction' : 'N/A'
                                    )}
                                    {(activity.targetType || showTransactionTarget || isTransactionAction) && (
                                      <MousePointerClick className="h-3 w-3 text-blue-600" />
                                    )}
                                  </div>
                                  {activity.targetId?.email && (
                                    <div className="text-xs text-gray-500 truncate max-w-[200px]">{activity.targetId.email}</div>
                                  )}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap border-b border-gray-300">
                          <div className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(activity.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden px-4 py-4 space-y-3">
                {paginatedActivities.map((activity: ActivityLog) => (
                  <div
                    key={activity._id}
                    ref={(el) => {
                      activityRefs.current[activity._id] = el;
                      // Scroll immediately when the highlighted element is rendered
                      const activityId = searchParams.get('id');
                      if (el && activityId === activity._id && highlightedActivityId === activityId) {
                        console.log('Mobile element rendered, scrolling immediately');
                        setTimeout(() => {
                          el.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'nearest'
                          });
                        }, 100);
                      }
                    }}
                    onClick={() => handleActivityClick(activity)}
                    className={`relative bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-all p-4 ${activity.targetId && activity.targetType
                      ? 'cursor-pointer'
                      : ''
                      } ${highlightedActivityId === activity._id
                        ? 'ring-2 ring-yellow-400 bg-yellow-50'
                        : ''
                      }`}
                  >
                    {activity.adminId?.userType === 'superadmin' && (
                      <span className="absolute top-4 right-4 inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 border border-purple-100 shadow-sm shadow-purple-50/50">
                        Super Admin
                      </span>
                    )}

                    <div className="flex items-center gap-3 mb-3 pr-20"> {/* Added padding for absolute badge */}
                      <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-gray-100 shadow-sm">
                        <span className="text-base font-bold text-blue-600 uppercase">
                          {activity.adminId?.name ? getInitials(activity.adminId.name) : 'N/A'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-gray-900 truncate">{activity.adminId?.name || 'Unknown Admin'}</h3>
                        </div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">{activity.adminId?.email || 'No email'}</p>
                      </div>
                    </div>

                    {(() => {
                      const isTransactionAction = activity.actionType === 'transaction_completed' || activity.actionType === 'transaction_failed';
                      const hasInferredId = activity.description.match(/[a-f\d]{24}/i);
                      const showTransactionTarget = isTransactionAction && hasInferredId && !activity.targetId;

                      return (
                        <>
                          <div className="mb-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-current shadow-sm ${ACTION_COLORS[activity.actionType] || 'bg-gray-50 text-gray-700 border-gray-200'
                              }`}>
                              {ACTION_ICONS[activity.actionType] || <ActivityIcon className="h-4 w-4" />}
                              {ACTION_LABELS[activity.actionType] || activity.actionType}
                            </span>
                          </div>

                          <p className="text-sm text-gray-900 mb-3">{formatDescriptionWithDuration(activity)}</p>

                          {(activity.targetId || showTransactionTarget) && (
                            <div className="mb-3 pb-3 border-b border-gray-100">
                              <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest mb-1">Target</p>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-2 flex-1">
                                  {typeof activity.targetId === 'object' && activity.targetId !== null ? (
                                    activity.targetId.name ||
                                    activity.targetId.title ||
                                    activity.targetId.subject ||
                                    activity.targetId.description ||
                                    ((activity.targetType === 'transaction' || isTransactionAction) ? 'Transaction' : 'Target')
                                  ) : (
                                    (activity.targetType === 'transaction' || showTransactionTarget || isTransactionAction) ? 'Transaction' : 'N/A'
                                  )}
                                  {(activity.targetType || showTransactionTarget || isTransactionAction) && (
                                    <MousePointerClick className="h-3 w-3 text-blue-600" />
                                  )}
                                </p>
                              </div>
                              {activity.targetId?.email && (
                                <p className="text-xs text-gray-500 truncate">{activity.targetId.email}</p>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}</span>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="sticky bottom-0 flex bg-white border-t border-gray-200 shadow-lg z-10 p-4">
                  <div className="flex items-center justify-between w-full">
                    <div>
                      <p className="text-xs md:text-sm text-gray-700 text-center md:text-left">
                        Showing{' '}
                        <span className="font-medium">
                          {((pagination.page - 1) * pagination.limit) + 1}
                        </span>{' '}
                        to{' '}
                        <span className="font-medium">
                          {Math.min(pagination.page * pagination.limit, filteredActivities.length)}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium">{filteredActivities.length}</span> results
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                        disabled={pagination.page === 1}
                        className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                        disabled={pagination.page === totalPages}
                        className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <UserDetailsModal
        isOpen={userModalOpen}
        onClose={() => {
          setUserModalOpen(false);
          setTimeout(() => setSelectedUser(null), 300);
        }}
        user={selectedUser}
        onVerify={async (userId: string, verified: boolean) => {
          try {
            await usersService.verifyUser(userId, verified);
            toast.success(`User ${verified ? 'verified' : 'unverified'} successfully`);
            await refetch();
          } catch (error) {
            toast.error('Failed to update verification');
          }
        }}
        onAction={async (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict' | 'delete', duration?: number) => {
          try {
            switch (actionType) {
              case 'ban':
                await usersService.banUser(user._id, 'Banned by admin', duration);
                break;
              case 'suspend':
                await usersService.suspendUser(user._id, 'Suspended by admin', duration || 7);
                break;
              case 'restrict':
                await usersService.restrictUser(user._id, duration);
                break;
              case 'unrestrict':
                await usersService.unrestrictUser(user._id);
                break;
            }
            toast.success(`User ${actionType}ed successfully`);
            await refetch();
          } catch (error) {
            toast.error(`Failed to ${actionType} user`);
          }
        }}
      />

      <TransactionDetailsModal
        isOpen={transactionModalOpen}
        onClose={() => {
          setTransactionModalOpen(false);
          setTimeout(() => setSelectedTransaction(null), 300);
        }}
        transaction={selectedTransaction}
      />
    </div>
  );
};

export default Activity;
