import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Activity as ActivityIcon,
  Calendar,
  ChevronRight,
  Download,
  LogIn,
  MousePointerClick,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { auditService, usersService, transactionsService } from '../services';
import { UserDetailsModal, TransactionDetailsModal } from '../components/Modals';
import { AUDIT_QUERY_KEY, useAuditCatalog, useAuditLogs, useAuditTeam } from '../hooks/useAudit';
import { useSocket } from '../context/SocketContext';
import StatsCard from '../components/Dashboard/StatsCard';
import AuditAdminPicker from '../components/Audit/AuditAdminPicker';
import AuditAdminsTable, {
  ADMIN_ACTIVITY_FILTERS,
  type AdminActivityFilter,
  type AdminSortKey,
} from '../components/Audit/AuditAdminsTable';
import AuditActionBadge from '../components/Audit/AuditActionBadge';
import AuditEntryPanel from '../components/Audit/AuditEntryPanel';
import {
  CONFIG_TARGET_TYPES,
  OPENABLE_TARGET_TYPES,
  exactTime,
  initials,
  lookupAction,
  roleLabel,
  shortTime,
  timeAgo,
} from '../components/Audit/auditStyle';
import type { AuditFilters, AuditLogEntry, Transaction, User } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const RANGES: { key: string; label: string; ms?: number }[] = [
  { key: '24h', label: 'Last 24 hours', ms: DAY },
  { key: '7d', label: 'Last 7 days', ms: 7 * DAY },
  { key: '30d', label: 'Last 30 days', ms: 30 * DAY },
  { key: '90d', label: 'Last 90 days', ms: 90 * DAY },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom range' },
];
const DEFAULT_RANGE = '30d';
const PAGE_SIZES = [10, 20, 50];
const DEFAULT_PAGE_SIZE = 20;

// Shared control styles — the same as the filter bars on Jobs and Verifications.
const SELECT =
  'w-full md:w-auto bg-white px-2 md:px-3 h-8 md:h-auto md:py-2 border border-gray-200 rounded-lg md:rounded-xl shadow-sm text-[11px] md:text-xs font-black uppercase tracking-wider text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer truncate';
const SEARCH =
  'w-full pl-8 md:pl-10 pr-4 h-8 md:h-auto md:py-2 bg-white border border-gray-200 rounded-lg md:rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs md:text-sm font-medium transition-all shadow-sm';
const TH = 'px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200';
const TD = 'px-6 py-4 border-b border-gray-300';

const targetIdOf = (log: AuditLogEntry) =>
  log.targetId && typeof log.targetId === 'object' ? log.targetId._id : log.targetId || null;

const targetLabel = (log: AuditLogEntry) => {
  const target = log.targetId && typeof log.targetId === 'object' ? log.targetId : null;
  return (
    target?.name ||
    target?.title ||
    target?.subject ||
    log.metadata?.targetName ||
    (log.targetType === 'transaction' ? 'Transaction' : null)
  );
};

const TargetLink: React.FC<{ log: AuditLogEntry; onOpen: (log: AuditLogEntry) => void }> = ({ log, onOpen }) => {
  const label = targetLabel(log);
  // A sign-in targets the admin themselves; the Admin column already says who.
  if (!label || (log.adminId && targetIdOf(log) === log.adminId._id)) return null;
  const clickable = Boolean(log.targetType && OPENABLE_TARGET_TYPES.has(log.targetType));
  return clickable ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(log);
      }}
      className="mt-1 inline-flex items-center gap-1.5 max-w-full text-xs font-medium text-blue-600 hover:text-blue-800"
    >
      <span className="truncate">{label}</span>
      <MousePointerClick className="h-3 w-3 flex-shrink-0" />
    </button>
  ) : (
    <p className="mt-1 text-xs font-medium text-gray-500 truncate">{label}</p>
  );
};

const AdminAvatar: React.FC<{ name?: string | null; size?: 'sm' | 'md' }> = ({ name, size = 'md' }) => (
  <div
    className={`${size === 'md' ? 'w-10 h-10 text-sm' : 'w-9 h-9 text-xs'} rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-gray-100`}
  >
    <span className="font-bold text-blue-600 uppercase">{initials(name)}</span>
  </div>
);

const SuperAdminTag = () => (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-50 text-purple-700 border border-purple-100 flex-shrink-0">
    Super Admin
  </span>
);

/**
 * Audit Log — every admin action: who did it, what it touched, and when.
 * Superadmin-only (server-enforced; the route and nav item are hidden too).
 * Laid out like the other list pages: stat cards that filter, a filter bar, a
 * table (cards on phones) and a pager. Log filters live in the URL so a view can
 * be linked; the Edit Admin panel opens it as /activity?admin=<id>.
 */
const Activity: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [params, setParams] = useSearchParams();

  const view = params.get('tab') === 'admins' ? 'admins' : 'log';
  const adminId = params.get('admin') || undefined;
  const group = params.get('group') || undefined;
  const actionType = params.get('action') || undefined;
  const sensitive = params.get('sensitive') === '1';
  const rangeKey = params.get('range') || DEFAULT_RANGE;
  const customFrom = params.get('from') || '';
  const customTo = params.get('to') || '';
  const search = params.get('q') || '';
  const page = Math.max(Number(params.get('page')) || 1, 1);
  const limit = PAGE_SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : DEFAULT_PAGE_SIZE;
  const signInsOnly = actionType === 'admin_login';
  const entryId = params.get('entry') || undefined;
  const targetId = params.get('target') || undefined;
  const targetName = params.get('tname') || '';

  const [searchInput, setSearchInput] = useState(search);
  const [anchor, setAnchor] = useState(() => Date.now());

  // Admins view: its own search, filter, sort and paging (server-side).
  const [adminsInput, setAdminsInput] = useState('');
  const [adminsSearch, setAdminsSearch] = useState('');
  const [adminsActivity, setAdminsActivity] = useState<AdminActivityFilter>('');
  const [adminsSort, setAdminsSort] = useState<AdminSortKey>('actions');
  const [adminsOrder, setAdminsOrder] = useState<'asc' | 'desc'>('desc');
  const [adminsPage, setAdminsPage] = useState(1);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [transactionModalOpen, setTransactionModalOpen] = useState(false);

  /** Set URL filters; any filter change goes back to page 1. */
  const update = useCallback(
    (changes: Record<string, string | undefined>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === '') next.delete(key);
            else next.set(key, value);
          }
          if (!('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    [setParams]
  );

  // Debounced searches.
  useEffect(() => {
    if (searchInput.trim() === search) return;
    const timer = setTimeout(() => update({ q: searchInput.trim() || undefined }), 350);
    return () => clearTimeout(timer);
  }, [searchInput, search, update]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setAdminsSearch(adminsInput.trim());
      setAdminsPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [adminsInput]);

  // A preset range is measured back from when it was chosen, so the query key
  // stays put instead of moving with the clock on every render.
  const range = useMemo(() => {
    if (rangeKey === 'custom') {
      return {
        from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : undefined,
        to: customTo ? new Date(`${customTo}T23:59:59.999`).toISOString() : undefined,
      };
    }
    const preset = RANGES.find((r) => r.key === rangeKey);
    return preset?.ms ? { from: new Date(anchor - preset.ms).toISOString() } : {};
  }, [rangeKey, customFrom, customTo, anchor]);

  const rangeLabel = useMemo(() => {
    if (rangeKey === 'custom') return customFrom || customTo ? `${customFrom || '…'} to ${customTo || 'now'}` : 'custom range';
    return (RANGES.find((r) => r.key === rangeKey)?.label || 'Last 30 days').toLowerCase();
  }, [rangeKey, customFrom, customTo]);

  const filters: AuditFilters = useMemo(
    () => ({ adminId, targetId, group, actionType, sensitive, ...range, search: search || undefined, page, limit }),
    [adminId, targetId, group, actionType, sensitive, range, search, page, limit]
  );

  const { data: catalog } = useAuditCatalog();
  // Card totals (every admin in the period) and, when filtering by one admin, their row.
  const { data: summary } = useAuditTeam({ ...range, limit: 1 });
  const { data: selected } = useAuditTeam({ ...range, adminId, limit: 1 }, Boolean(adminId));
  const selectedAdmin = adminId ? selected?.team[0] : undefined;
  const { data, isLoading, isError } = useAuditLogs(filters);
  const { data: adminsData, isLoading: adminsLoading } = useAuditTeam(
    {
      ...range,
      search: adminsSearch || undefined,
      activity: adminsActivity || undefined,
      sort: adminsSort,
      order: adminsOrder,
      page: adminsPage,
      limit,
    },
    view === 'admins'
  );
  const logs = data?.logs || [];
  const totals = summary?.totals;

  const groupActions = useMemo(
    () => (catalog?.actions || []).filter((a) => !group || a.group === group),
    [catalog, group]
  );

  // New rows arrive over the socket (superadmins only); refresh what's on screen.
  useEffect(() => {
    if (!socket) return;
    const onNew = () =>
      queryClient.invalidateQueries({ queryKey: [AUDIT_QUERY_KEY], predicate: (q) => q.queryKey[1] !== 'catalog' });
    socket.on('activity:new', onNew);
    return () => {
      socket.off('activity:new', onNew);
    };
  }, [socket, queryClient]);

  // CSV of exactly what the log is showing (every page, newest first, up to 5,000).
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const { page: _page, limit: _limit, ...current } = filters;
      const { blob, filename, count, total } = await auditService.exportCsv(current);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(
        total > count
          ? `Exported the newest ${count.toLocaleString()} of ${total.toLocaleString()} entries`
          : `Exported ${count.toLocaleString()} entr${count === 1 ? 'y' : 'ies'}`
      );
    } catch {
      toast.error("Couldn't export the audit log");
    } finally {
      setExporting(false);
    }
  };

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [AUDIT_QUERY_KEY], predicate: (q) => q.queryKey[1] !== 'catalog' });
  }, [queryClient]);

  const openTarget = useCallback(
    async (log: AuditLogEntry) => {
      const id = targetIdOf(log);
      try {
        switch (log.targetType) {
          case 'user': {
            if (!id) return;
            const user = await usersService.getUserById(id);
            if (user) {
              setSelectedUser(user);
              setUserModalOpen(true);
            }
            return;
          }
          case 'transaction': {
            if (!id) return;
            const transaction = await transactionsService.getTransactionById(id);
            if (transaction) {
              setSelectedTransaction(transaction as Transaction);
              setTransactionModalOpen(true);
            }
            return;
          }
          case 'job':
            return navigate('/jobs');
          case 'support':
            return navigate('/support');
          case 'verification':
            return navigate('/verifications');
          default:
            if (log.targetType && CONFIG_TARGET_TYPES.has(log.targetType)) navigate('/settings/configuration');
        }
      } catch (error) {
        console.error('Error opening audit target:', error);
        toast.error('Failed to load details');
      }
    },
    [navigate]
  );

  const keepLogPage = () => params.get('page') || undefined;
  // The open entry lives in the URL (?entry=), so the panel's "Copy link" shares it.
  const openEntry = (id: string) => update({ entry: id, page: keepLogPage() });
  const closeEntry = () => update({ entry: undefined, page: keepLogPage() });
  const showLog = (changes: Record<string, string | undefined> = {}) => update({ tab: undefined, ...changes });
  /** The view toggle keeps the admins search (back to the list you left); the card starts fresh. */
  const showAdmins = (activity: AdminActivityFilter = '', { resetSearch = false } = {}) => {
    if (resetSearch) {
      setAdminsInput('');
      setAdminsSearch('');
    }
    setAdminsActivity(activity);
    setAdminsPage(1);
    update({ tab: 'admins', page: keepLogPage() });
  };
  const sortAdmins = (key: AdminSortKey) => {
    if (key === adminsSort) setAdminsOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else {
      setAdminsSort(key);
      setAdminsOrder(key === 'name' ? 'asc' : 'desc');
    }
    setAdminsPage(1);
  };
  const changeRange = (key: string) => {
    setAnchor(Date.now());
    setAdminsPage(1);
    update({ range: key === DEFAULT_RANGE ? undefined : key, from: undefined, to: undefined });
  };
  const changeLimit = (size: number) => {
    setAdminsPage(1);
    update({ size: size === DEFAULT_PAGE_SIZE ? undefined : String(size) });
  };

  const hasLogFilters = Boolean(adminId || targetId || group || actionType || sensitive || search || rangeKey !== DEFAULT_RANGE);
  const clearLogFilters = () => {
    setSearchInput('');
    setParams(new URLSearchParams(), { replace: true });
  };

  // Stat cards double as filters, as on the other list pages.
  const cards = [
    {
      key: 'actions',
      title: 'Total Actions',
      value: totals ? totals.actions.toLocaleString() : '—',
      icon: ActivityIcon,
      color: 'blue' as const,
      active: view === 'log' && !sensitive && !signInsOnly,
      onClick: () => showLog({ sensitive: undefined, action: signInsOnly ? undefined : actionType }),
    },
    {
      key: 'sensitive',
      title: 'Sensitive Actions',
      value: totals ? totals.sensitive.toLocaleString() : '—',
      icon: ShieldAlert,
      color: 'red' as const,
      active: view === 'log' && sensitive,
      onClick: () =>
        showLog({ sensitive: view === 'log' && sensitive ? undefined : '1', action: signInsOnly ? undefined : actionType }),
    },
    {
      key: 'logins',
      title: 'Sign-ins',
      value: totals ? totals.logins.toLocaleString() : '—',
      icon: LogIn,
      color: 'purple' as const,
      active: view === 'log' && signInsOnly,
      onClick: () =>
        showLog({ sensitive: undefined, group: undefined, action: view === 'log' && signInsOnly ? undefined : 'admin_login' }),
    },
    {
      key: 'admins',
      title: 'Active Admins',
      value: totals ? `${totals.activeAdmins} of ${totals.admins}` : '—',
      icon: Users,
      color: 'green' as const,
      active: view === 'admins',
      onClick: () => showAdmins('active', { resetSearch: true }),
    },
  ];

  const pager =
    view === 'log'
      ? data && { page: data.page, pages: data.pages, total: data.total, size: data.limit, go: (p: number) => update({ page: String(p) }) }
      : adminsData && { page: adminsData.page, pages: adminsData.pages, total: adminsData.total, size: adminsData.limit, go: (p: number) => setAdminsPage(p) };

  const loading = view === 'log' ? isLoading : adminsLoading && !adminsData;

  return (
    <div className="fixed inset-0 md:left-72 flex flex-col bg-gray-50 mt-16 md:mt-0 h-screen overflow-hidden" data-testid="audit-log-page">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 pb-2 md:px-6 md:py-5">
          <div className="hidden md:flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Audit Log</h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                Track every action taken by admins across the platform — who did it, to whom, and when
              </p>
            </div>
            <div className="flex items-center gap-0.5 p-1 bg-white border border-gray-200 rounded-xl shadow-sm" data-testid="audit-view-toggle">
              {(
                [
                  ['log', 'Activity Log'],
                  ['admins', `Admins${totals ? ` (${totals.admins.toLocaleString()})` : ''}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  data-testid={`audit-tab-${key}`}
                  onClick={() => (key === 'log' ? showLog({ page: keepLogPage() }) : showAdmins())}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${
                    view === key ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Header */}
          <div className="md:hidden">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Actions</p>
                <p className="text-base font-black text-blue-600 leading-tight">{cards[0].value}</p>
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sensitive</p>
                <p className="text-base font-black text-red-600 leading-tight">{cards[1].value}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(
                [
                  { card: cards[0], label: 'All', activeBg: 'bg-blue-500 border-blue-500' },
                  { card: cards[1], label: 'Sensitive', activeBg: 'bg-red-500 border-red-500' },
                  { card: cards[2], label: 'Sign-ins', activeBg: 'bg-purple-500 border-purple-500' },
                  { card: cards[3], label: 'Admins', activeBg: 'bg-emerald-500 border-emerald-500' },
                ] as const
              ).map(({ card, label, activeBg }) => (
                <button
                  key={card.key}
                  type="button"
                  onClick={card.onClick}
                  data-testid={`audit-pill-${card.key}`}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full border transition-all active:scale-95 ${
                    card.active ? `${activeBg} text-white` : 'bg-white border-gray-200 text-gray-600'
                  }`}
                >
                  <span className="text-[11px] font-black">{card.key === 'admins' && totals ? totals.activeAdmins : card.value}</span>
                  <span className={`text-[9px] font-black uppercase tracking-wide ${card.active ? 'text-white/80' : 'text-gray-400'}`}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
              <div key={card.key} className="cursor-pointer" onClick={card.onClick} data-testid={`audit-card-${card.key}`}>
                <StatsCard
                  title={card.title}
                  value={card.value}
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

        {/* Filter Bar */}
        <div className="px-4 py-2 md:px-6 md:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
          <div className="flex items-center gap-2 md:flex-1 min-w-0">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 md:left-3 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 md:h-4 md:w-4" />
              {view === 'log' ? (
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search activity..."
                  data-testid="audit-search"
                  className={SEARCH}
                />
              ) : (
                <input
                  type="text"
                  value={adminsInput}
                  onChange={(e) => setAdminsInput(e.target.value)}
                  placeholder="Search admins by name or email..."
                  data-testid="audit-admins-search"
                  className={SEARCH}
                />
              )}
            </div>
            {/* Page Limit - Mobile only */}
            <select
              value={limit}
              onChange={(e) => changeLimit(Number(e.target.value))}
              className="md:hidden bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black text-gray-600 focus:outline-none h-8 px-2 shrink-0"
              aria-label="Page limit"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 md:flex md:items-center md:shrink-0">
            {view === 'log' && (
              <div className="col-span-2 md:col-span-1">
                <AuditAdminPicker value={adminId} selectedLabel={selectedAdmin?.name} range={range} onChange={(id) => update({ admin: id })} />
              </div>
            )}
            <select
              value={rangeKey}
              onChange={(e) => changeRange(e.target.value)}
              className={`${SELECT} ${view === 'admins' ? 'col-span-2' : ''} md:max-w-[160px]`}
              aria-label="Period"
              data-testid="audit-range"
            >
              {RANGES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            {view === 'log' ? (
              <>
                <select
                  value={group || ''}
                  onChange={(e) => update({ group: e.target.value || undefined, action: undefined })}
                  className={`${SELECT} md:max-w-[150px]`}
                  aria-label="Area"
                  data-testid="audit-group"
                >
                  <option value="">All Areas</option>
                  {(catalog?.groups || []).map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </select>
                <select
                  value={actionType || ''}
                  onChange={(e) => update({ action: e.target.value || undefined })}
                  className={`${SELECT} col-span-2 md:col-span-1 md:max-w-[180px]`}
                  aria-label="Action"
                  data-testid="audit-action"
                >
                  <option value="">All Actions</option>
                  {groupActions.map((a) => (
                    <option key={a.key} value={a.key}>
                      {a.label}
                      {a.sensitive ? ' •' : ''}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <div
                className="col-span-2 flex items-center gap-0.5 p-1 bg-white border border-gray-200 rounded-lg md:rounded-xl shadow-sm overflow-x-auto"
                data-testid="audit-admins-activity"
              >
                {ADMIN_ACTIVITY_FILTERS.map((f) => (
                  <button
                    key={f.key || 'all'}
                    type="button"
                    onClick={() => {
                      setAdminsActivity(f.key);
                      setAdminsPage(1);
                    }}
                    className={`flex-1 md:flex-none px-2.5 py-1 md:py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md md:rounded-lg transition-all whitespace-nowrap ${
                      adminsActivity === f.key ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            {rangeKey === 'custom' && (
              <div className="col-span-2 flex items-center gap-1.5">
                <input
                  type="date"
                  aria-label="From date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => update({ from: e.target.value || undefined })}
                  className="flex-1 md:flex-none h-8 md:h-9 bg-white border border-gray-200 rounded-lg md:rounded-xl shadow-sm px-2 text-xs font-bold text-gray-600"
                />
                <span className="text-[10px] font-black text-gray-400 uppercase">to</span>
                <input
                  type="date"
                  aria-label="To date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => update({ to: e.target.value || undefined })}
                  className="flex-1 md:flex-none h-8 md:h-9 bg-white border border-gray-200 rounded-lg md:rounded-xl shadow-sm px-2 text-xs font-bold text-gray-600"
                />
              </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3 shrink-0">
            {view === 'log' && hasLogFilters && (
              <button
                type="button"
                onClick={clearLogFilters}
                className="inline-flex items-center gap-1 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-gray-800"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Page Limit</span>
              <select
                value={limit}
                onChange={(e) => changeLimit(Number(e.target.value))}
                className="bg-white px-2 py-1 border border-gray-200 rounded-lg shadow-sm text-xs font-black text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                aria-label="Rows per page"
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
            {view === 'log' && (
              <button
                type="button"
                onClick={exportCsv}
                disabled={exporting || !data?.total}
                data-testid="audit-export"
                title="Download every entry matching these filters as a CSV file"
                className="inline-flex items-center gap-1.5 bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm text-xs font-black uppercase tracking-wider text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className={`h-3.5 w-3.5 ${exporting ? 'animate-bounce' : ''}`} />
                {exporting ? 'Exporting' : 'Export'}
              </button>
            )}
          </div>
        </div>

        {view === 'log' && targetId && (
          <div
            className="px-4 md:px-6 py-2 bg-amber-50/70 border-t border-amber-100 flex flex-wrap items-center gap-x-3 gap-y-1"
            data-testid="audit-selected-target"
          >
            <p className="text-sm text-gray-700 min-w-0">
              Every action on <span className="font-bold text-gray-900">{targetName || 'this record'}</span>
            </p>
            <button
              type="button"
              onClick={() => update({ target: undefined, tname: undefined })}
              className="ml-auto inline-flex items-center gap-1 text-[10px] font-black text-amber-800 uppercase tracking-widest hover:text-amber-950"
            >
              <X className="h-3.5 w-3.5" /> Show all actions
            </button>
          </div>
        )}

        {view === 'log' && adminId && (
          <div
            className="px-4 md:px-6 py-2 bg-blue-50/60 border-t border-blue-100 flex flex-wrap items-center gap-x-3 gap-y-1"
            data-testid="audit-selected-admin"
          >
            <AdminAvatar name={selectedAdmin?.name} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 truncate">{selectedAdmin?.name || 'Selected admin'}</p>
              {selectedAdmin && (
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                  {roleLabel(selectedAdmin.userType)}
                  {selectedAdmin.accountStatus && selectedAdmin.accountStatus !== 'active' && (
                    <span className="text-red-600"> · {selectedAdmin.accountStatus}</span>
                  )}
                  {' · '}
                  {selectedAdmin.actions} actions
                  {selectedAdmin.sensitive > 0 && <span className="text-red-600"> · {selectedAdmin.sensitive} sensitive</span>}
                  {' · '}
                  {rangeLabel} · last login {timeAgo(selectedAdmin.lastLogin)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => update({ admin: undefined })}
              className="ml-auto inline-flex items-center gap-1 text-[10px] font-black text-blue-700 uppercase tracking-widest hover:text-blue-900"
            >
              <X className="h-3.5 w-3.5" /> Show everyone
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto" data-testid="audit-results">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                <p className="text-gray-500">{view === 'log' ? 'Loading activity...' : 'Loading admins...'}</p>
              </div>
            </div>
          ) : view === 'admins' ? (
            adminsData && adminsData.team.length > 0 ? (
              <AuditAdminsTable
                rows={adminsData.team}
                sort={adminsSort}
                order={adminsOrder}
                onSort={sortAdmins}
                onSelectAdmin={(id) => showLog({ admin: id })}
              />
            ) : (
              <div className="bg-white p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <Search className="h-12 w-12 mx-auto" />
                </div>
                <p className="text-gray-600 font-medium">No admins found</p>
                <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
              </div>
            )
          ) : isError ? (
            <div className="bg-white p-12 text-center">
              <p className="text-gray-600 font-medium">Couldn't load the audit log</p>
              <button type="button" onClick={refresh} className="text-sm text-blue-600 font-medium mt-1 hover:underline">
                Try again
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <ActivityIcon className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No activity found</p>
              <p className="text-sm text-gray-500 mt-1">
                {hasLogFilters ? 'Try adjusting your search or filters' : 'No admin actions in this period'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden md:block bg-white">
                <table className="min-w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr>
                      <th className={`${TH} w-[24%]`}>Admin</th>
                      <th className={`${TH} w-[21%]`}>Action</th>
                      <th className={TH}>What Happened</th>
                      <th className={`${TH} w-[15%]`}>Date</th>
                      <th className={`${TH} w-12`} />
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {logs.map((log) => {
                      const open = entryId === log._id;
                      const cell = TD;
                      return (
                        <React.Fragment key={log._id}>
                          <tr
                            onClick={() => openEntry(log._id)}
                            data-testid="audit-row"
                            className={`group align-top transition-all duration-150 cursor-pointer ${open ? 'bg-blue-50/40' : 'hover:bg-gray-50'}`}
                          >
                            <td className={cell}>
                              <div className="flex items-center gap-3 min-w-0">
                                <AdminAvatar name={log.adminId?.name} />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-gray-900 truncate">{log.adminId?.name || 'Unknown Admin'}</p>
                                  <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
                                    {log.adminId?.userType === 'superadmin' && <SuperAdminTag />}
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate">{log.adminId?.email || 'No email'}</p>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className={cell}>
                              <AuditActionBadge action={lookupAction(catalog, log.actionType)} />
                            </td>
                            <td className={cell}>
                              <p className="text-sm text-gray-900 break-words">{log.description}</p>
                              <TargetLink log={log} onOpen={openTarget} />
                            </td>
                            <td className={cell}>
                              <p className="text-xs font-bold text-gray-900 whitespace-nowrap" title={exactTime(log.createdAt)}>
                                {timeAgo(log.createdAt)}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase mt-1 whitespace-nowrap">
                                <Calendar className="h-3 w-3" />
                                {shortTime(log.createdAt)}
                              </div>
                            </td>
                            <td className={`${cell} text-gray-300 group-hover:text-gray-500`}>
                              <ChevronRight className="h-4 w-4" />
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden px-3 py-3 space-y-2">
                {logs.map((log) => {
                  const open = entryId === log._id;
                  return (
                    <div
                      key={log._id}
                      onClick={() => openEntry(log._id)}
                      data-testid="audit-card"
                      className={`bg-white rounded-xl border shadow-sm overflow-hidden active:scale-[0.98] transition-all ${open ? 'border-blue-300' : 'border-gray-300'}`}
                    >
                      <div className="flex items-center justify-between px-3 py-2 gap-1.5 bg-gray-50/80 border-b border-gray-100">
                        <AuditActionBadge action={lookupAction(catalog, log.actionType)} size="sm" />
                        <span className="text-[10px] font-bold text-gray-400 bg-white px-2 py-0.5 rounded border border-gray-100 uppercase tracking-widest whitespace-nowrap">
                          {timeAgo(log.createdAt)}
                        </span>
                      </div>
                      <div className="px-3 py-2.5">
                        <div className="flex items-start gap-3">
                          <AdminAvatar name={log.adminId?.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-gray-900 leading-tight truncate">{log.adminId?.name || 'Unknown Admin'}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider truncate mb-1.5">{log.adminId?.email || 'No email'}</p>
                            <p className="text-xs text-gray-900 break-words">{log.description}</p>
                            <TargetLink log={log} onOpen={openTarget} />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination — outside scroll, always sticky at bottom */}
        {pager && pager.pages > 1 && (
          <div className="flex-shrink-0 bg-white border-t border-gray-200 z-10 px-4 h-[65px] flex items-center" data-testid="audit-pagination">
            <div className="flex items-center justify-between w-full">
              <p className="text-xs md:text-sm text-gray-700">
                Showing <span className="font-medium">{((pager.page - 1) * pager.size + 1).toLocaleString()}</span> to{' '}
                <span className="font-medium">{Math.min(pager.page * pager.size, pager.total).toLocaleString()}</span> of{' '}
                <span className="font-medium">{pager.total.toLocaleString()}</span> {view === 'log' ? 'results' : 'admins'}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => pager.go(pager.page - 1)}
                  disabled={pager.page <= 1}
                  className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => pager.go(pager.page + 1)}
                  disabled={pager.page >= pager.pages}
                  className="px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AuditEntryPanel
        entryId={entryId}
        catalog={catalog}
        onClose={closeEntry}
        onOpenEntry={openEntry}
        onShowAdmin={(id) => update({ admin: id, entry: undefined, tab: undefined })}
        onOpenReport={(reportId) => navigate(`/flagged?reportId=${reportId}`)}
        onShowTarget={(id, label) =>
          update({ target: id, tname: label, entry: undefined, tab: undefined, admin: undefined, group: undefined, action: undefined, sensitive: undefined, range: 'all' })
        }
        onOpenTarget={openTarget}
      />

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
            refresh();
          } catch (error) {
            toast.error('Failed to update verification');
          }
        }}
        onAction={async (user: User, action: 'ban' | 'suspend' | 'restrict' | 'unrestrict' | 'delete', duration?: number) => {
          try {
            switch (action) {
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
            toast.success(`User ${action}ed successfully`);
            refresh();
          } catch (error) {
            toast.error(`Failed to ${action} user`);
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
