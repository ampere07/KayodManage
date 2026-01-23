import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, 
  UserCheck, 
  UserX, 
  Eye, 
  AlertCircle, 
  Ban, 
  Clock, 
  Shield,
  Mail,
  MapPin,
  Wallet as WalletIcon,
  Calendar,
  Briefcase,
  User as UserIcon,
  Phone,
  CheckCircle,
  XCircle,
  Users as UsersIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { UserDetailsModal } from '../components/Modals';
import { useUsers, useUserCounts, useStatusCounts, useFlaggedUserCounts, useUserMutations } from '../hooks/useUsers';
import UserTypeBadge from '../components/UI/UserTypeBadge';
import VerificationStatusBadge from '../components/UI/VerificationStatusBadge';
import type { User, UserStats } from '../types';

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

const Users: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified' | 'suspended' | 'restricted' | 'banned'>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsModal, setDetailsModal] = useState({ isOpen: false });
  const [flaggedUserTypeFilter, setFlaggedUserTypeFilter] = useState<'all' | 'client' | 'provider'>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  
  const getUserType = () => {
    const path = location.pathname;
    if (path === '/users/customers') return 'customers';
    if (path === '/users/providers') return 'providers';
    if (path === '/users/flagged') return 'flagged';
    return 'all';
  };
  
  const getPageTitle = () => {
    const type = getUserType();
    if (type === 'customers') return 'Customers';
    if (type === 'providers') return 'Service Providers';
    if (type === 'flagged') return 'Flagged & Suspended Users';
    return 'All Users';
  };
  
  const getPageDescription = () => {
    const type = getUserType();
    if (type === 'customers') return 'Manage customer accounts and their service requests';
    if (type === 'providers') return 'Manage service providers and their verification status';
    if (type === 'flagged') return 'Review and manage restricted, suspended, and banned user accounts';
    return 'Manage and monitor all user accounts, including customers and service providers';
  };

  const userType = getUserType();

  const queryParams = useMemo(() => {
    const params: any = {
      page: pagination.page,
      limit: pagination.limit,
      ...(searchTerm && { search: searchTerm })
    };

    if (userType === 'customers') params.userType = 'client';
    if (userType === 'providers') params.userType = 'provider';
    if (userType === 'flagged') {
      params.restricted = 'true';
      if (flaggedUserTypeFilter !== 'all') {
        params.userType = flaggedUserTypeFilter;
      }
    }

    if (statusFilter === 'verified') params.isVerified = 'true';
    if (statusFilter === 'unverified') params.isVerified = 'false';
    if (statusFilter === 'suspended') params.status = 'suspended';
    if (statusFilter === 'restricted') params.status = 'restricted';
    if (statusFilter === 'banned') params.status = 'banned';

    return params;
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, flaggedUserTypeFilter, userType]);

  const statusCountsParams = useMemo(() => {
    const baseParams: any = {};
    
    if (userType === 'customers') baseParams.userType = 'client';
    if (userType === 'providers') baseParams.userType = 'provider';
    if (userType === 'flagged') baseParams.restricted = 'true';

    return baseParams;
  }, [userType]);

  const userCountsParams = useMemo(() => {
    const baseParams: any = {};
    
    if (userType === 'customers') {
      baseParams.userType = 'client';
    } else if (userType === 'providers') {
      baseParams.userType = 'provider';
    }

    return baseParams;
  }, [userType]);

  const { data: usersData, isLoading: usersLoading, isFetching } = useUsers(queryParams);
  const { data: userTypeCounts = { total: 0, customers: 0, providers: 0, suspended: 0, restricted: 0, banned: 0, verified: 0, unverified: 0 } } = useUserCounts(userCountsParams);
  const { data: statusCounts = { all: 0, verified: 0, unverified: 0 } } = useStatusCounts(statusCountsParams);
  const { data: flaggedUserCounts = { total: 0, customers: 0, providers: 0 } } = useFlaggedUserCounts();
  const mutations = useUserMutations();

  const users = usersData?.users || [];
  const loading = usersLoading;
  
  useEffect(() => {
    if (usersData?.pagination) {
      setPagination(prev => ({
        ...prev,
        total: usersData.pagination.total || 0,
        pages: usersData.pagination.pages || 1
      }));
    }
  }, [usersData]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm, statusFilter, flaggedUserTypeFilter]);

  useEffect(() => {
    setStatusFilter('all');
    setFlaggedUserTypeFilter('all');
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [location.pathname]);
  
  const isUserRestricted = (user: User) => {
    if (user.accountStatus) return user.accountStatus !== 'active';
    return user.isRestricted;
  };

  const getOverdueFees = (fees: User['fees']) => {
    if (!fees || !Array.isArray(fees)) return [];
    return fees.filter(fee => !fee.isPaid && new Date(fee.dueDate) < new Date());
  };

  const formatCurrency = (amount: number, currency: string = 'PHP') => {
    if (currency === 'PHP') {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 0,
      }).format(amount).replace('PHP', '₱');
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const handleUserAction = async (actionType: string, duration?: number, reason?: string) => {
    if (!selectedUser) return;
    
    try {
      switch (actionType) {
        case 'ban':
          await mutations.banUser.mutateAsync({ userId: selectedUser._id, reason: reason || 'Banned by admin', duration });
          break;
        case 'suspend':
          await mutations.suspendUser.mutateAsync({ userId: selectedUser._id, reason: reason || 'Suspended by admin', duration: duration || 7 });
          break;
        case 'restrict':
          await mutations.restrictUser.mutateAsync({ userId: selectedUser._id, duration, reason: reason || 'Restricted by admin' });
          break;
        case 'unrestrict':
          await mutations.unrestrictUser.mutateAsync(selectedUser._id);
          break;
        default:
          return;
      }
      setSelectedUser(null);
    } catch (error) {
      console.error(`Error ${actionType}ing user:`, error);
    }
  };

  const toggleUserVerification = async (userId: string, isVerified: boolean) => {
    try {
      await mutations.verifyUser.mutateAsync({ userId, isVerified: !isVerified });
      setSelectedUser(null);
    } catch (error) {
      console.error('Error updating verification:', error);
    }
  };

  const openDetailsModal = (user: User) => {
    setSelectedUser(user);
    setDetailsModal({ isOpen: true });
  };

  const closeDetailsModal = () => {
    setDetailsModal({ isOpen: false });
    setTimeout(() => setSelectedUser(null), 300);
  };

  const handleAction = async (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict', duration?: number, reason?: string) => {
    setSelectedUser(user);
    await handleUserAction(actionType, duration, reason);
  };

  const handleCounterClick = (type: 'all' | 'customers' | 'providers' | 'suspended' | 'restricted' | 'banned') => {
    if (type === 'all') {
      navigate('/users');
    } else if (type === 'customers') {
      navigate('/users/customers');
    } else if (type === 'providers') {
      navigate('/users/providers');
    } else {
      setStatusFilter(type);
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  };

  return (
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {getPageDescription()}
            </p>
          </div>
        </div>

        {getUserType() === 'all' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4">
            <div 
              onClick={() => handleCounterClick('all')}
              className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border-2 border-blue-600 ring-2 ring-blue-400 shadow-lg cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-600">Total Users</span>
                <UsersIcon className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-blue-900">{userTypeCounts.total.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => handleCounterClick('customers')}
              className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-purple-600">Customers</span>
                <UserIcon className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-purple-900">{userTypeCounts.customers.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => handleCounterClick('providers')}
              className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-indigo-600">Providers</span>
                <Briefcase className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-indigo-900">{userTypeCounts.providers.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('suspended')}
              className={`bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'suspended' ? 'border-2 border-yellow-600 ring-2 ring-yellow-400 shadow-lg' : 'border border-yellow-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-yellow-600">Suspended</span>
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-yellow-900">{userTypeCounts.suspended.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('restricted')}
              className={`bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'restricted' ? 'border-2 border-orange-600 ring-2 ring-orange-400 shadow-lg' : 'border border-orange-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-orange-600">Restricted</span>
                <Shield className="h-4 w-4 text-orange-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-orange-900">{userTypeCounts.restricted.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('banned')}
              className={`bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'banned' ? 'border-2 border-red-600 ring-2 ring-red-400 shadow-lg' : 'border border-red-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-red-600">Banned</span>
                <Ban className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-red-900">{userTypeCounts.banned.toLocaleString()}</p>
            </div>
          </div>
        )}

        {getUserType() === 'customers' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4">
            <div 
              onClick={() => navigate('/users')}
              className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-600">Total Users</span>
                <UsersIcon className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-blue-900">{userTypeCounts.total.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => navigate('/users/customers')}
              className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border-2 border-purple-600 ring-2 ring-purple-400 shadow-lg cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-purple-600">Customers</span>
                <UserIcon className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-purple-900">{userTypeCounts.customers.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => navigate('/users/providers')}
              className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border border-indigo-200 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-indigo-600">Providers</span>
                <Briefcase className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-indigo-900">{userTypeCounts.providers.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('suspended')}
              className={`bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'suspended' ? 'border-2 border-yellow-600 ring-2 ring-yellow-400 shadow-lg' : 'border border-yellow-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-yellow-600">Suspended</span>
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-yellow-900">{userTypeCounts.suspended.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('restricted')}
              className={`bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'restricted' ? 'border-2 border-orange-600 ring-2 ring-orange-400 shadow-lg' : 'border border-orange-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-orange-600">Restricted</span>
                <Shield className="h-4 w-4 text-orange-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-orange-900">{userTypeCounts.restricted.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('banned')}
              className={`bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'banned' ? 'border-2 border-red-600 ring-2 ring-red-400 shadow-lg' : 'border border-red-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-red-600">Banned</span>
                <Ban className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-red-900">{userTypeCounts.banned.toLocaleString()}</p>
            </div>
          </div>
        )}

        {getUserType() === 'flagged' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4">
            <div 
              onClick={() => setFlaggedUserTypeFilter('all')}
              className={`bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                flaggedUserTypeFilter === 'all' ? 'border-2 border-red-600 ring-2 ring-red-400 shadow-lg' : 'border border-red-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-red-600">Total Flagged</span>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-red-900">{flaggedUserCounts.total.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setFlaggedUserTypeFilter('client')}
              className={`bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                flaggedUserTypeFilter === 'client' ? 'border-2 border-purple-600 ring-2 ring-purple-400 shadow-lg' : 'border border-purple-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-purple-600">Customers</span>
                <UserIcon className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-purple-900">{flaggedUserCounts.customers.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setFlaggedUserTypeFilter('provider')}
              className={`bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                flaggedUserTypeFilter === 'provider' ? 'border-2 border-blue-600 ring-2 ring-blue-400 shadow-lg' : 'border border-blue-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-600">Providers</span>
                <Briefcase className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-blue-900">{flaggedUserCounts.providers.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('suspended')}
              className={`bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'suspended' ? 'border-2 border-yellow-600 ring-2 ring-yellow-400 shadow-lg' : 'border border-yellow-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-yellow-600">Suspended</span>
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-yellow-900">{userTypeCounts.suspended.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('restricted')}
              className={`bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'restricted' ? 'border-2 border-orange-600 ring-2 ring-orange-400 shadow-lg' : 'border border-orange-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-orange-600">Restricted</span>
                <Shield className="h-4 w-4 text-orange-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-orange-900">{userTypeCounts.restricted.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('banned')}
              className={`bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'banned' ? 'border-2 border-red-600 ring-2 ring-red-400 shadow-lg' : 'border border-red-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-red-600">Banned</span>
                <Ban className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-red-900">{userTypeCounts.banned.toLocaleString()}</p>
            </div>
          </div>
        )}

        {getUserType() === 'providers' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 mb-4">
            <div 
              onClick={() => navigate('/users')}
              className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-600">Total Users</span>
                <UsersIcon className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-blue-900">{userTypeCounts.total.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => navigate('/users/customers')}
              className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-3 border border-purple-200 cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-purple-600">Customers</span>
                <UserIcon className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-purple-900">{userTypeCounts.customers.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => navigate('/users/providers')}
              className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-3 border-2 border-indigo-600 ring-2 ring-indigo-400 shadow-lg cursor-pointer hover:shadow-lg transition-all"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-indigo-600">Providers</span>
                <Briefcase className="h-4 w-4 text-indigo-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-indigo-900">{userTypeCounts.providers.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('suspended')}
              className={`bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'suspended' ? 'border-2 border-yellow-600 ring-2 ring-yellow-400 shadow-lg' : 'border border-yellow-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-yellow-600">Suspended</span>
                <Clock className="h-4 w-4 text-yellow-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-yellow-900">{userTypeCounts.suspended.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('restricted')}
              className={`bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'restricted' ? 'border-2 border-orange-600 ring-2 ring-orange-400 shadow-lg' : 'border border-orange-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-orange-600">Restricted</span>
                <Shield className="h-4 w-4 text-orange-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-orange-900">{userTypeCounts.restricted.toLocaleString()}</p>
            </div>

            <div 
              onClick={() => setStatusFilter('banned')}
              className={`bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-3 border cursor-pointer hover:shadow-lg transition-all ${
                statusFilter === 'banned' ? 'border-red-500 ring-2 ring-red-400 shadow-lg' : 'border-red-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-red-600">Banned</span>
                <Ban className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-xl sm:text-2xl font-bold text-red-900">{userTypeCounts.banned.toLocaleString()}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          
          <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
            {[
              { key: 'all', label: 'All', count: statusCounts.all },
              { key: 'verified', label: 'Verified', count: statusCounts.verified },
              { key: 'unverified', label: 'Unverified', count: statusCounts.unverified }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as typeof statusFilter)}
                className={`px-3 py-1 text-sm rounded-md font-medium transition-colors whitespace-nowrap ${
                  statusFilter === tab.key
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading users...</p>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No users found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">
                        User
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[180px]">
                        Contact
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                        Type
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[130px]">
                        Status
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[120px]">
                        Wallet
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[150px]">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => {
                      const overdueFees = getOverdueFees(user.fees);
                      const totalOverdue = overdueFees.reduce((sum, fee) => sum + fee.amount, 0);
                      const isRestricted = isUserRestricted(user);
                      
                      return (
                        <tr 
                          key={user._id} 
                          onClick={() => openDetailsModal(user)}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="relative flex-shrink-0 mr-3">
                                {user.profileImage ? (
                                  <img
                                    src={user.profileImage}
                                    alt={user.name}
                                    className="w-10 h-10 rounded-full object-cover"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                                    <span className="text-sm font-semibold text-gray-700">
                                      {getInitials(user.name)}
                                    </span>
                                  </div>
                                )}
                                {user.isOnline && (
                                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">{user.name}</div>
                                <div className="text-xs text-gray-500 truncate">{user.location || 'No location'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <div className="text-xs text-gray-900 flex items-center gap-1">
                              <Mail className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className="truncate max-w-[150px] lg:max-w-[200px]">{user.email}</span>
                            </div>
                            {user.phone && (
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Phone className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{user.phone}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 lg:px-6 py-4 text-center">
                            {user.userType && (
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                user.userType === 'provider'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                              }`}>
                                {user.userType === 'provider' ? (
                                  <Briefcase className="h-3 w-3" />
                                ) : (
                                  <UserIcon className="h-3 w-3" />
                                )}
                                {user.userType === 'provider' ? 'Provider' : 'Customer'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 lg:px-6 py-4">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                                user.isVerified 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-yellow-100 text-yellow-700'
                              }`}>
                                {user.isVerified ? (
                                  <>
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verified
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Unverified
                                  </>
                                )}
                              </span>
                              {isRestricted && (
                                <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap">
                                  Restricted
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">
                              {formatCurrency(user.wallet.balance, user.wallet.currency)}
                            </div>
                            {overdueFees.length > 0 && (
                              <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                                <span>{formatCurrency(totalOverdue, 'PHP')}</span>
                              </div>
                            )}
                          </td>
                          <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                            <div className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                              <Calendar className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden px-4 py-4 space-y-3">
                {users.map((user) => {
                  const overdueFees = getOverdueFees(user.fees);
                  const totalOverdue = overdueFees.reduce((sum, fee) => sum + fee.amount, 0);
                  const isRestricted = isUserRestricted(user);
                  
                  return (
                    <div 
                      key={user._id} 
                      onClick={() => openDetailsModal(user)}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              {user.profileImage ? (
                                <img
                                  src={user.profileImage}
                                  alt={user.name}
                                  className="w-12 h-12 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center">
                                  <span className="text-base font-semibold text-gray-700">
                                    {getInitials(user.name)}
                                  </span>
                                </div>
                              )}
                              {user.isOnline && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-gray-900 truncate">{user.name}</h3>
                              <p className="text-xs text-gray-500 truncate">{user.email}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${
                            user.isVerified 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {user.isVerified ? '✓ Verified' : 'Unverified'}
                          </span>
                          {user.userType && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
                              user.userType === 'provider'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}>
                              {user.userType === 'provider' ? (
                                <Briefcase className="h-3 w-3" />
                              ) : (
                                <UserIcon className="h-3 w-3" />
                              )}
                              {user.userType === 'provider' ? 'Provider' : 'Customer'}
                            </span>
                          )}
                          {isRestricted && (
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                              Restricted
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <WalletIcon className="h-3 w-3" />
                              Balance
                            </span>
                            <span className="text-sm font-bold text-gray-900">
                              {formatCurrency(user.wallet.balance, user.wallet.currency)}
                            </span>
                          </div>
                          {overdueFees.length > 0 && (
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Overdue
                              </span>
                              <span className="text-sm font-bold text-red-600">
                                {formatCurrency(totalOverdue, 'PHP')}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {pagination.pages > 1 && (
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
                          {Math.min(pagination.page * pagination.limit, pagination.total)}
                        </span>{' '}
                        of{' '}
                        <span className="font-medium">{pagination.total}</span> results
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
                        onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                        disabled={pagination.page === pagination.pages}
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
        isOpen={detailsModal.isOpen}
        onClose={closeDetailsModal}
        user={selectedUser}
        onVerify={toggleUserVerification}
        onAction={handleAction}
      />
    </div>
  );
};

export default Users;
