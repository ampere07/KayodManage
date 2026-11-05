import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  CheckCircle,
  Users as UsersIcon,
  Clock,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { UserDetailsModal } from '../components/Modals';
import { settingsService } from '../services/settingsService';
import { useQuery } from '@tanstack/react-query';
import { resolveIconForProfession, getProfessionDisplayName } from '../utils/professionUtils';
import { useUsers, useUserCountCells, useUserMutations } from '../hooks/useUsers';
import CounterGroups from '../components/UI/CounterGroups';
import type { Counter, CounterGroup, Tone } from '../components/UI/CounterGroups';
import { SortHeader, ListFooter, selectClass, ago } from '../components/UI/ListControls';
import type { User } from '../types';

type UserKind = 'client' | 'provider';
type TypeFilter = 'all' | UserKind;
type AccountFilter = 'all' | 'suspended' | 'restricted' | 'banned';
type VerifiedFilter = 'all' | 'verified' | 'unverified';
type JoinedSort = 'newest' | 'oldest';

// The counter grid's columns, one per group, sized by how many cells each
// holds. Keyed by the groups' cell counts; literal so Tailwind generates them.
const GRID_BY_GROUPS: Record<string, string> = {
  'all-2-3-2': 'grid-cols-[0.8fr_2fr_3fr_2fr]',
  'all-2-2': 'grid-cols-[0.8fr_2fr_2fr]',
  '3-2': 'grid-cols-[3fr_2fr]',
};

// The routes whose counters lead with an All cell.
const ALL_CELL: Record<string, { label: string; hint: string }> = {
  all: { label: 'All', hint: 'Every customer and provider' },
  flagged: { label: 'All', hint: 'Every restricted, suspended or banned account' },
  deleted: { label: 'All', hint: 'Every deleted account' },
};

const STATUS_COUNTERS: { key: Exclude<AccountFilter, 'all'>; label: string; tone: Tone; hint: string }[] = [
  { key: 'suspended', label: 'Suspended', tone: 'yellow', hint: 'Locked out for a set time' },
  { key: 'restricted', label: 'Restricted', tone: 'orange', hint: 'Can sign in, but limited in what they can do' },
  { key: 'banned', label: 'Banned', tone: 'red', hint: 'Removed from the platform' },
];

const getInitials = (name: string): string => {
  const nameParts = name.trim().split(' ').filter(part => part.length > 0);
  if (nameParts.length === 0) return '?';
  return nameParts[0][0].toUpperCase();
};

const day = (value?: Date | string | null) => (value ? format(new Date(value), 'MMM d') : '');

/**
 * The line under a row's status badge: when a restriction ends or began, or
 * that the person is online now. Nothing when there is nothing to add.
 */
const statusLine = (user: User): { text: string; tone: string } | null => {
  const details = user.restrictionDetails;
  if (user.accountStatus === 'deleted' || user.accountStatus === 'banned') {
    return details?.restrictedAt ? { text: `Since ${day(details.restrictedAt)}`, tone: 'text-gray-500' } : null;
  }
  if (user.accountStatus === 'suspended') {
    const until = details?.suspendedUntil || details?.expiresAt;
    return { text: until ? `Until ${day(until)}` : 'No end date', tone: 'text-gray-500' };
  }
  if (user.isRestricted || user.accountStatus === 'restricted') {
    return { text: details?.expiresAt ? `Until ${day(details.expiresAt)}` : 'No end date', tone: 'text-gray-500' };
  }
  if (user.isOnline) return { text: 'Online now', tone: 'text-emerald-600' };
  return null;
};

/** The account type as a label, in the Jobs page's Client / Provider colours. */
const RoleLabel: React.FC<{ user: User }> = ({ user }) => (
  <span className={`text-[9px] font-black uppercase tracking-wider ${user.userType === 'provider' ? 'text-indigo-600' : 'text-purple-600'}`}>
    {user.userType === 'provider' ? 'Provider' : 'Client'}
  </span>
);

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
  const [sort, setSort] = useState<JoinedSort>('newest');
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
    ...(sort !== 'newest' && { sort }),
  }), [pagination.page, pagination.limit, activeTypes, activeStatuses, searchTerm, verifiedFilter, professionParam, sort]);

  const { data: usersData, isLoading, isPlaceholderData } = useUsers(queryParams);
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
  const [iconStamp] = useState(() => Date.now());

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

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [sort]);

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

  // Every counter is the rows clicking it would leave: its own value combined
  // with whatever the other filters are set to. Clicking the selected one
  // again lifts that filter. On the customers and providers pages the route
  // fixes the type, so there is no type group.
  const typeCells: Counter[] = fixedType ? [] : ([
    { key: 'client', label: 'Customers', tone: 'purple', hint: 'People who post jobs' },
    { key: 'provider', label: 'Providers', tone: 'indigo', hint: 'People who quote on jobs and do the work' },
  ] as const).map((cell) => ({
    ...cell,
    count: countsLoading ? undefined : countWhere([cell.key], activeStatuses, verifiedFilter),
    selected: typeFilter === cell.key,
    onClick: () => { setTypeFilter(prev => (prev === cell.key ? 'all' : cell.key)); resetPage(); },
  }));

  const statusCells: Counter[] = userType === 'deleted' ? [] : STATUS_COUNTERS.map((cell) => ({
    ...cell,
    count: countsLoading ? undefined : countWhere(activeTypes, [cell.key], verifiedFilter),
    selected: accountFilter === cell.key,
    onClick: () => { setAccountFilter(prev => (prev === cell.key ? 'all' : cell.key)); resetPage(); },
  }));

  const verificationCells: Counter[] = ([
    { key: 'verified', label: 'Verified', tone: 'emerald', hint: 'Identity checked by an admin' },
    { key: 'unverified', label: 'Unverified', tone: 'amber', hint: 'Not checked yet' },
  ] as const).map((cell) => ({
    ...cell,
    count: countsLoading ? undefined : countWhere(activeTypes, activeStatuses, cell.key),
    selected: verifiedFilter === cell.key,
    onClick: () => { setVerifiedFilter(prev => (prev === cell.key ? 'all' : cell.key)); resetPage(); },
  }));

  const counterGroups: CounterGroup[] = [
    ...(typeCells.length ? [{
      label: 'Account type',
      total: countsLoading ? undefined : countWhere(scope.types, activeStatuses, verifiedFilter),
      cells: typeCells,
    }] : []),
    ...(statusCells.length ? [{ label: 'Account status', cells: statusCells }] : []),
    { label: 'Verification', cells: verificationCells },
  ];
  const scopeTotal = countsLoading ? undefined : countWhere(scope.types, scope.statuses, 'all');

  const anyFilterActive = Boolean(searchTerm) || typeFilter !== 'all' || accountFilter !== 'all' || verifiedFilter !== 'all'
    || professionFilter !== 'all' || sort !== 'newest';
  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setAccountFilter('all');
    setVerifiedFilter('all');
    setProfessionFilter('all');
    setSort('newest');
    resetPage();
  };

  // The route's description, led by how many accounts it holds.
  const description = (() => {
    const n = scopeTotal === undefined ? null : scopeTotal.toLocaleString();
    switch (userType) {
      case 'customers': return n ? `${n} customer accounts, and the jobs they post` : 'Customer accounts and the jobs they post';
      case 'providers': return n ? `${n} provider accounts, their trades and verification` : 'Provider accounts, their trades and verification';
      case 'flagged': return n ? `${n} restricted, suspended or banned accounts` : 'Restricted, suspended and banned accounts';
      case 'deleted': return n ? `${n} deleted accounts` : 'Deleted accounts';
      default: return n ? `${n} customers and providers on the platform` : 'Every customer and provider on the platform';
    }
  })();

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
        <div className="px-4 pt-3 md:px-6 md:pt-5">
          <div className="hidden md:flex items-start justify-between gap-6 mb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <UsersIcon className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  {getPageTitle()}
                </h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">{description}</p>
            </div>
          </div>

          <CounterGroups
            groups={counterGroups}
            gridClass={GRID_BY_GROUPS[[...(ALL_CELL[userType] ? ['all'] : []), ...counterGroups.map((group) => group.cells.length)].join('-')] || 'grid-cols-3'}
            all={{
              count: scopeTotal,
              selected: typeFilter === 'all' && accountFilter === 'all' && verifiedFilter === 'all',
              onClick: () => { setTypeFilter('all'); setAccountFilter('all'); setVerifiedFilter('all'); resetPage(); },
            }}
            filtered={anyFilterActive}
            onClear={clearFilters}
            testId="users-counters"
            idPrefix="users"
            allCell={ALL_CELL[userType]}
          />
        </div>

        {/* Filter Bar — one bar for every width. Phones stack it (search, then
            the selects); from lg it's one row. */}
        <div className="px-4 lg:px-6 py-2 lg:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 w-full lg:w-auto lg:flex-1 lg:min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 lg:left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 lg:h-4 lg:w-4" />
              <input
                type="text"
                placeholder="Search by name, email or phone..."
                data-testid="users-search-input"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  // A new search starts at page 1 — otherwise a search typed on
                  // page 3 asks for page 3 of the matches and shows nothing.
                  resetPage();
                }}
                className="w-full pl-8 pr-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium transition-all shadow-sm lg:pl-10 lg:pr-4 lg:h-9 lg:rounded-xl lg:text-sm"
              />
            </div>

            {/* Page Limit - phones (the desktop one sits by the pages) */}
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

          <div className="grid grid-cols-2 gap-2 w-full lg:contents">
            {userType === 'providers' && (
              <select
                value={professionFilter}
                onChange={(e) => {
                  setProfessionFilter(e.target.value);
                  resetPage();
                }}
                className={`${selectClass} lg:w-[170px]`}
              >
                <option value="all">Professions</option>
                {professionsList.map(prof => (
                  <option key={prof} value={prof} className="capitalize">{prof}</option>
                ))}
              </select>
            )}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as JoinedSort)}
              aria-label="Sort users"
              className={`${selectClass} lg:w-[160px] xl:hidden ${userType === 'providers' ? '' : 'col-span-2'}`}
            >
              <option value="newest">Newest joined</option>
              <option value="oldest">Oldest joined</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className={`flex-1 overflow-y-auto transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : users.length === 0 ? (
            <div className="bg-white p-12 text-center" data-testid="users-empty">
              <div className="text-gray-300 mb-4">
                <UsersIcon className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-700 font-semibold">No users found</p>
              <p className="text-sm text-gray-500 mt-1">No accounts match your search or filters.</p>
              {anyFilterActive && (
                <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Show all users
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white flex-1 relative overflow-hidden">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr>
                      <th className="w-[31%] xl:w-[27%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        User
                      </th>
                      <th className="w-[21%] xl:w-[20%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Profession
                      </th>
                      <th className="w-[17%] xl:w-[15%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th className="w-[15%] xl:w-[10%] px-4 xl:px-6 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Wallet
                      </th>
                      <th
                        className="hidden xl:table-cell w-[12%] px-6 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap"
                        title="Lifetime top-ups (in) and cash-outs (out)"
                      >
                        In / out
                      </th>
                      <th
                        className="w-[16%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-200"
                        aria-sort={sort === 'newest' ? 'descending' : 'ascending'}
                      >
                        <SortHeader
                          label="Joined"
                          dir={sort === 'newest' ? 'desc' : 'asc'}
                          onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {users.map((user) => {
                      const line = statusLine(user);
                      const professions = getProviderProfessions(user);
                      const pending = (user.financials?.topUpPending || 0) + (user.financials?.cashOutPending || 0);
                      return (
                        <tr
                          key={user._id}
                          data-testid={`user-row-${user._id}`}
                          onClick={() => openDetailsModal(user)}
                          className="group h-20 cursor-pointer transition-colors hover:bg-gray-50/70"
                        >
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <div className="flex items-center gap-3 min-w-0">
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
                                <RoleLabel user={user} />
                                <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                                  {user.name}
                                </p>
                                <p className="text-[11px] text-gray-500 truncate">{user.phoneNumber || user.phone || user.email || 'No contact info'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            {user.userType !== 'provider' ? (
                              <span className="text-xs text-gray-300">—</span>
                            ) : professions.length === 0 ? (
                              <span className="text-xs text-gray-400">No trade listed</span>
                            ) : (
                              <div className="flex items-start gap-2 min-w-0">
                                {/* Two trades from xl, one below it; the rest as a count, named on hover. */}
                                {professions.slice(0, 2).map((prof, idx) => {
                                  const iconData = resolveIconForProfession(prof, categories);
                                  const iconPath = iconData.imagePath.startsWith('https://ik.imagekit.io')
                                    ? `${iconData.imagePath}?t=${iconStamp}`
                                    : iconData.imagePath;
                                  const label = getProfessionDisplayName(prof, categories);
                                  return (
                                    <div key={idx} className={`${idx === 0 ? 'flex' : 'hidden xl:flex'} flex-col items-center gap-1 w-[72px] min-w-0 flex-shrink-0`} title={label}>
                                      <div className="w-9 h-9 rounded-xl bg-indigo-50/40 flex items-center justify-center p-1.5 border border-indigo-100/60 flex-shrink-0">
                                        <img
                                          src={iconPath}
                                          className="w-full h-full object-contain"
                                          alt={label}
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://cdn-icons-png.flaticon.com/512/3203/3203952.png'; // Fallback icon
                                          }}
                                        />
                                      </div>
                                      <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight w-full line-clamp-2 break-words">
                                        {label}
                                      </span>
                                    </div>
                                  );
                                })}
                                {professions.length > 1 && (
                                  <span
                                    className="xl:hidden self-center text-[11px] font-bold text-gray-400 flex-shrink-0"
                                    title={professions.slice(1).map((prof) => getProfessionDisplayName(prof, categories)).join(', ')}
                                  >
                                    +{professions.length - 1}
                                  </span>
                                )}
                                {professions.length > 2 && (
                                  <span
                                    className="hidden xl:inline self-center text-[11px] font-bold text-gray-400 flex-shrink-0"
                                    title={professions.slice(2).map((prof) => getProfessionDisplayName(prof, categories)).join(', ')}
                                  >
                                    +{professions.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <div className="flex flex-col items-start gap-1.5 min-w-0">
                              {getStatusLabel(user) ? (
                                <span data-testid={`user-status-${user._id}`} className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusColor(user)}`}>
                                  {getStatusLabel(user)}
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${user.isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                                  {user.isVerified ? <CheckCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                                  {user.isVerified ? 'Verified' : 'Unverified'}
                                </span>
                              )}
                              {line && <span className={`text-[11px] truncate max-w-full ${line.tone}`}>{line.text}</span>}
                            </div>
                          </td>
                          <td className="px-4 xl:px-6 py-2 text-right border-b border-gray-200 h-20 align-middle">
                            <p className="text-sm font-black text-gray-900 tabular-nums">
                              {formatCurrency(user.wallet?.balance || 0)}
                            </p>
                            {pending > 0 && (
                              <p className="text-[9px] font-bold text-amber-600 uppercase tracking-wider mt-0.5">
                                {formatCurrency(pending)} pending
                              </p>
                            )}
                            {/* Below xl the Top-up / Cash-out column is hidden; its totals ride here. */}
                            <p className="xl:hidden text-[10px] font-black mt-0.5 whitespace-nowrap">
                              <span className="text-emerald-600">↓{formatCurrency(user.financials?.topUpTotal || 0)}</span>{' '}
                              <span className="text-rose-600">↑{formatCurrency(user.financials?.cashOutTotal || 0)}</span>
                            </p>
                          </td>
                          <td className="hidden xl:table-cell px-6 py-2 text-right border-b border-gray-200 h-20 align-middle">
                            {/* Lifetime money in and out of this account. Settled
                                amounts only; anything still in flight is called
                                out under the wallet balance. */}
                            <p className="text-xs font-black text-emerald-600 tabular-nums" data-testid={`user-topup-${user._id}`}>
                              ↓ {formatCurrency(user.financials?.topUpTotal || 0)}
                            </p>
                            <p className="text-xs font-black text-rose-600 tabular-nums mt-0.5" data-testid={`user-cashout-${user._id}`}>
                              ↑ {formatCurrency(user.financials?.cashOutTotal || 0)}
                            </p>
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <p className="text-xs font-bold text-gray-900 truncate">{ago(user.createdAt)}</p>
                            <p className="text-[10px] font-medium text-gray-400 mt-1">{format(new Date(user.createdAt), 'MMM d, yyyy')}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phones and tablets */}
              <div className="lg:hidden flex-1 overflow-y-auto bg-white">
                <div className="px-3 py-3 space-y-2">
                  {users.map((user) => {
                    const line = statusLine(user);
                    const professions = getProviderProfessions(user);
                    return (
                      <div
                        key={user._id}
                        data-testid={`user-card-${user._id}`}
                        onClick={() => openDetailsModal(user)}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
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
                            <RoleLabel user={user} />
                            <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{user.name}</p>
                            {user.userType === 'provider' && professions.length > 0 ? (
                              <p className="mt-0.5 text-[11px] text-gray-500 truncate">
                                {professions.map((prof) => getProfessionDisplayName(prof, categories)).join(' · ')}
                              </p>
                            ) : line ? (
                              <p className={`mt-0.5 text-[11px] truncate ${line.tone}`}>{line.text}</p>
                            ) : null}
                          </div>
                          {getStatusLabel(user) ? (
                            <span data-testid={`user-status-${user._id}`} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight border bg-white flex-shrink-0 ${getStatusColor(user)}`}>
                              {getStatusLabel(user)}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tight border flex-shrink-0 ${user.isVerified ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'}`}>
                              {user.isVerified ? 'Verified' : 'Unverified'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                          <p className="text-[10px] font-semibold text-gray-500 truncate flex-1 min-w-0">{user.email || user.phone}</p>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] font-black text-emerald-600">↓{formatCurrency(user.financials?.topUpTotal || 0)}</span>
                            <span className="text-[10px] font-black text-rose-600">↑{formatCurrency(user.financials?.cashOutTotal || 0)}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Wallet className="h-3 w-3 text-gray-400" />
                            <p className="text-sm font-black text-gray-900">{formatCurrency(user.wallet?.balance || 0)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {!loading && users.length > 0 && (
          <ListFooter
            page={pagination.page}
            limit={pagination.limit}
            total={pagination.total}
            pages={pagination.pages}
            onPage={(page) => setPagination(prev => ({ ...prev, page }))}
            onLimit={(limit) => setPagination(prev => ({ ...prev, limit, page: 1 }))}
          />
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
