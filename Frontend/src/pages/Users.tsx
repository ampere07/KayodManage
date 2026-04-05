import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search,
  Briefcase,
  User as UserIcon,
  CheckCircle,
  XCircle,
  Users as UsersIcon,
  RefreshCw,
  ChevronRight,
  Shield,
  Clock,
  Ban,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { UserDetailsModal } from '../components/Modals';
import { settingsService } from '../services/settingsService';
import { useQuery } from '@tanstack/react-query';
import { resolveIconForProfession } from '../utils/professionUtils';
import { useUsers, useUserCounts, useStatusCounts, useFlaggedUserCounts, useDeletedUserCounts, useUserMutations } from '../hooks/useUsers';
import StatsCard from '../components/Dashboard/StatsCard';
import type { User } from '../types';

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

const Users: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'unverified' | 'suspended' | 'restricted' | 'banned' | 'deleted'>('all');
  const [professionFilter, setProfessionFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsModal, setDetailsModal] = useState({ isOpen: false });
  const [userSubTypeFilter, setUserSubTypeFilter] = useState<'all' | 'client' | 'provider'>('all');
  const [professionsList, setProfessionsList] = useState<string[]>([]);
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
    if (path === '/users/deleted') return 'deleted';
    return 'all';
  };

  const getPageTitle = () => {
    const type = getUserType();
    if (type === 'customers') return 'Customers';
    if (type === 'providers') return 'Service Providers';
    if (type === 'flagged') return 'Flagged & Suspended Users';
    if (type === 'deleted') return 'Deleted Accounts';
    return 'Users Management';
  };

  const getPageDescription = () => {
    const type = getUserType();
    if (type === 'customers') return 'Manage customer accounts and their service requests';
    if (type === 'providers') return 'Manage service providers and their verification status';
    if (type === 'flagged') return 'Review and manage restricted, suspended, and banned user accounts';
    if (type === 'deleted') return 'View and manage soft deleted user accounts';
    return 'Monitor and manage all user accounts across the platform';
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
      params.accountStatus = 'restricted,suspended,banned';
      if (userSubTypeFilter !== 'all') {
        params.userType = userSubTypeFilter;
      }
    }
    if (userType === 'deleted') {
      params.accountStatus = 'deleted';
      if (userSubTypeFilter !== 'all') {
        params.userType = userSubTypeFilter === 'client' ? 'client' : 'provider';
      }
    }

    if (statusFilter === 'verified') params.isVerified = 'true';
    if (statusFilter === 'unverified') params.isVerified = 'false';
    if (statusFilter === 'suspended') params.accountStatus = 'suspended';
    if (statusFilter === 'restricted') params.accountStatus = 'restricted';
    if (statusFilter === 'banned') params.accountStatus = 'banned';
    if (statusFilter === 'deleted') params.accountStatus = 'deleted';

    if (userType === 'providers' && professionFilter !== 'all') {
      params.profession = professionFilter;
    }

    return params;
  }, [pagination.page, pagination.limit, searchTerm, userType, userSubTypeFilter, statusFilter, professionFilter]);

  const { data: usersData, isLoading, refetch } = useUsers(queryParams);
  const { data: globalUserCounts = { total: 0, customers: 0, providers: 0 } } = useUserCounts();
  const { data: statusCounts = { all: 0, verified: 0, unverified: 0 } } = useStatusCounts(
    userType === 'customers' ? { userType: 'client' } :
      userType === 'providers' ? { userType: 'provider' } :
        userType === 'flagged' ? { accountStatus: 'restricted,suspended,banned' } :
          {}
  );
  const { data: flaggedUserCounts = { total: 0, suspended: 0, restricted: 0, banned: 0, providers: 0, customers: 0 } } = useFlaggedUserCounts();
  const { data: deletedUserCounts = { total: 0, customers: 0, providers: 0 } } = useDeletedUserCounts();
  const { data: jobCategoriesData } = useQuery({
    queryKey: ['job-categories'],
    queryFn: () => settingsService.getJobCategories()
  });

  const categories = useMemo(() => jobCategoriesData?.categories || [], [jobCategoriesData]);

  useEffect(() => {
    if (jobCategoriesData?.success && jobCategoriesData.categories) {
      const allProfessions = jobCategoriesData.categories
        .flatMap((cat: any) => cat.professions || [])
        .map((prof: any) => prof.name)
        .sort();
      setProfessionsList(allProfessions);
    }
  }, [jobCategoriesData]);

  const mutations = useUserMutations();

  const getProviderProfessions = (user: User): string[] => {
    if (user.userType !== 'provider') return [];
    
    const allProfessions: string[] = [];

    // 1. Try jobCategories (can be string or array in DB)
    if (user.jobCategories) {
      if (Array.isArray(user.jobCategories)) {
         user.jobCategories.forEach(c => {
           if (c && !allProfessions.includes(c)) allProfessions.push(c);
         });
      } else if (typeof user.jobCategories === 'string' && user.jobCategories.trim().length > 0) {
         const cats = user.jobCategories.split(',').map(c => c.trim()).filter(Boolean);
         cats.forEach(c => {
           if (!allProfessions.includes(c)) allProfessions.push(c);
         });
      }
    }

    // 2. Try categories array
    if (user.categories && user.categories.length > 0) {
      user.categories.forEach(c => {
        if (c && !allProfessions.includes(c)) allProfessions.push(c);
      });
    }

    // 3. Try jobVerificationStatus
    if (user.jobVerificationStatus && user.jobVerificationStatus.length > 0) {
       user.jobVerificationStatus.forEach(v => {
         if (v.category && !allProfessions.includes(v.category)) allProfessions.push(v.category);
       });
    }

    // 4. Try legacy category field
    if (user.category && !allProfessions.includes(user.category)) {
      allProfessions.push(user.category);
    }

    return allProfessions;
  };

  const users = usersData?.users || [];
  const loading = isLoading;

  useEffect(() => {
    if (usersData?.pagination) {
      setPagination(prev => ({
        ...prev,
        total: usersData.pagination.total || 0,
        pages: usersData.pagination.pages || 0
      }));
    }
  }, [usersData]);

  useEffect(() => {
    setStatusFilter('all');
    setUserSubTypeFilter('all');
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [location.pathname]);

  const getStatusLabel = (user: User) => {
    if (user.accountStatus === 'deleted') return 'Deleted';
    if (user.accountStatus === 'banned') return 'Banned';
    if (user.accountStatus === 'suspended') return 'Suspended';
    if (user.isRestricted || user.accountStatus === 'restricted') return 'Restricted';
    return '';
  };

  const getStatusColor = (user: User) => {
    if (user.accountStatus === 'deleted') return 'bg-gray-100 text-gray-700 border-gray-200';
    if (user.accountStatus === 'banned') return 'bg-red-100 text-red-700 border-red-200';
    if (user.accountStatus === 'suspended') return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    if (user.isRestricted || user.accountStatus === 'restricted') return 'bg-orange-100 text-orange-700 border-orange-200';
    return '';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

  const openDetailsModal = (user: User) => {
    setSelectedUser(user);
    setDetailsModal({ isOpen: true });
  };

  const closeDetailsModal = () => {
    setDetailsModal({ isOpen: false });
    setTimeout(() => setSelectedUser(null), 300);
  };

  const handleCounterClick = (type: string) => {
    if (type === 'reset') {
      navigate('/users');
      setStatusFilter('all');
      setUserSubTypeFilter('all');
      setPagination(prev => ({ ...prev, page: 1 }));
    } else if (type === 'customers') {
      navigate('/users/customers');
    } else if (type === 'providers') {
      navigate('/users/providers');
    } else if (type === 'suspended') {
      setStatusFilter('suspended');
    } else if (type === 'restricted') {
      setStatusFilter('restricted');
    } else if (type === 'banned') {
      setStatusFilter('banned');
    } else if (type === 'deleted') {
      setStatusFilter('deleted');
    } else if (type === 'verified') {
      setStatusFilter('verified');
    } else if (type === 'unverified') {
      setStatusFilter('unverified');
    }

    // Reset profession when clicking stats cards unless it's the providers card
    if (type !== 'providers') {
      setProfessionFilter('all');
    }
  };

  const handleVerify = async (userId: string, isVerified: boolean) => {
    try {
      await mutations.verifyUser.mutateAsync({ userId, isVerified });
    } catch (error) {}
  };

  const handleAction = async (user: User, actionType: 'ban' | 'suspend' | 'restrict' | 'unrestrict' | 'delete', duration?: number, reason?: string) => {
    const userId = user._id;
    try {
      switch (actionType) {
        case 'ban': await mutations.banUser.mutateAsync({ userId, reason: reason || 'Violation of terms', duration }); break;
        case 'suspend': await mutations.suspendUser.mutateAsync({ userId, reason: reason || 'Account suspension', duration: duration || 7 }); break;
        case 'restrict': await mutations.restrictUser.mutateAsync({ userId, duration, reason }); break;
        case 'unrestrict': await mutations.unrestrictUser.mutateAsync(userId); break;
        case 'delete': await mutations.softDeleteUser.mutateAsync({ userId, reason: reason || 'Soft deleted' }); break;
      }
      closeDetailsModal();
    } catch (error) {}
  };

  return (
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50 mt-16 md:mt-0 h-screen overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <UsersIcon className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  {getPageTitle()}
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">{getPageDescription()}</p>
            </div>
            
            <button 
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900 font-bold bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg transition-colors text-xs"
            >
              <RefreshCw className="h-4 w-4" />
              <span>REFRESH DATA</span>
            </button>
          </div>

          {/* Stats Cards Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            {userType !== 'customers' && userType !== 'providers' && userType !== 'flagged' && userType !== 'deleted' && (
              <div className="cursor-pointer" onClick={() => handleCounterClick('reset')}>
                <StatsCard
                  title="All Users"
                  value={globalUserCounts.total.toLocaleString()}
                  icon={UsersIcon}
                  color="blue"
                  variant="tinted"
                  isActive={location.pathname === '/users' && statusFilter === 'all'}
                  smallIcon={true}
                />
              </div>
            )}
            
            {userType !== 'providers' && userType !== 'flagged' && userType !== 'deleted' && (
              <div className="cursor-pointer" onClick={() => handleCounterClick('customers')}>
                <StatsCard
                  title="Customers"
                  value={globalUserCounts.customers.toLocaleString()}
                  icon={UserIcon}
                  color="purple"
                  variant="tinted"
                  isActive={location.pathname === '/users/customers'}
                  smallIcon={true}
                />
              </div>
            )}

            {userType !== 'customers' && userType !== 'flagged' && userType !== 'deleted' && (
              <div className="cursor-pointer" onClick={() => handleCounterClick('providers')}>
                <StatsCard
                  title="Providers"
                  value={globalUserCounts.providers.toLocaleString()}
                  icon={Briefcase}
                  color="indigo"
                  variant="tinted"
                  isActive={location.pathname === '/users/providers'}
                  smallIcon={true}
                />
              </div>
            )}

            {userType === 'flagged' ? (
              <>
                <div className="cursor-pointer" onClick={() => {
                  setUserSubTypeFilter('all');
                  setStatusFilter('all');
                }}>
                  <StatsCard
                    title="All Suspended Users"
                    value={flaggedUserCounts.total.toLocaleString()}
                    icon={UsersIcon}
                    color="blue"
                    variant="tinted"
                    isActive={userSubTypeFilter === 'all' && statusFilter === 'all'}
                    smallIcon={true}
                  />
                </div>
                <div className="cursor-pointer" onClick={() => {
                  setUserSubTypeFilter('client');
                  setStatusFilter('all');
                }}>
                  <StatsCard
                    title="Customers"
                    value={flaggedUserCounts.customers.toLocaleString()}
                    icon={UserIcon}
                    color="purple"
                    variant="tinted"
                    isActive={userSubTypeFilter === 'client' && statusFilter === 'all'}
                    smallIcon={true}
                  />
                </div>
                <div className="cursor-pointer" onClick={() => {
                  setUserSubTypeFilter('provider');
                  setStatusFilter('all');
                }}>
                  <StatsCard
                    title="Providers"
                    value={flaggedUserCounts.providers.toLocaleString()}
                    icon={Briefcase}
                    color="indigo"
                    variant="tinted"
                    isActive={userSubTypeFilter === 'provider' && statusFilter === 'all'}
                    smallIcon={true}
                  />
                </div>
              </>
            ) : userType === 'deleted' ? (
              <>
                <div className="cursor-pointer" onClick={() => {
                   setUserSubTypeFilter('all');
                   setPagination(prev => ({ ...prev, page: 1 }));
                }}>
                  <StatsCard
                    title="All Deleted Users"
                    value={deletedUserCounts.total.toLocaleString()}
                    icon={UsersIcon}
                    color="blue"
                    variant="tinted"
                    isActive={userSubTypeFilter === 'all'}
                    smallIcon={true}
                  />
                </div>
                <div className="cursor-pointer" onClick={() => {
                   setUserSubTypeFilter('client');
                   setPagination(prev => ({ ...prev, page: 1 }));
                }}>
                  <StatsCard
                    title="Customers"
                    value={deletedUserCounts.customers.toLocaleString()}
                    icon={UserIcon}
                    color="purple"
                    variant="tinted"
                    isActive={userSubTypeFilter === 'client'}
                    smallIcon={true}
                  />
                </div>
                <div className="cursor-pointer" onClick={() => {
                   setUserSubTypeFilter('provider');
                   setPagination(prev => ({ ...prev, page: 1 }));
                }}>
                  <StatsCard
                    title="Providers"
                    value={deletedUserCounts.providers.toLocaleString()}
                    icon={Briefcase}
                    color="indigo"
                    variant="tinted"
                    isActive={userSubTypeFilter === 'provider'}
                    smallIcon={true}
                  />
                </div>
              </>
            ) : (userType === 'customers' || userType === 'providers') && (
              <>
                <div className="cursor-pointer" onClick={() => handleCounterClick('verified')}>
                  <StatsCard
                    title="Verified"
                    value={statusCounts.verified.toLocaleString()}
                    icon={CheckCircle}
                    color="green"
                    variant="tinted"
                    isActive={statusFilter === 'verified'}
                    smallIcon={true}
                  />
                </div>
                <div className="cursor-pointer" onClick={() => handleCounterClick('unverified')}>
                  <StatsCard
                    title="Unverified"
                    value={statusCounts.unverified.toLocaleString()}
                    icon={XCircle}
                    color="purple"
                    variant="tinted"
                    isActive={statusFilter === 'unverified'}
                    smallIcon={true}
                  />
                </div>
              </>
            )}

            {userType !== 'deleted' && (
              <>
                <div className="cursor-pointer" onClick={() => handleCounterClick('suspended')}>
                  <StatsCard
                    title="Suspended"
                    value={flaggedUserCounts.suspended.toLocaleString()}
                    icon={Clock}
                    color="orange"
                    variant="tinted"
                    isActive={statusFilter === 'suspended'}
                    smallIcon={true}
                  />
                </div>
                <div className="cursor-pointer" onClick={() => handleCounterClick('restricted')}>
                   <StatsCard
                    title="Restricted"
                    value={flaggedUserCounts.restricted.toLocaleString()}
                    icon={Shield}
                    color="indigo"
                    variant="tinted"
                    isActive={statusFilter === 'restricted'}
                    smallIcon={true}
                  />
                </div>
                {(userType === 'customers' || userType === 'providers' || userType === 'all' || userType === 'flagged') && (
                  <div className="cursor-pointer" onClick={() => handleCounterClick('banned')}>
                    <StatsCard
                      title="Banned"
                      value={flaggedUserCounts.banned.toLocaleString()}
                      icon={Ban}
                      color="red"
                      variant="tinted"
                      isActive={statusFilter === 'banned'}
                      smallIcon={true}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            {userType === 'providers' ? (
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs font-bold text-gray-400">Profession:</span>
                <select 
                  value={professionFilter}
                  onChange={(e) => {
                    setProfessionFilter(e.target.value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 min-w-[140px] shadow-sm transition-all hover:border-gray-300"
                >
                  <option value="all">All Professions</option>
                  {professionsList.map(prof => (
                    <option key={prof} value={prof} className="capitalize">{prof}</option>
                  ))}
                </select>
              </div>
            ) : (
              [
                { key: 'all', label: 'All', count: statusCounts.all },
                { key: 'verified', label: 'Verified', count: statusCounts.verified },
                { key: 'unverified', label: 'Unverified', count: statusCounts.unverified }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    setStatusFilter(tab.key as any);
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}
                  className={`px-3 py-2 text-xs font-bold rounded-xl transition-all border ${statusFilter === tab.key
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))
            )}
            
            <div className="h-6 w-px bg-gray-200 mx-1" />

            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-bold text-gray-400">Limit:</span>
              <select 
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                className="bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-all hover:border-gray-300"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="bg-white p-20 text-center">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gray-50 mb-6">
                <UsersIcon className="h-10 w-10 text-gray-300" />
              </div>
              <p className="text-gray-900 font-black text-xl mb-2">No users found</p>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">We couldn't find any user profiles matching your current selection.</p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white flex-1 relative overflow-hidden">
                <table className="min-w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr className="border-b border-gray-200">
                      <th className="w-[28%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        User Profile
                      </th>
                      <th className="w-[15%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Account Type
                      </th>
                      <th className="w-[18%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Profession
                      </th>
                      <th className="w-[14%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th className="w-[14%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Wallet Balance
                      </th>
                      <th className="w-[14%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Joined Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white border-b border-gray-300">
                    {users.map((user) => (
                      <tr
                        key={user._id}
                        onClick={() => openDetailsModal(user)}
                        className="group h-[105px] transition-all duration-150 cursor-pointer"
                      >
                        <td className="px-6 py-2.5 whitespace-nowrap border-b border-gray-300">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              {user.profileImage ? (
                                <img
                                  src={user.profileImage}
                                  alt={user.name}
                                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-gray-100">
                                  <span className="text-sm font-bold text-blue-600 uppercase">
                                    {getInitials(user.name)}
                                  </span>
                                </div>
                              )}
                              {user.isOnline && (
                                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                                {user.name}
                              </p>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{user.email || user.phone || 'No contact info'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-2.5 border-b border-gray-300">
                          <div className="flex justify-center">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${user.userType === 'provider'
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-100'
                              : 'bg-purple-50 text-purple-700 border-purple-100'
                              }`}>
                              {user.userType === 'provider' ? <Briefcase className="h-3 w-3" /> : <UserIcon className="h-3.5 w-3.5" />}
                              {user.userType}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-2.5 border-b border-gray-300">
                          <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 mx-auto py-0.5">
                            {user.userType === 'provider' && (
                              (() => {
                                const professions = getProviderProfessions(user);
                                
                                if (professions.length === 0) return <span className="text-gray-300 font-bold">—</span>;

                                return professions.map((prof, idx) => {
                                  const iconData = resolveIconForProfession(prof, categories);
                                  const label = prof.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().toUpperCase();

                                  return (
                                    <div 
                                      key={idx} 
                                      className="flex flex-col items-center gap-1.5 group/prof"
                                    >
                                      <div className="w-14 h-14 rounded-xl bg-indigo-50/40 flex items-center justify-center p-2 border border-indigo-100/60 shadow-sm group-hover/prof:bg-indigo-50/90 group-hover/prof:scale-105 transition-all duration-300">
                                        <img 
                                          src={iconData.imagePath} 
                                          className="w-full h-full object-contain filter contrast-[1.1]" 
                                          alt={label}
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/3203/3203952.png'; // Fallback icon
                                          }}
                                        />
                                      </div>
                                      <span className="text-[9.5px] font-bold text-indigo-600 uppercase tracking-tight text-center leading-tight max-w-[100px]">
                                        {label}
                                      </span>
                                    </div>
                                  );
                                });
                              })()
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-2.5 border-b border-gray-300">
                          <div className="flex flex-col items-center gap-1.5">
                            {getStatusLabel(user) ? (
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(user)}`}>
                                {getStatusLabel(user)}
                              </span>
                            ) : (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${user.isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                {user.isVerified ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                {user.isVerified ? 'Verified' : 'Unverified'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-2.5 text-center border-b border-gray-300">
                          <p className="text-sm font-black text-gray-900">
                            {formatCurrency(user.wallet?.balance || 0)}
                          </p>
                        </td>
                        <td className="px-6 py-2.5 border-b border-gray-300">
                          <div className="flex flex-col">
                            <p className="text-xs font-bold text-gray-900">
                              {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{new Date(user.createdAt).toLocaleDateString()}</p>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="lg:hidden flex-1 overflow-y-auto px-4 py-4 space-y-4">
                {users.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => openDetailsModal(user)}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-all"
                  >
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                       <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                         {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                       </span>
                    </div>

                    <div className="p-4">
                       <div className="flex items-center gap-4 mb-4">
                        <div className="relative flex-shrink-0">
                          {user.profileImage ? (
                            <img src={user.profileImage} className="h-12 w-12 rounded-full border border-gray-100 bg-white" alt="" />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                              <span className="text-xs font-black text-blue-600">{getInitials(user.name)}</span>
                            </div>
                          )}
                          {user.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                        </div>
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1">
                             <h3 className="text-base font-black text-gray-900 leading-tight truncate">{user.name}</h3>
                             <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${user.userType === 'provider' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                               {user.userType}
                             </span>
                           </div>
                           <div className="flex items-center gap-2">
                             <p className="text-xs text-gray-500 truncate">{user.email || user.phone}</p>
                             {user.userType === 'provider' && (
                               (() => {
                                 const professions = getProviderProfessions(user);
                                 if (professions.length === 0) return null;
                                 
                                 return (
                                   <div className="flex flex-wrap gap-1 mt-1">
                                     {professions.map((prof, idx) => {
                                                                               const iconData = resolveIconForProfession(prof, categories);
                                       const label = (iconData?.label && iconData.label !== 'Professional Services')
                                         ? iconData.label
                                         : prof.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().toUpperCase();
                                       return (
                                         <span key={idx} className="text-[8px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                           {label}
                                         </span>
                                       );
                                     })}
                                   </div>
                                 );
                               })()
                             )}
                           </div>
                         </div>
                       </div>

                       <div className="grid grid-cols-2 gap-3 pt-4 border-t border-dashed border-gray-100">
                          <div className="flex flex-col">
                            <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest opacity-70">Wallet balance</span>
                            <span className="text-sm font-black text-gray-900">{formatCurrency(user.wallet?.balance || 0)}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest opacity-70">Verification</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${user.isVerified ? 'text-emerald-600' : 'text-amber-600'}`}>
                               {user.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
                            </span>
                          </div>
                       </div>
                    </div>

                    <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
                       <div className="flex items-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                         <Shield className="h-3 w-3" />
                         ID: {user._id.slice(-8).toUpperCase()}
                       </div>
                       <ChevronRight className="h-4 w-4 text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>

            </>
          )}
        </div>

        {!loading && users.length > 0 && (
          <div className="flex-shrink-0 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-10 p-4">
            <div className="flex items-center justify-between w-full">
              <div>
                <p className="text-xs md:text-sm text-gray-700">
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
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.pages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <UserDetailsModal
        isOpen={detailsModal.isOpen}
        onClose={closeDetailsModal}
        user={selectedUser}
        onVerify={handleVerify}
        onAction={handleAction}
      />
    </div>
  );
};

export default Users;
