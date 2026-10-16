import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  Briefcase,
  User as UserIcon,
  CheckCircle,
  Users as UsersIcon,
  Shield,
  Clock,
  Ban,
  type LucideIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { UserDetailsModal } from '../components/Modals';
import { settingsService } from '../services/settingsService';
import { useQuery } from '@tanstack/react-query';
import { resolveIconForProfession } from '../utils/professionUtils';
import { useUsers, useUserCountCells, useUserMutations } from '../hooks/useUsers';
import StatsCard from '../components/Dashboard/StatsCard';
import type { User } from '../types';

type UserKind = 'client' | 'provider';
type TypeFilter = 'all' | UserKind;
type AccountFilter = 'all' | 'suspended' | 'restricted' | 'banned';
type VerifiedFilter = 'all' | 'verified' | 'unverified';
type CardColor = 'blue' | 'purple' | 'indigo' | 'orange' | 'red';

interface FilterCard {
  key: string;
  title: string;
  /** Shorter label for the mobile pills. */
  pillTitle: string;
  count: number;
  icon: LucideIcon;
  color: CardColor;
  active: boolean;
  onClick: () => void;
}

const PILL_ACTIVE: Record<CardColor, string> = {
  blue: 'bg-blue-500 border-blue-500',
  purple: 'bg-purple-500 border-purple-500',
  indigo: 'bg-indigo-500 border-indigo-500',
  orange: 'bg-orange-500 border-orange-500',
  red: 'bg-red-500 border-red-500',
};

// Card groups share the desktop row in proportion to their card count, so every
// card is the same width. Literal class names so Tailwind generates them.
const GROUP_FLEX: Record<number, string> = {
  1: 'lg:flex-[1]',
  2: 'lg:flex-[2]',
  3: 'lg:flex-[3]',
};

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

const Users: React.FC = () => {
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  // Three independent filters that combine: the stat cards set account type and
  // account status, the tabs set verification. Each route fixes a base scope
  // first (see `scope` below).
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [accountFilter, setAccountFilter] = useState<AccountFilter>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>('all');
  const [professionFilter, setProfessionFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailsModal, setDetailsModal] = useState({ isOpen: false });
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
    return 'All Users';
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

  // What each route lists before any card or tab narrows it. Staff accounts
  // (admin, finance, support) are never part of these lists — counting them is
  // what made "All Users" larger than Customers + Providers.
  const scope = useMemo((): { types: UserKind[]; statuses: string[] | null } => {
    if (userType === 'customers') return { types: ['client'], statuses: null };
    if (userType === 'providers') return { types: ['provider'], statuses: null };
    if (userType === 'flagged') return { types: ['client', 'provider'], statuses: ['restricted', 'suspended', 'banned'] };
    if (userType === 'deleted') return { types: ['client', 'provider'], statuses: ['deleted'] };
    return { types: ['client', 'provider'], statuses: null };
  }, [userType]);

  const activeTypes = useMemo(() => (typeFilter === 'all' ? scope.types : [typeFilter]), [scope, typeFilter]);
  const activeStatuses = useMemo(() => (accountFilter === 'all' ? scope.statuses : [accountFilter]), [scope, accountFilter]);
  const professionParam = userType === 'providers' && professionFilter !== 'all' ? professionFilter : undefined;

  const queryParams = useMemo(() => ({
    page: pagination.page,
    limit: pagination.limit,
    userType: activeTypes.join(','),
    ...(searchTerm && { search: searchTerm }),
    ...(activeStatuses && { accountStatus: activeStatuses.join(',') }),
    ...(verifiedFilter !== 'all' && { isVerified: String(verifiedFilter === 'verified') }),
    ...(professionParam && { profession: professionParam }),
  }), [pagination.page, pagination.limit, activeTypes, activeStatuses, searchTerm, verifiedFilter, professionParam]);

  const { data: usersData, isLoading, refetch } = useUsers(queryParams);
  const { data: countCells = [], isLoading: countsLoading } = useUserCountCells({
    ...(searchTerm && { search: searchTerm }),
    ...(professionParam && { profession: professionParam }),
  });

  // Rows matching a type/status/verification combination. Every card and tab
  // shows the rows clicking it would leave: its own value combined with whatever
  // the other filters are set to — so a number never disagrees with the list.
  const countWhere = (types: UserKind[], statuses: string[] | null, verified: VerifiedFilter) =>
    countCells.reduce((sum, cell) =>
      types.includes(cell.userType) &&
      (!statuses || statuses.includes(cell.accountStatus)) &&
      (verified === 'all' || cell.isVerified === (verified === 'verified'))
        ? sum + cell.count
        : sum, 0);
  // Until the first counts arrive, a dash rather than a misleading 0.
  const shown = (n: number) => (countsLoading ? '—' : n.toLocaleString());
  const { data: jobCategoriesData } = useQuery({
    queryKey: ['job-categories'],
    queryFn: () => settingsService.getJobCategories()
  });

  const categories = useMemo(() => jobCategoriesData?.categories || [], [jobCategoriesData]);

  useEffect(() => {
    if (jobCategoriesData?.success && jobCategoriesData.categories) {
      const allProfessions = [...new Set(
        jobCategoriesData.categories
          .flatMap((cat: any) => cat.professions || [])
          .map((prof: any) => prof.name)
      )].sort() as string[];
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

  // The details modal must read the LIVE row, not the snapshot taken when it was
  // opened.
  //
  // `selectedUser` is frozen at click time, and the list keeps rendering its
  // previous page while an invalidated query refetches
  // (`placeholderData: previousData`). So an admin who restricts a user and
  // reopens them quickly — or who opens a row mid-refetch — gets a modal built
  // from stale data: it offers to restrict an account that is already
  // restricted, and the enforcement buttons reflect a status that has changed.
  //
  // Re-resolving by id means the modal follows the query. The snapshot remains
  // the fallback for the frame after a row leaves the current page.
  const selectedUserLive =
    (selectedUser &&
      users.find((candidate: User) => candidate._id === selectedUser._id)) ||
    selectedUser;
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
    setTypeFilter('all');
    setAccountFilter('all');
    setVerifiedFilter('all');
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

  const resetPage = () => setPagination(prev => ({ ...prev, page: 1 }));
  const fixedType = userType === 'customers' || userType === 'providers';
  const allTitle = { all: 'All Users', customers: 'All Customers', providers: 'All Providers', flagged: 'All Flagged', deleted: 'All Deleted' }[userType];

  // Account type. Every card filters this list in place. On the customers and
  // providers pages the route fixes the type, so the group is a single total
  // card, which clears the status filter.
  const typeCards: FilterCard[] = fixedType
    ? [{
        key: 'scope',
        title: allTitle,
        pillTitle: 'All',
        icon: userType === 'customers' ? UserIcon : Briefcase,
        color: userType === 'customers' ? 'purple' : 'indigo',
        count: countWhere(scope.types, scope.statuses, verifiedFilter),
        active: accountFilter === 'all',
        onClick: () => { setAccountFilter('all'); resetPage(); },
      }]
    : ([
        { type: 'all', title: allTitle, pillTitle: userType === 'all' ? 'All Users' : 'All', icon: UsersIcon, color: 'blue' },
        { type: 'client', title: 'Customers', pillTitle: 'Customers', icon: UserIcon, color: 'purple' },
        { type: 'provider', title: 'Providers', pillTitle: 'Providers', icon: Briefcase, color: 'indigo' },
      ] as const).map(({ type, ...card }) => ({
        ...card,
        key: type,
        count: countWhere(type === 'all' ? scope.types : [type], activeStatuses, verifiedFilter),
        active: typeFilter === type,
        onClick: () => { setTypeFilter(type); resetPage(); },
      }));

  // Account status. Toggles: clicking the selected card again clears it.
  const statusCards: FilterCard[] = userType === 'deleted' ? [] : ([
    { status: 'suspended', title: 'Suspended', icon: Clock, color: 'orange' },
    { status: 'restricted', title: 'Restricted', icon: Shield, color: 'indigo' },
    { status: 'banned', title: 'Banned', icon: Ban, color: 'red' },
  ] as const).map(({ status, ...card }) => ({
    ...card,
    key: status,
    pillTitle: card.title,
    count: countWhere(activeTypes, [status], verifiedFilter),
    active: accountFilter === status,
    onClick: () => { setAccountFilter(prev => (prev === status ? 'all' : status)); resetPage(); },
  }));

  const cardGroups = [
    { label: fixedType ? 'Total' : 'Account type', cards: typeCards },
    ...(statusCards.length ? [{ label: 'Account status', cards: statusCards }] : []),
  ];

  const verificationTabs = (['all', 'verified', 'unverified'] as const).map(key => ({
    key,
    label: { all: 'All', verified: 'Verified', unverified: 'Unverified' }[key],
    count: countWhere(activeTypes, activeStatuses, key),
  }));

  const anyFilterActive = typeFilter !== 'all' || accountFilter !== 'all' || verifiedFilter !== 'all';
  const clearFilters = () => {
    setTypeFilter('all');
    setAccountFilter('all');
    setVerifiedFilter('all');
    resetPage();
  };

  const handleVerify = async (userId: string, isVerified: boolean) => {
    try {
      await mutations.verifyUser.mutateAsync({ userId, isVerified });
    } catch { /* the mutation surfaces its own toast */ }
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
    } catch { /* the mutation surfaces its own toast; keep the modal open */ }
  };

  return (
    <div className="fixed top-16 md:top-0 bottom-0 left-0 md:left-72 right-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 pb-2 md:px-6 md:py-5">
          <div className="hidden md:flex items-center justify-between mb-6">
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
            

          </div>

          {/* Mobile — the same filter cards, as pills */}
          <div className="md:hidden">
            <div className="grid grid-cols-3 gap-2">
              {cardGroups.flatMap(group => group.cards).map(card => (
                <button
                  key={card.key}
                  onClick={card.onClick}
                  className={`flex items-center justify-center gap-1 py-1.5 px-3 rounded-full border transition-all active:scale-95 ${card.active ? `${PILL_ACTIVE[card.color]} text-white` : 'bg-white border-gray-200 text-gray-600'}`}
                >
                  <span className="text-[11px] font-black">{shown(card.count)}</span>
                  <span className={`text-[9px] font-black uppercase tracking-wide ${card.active ? 'text-white/80' : 'text-gray-400'}`}>{card.pillTitle}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Stat cards: account type and account status are separate filters that
              combine, and each number is the rows clicking that card would show. */}
          <div className="hidden md:flex md:flex-col lg:flex-row gap-4 lg:gap-6">
            {cardGroups.map((group, index) => (
              <div key={group.label} className={`min-w-0 ${GROUP_FLEX[group.cards.length] || 'lg:flex-1'}`}>
                <div className="flex items-center justify-between h-4 mb-2">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{group.label}</span>
                  {index === cardGroups.length - 1 && anyFilterActive && (
                    <button
                      onClick={clearFilters}
                      className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
                <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${group.cards.length}, minmax(0, 1fr))` }}>
                  {group.cards.map(card => (
                    <div key={card.key} className="cursor-pointer" onClick={card.onClick}>
                      <StatsCard
                        title={card.title}
                        value={shown(card.count)}
                        icon={card.icon}
                        color={card.color}
                        variant="tinted"
                        isActive={card.active}
                        smallIcon={true}
                        showActiveIcon={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-6">
          {/* Row 1: Search + View Toggle (mobile) / Search (desktop) */}
          <div className="flex items-center gap-2 lg:contents">
            <div className="relative flex-1 lg:order-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 lg:h-4 lg:w-4" />
              <input
                type="text"
                placeholder="Search..."
                data-testid="users-search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition-all shadow-sm h-8 text-xs lg:pl-10 lg:h-10 lg:text-sm lg:rounded-xl"
              />
            </div>

            {/* Page Limit - Mobile only */}
            <select
              value={pagination.limit}
              onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
              className="lg:hidden bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black text-gray-600 focus:outline-none h-8 px-2 shrink-0"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          {/* Row 2 below lg: verification (and profession on the providers page) */}
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            <select
              value={verifiedFilter}
              onChange={(e) => {
                setVerifiedFilter(e.target.value as VerifiedFilter);
                resetPage();
              }}
              className={`bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black uppercase tracking-wider text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-8 w-full px-2 py-1.5 ${userType === 'providers' ? '' : 'col-span-2'}`}
            >
              {verificationTabs.map(tab => (
                <option key={tab.key} value={tab.key}>{tab.label} ({shown(tab.count)})</option>
              ))}
            </select>
            {userType === 'providers' && (
              <select
                value={professionFilter}
                onChange={(e) => {
                  setProfessionFilter(e.target.value);
                  resetPage();
                }}
                className="bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black uppercase tracking-wider text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 h-8 w-full px-2 py-1.5 truncate"
              >
                <option value="all">All Professions</option>
                {professionsList.map(prof => (
                  <option key={prof} value={prof} className="capitalize">{prof}</option>
                ))}
              </select>
            )}
          </div>

          {/* Desktop filter row */}
          <div className="hidden lg:flex items-center justify-between gap-3 lg:flex-initial lg:order-2 lg:justify-end lg:gap-6 shrink-0">
            <div className="flex-1 flex items-center gap-1.5 lg:flex-initial lg:justify-end overflow-x-auto no-scrollbar pb-0.5">
              {userType === 'providers' && (
                <select
                  value={professionFilter}
                  onChange={(e) => {
                    setProfessionFilter(e.target.value);
                    resetPage();
                  }}
                  className="bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm text-xs font-black uppercase tracking-wider text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 lg:min-w-[140px] lg:max-w-[160px] truncate"
                >
                  <option value="all">Professions</option>
                  {professionsList.map(prof => (
                    <option key={prof} value={prof} className="capitalize">{prof}</option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-1 min-w-max">
                {verificationTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setVerifiedFilter(tab.key);
                      resetPage();
                    }}
                    className={`px-2.5 py-2 text-[10px] font-black rounded-xl transition-all border uppercase tracking-widest ${verifiedFilter === tab.key
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200'
                      }`}
                  >
                    {tab.label} ({shown(tab.count)})
                  </button>
                ))}
              </div>
            </div>

            {/* Pagination Limit for Desktop */}
            <div className="flex items-center gap-2 order-3 shrink-0">
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
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr className="border-b border-gray-200">
                      <th className="w-[24%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        User Profile
                      </th>
                      <th className="w-[10%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Account Type
                      </th>
                      <th className="w-[19%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Profession
                      </th>
                      <th className="w-[10%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th className="w-[10%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Wallet Balance
                      </th>
                      <th className="w-[15%] px-6 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Top-up / Cash-out
                      </th>
                      <th className="w-[12%] px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Joined Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white border-b border-gray-300">
                    {users.map((user) => (
                      <tr
                        key={user._id}
                        data-testid={`user-row-${user._id}`}
                        onClick={() => openDetailsModal(user)}
                        className="group h-20 transition-all duration-150 cursor-pointer"
                      >
                        <td className="w-[24%] px-6 py-2 border-b border-gray-300 h-20 align-middle">
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
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{user.phoneNumber || user.phone || user.email || 'No contact info'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="w-[10%] px-6 py-2 border-b border-gray-300 h-20 align-middle">
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
                        <td className="w-[19%] px-6 py-2 border-b border-gray-300 h-20 align-middle">
                          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 mx-auto py-0.5">
                            {user.userType === 'provider' && (
                              (() => {
                                const professions = getProviderProfessions(user);
                                
                                if (professions.length === 0) return <span className="text-gray-300 font-bold">—</span>;

                                return professions.map((prof, idx) => {
                                  const iconData = resolveIconForProfession(prof, categories);
                                  // Add cache-busting for ImageKit icons
                                  const iconPath = iconData.imagePath.startsWith('https://ik.imagekit.io')
                                    ? `${iconData.imagePath}?t=${Date.now()}`
                                    : iconData.imagePath;
                                  const label = prof.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().toUpperCase();

                                  return (
                                    <div
                                      key={idx}
                                      className="flex flex-col items-center gap-1.5 group/prof"
                                    >
                                      <div className="w-12 h-12 rounded-xl bg-indigo-50/40 flex items-center justify-center p-2 border border-indigo-100/60 shadow-sm group-hover/prof:bg-indigo-50/90 group-hover/prof:scale-105 transition-all duration-300">
                                        <img
                                          src={iconPath}
                                          className="w-full h-full object-contain filter contrast-[1.1]"
                                          alt={label}
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/3203/3203952.png'; // Fallback icon
                                          }}
                                        />
                                      </div>
                                      <span className="text-[9px] font-bold text-gray-900 uppercase tracking-tight text-center leading-tight max-w-[80px]">
                                        {label}
                                      </span>
                                    </div>
                                  );
                                });
                              })()
                            )}
                          </div>
                        </td>
                        <td className="w-[10%] px-6 py-2 border-b border-gray-300 h-20 align-middle">
                          <div className="flex flex-col items-center gap-1.5">
                            {getStatusLabel(user) ? (
                              <span data-testid={`user-status-${user._id}`} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(user)}`}>
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
                        <td className="w-[10%] px-6 py-2 text-center border-b border-gray-300 h-20 align-middle">
                          <p className="text-sm font-black text-gray-900">
                            {formatCurrency(user.wallet?.balance || 0)}
                          </p>
                        </td>
                        <td className="w-[15%] px-6 py-2 text-center border-b border-gray-300 h-20 align-middle">
                          {/* Lifetime money in and out of this account. Settled
                              amounts only; anything still in flight is called
                              out underneath rather than folded into the total. */}
                          <div className="flex flex-col items-center gap-0.5">
                            <p className="text-xs font-black text-emerald-600" data-testid={`user-topup-${user._id}`}>
                              ↓ {formatCurrency(user.financials?.topUpTotal || 0)}
                            </p>
                            <p className="text-xs font-black text-rose-600" data-testid={`user-cashout-${user._id}`}>
                              ↑ {formatCurrency(user.financials?.cashOutTotal || 0)}
                            </p>
                            {((user.financials?.topUpPending || 0) + (user.financials?.cashOutPending || 0)) > 0 && (
                              <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">
                                {formatCurrency((user.financials?.topUpPending || 0) + (user.financials?.cashOutPending || 0))} pending
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="w-[12%] px-6 py-2 border-b border-gray-300 h-20 align-middle">
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
              <div className="lg:hidden flex-1 overflow-y-auto">
                <div className="px-3 py-3 space-y-2">
                  {users.map((user) => (
                    <div
                      key={user._id}
                      data-testid={`user-card-${user._id}`}
                      onClick={() => openDetailsModal(user)}
                      className="bg-white rounded-xl border border-gray-300 shadow-sm overflow-hidden active:scale-[0.98] transition-all"
                    >
                      {/* Main Row */}
                      <div className="flex items-center gap-3 px-3 pt-3 pb-2.5">
                        <div className="relative flex-shrink-0">
                          {user.profileImage ? (
                            <img src={user.profileImage} className="h-12 w-12 rounded-full border border-gray-100 bg-white object-cover" alt="" />
                          ) : (
                            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                              <span className="text-sm font-black text-blue-600">{getInitials(user.name)}</span>
                            </div>
                          )}
                          {user.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border truncate max-w-[130px] ${user.userType === 'provider' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-purple-50 text-purple-700 border-purple-100'}`}>
                              {user.userType || 'Unknown'}
                            </span>
                          </div>
                          <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{user.name}</p>
                        </div>
                        {/* Status + profession stacked on the right */}
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {getStatusLabel(user) ? (
                            <span data-testid={`user-status-${user._id}`} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight border bg-white ${getStatusColor(user)}`}>
                              {getStatusLabel(user)}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight border ${user.isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                              {user.isVerified ? 'Verified' : 'Unverified'}
                            </span>
                          )}
                          {user.userType === 'provider' && getProviderProfessions(user).length > 0 && (
                            <span className="text-[8px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 max-w-[110px] truncate text-right">
                              {getProviderProfessions(user)[0].replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim()}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Footer strip */}
                      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                        <p className="text-[10px] font-bold text-gray-500 truncate flex-1 min-w-0">{user.email || user.phone}</p>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] font-black text-emerald-600">↓{formatCurrency(user.financials?.topUpTotal || 0)}</span>
                          <span className="text-[10px] font-black text-rose-600">↑{formatCurrency(user.financials?.cashOutTotal || 0)}</span>
                        </div>
                        <p className="text-sm font-black text-gray-900 flex-shrink-0">{formatCurrency(user.wallet?.balance || 0)}</p>
                        <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400 flex-shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && users.length > 0 && (
          <div className="flex-shrink-0 bg-white border-t border-gray-200 z-10 px-4 h-[65px] flex items-center">
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
        user={selectedUserLive}
        onVerify={handleVerify}
        onAction={handleAction}
      />
    </div>
  );
};

export default Users;
