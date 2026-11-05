import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Activity as ActivityIcon, ArrowUpRight, Clock, Download, Search, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { auditService, usersService, transactionsService } from '../services';
import { UserDetailsModal, TransactionDetailsModal } from '../components/Modals';
import { AUDIT_QUERY_KEY, useAuditCatalog, useAuditLogs, useAuditSummary, useAuditTeam } from '../hooks/useAudit';
import { useSocket } from '../context/SocketContext';
import CounterGroups from '../components/UI/CounterGroups';
import type { Counter, CounterGroup } from '../components/UI/CounterGroups';
import { ListFooter, SortHeader, selectClass } from '../components/UI/ListControls';
import AuditAdminPicker from '../components/Audit/AuditAdminPicker';
import AuditAdminsTable, { type AdminActivityFilter, type AdminSortKey } from '../components/Audit/AuditAdminsTable';
import AuditEntryPanel from '../components/Audit/AuditEntryPanel';
import {
  AREAS,
  CONFIG_TARGET_TYPES,
  OPENABLE_TARGET_TYPES,
  SIGN_INS,
  areaLook,
  areaOf,
  exactTime,
  initials,
  lookupAction,
  roleLabel,
  roleText,
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
const AREA_KEYS = [...AREAS.map((a) => a.key), SIGN_INS.key];

const TH = 'px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200';
const TD = 'px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle';

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

/** The record a row is about, under its sentence; opens it when the log can. */
const TargetLine: React.FC<{ log: AuditLogEntry; onOpen: (log: AuditLogEntry) => void }> = ({ log, onOpen }) => {
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
      data-testid="audit-row-target"
      className="mt-1 inline-flex items-center gap-1 max-w-full text-[11px] font-semibold text-blue-600 hover:text-blue-800"
    >
      <span className="truncate">{label}</span>
      <ArrowUpRight className="h-3 w-3 flex-shrink-0" />
    </button>
  ) : (
    <p className="mt-1 text-[11px] font-medium text-gray-500 truncate">{label}</p>
  );
};

const AdminAvatar: React.FC<{ name?: string | null }> = ({ name }) => (
  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 border border-gray-100">
    <span className="text-sm font-bold text-blue-600 uppercase">{initials(name)}</span>
  </div>
);

/**
 * Audit Log — every admin action: who did it, what it touched, and when.
 * Superadmin-only (server-enforced; the route and nav item are hidden too).
 * The same counters, rows and footer as the other list pages: the counters
 * split the log by area (sign-ins apart) and flag what's sensitive, and every
 * number is the rows clicking it shows. Filters live in the URL so a view can
 * be linked; the Edit Admin panel opens it as /activity?admin=<id>.
 */
const Activity: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [params, setParams] = useSearchParams();

  const view = params.get('tab') === 'admins' ? 'admins' : 'log';
  const adminId = params.get('admin') || undefined;
  const groupParam = params.get('group') || undefined;
  const group = groupParam && AREA_KEYS.includes(groupParam) ? groupParam : undefined;
  const actionType = params.get('action') || undefined;
  const sensitive = params.get('sensitive') === '1';
  const order = params.get('order') === 'asc' ? 'asc' : 'desc';
  const rangeKey = params.get('range') || DEFAULT_RANGE;
  const customFrom = params.get('from') || '';
  const customTo = params.get('to') || '';
  const search = params.get('q') || '';
  const page = Math.max(Number(params.get('page')) || 1, 1);
  const limit = PAGE_SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : DEFAULT_PAGE_SIZE;
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
    if (rangeKey === 'custom') return customFrom || customTo ? `${customFrom || '…'} to ${customTo || 'now'}` : 'in a custom range';
    return (RANGES.find((r) => r.key === rangeKey)?.label || 'Last 30 days').toLowerCase();
  }, [rangeKey, customFrom, customTo]);

  const filters: AuditFilters = useMemo(
    () => ({ adminId, targetId, group, actionType, sensitive, ...range, search: search || undefined, order: order === 'asc' ? 'asc' : undefined, page, limit }),
    [adminId, targetId, group, actionType, sensitive, range, search, order, page, limit]
  );
  // The counters' scope: everything but the area / action / sensitive choice.
  const summaryFilters = useMemo(
    () => ({ adminId, targetId, ...range, search: search || undefined }),
    [adminId, targetId, range, search]
  );

  const { data: catalog } = useAuditCatalog();
  const { data: summary } = useAuditSummary(summaryFilters, view === 'log');
  // Totals for the header and the view toggle, and the filtered admin's row.
  const { data: teamTotals } = useAuditTeam({ ...range, limit: 1 });
  const { data: selected } = useAuditTeam({ ...range, adminId, limit: 1 }, Boolean(adminId));
  const selectedAdmin = adminId ? selected?.team[0] : undefined;
  const { data, isLoading, isError, isPlaceholderData } = useAuditLogs(filters, view === 'log');
  const { data: adminsData, isLoading: adminsLoading, isPlaceholderData: adminsPlaceholder } = useAuditTeam(
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
  const totals = teamTotals?.totals;

  // Actions offered in the Action filter: those in the chosen area.
  const groupActions = useMemo(
    () => (catalog?.actions || []).filter((a) => !group || areaOf(a) === group),
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
      const { page: _page, limit: _limit, order: _order, ...current } = filters;
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
            return navigate(id ? `/support?id=${id}` : '/support');
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
  const showAdmins = () => update({ tab: 'admins', page: keepLogPage() });
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

  // ── Counters ──────────────────────────────────────────────────────────────
  // Summed per area from the catalog, so each one is the rows its click shows.
  const countArea = (area: string, sensitiveOnly: boolean) =>
    summary && catalog
      ? catalog.actions
          .filter((a) => areaOf(a) === area && (!sensitiveOnly || a.sensitive))
          .reduce((n, a) => n + (summary.byAction[a.key] || 0), 0)
      : undefined;
  const sensitiveCount = () =>
    summary && catalog
      ? group
        ? countArea(group, true)
        : catalog.actions.filter((a) => a.sensitive).reduce((n, a) => n + (summary.byAction[a.key] || 0), 0)
      : undefined;

  // Clicking the selected counter again lifts that filter; an area drops the
  // action filter (the action may belong to another area).
  const chooseArea = (key: string) => showLog({ group: group === key ? undefined : key, action: undefined });
  const toggleSensitive = () => showLog({ sensitive: sensitive ? undefined : '1' });

  const areaCell = (area: { key: string; label: string; tone: Counter['tone']; hint: string }): Counter => ({
    key: area.key,
    label: area.label,
    tone: area.tone,
    hint: area.hint,
    count: area.key === SIGN_INS.key && sensitive ? 0 : countArea(area.key, sensitive),
    selected: group === area.key,
    onClick: () => chooseArea(area.key),
  });
  const changesTotal = AREAS.reduce((n, a) => n + (countArea(a.key, sensitive) || 0), 0);
  const logGroups: CounterGroup[] = [
    { label: 'Changes by area', total: summary ? changesTotal : undefined, cells: AREAS.map(areaCell) },
    {
      label: 'Also',
      cells: [
        areaCell(SIGN_INS),
        {
          key: 'sensitive',
          label: 'Sensitive',
          tone: 'red',
          hint: "Changes someone's access, moves money, or changes what every user sees",
          alert: true,
          count: sensitiveCount(),
          selected: sensitive,
          onClick: toggleSensitive,
        },
      ],
    },
  ];

  const adminCounts = adminsData?.counts;
  const chooseActivity = (key: AdminActivityFilter) => {
    setAdminsActivity(adminsActivity === key ? '' : key);
    setAdminsPage(1);
  };
  const adminGroups: CounterGroup[] = [
    {
      label: 'In this period',
      cells: ([
        { key: 'active', label: 'Active', tone: 'emerald', hint: 'Did at least one thing besides signing in' },
        { key: 'sensitive', label: 'Sensitive', tone: 'red', hint: 'Did at least one sensitive action' },
        { key: 'none', label: 'No activity', tone: 'gray', hint: 'Did nothing besides signing in, or nothing at all' },
      ] as const).map((cell) => ({
        ...cell,
        count: adminCounts?.[cell.key],
        selected: adminsActivity === cell.key,
        onClick: () => chooseActivity(cell.key),
      })),
    },
  ];

  const hasLogFilters = Boolean(adminId || targetId || group || actionType || sensitive || search || order === 'asc' || rangeKey !== DEFAULT_RANGE);
  const clearLogFilters = () => {
    setSearchInput('');
    setParams(new URLSearchParams(), { replace: true });
  };
  const hasAdminFilters = Boolean(adminsSearch || adminsActivity || rangeKey !== DEFAULT_RANGE);
  const clearAdminFilters = () => {
    setAdminsInput('');
    setAdminsSearch('');
    setAdminsActivity('');
    setAdminsPage(1);
    update({ range: undefined, from: undefined, to: undefined, tab: 'admins' });
  };

  const sensitiveTotal = summary && catalog ? catalog.actions.filter((a) => a.sensitive).reduce((n, a) => n + (summary.byAction[a.key] || 0), 0) : 0;
  const loading = view === 'log' ? isLoading && !data : adminsLoading && !adminsData;
  const faded = view === 'log' ? isPlaceholderData : adminsPlaceholder;

  return (
    <div className="fixed top-16 md:top-0 bottom-0 left-0 md:left-72 right-0 flex flex-col bg-gray-50 overflow-hidden" data-testid="audit-log-page">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 md:px-6 md:pt-5">
          <div className="flex items-start justify-between gap-4 mb-3 md:mb-5">
            <div className="min-w-0 hidden md:block">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Audit Log</h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {view === 'log'
                  ? summary
                    ? `${summary.total.toLocaleString()} entries ${rangeKey === 'all' ? 'in all' : rangeLabel}`
                    : 'Everything admins did — who, what, and when'
                  : totals
                    ? `${totals.admins.toLocaleString()} admin accounts · ${totals.activeAdmins} active ${rangeKey === 'all' ? 'ever' : rangeLabel}`
                    : 'Every admin account and what they did'}
                {view === 'log' && sensitiveTotal > 0 && (
                  <span className="text-red-600 font-semibold"> · {sensitiveTotal.toLocaleString()} sensitive</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-0.5 p-1 bg-white border border-gray-200 rounded-xl shadow-sm w-full md:w-auto" data-testid="audit-view-toggle">
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
                  className={`flex-1 md:flex-none px-3 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap ${
                    view === key ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {view === 'log' ? (
            <CounterGroups
              groups={logGroups}
              gridClass="grid-cols-[0.8fr_7fr_2fr]"
              all={{ count: summary?.total, selected: !group && !sensitive && !actionType, onClick: () => showLog({ group: undefined, action: undefined, sensitive: undefined }) }}
              filtered={hasLogFilters}
              onClear={clearLogFilters}
              testId="audit-counters"
              idPrefix="audit"
              allCell={{ label: 'All', hint: 'Every entry under the admin, period and search filters' }}
            />
          ) : (
            <CounterGroups
              groups={adminGroups}
              gridClass="grid-cols-[0.8fr_3fr] max-w-2xl"
              all={{ count: adminCounts?.all, selected: !adminsActivity, onClick: () => chooseActivity('') }}
              filtered={hasAdminFilters}
              onClear={clearAdminFilters}
              testId="audit-admin-counters"
              idPrefix="audit-admins"
              allCell={{ label: 'All', hint: 'Every admin account' }}
            />
          )}
        </div>

        {/* Filter Bar — one bar for every width. Phones stack it; from lg it's one row. */}
        <div className="px-4 lg:px-6 py-2 lg:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="relative w-full lg:w-auto lg:flex-1 lg:min-w-[200px]">
            <Search className="absolute left-3 lg:left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 lg:h-4 lg:w-4" />
            {view === 'log' ? (
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search what happened, a name, or an admin..."
                data-testid="audit-search"
                className="w-full pl-8 pr-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium transition-all shadow-sm lg:pl-10 lg:pr-4 lg:h-9 lg:rounded-xl lg:text-sm"
              />
            ) : (
              <input
                type="text"
                value={adminsInput}
                onChange={(e) => setAdminsInput(e.target.value)}
                placeholder="Search admins by name or email..."
                data-testid="audit-admins-search"
                className="w-full pl-8 pr-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium transition-all shadow-sm lg:pl-10 lg:pr-4 lg:h-9 lg:rounded-xl lg:text-sm"
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 w-full lg:w-auto lg:flex lg:items-center">
            {view === 'log' && (
              <div className="col-span-2 lg:col-span-1">
                <AuditAdminPicker value={adminId} selectedLabel={selectedAdmin?.name} range={range} onChange={(id) => update({ admin: id })} />
              </div>
            )}
            <select
              value={rangeKey}
              onChange={(e) => changeRange(e.target.value)}
              className={`${selectClass} ${view === 'admins' ? 'col-span-2' : ''} lg:w-[150px]`}
              aria-label="Period"
              data-testid="audit-range"
            >
              {RANGES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
            {view === 'log' && (
              <select
                value={actionType || ''}
                onChange={(e) => update({ action: e.target.value || undefined })}
                className={`${selectClass} lg:w-[190px]`}
                aria-label="Action"
                data-testid="audit-action"
              >
                <option value="">{group ? `Every ${areaLook(group)?.label.toLowerCase()} action` : 'All actions'}</option>
                {groupActions.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                    {a.sensitive ? ' •' : ''}
                  </option>
                ))}
              </select>
            )}
            {rangeKey === 'custom' && (
              <div className="col-span-2 flex items-center gap-1.5">
                <input
                  type="date"
                  aria-label="From date"
                  value={customFrom}
                  max={customTo || undefined}
                  onChange={(e) => update({ from: e.target.value || undefined })}
                  className="flex-1 lg:flex-none h-8 lg:h-9 bg-white border border-gray-200 rounded-lg lg:rounded-xl shadow-sm px-2 text-xs font-bold text-gray-600"
                />
                <span className="text-[10px] font-black text-gray-400 uppercase">to</span>
                <input
                  type="date"
                  aria-label="To date"
                  value={customTo}
                  min={customFrom || undefined}
                  onChange={(e) => update({ to: e.target.value || undefined })}
                  className="flex-1 lg:flex-none h-8 lg:h-9 bg-white border border-gray-200 rounded-lg lg:rounded-xl shadow-sm px-2 text-xs font-bold text-gray-600"
                />
              </div>
            )}
            {view === 'log' && (
              <button
                type="button"
                onClick={exportCsv}
                disabled={exporting || !data?.total}
                data-testid="audit-export"
                title="Download every entry matching these filters as a CSV file"
                className="hidden lg:inline-flex items-center gap-1.5 bg-white px-3 h-9 border border-gray-200 rounded-xl shadow-sm text-xs font-black uppercase tracking-wider text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download className={`h-3.5 w-3.5 ${exporting ? 'animate-bounce' : ''}`} />
                {exporting ? 'Exporting' : 'Export'}
              </button>
            )}
          </div>
        </div>

        {view === 'log' && targetId && (
          <div
            className="px-4 lg:px-6 py-2 bg-amber-50/70 border-t border-amber-100 flex flex-wrap items-center gap-x-3 gap-y-1"
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
            className="px-4 lg:px-6 py-2 bg-blue-50/60 border-t border-blue-100 flex flex-wrap items-center gap-x-3 gap-y-1"
            data-testid="audit-selected-admin"
          >
            <p className="text-sm text-gray-700 min-w-0 truncate">
              Only what <span className="font-bold text-gray-900">{selectedAdmin?.name || 'this admin'}</span> did
              {selectedAdmin && (
                <span className="text-gray-500">
                  {' '}· {roleLabel(selectedAdmin.userType)}
                  {selectedAdmin.accountStatus && selectedAdmin.accountStatus !== 'active' && (
                    <span className="text-red-600"> · {selectedAdmin.accountStatus}</span>
                  )}
                  {' '}· signed in {timeAgo(selectedAdmin.lastLogin)}
                </span>
              )}
            </p>
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
        <div className={`flex-1 overflow-y-auto transition-opacity ${faded ? 'opacity-60' : ''}`} data-testid="audit-results">
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
              <div className="bg-white p-12 text-center" data-testid="audit-admins-empty">
                <div className="text-gray-300 mb-4">
                  <Search className="h-12 w-12 mx-auto" />
                </div>
                <p className="text-gray-700 font-semibold">No admins found</p>
                <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters.</p>
              </div>
            )
          ) : isError ? (
            <div className="bg-white p-12 text-center">
              <p className="text-gray-700 font-semibold">Couldn't load the audit log</p>
              <button type="button" onClick={refresh} className="text-sm text-blue-600 font-medium mt-1 hover:underline">
                Try again
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white p-12 text-center" data-testid="audit-empty">
              <div className="text-gray-300 mb-4">
                <ActivityIcon className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-700 font-semibold">No activity found</p>
              <p className="text-sm text-gray-500 mt-1">
                {hasLogFilters ? 'Try adjusting your search or filters.' : 'No admin actions in this period.'}
              </p>
              {hasLogFilters && (
                <button type="button" onClick={clearLogFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Show everything
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop View */}
              <div className="hidden lg:block bg-white">
                <table className="w-full table-fixed border-separate border-spacing-0">
                  <thead className="bg-gray-50/80 backdrop-blur-md sticky top-0 z-20">
                    <tr>
                      <th className={`${TH} w-[25%]`}>Admin</th>
                      <th className={`${TH} w-[21%]`}>Action</th>
                      <th className={TH}>What happened</th>
                      <th className={`${TH} w-[15%]`} aria-sort={order === 'asc' ? 'ascending' : 'descending'}>
                        <SortHeader label="When" dir={order} onClick={() => update({ order: order === 'asc' ? undefined : 'asc' })} />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {logs.map((log) => {
                      const action = lookupAction(catalog, log.actionType);
                      const area = areaLook(areaOf(action));
                      return (
                        <tr
                          key={log._id}
                          onClick={() => openEntry(log._id)}
                          data-testid="audit-row"
                          className={`group h-20 cursor-pointer transition-colors ${entryId === log._id ? 'bg-blue-50/60' : 'hover:bg-gray-50/70'}`}
                        >
                          <td className={TD}>
                            <div className="flex items-center gap-3 min-w-0">
                              <AdminAvatar name={log.adminId?.name} />
                              <div className="min-w-0">
                                <p className={`text-[9px] font-black uppercase tracking-wider ${roleText(log.adminId?.userType)}`}>
                                  {roleLabel(log.adminId?.userType) || 'Admin'}
                                </p>
                                <p className="text-sm font-bold text-gray-900 truncate">{log.adminId?.name || 'Unknown admin'}</p>
                                <p className="text-[11px] text-gray-500 truncate">{log.adminId?.email || 'No email'}</p>
                              </div>
                            </div>
                          </td>
                          <td className={TD}>
                            <p className={`text-[9px] font-black uppercase tracking-wider truncate ${area?.text || 'text-gray-400'}`}>{area?.label || 'Other'}</p>
                            <p className="text-sm font-semibold text-gray-900 truncate" title={action.label}>{action.label}</p>
                            {action.sensitive && (
                              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-red-600">
                                <ShieldAlert className="h-3 w-3" />
                                Sensitive
                              </p>
                            )}
                          </td>
                          <td className={TD}>
                            <p className="text-sm text-gray-900 truncate group-hover:text-blue-700 transition-colors" title={log.description}>{log.description}</p>
                            <TargetLine log={log} onOpen={openTarget} />
                          </td>
                          <td className={TD}>
                            <p className="text-xs font-bold text-gray-900 truncate" title={exactTime(log.createdAt)}>{timeAgo(log.createdAt)}</p>
                            <p className="text-[10px] font-medium text-gray-400 mt-1">{shortTime(log.createdAt)}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Phones and tablets */}
              <div className="lg:hidden bg-white px-3 py-3 space-y-2">
                {logs.map((log) => {
                  const action = lookupAction(catalog, log.actionType);
                  const area = areaLook(areaOf(action));
                  return (
                    <div
                      key={log._id}
                      onClick={() => openEntry(log._id)}
                      data-testid="audit-card"
                      className={`bg-white rounded-xl border shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer ${entryId === log._id ? 'border-blue-300' : 'border-gray-200'}`}
                    >
                      <div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
                        <AdminAvatar name={log.adminId?.name} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-[9px] font-black uppercase tracking-wider ${area?.text || 'text-gray-400'}`}>{area?.label || 'Other'}</p>
                          <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{action.label}</p>
                          <p className="mt-0.5 text-[11px] text-gray-500 truncate">
                            by {log.adminId?.name || 'Unknown admin'}
                            {action.sensitive && <span className="text-red-600 font-semibold"> · Sensitive</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                        <p className="flex-1 min-w-0 text-[10px] font-semibold text-gray-500 truncate">{log.description}</p>
                        <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400 flex-shrink-0">
                          <Clock className="h-2.5 w-2.5" />
                          {timeAgo(log.createdAt)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {view === 'log' && data && data.total > 0 && (
          <ListFooter page={data.page} limit={data.limit} total={data.total} pages={data.pages} onPage={(p) => update({ page: String(p) })} onLimit={changeLimit} />
        )}
        {view === 'admins' && adminsData && adminsData.total > 0 && (
          <ListFooter page={adminsData.page} limit={adminsData.limit} total={adminsData.total} pages={adminsData.pages} onPage={setAdminsPage} onLimit={changeLimit} />
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
        covered={userModalOpen || transactionModalOpen}
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
