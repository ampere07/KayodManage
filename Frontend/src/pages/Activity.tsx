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
  Briefcase
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { usersService, transactionsService } from '../services';
import { UserDetailsModal, TransactionDetailsModal } from '../components/Modals';
import { getInitials } from '../utils';
import { useActivityLogs } from '../hooks';
import { useSocket } from '../context/SocketContext';
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
    if (!activity.targetId || !activity.targetType) return;

    try {
      switch (activity.targetType) {
        case 'user':
          const user = await usersService.getUserById(activity.targetId._id);
          if (user) {
            setSelectedUser(user);
            setUserModalOpen(true);
          }
          break;

        case 'transaction':
          const transactionResponse = await transactionsService.getTransactionById(activity.targetId._id);
          if (transactionResponse?.transaction) {
            setSelectedTransaction(transactionResponse.transaction);
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
    return activities.filter(activity => {
      const matchesSearch =
        activity.adminId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        activity.adminId.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (activity.targetId?.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (activity.targetId?.email?.toLowerCase().includes(searchTerm.toLowerCase()));

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
  const userActivityLogs = activities.filter(activity => USER_ACTIONS.includes(activity.actionType)).length;
  const systemActivityLogs = activities.filter(activity => SYSTEM_ACTIONS.includes(activity.actionType)).length;

  // Handle activity ID from URL parameter
  useEffect(() => {
    const activityId = searchParams.get('id');
    if (activityId && activities.length > 0 && !highlightedActivityId) {
      console.log('Processing activity ID from URL:', activityId);
      // Find the activity
      const activity = activities.find(a => a._id === activityId);
      if (activity) {
        console.log('Activity found:', activity);
        // Set as highlighted
        setHighlightedActivityId(activityId);

        // Find which page this activity is on
        const activityIndex = filteredActivities.findIndex(a => a._id === activityId);
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
            const activity = activities.find(a => a._id === activityId);
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
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50 mt-16 md:mt-0">
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">Activity Logs</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Track and monitor all administrative actions and system events across the platform
            </p>
          </div>
        </div>

        {/* Mobile: Compact Grid */}
        <div className="grid grid-cols-2 gap-2 md:hidden mb-4">
          <div
            onClick={() => setTypeFilter('all')}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-blue-50 border-blue-200 ${typeFilter === 'all' ? 'border-blue-400 ring-2 ring-blue-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Total</span>
            </div>
            <span className="text-sm font-bold text-blue-700">{totalActivityLogs}</span>
          </div>

          <div
            onClick={() => setTypeFilter('user')}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-purple-50 border-purple-200 ${typeFilter === 'user' ? 'border-purple-400 ring-2 ring-purple-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">User</span>
            </div>
            <span className="text-sm font-bold text-purple-700">{userActivityLogs}</span>
          </div>

          <div
            onClick={() => setTypeFilter('job')}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-orange-50 border-orange-200 ${typeFilter === 'job' ? 'border-orange-400 ring-2 ring-orange-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-orange-600" />
              <span className="text-sm font-medium text-gray-700">Job</span>
            </div>
            <span className="text-sm font-bold text-orange-700">{activities.filter((activity: ActivityLog) => JOB_ACTIONS.includes(activity.actionType)).length}</span>
          </div>

          <div
            onClick={() => setTypeFilter('system')}
            className={`rounded-lg p-2.5 border cursor-pointer transition-all flex items-center justify-between bg-green-50 border-green-200 ${typeFilter === 'system' ? 'border-green-400 ring-2 ring-green-300' : ''
              }`}
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-gray-700">System</span>
            </div>
            <span className="text-sm font-bold text-green-700">{systemActivityLogs}</span>
          </div>
        </div>

        {/* Desktop: Full Grid */}
        <div className="hidden md:grid grid-cols-4 gap-3 mb-4">
          <div
            onClick={() => setTypeFilter('all')}
            className={`bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${typeFilter === 'all' ? 'border-blue-500 ring-2 ring-blue-400 shadow-lg' : 'border-blue-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">Total Activity Logs</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{totalActivityLogs}</p>
          </div>

          <div
            onClick={() => setTypeFilter('user')}
            className={`bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${typeFilter === 'user' ? 'border-purple-500 ring-2 ring-purple-400 shadow-lg' : 'border-purple-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">User Actions</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{userActivityLogs}</p>
          </div>

          <div
            onClick={() => setTypeFilter('job')}
            className={`bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${typeFilter === 'job' ? 'border-orange-500 ring-2 ring-orange-400 shadow-lg' : 'border-orange-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">Job Actions</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{activities.filter((activity: ActivityLog) => JOB_ACTIONS.includes(activity.actionType)).length}</p>
          </div>

          <div
            onClick={() => setTypeFilter('system')}
            className={`bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${typeFilter === 'system' ? 'border-green-500 ring-2 ring-green-400 shadow-lg' : 'border-green-200'
              }`}
          >
            <p className="text-xs text-gray-600 font-medium mb-1">System Actions</p>
            <p className="text-xl md:text-2xl font-bold text-gray-900">{systemActivityLogs}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search by admin, description, or target..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
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
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading activity logs...</p>
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
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Admin</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Target</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedActivities.map((activity) => (
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
                        className={`transition-all duration-200 ${activity.targetId && activity.targetType
                          ? 'hover:bg-gray-100 cursor-pointer'
                          : 'hover:bg-gray-50'
                          } ${highlightedActivityId === activity._id
                            ? 'bg-yellow-100 ring-2 ring-yellow-400'
                            : ''
                          }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-semibold text-gray-700">
                                {getInitials(activity.adminId.name)}
                              </span>
                            </div>
                            <div className="ml-3">
                              <div className="flex items-center gap-2">
                                <div className="text-sm font-semibold text-gray-900">{activity.adminId.name}</div>
                                {activity.adminId.userType === 'superadmin' && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                                    Super Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 truncate max-w-[150px]">{activity.adminId.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${ACTION_COLORS[activity.actionType] || 'bg-gray-100 text-gray-700'
                            }`}>
                            {ACTION_ICONS[activity.actionType] || <ActivityIcon className="h-4 w-4" />}
                            {ACTION_LABELS[activity.actionType] || activity.actionType}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-[300px]">{formatDescriptionWithDuration(activity)}</div>
                        </td>
                        <td className="px-6 py-4">
                          {activity.targetId && (
                            <div className="text-sm">
                              <div className="font-medium text-gray-900 truncate max-w-[200px] flex items-center gap-2">
                                {activity.targetId.name || activity.targetId.title || activity.targetId.subject || 'N/A'}
                                {activity.targetType && (
                                  <MousePointerClick className="h-3 w-3 text-blue-600" />
                                )}
                              </div>
                              {activity.targetId.email && (
                                <div className="text-xs text-gray-500 truncate max-w-[200px]">{activity.targetId.email}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
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
                {paginatedActivities.map((activity) => (
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
                    className={`relative bg-white rounded-lg border border-gray-200 p-4 transition-all duration-200 ${activity.targetId && activity.targetType
                      ? 'hover:bg-gray-100 cursor-pointer'
                      : 'hover:bg-gray-50'
                      } ${highlightedActivityId === activity._id
                        ? 'bg-yellow-100 ring-2 ring-yellow-400'
                        : ''
                      }`}
                  >
                    {activity.adminId.userType === 'superadmin' && (
                      <span className="absolute top-4 right-4 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-700">
                        Super Admin
                      </span>
                    )}

                    <div className="flex items-center gap-3 mb-3 pr-20"> {/* Added padding for absolute badge */}
                      <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                        <span className="text-base font-semibold text-gray-700">
                          {getInitials(activity.adminId.name)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 truncate">{activity.adminId.name}</h3>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{activity.adminId.email}</p>
                      </div>
                    </div>

                    {!activity.targetId && (
                      <div className="mb-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${ACTION_COLORS[activity.actionType] || 'bg-gray-100 text-gray-700'
                          }`}>
                          {ACTION_ICONS[activity.actionType] || <ActivityIcon className="h-4 w-4" />}
                          {ACTION_LABELS[activity.actionType] || activity.actionType}
                        </span>
                      </div>
                    )}

                    <p className="text-sm text-gray-900 mb-3">{formatDescriptionWithDuration(activity)}</p>

                    {activity.targetId && (
                      <div className="mb-3 pb-3 border-b border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">Target:</p>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900 truncate flex items-center gap-2 flex-1">
                            {activity.targetId.name || activity.targetId.title || activity.targetId.subject || 'N/A'}
                            {activity.targetType && (
                              <MousePointerClick className="h-3 w-3 text-blue-600" />
                            )}
                          </p>
                          <span className={`flex-shrink-0 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${ACTION_COLORS[activity.actionType] || 'bg-gray-100 text-gray-700'
                            }`}>
                            {ACTION_ICONS[activity.actionType] || <ActivityIcon className="h-3 w-3" />}
                            {ACTION_LABELS[activity.actionType] || activity.actionType}
                          </span>
                        </div>
                        {activity.targetId.email && (
                          <p className="text-xs text-gray-500 truncate">{activity.targetId.email}</p>
                        )}
                      </div>
                    )}

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
        onAction={async (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict', duration?: number) => {
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
