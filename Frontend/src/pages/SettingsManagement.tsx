import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Lock, Search, ShieldAlert, ShieldCheck, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { SidebarContext } from '../components/Layout/Layout';
import { settingsService } from '../services';
import CreateAdminModal from '../components/Settings/CreateAdminModal';
import EditAdminModal from '../components/Settings/EditAdminModal';
import { AccessPill } from '../components/Settings/AdminForm';
import {
  INACTIVE_DAYS,
  ROLES,
  canSignIn,
  daysSince,
  pagesOn,
  pagesSummary,
  presetOf,
  roleKeyOf,
  roleOf,
  signInConcern,
  type Permissions,
  type RoleKey,
} from '../components/Settings/adminAccess';
import CounterGroups from '../components/UI/CounterGroups';
import type { Counter, CounterGroup } from '../components/UI/CounterGroups';
import { ListFooter, SortHeader, selectClass } from '../components/UI/ListControls';
import { initials, roleText, shortTime, timeAgo } from '../components/Audit/auditStyle';

interface Admin {
  _id: string;
  uid: string;
  fullName: string;
  email: string;
  /** Capitalised by the server: "Superadmin", "Customer support". */
  role: string;
  permissions: Partial<Permissions>;
  accountStatus?: string;
  createdAt?: string;
  lastLogin?: string | null;
  /** Their live sessions, the most recently active one described. */
  signedInNow?: { count: number; lastSeenAt: string | null; device: string; ipAddress: string | null; location: string } | null;
  /** Their latest sign-in, from the audit log. */
  lastSignIn?: { at: string; device: string; ipAddress: string | null; location: string } | null;
}

/** "Chrome on Windows · 203.0.113.7", for hover text. */
const deviceAndIp = (where: { device: string; ipAddress: string | null }) => [where.device, where.ipAddress].filter(Boolean).join(' · ');

type RoleFilter = 'all' | RoleKey;
const ROLE_FILTERS: RoleFilter[] = ['all', ...ROLES.map((r) => r.key)];
/** Access (can they sign in) and the two sign-in concerns share one filter. */
type StatusFilter = 'all' | 'active' | 'off' | 'never' | 'inactive';
const STATUS_FILTERS: StatusFilter[] = ['all', 'active', 'off', 'never', 'inactive'];
type SortKey = 'name' | 'lastLogin' | 'createdAt';

const TH = 'px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200';
const TD = 'px-4 xl:px-6 py-2 h-20 align-middle border-b border-gray-200';

const matchesRole = (admin: Admin, role: RoleFilter) => role === 'all' || roleKeyOf(admin.role) === role;
const matchesStatus = (admin: Admin, status: StatusFilter) => {
  if (status === 'all') return true;
  if (status === 'active') return canSignIn(admin.accountStatus);
  if (status === 'off') return !canSignIn(admin.accountStatus);
  return signInConcern(admin) === status;
};
const time = (value?: string | null) => (value ? new Date(value).getTime() : 0);

const Avatar: React.FC<{ name: string }> = ({ name }) => (
  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
    <span className="text-sm font-bold text-blue-600 uppercase">{initials(name)}</span>
  </div>
);

/** The quiet line under an account's access: only when it hasn't been used lately. */
const concernText = (admin: Admin) => {
  const concern = signInConcern(admin);
  if (concern === 'never') return 'Never signed in';
  if (concern === 'inactive' && admin.lastLogin) return `No sign-in for ${daysSince(admin.lastLogin)} days`;
  return null;
};

/**
 * Settings → Management: every admin account, in the other list pages' style.
 * Counters that are also filters (role, whether they can sign in, and accounts
 * that haven't been used), labelled rows, sortable headers, and the create /
 * edit panels. Role and status live in the URL; ?id= opens one admin.
 */
const SettingsManagement: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: admins = [], isLoading, error: queryError } = useQuery<Admin[]>({
    queryKey: ['admins'],
    queryFn: async () => {
      const response = await settingsService.getAllAdmins();
      return response.admins || [];
    },
  });
  const loadError = queryError ? (queryError as any)?.message || "Couldn't load the admin accounts" : null;

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState<Admin | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [searchParams, setSearchParams] = useSearchParams();
  const roleParam = (searchParams.get('role') || 'all') as RoleFilter;
  const roleFilter: RoleFilter = ROLE_FILTERS.includes(roleParam) ? roleParam : 'all';
  const statusParam = (searchParams.get('status') || 'all') as StatusFilter;
  const statusFilter: StatusFilter = STATUS_FILTERS.includes(statusParam) ? statusParam : 'all';
  const setFilters = (nextRole: RoleFilter, nextStatus: StatusFilter) => {
    const next = new URLSearchParams(searchParams);
    if (nextRole === 'all') next.delete('role'); else next.set('role', nextRole);
    if (nextStatus === 'all') next.delete('status'); else next.set('status', nextStatus);
    setSearchParams(next, { replace: true });
  };
  // Clicking the selected counter again lifts that filter.
  const chooseRole = (next: RoleFilter) => setFilters(next === roleFilter ? 'all' : next, statusFilter);
  const chooseStatus = (next: StatusFilter) => setFilters(roleFilter, next === statusFilter ? 'all' : next);

  // ?id= opens that admin once the list has loaded.
  useEffect(() => {
    const id = searchParams.get('id');
    if (!id || !admins.length) return;
    const found = admins.find((a) => a._id === id);
    if (found) setSelectedAdmin(found);
    const next = new URLSearchParams(searchParams);
    next.delete('id');
    setSearchParams(next, { replace: true });
  }, [admins, searchParams, setSearchParams]);

  const { setIsHeaderHidden } = useContext(SidebarContext);
  const panelOpen = Boolean(selectedAdmin) || isCreateOpen;
  useEffect(() => {
    if (setIsHeaderHidden) setIsHeaderHidden(panelOpen);
  }, [panelOpen, setIsHeaderHidden]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admins'] });

  // Search narrows the counters as well as the list.
  const searched = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    if (!s) return admins;
    return admins.filter((a) =>
      [a.fullName, a.email, a.uid, roleOf(a.role)?.label, a.role].some((field) => (field || '').toLowerCase().includes(s))
    );
  }, [admins, searchTerm]);

  const countWhere = (role: RoleFilter, status: StatusFilter) => searched.filter((a) => matchesRole(a, role) && matchesStatus(a, status)).length;

  const filtered = useMemo(() => {
    const list = searched.filter((a) => matchesRole(a, roleFilter) && matchesStatus(a, statusFilter));
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === 'name') return sign * a.fullName.localeCompare(b.fullName);
      // Never signed in / no date sorts last either way.
      const ta = time(sort.key === 'lastLogin' ? a.lastLogin : a.createdAt);
      const tb = time(sort.key === 'lastLogin' ? b.lastLogin : b.createdAt);
      if (!ta || !tb) return (tb ? 1 : 0) - (ta ? 1 : 0);
      return sign * (ta - tb);
    });
  }, [searched, roleFilter, statusFilter, sort]);

  useEffect(() => setPage(1), [roleFilter, statusFilter, searchTerm, perPage, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const shown = filtered.slice((page - 1) * perPage, page * perPage);

  const sortBy = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  const dirOf = (key: SortKey) => (sort.key === key ? sort.dir : null);

  // ── Counters ─────────────────────────────────────────────────────────────
  const count = (role: RoleFilter, status: StatusFilter) => (isLoading ? undefined : countWhere(role, status));
  const roleCell = (key: RoleKey, label: string, tone: Counter['tone'], hint: string): Counter => ({
    key,
    label,
    tone,
    hint,
    count: count(key, statusFilter),
    selected: roleFilter === key,
    onClick: () => chooseRole(key),
  });
  const statusCell = (key: Exclude<StatusFilter, 'all'>, label: string, tone: Counter['tone'], hint: string, extra: Partial<Counter> = {}): Counter => ({
    key,
    label,
    tone,
    hint,
    count: count(roleFilter, key),
    selected: statusFilter === key,
    onClick: () => chooseStatus(key),
    ...extra,
  });
  const groups: CounterGroup[] = [
    {
      // No total beside the label: every admin has one role, so it would only repeat All.
      label: 'Role',
      cells: ROLES.map((role) => roleCell(role.key, role.label, role.tone, role.description)),
    },
    {
      label: 'Access',
      cells: [
        statusCell('active', 'Active', 'emerald', 'Can sign in'),
        statusCell('off', 'Off', 'red', "Suspended or banned: can't sign in"),
      ],
    },
    {
      label: 'Needs a look',
      cells: [
        statusCell('never', 'Never signed in', 'amber', 'Active accounts nobody has signed in to yet', { alert: true, shortLabel: 'Never used' }),
        statusCell('inactive', `Idle ${INACTIVE_DAYS}+ days`, 'amber', `Active accounts with no sign-in for ${INACTIVE_DAYS} days or more`, { alert: true, shortLabel: 'Idle' }),
      ],
    },
  ];

  const anyFilterActive = Boolean(searchTerm) || roleFilter !== 'all' || statusFilter !== 'all';
  const clearFilters = () => {
    setSearchTerm('');
    setFilters('all', 'all');
  };
  const offCount = admins.filter((a) => !canSignIn(a.accountStatus)).length;
  const attention = admins.filter((a) => signInConcern(a)).length;

  if (user?.role !== 'superadmin') {
    return (
      <div className="fixed inset-0 md:left-72 flex items-center justify-center bg-gray-50 mt-16 md:mt-0">
        <div className="flex flex-col items-center gap-6 max-w-sm px-6 text-center">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-red-50 flex items-center justify-center border-4 border-white shadow-xl">
              <ShieldAlert className="h-12 w-12 text-red-500" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-lg border border-red-100">
              <Lock className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight uppercase italic">Access Denied</h2>
            <p className="text-sm text-gray-500 font-medium">
              You do not have the required permissions to access administrative settings.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 py-2 px-4 bg-red-50 rounded-full border border-red-100 shadow-sm shadow-red-500/10">
              <ShieldCheck className="w-4 h-4 text-red-600" />
              <span className="text-[10px] font-black text-red-700 uppercase tracking-widest">Super Admin Eyes Only</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const presetLine = (admin: Admin) => {
    const preset = presetOf(admin.permissions);
    const on = pagesOn(admin.permissions).map((p) => p.label);
    return (
      <div className="min-w-0" title={on.length ? on.join(', ') : 'No pages'} data-testid="admin-row-pages">
        <p className={`text-xs font-bold truncate ${preset ? 'text-gray-900' : on.length ? 'text-gray-700' : 'text-amber-700'}`}>
          {preset ? preset.label : on.length ? 'Custom' : 'No pages'}
        </p>
        {on.length > 0 && <p className="text-[11px] text-gray-500 truncate mt-0.5">{pagesSummary(admin.permissions)}</p>}
      </div>
    );
  };

  return (
    <div className="fixed top-16 md:top-0 bottom-0 left-0 md:left-72 right-0 flex flex-col bg-gray-50 overflow-hidden">
      <CreateAdminModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onSuccess={refresh} />
      <EditAdminModal isOpen={Boolean(selectedAdmin)} onClose={() => setSelectedAdmin(null)} onSuccess={refresh} admin={selectedAdmin} />

      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 md:px-6 md:pt-5">
          <div className="flex items-start justify-between gap-4 mb-3 md:mb-5">
            <div className="min-w-0">
              <div className="hidden md:flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Admin Management</h1>
              </div>
              <p className="text-xs text-gray-500 font-medium" data-testid="admins-subtitle">
                {isLoading ? 'Admin accounts and what each can open' : `${admins.length.toLocaleString()} admin account${admins.length === 1 ? '' : 's'}`}
                {!isLoading && offCount > 0 && <span> · {offCount} with access turned off</span>}
                {!isLoading && attention > 0 && <span className="text-amber-600 font-semibold"> · {attention} not signing in</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="group flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-lg shadow-gray-900/10 active:scale-95 flex-shrink-0"
              data-testid="admins-new"
            >
              <UserPlus className="h-4 w-4 group-hover:rotate-12 transition-transform" />
              <span className="text-[10px] md:text-xs font-black uppercase tracking-widest">New Admin</span>
            </button>
          </div>

          <CounterGroups
            groups={groups}
            gridClass="grid-cols-[0.65fr_4.6fr_1.7fr_2.8fr]"
            all={{ count: isLoading ? undefined : searched.length, selected: roleFilter === 'all' && statusFilter === 'all', onClick: () => setFilters('all', 'all') }}
            filtered={anyFilterActive}
            onClear={clearFilters}
            testId="admins-counters"
            idPrefix="admins"
            allCell={{ label: 'All', hint: 'Every admin account under the search' }}
          />
        </div>

        {/* Filter bar */}
        <div className="px-4 lg:px-6 py-2 lg:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-auto lg:flex-1 lg:min-w-[200px]">
            <Search className="absolute left-3 lg:left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 lg:h-4 lg:w-4" />
            <input
              type="text"
              data-testid="admins-search"
              placeholder="Search by name, email, ID or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium transition-all shadow-sm lg:pl-10 lg:pr-4 lg:h-9 lg:rounded-xl lg:text-sm"
            />
          </div>
          <select
            value={`${sort.key}:${sort.dir}`}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(':') as [SortKey, 'asc' | 'desc'];
              setSort({ key, dir });
            }}
            aria-label="Sort admins"
            data-testid="admins-sort"
            className={`${selectClass} lg:hidden`}
          >
            <option value="name:asc">Name A–Z</option>
            <option value="lastLogin:desc">Signed in lately</option>
            <option value="createdAt:desc">Newest added</option>
          </select>
        </div>
      </div>

      {loadError && (
        <div className="mx-4 md:mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-sm text-red-700" role="alert">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          {loadError}
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                <p className="text-gray-500">Loading admin accounts...</p>
              </div>
            </div>
          ) : shown.length === 0 ? (
            <div className="bg-white p-12 text-center" data-testid="admins-empty">
              <ShieldAlert className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-700 font-semibold">No admins found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters.</p>
              {anyFilterActive && (
                <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Show every admin
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden lg:block bg-white">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr>
                      {/* No width: Admin takes what's left, so hiding Added below xl widens it. */}
                      <th className={TH} aria-sort={sort.key === 'name' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                        <SortHeader label="Admin" dir={dirOf('name')} onClick={() => sortBy('name')} />
                      </th>
                      <th className={`${TH} w-[18%]`}>Access</th>
                      <th className={`${TH} w-[19%]`}>Permissions</th>
                      <th className={`${TH} w-[16%]`} aria-sort={sort.key === 'lastLogin' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                        <SortHeader label="Signed in" dir={dirOf('lastLogin')} onClick={() => sortBy('lastLogin')} />
                      </th>
                      <th className={`${TH} hidden xl:table-cell w-[13%]`} aria-sort={sort.key === 'createdAt' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                        <SortHeader label="Added" dir={dirOf('createdAt')} onClick={() => sortBy('createdAt')} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {shown.map((admin) => {
                      const role = roleOf(admin.role);
                      const concern = concernText(admin);
                      return (
                        <tr
                          key={admin._id}
                          onClick={() => setSelectedAdmin(admin)}
                          data-testid="admin-row"
                          className="group h-20 cursor-pointer transition-colors hover:bg-gray-50/70"
                        >
                          <td className={TD}>
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar name={admin.fullName} />
                              <div className="min-w-0">
                                <p className={`text-[9px] font-black uppercase tracking-wider ${roleText(role?.value)}`}>{role?.label || admin.role}</p>
                                <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{admin.fullName}</p>
                                <p className="text-[11px] text-gray-500 truncate">
                                  {admin.email}
                                  <span className="text-gray-300"> · </span>
                                  <span className="font-mono text-gray-400">{admin.uid}</span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className={TD}>
                            <div className="flex flex-col items-start gap-1.5 min-w-0">
                              <AccessPill status={admin.accountStatus} testId="admin-row-access" />
                              {concern && <span className="text-[11px] font-medium text-amber-700 truncate max-w-full" data-testid="admin-row-concern">{concern}</span>}
                            </div>
                          </td>
                          <td className={TD}>{presetLine(admin)}</td>
                          <td className={TD}>
                            {admin.signedInNow ? (
                              <>
                                <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 truncate" data-testid="admin-row-online">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                  Signed in now{admin.signedInNow.count > 1 ? ` · ${admin.signedInNow.count}` : ''}
                                </p>
                                <p className="text-[10px] font-medium text-gray-500 mt-1 truncate" title={deviceAndIp(admin.signedInNow)} data-testid="admin-row-where">
                                  {admin.signedInNow.location}
                                </p>
                              </>
                            ) : (
                              <>
                                <p className={`text-xs font-bold truncate ${admin.lastLogin ? 'text-gray-900' : 'text-gray-400'}`} title={admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : undefined}>
                                  {timeAgo(admin.lastLogin)}
                                </p>
                                {admin.lastSignIn ? (
                                  <p
                                    className="text-[10px] font-medium text-gray-400 mt-1 truncate"
                                    title={`${deviceAndIp(admin.lastSignIn)} · ${shortTime(admin.lastSignIn.at)}`}
                                    data-testid="admin-row-where"
                                  >
                                    {admin.lastSignIn.location}
                                  </p>
                                ) : admin.lastLogin ? (
                                  <p className="text-[10px] font-medium text-gray-400 mt-1">{shortTime(admin.lastLogin)}</p>
                                ) : null}
                              </>
                            )}
                          </td>
                          <td className={`${TD} hidden xl:table-cell`}>
                            {admin.createdAt ? (
                              <>
                                <p className="text-xs font-bold text-gray-900">{format(new Date(admin.createdAt), 'MMM d, yyyy')}</p>
                                <p className="text-[10px] font-medium text-gray-400 mt-1">{timeAgo(admin.createdAt)}</p>
                              </>
                            ) : (
                              <p className="text-xs text-gray-400">Not recorded</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phones and tablets */}
              <div className="lg:hidden bg-white px-3 py-3 space-y-2">
                {shown.map((admin) => {
                  const role = roleOf(admin.role);
                  const preset = presetOf(admin.permissions);
                  const concern = concernText(admin);
                  return (
                    <div
                      key={admin._id}
                      onClick={() => setSelectedAdmin(admin)}
                      data-testid="admin-card"
                      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
                        <Avatar name={admin.fullName} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[9px] font-black uppercase tracking-wider ${roleText(role?.value)}`}>{role?.label || admin.role}</p>
                          <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{admin.fullName}</p>
                          <p className="mt-0.5 text-[11px] text-gray-500 truncate">
                            {preset ? preset.label : pagesOn(admin.permissions).length ? 'Custom' : 'No pages'} · {pagesSummary(admin.permissions)}
                          </p>
                        </div>
                        <AccessPill status={admin.accountStatus} small />
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                        <p className="flex-1 min-w-0 text-[10px] font-semibold text-gray-500 truncate">{admin.email}</p>
                        {admin.signedInNow ? (
                          <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-700 flex-shrink-0 max-w-[55%] truncate" title={deviceAndIp(admin.signedInNow)}>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                            <span className="truncate">Signed in now · {admin.signedInNow.location}</span>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-0.5 text-[9px] font-bold flex-shrink-0 ${concern ? 'text-amber-700' : 'text-gray-400'}`}>
                            <Clock className="h-2.5 w-2.5" />
                            {concern || `Signed in ${timeAgo(admin.lastLogin)}`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {!isLoading && filtered.length > 0 && (
          <ListFooter page={page} limit={perPage} total={filtered.length} pages={pages} onPage={setPage} onLimit={setPerPage} />
        )}
      </div>
    </div>
  );
};

export default SettingsManagement;
