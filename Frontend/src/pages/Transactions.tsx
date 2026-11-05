import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  Search,
  Receipt,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Clock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';

// Component imports
import { DateRangePicker } from '../components/Transactions';
import { TransactionDetailsModal } from '../components/Modals';
import CounterGroups from '../components/UI/CounterGroups';
import type { Counter, CounterGroup, Tone } from '../components/UI/CounterGroups';
import { SortHeader, ListFooter, selectClass, ago } from '../components/UI/ListControls';
import { pesoShort } from '../components/Dashboard/dashboardFormat';
import {
  KIND_ICON,
  PartyLine,
  StatusBadge,
  StatusText,
  describe,
  kindLabel,
  methodOf,
  partiesOf,
  peso,
  titleCase,
} from '../components/Transactions/txPresentation';
import type { TxKind } from '../components/Transactions/txPresentation';

// Type imports
import type { Transaction, TransactionsSort } from '../types';

// Utility imports
import { getTransactionIcon } from '../utils';

// Hooks
import { useTransactions, useTransactionCounts, useTransactionMutations } from '../hooks/useTransactions';
import { useJobCategories } from '../hooks/useJobs';

type Category = 'platform_fee' | 'wallet_topup' | 'withdrawal' | 'refund_request';

interface StatusDef {
  key: string;
  label: string;
  tone: Tone;
  hint: string;
  /** Needs an admin: the number turns amber while anything is waiting. */
  alert?: boolean;
  /** Show the amount beside the number. */
  money?: boolean;
}

interface PageDef {
  title: string;
  icon: LucideIcon;
  /** The API's transaction type. */
  type: string;
  /** "<n> …" in the subtitle. */
  noun: string;
  waiting: { label: string; statuses: StatusDef[] };
  finished: { label: string; statuses: StatusDef[] };
}

const PAGES: Record<Category, PageDef> = {
  platform_fee: {
    title: 'Fee Records',
    icon: Receipt,
    type: 'platform_fee',
    noun: 'platform fees charged on jobs',
    waiting: { label: 'Outstanding', statuses: [
      { key: 'pending', label: 'Pending', tone: 'amber', money: true, hint: 'Charged, not collected yet' },
    ] },
    finished: { label: 'Settled', statuses: [
      { key: 'completed', label: 'Collected', tone: 'emerald', money: true, hint: "Taken from the payer's wallet" },
      { key: 'failed', label: 'Failed', tone: 'red', hint: 'Could not be collected' },
      { key: 'cancelled', label: 'Cancelled', tone: 'gray', hint: 'Called off; nothing is owed' },
    ] },
  },
  wallet_topup: {
    title: 'Top-up Transactions',
    icon: ArrowDownLeft,
    type: 'xendit_topup',
    noun: 'wallet top-ups through Xendit',
    waiting: { label: 'In progress', statuses: [
      { key: 'pending', label: 'Pending', tone: 'amber', money: true, hint: 'Waiting for Xendit to confirm the payment' },
    ] },
    finished: { label: 'Finished', statuses: [
      { key: 'completed', label: 'Credited', tone: 'emerald', money: true, hint: 'Paid and added to the wallet' },
      { key: 'failed', label: 'Failed', tone: 'red', hint: 'The payment did not go through' },
      { key: 'cancelled', label: 'Cancelled', tone: 'gray', hint: 'Called off before paying' },
      { key: 'expired', label: 'Expired', tone: 'gray', hint: 'Never paid before the link expired' },
    ] },
  },
  withdrawal: {
    title: 'Cashout Transactions',
    icon: ArrowUpRight,
    type: 'withdrawal',
    noun: 'cash-outs to bank and e-wallet accounts',
    waiting: { label: 'Needs action', statuses: [
      { key: 'pending', label: 'Pending', tone: 'amber', alert: true, money: true, hint: 'Waiting for an admin to pay it out' },
    ] },
    finished: { label: 'Finished', statuses: [
      { key: 'completed', label: 'Paid out', tone: 'emerald', money: true, hint: 'Sent to the account' },
      { key: 'failed', label: 'Failed', tone: 'red', hint: 'The payout did not go through' },
      { key: 'cancelled', label: 'Cancelled', tone: 'gray', hint: 'Called off; the money stayed in the wallet' },
    ] },
  },
  refund_request: {
    title: 'Refund Transactions',
    icon: RotateCcw,
    type: 'refund_request',
    noun: 'refund requests from clients',
    waiting: { label: 'Needs action', statuses: [
      { key: 'pending', label: 'Awaiting decision', tone: 'amber', alert: true, money: true, hint: 'A client asked for money back; approve or decline it' },
    ] },
    finished: { label: 'Decided', statuses: [
      { key: 'completed', label: 'Approved', tone: 'emerald', money: true, hint: 'Refunded to the client' },
      { key: 'failed', label: 'Declined', tone: 'red', hint: 'Turned down by an admin' },
      { key: 'cancelled', label: 'Cancelled', tone: 'gray', hint: 'Withdrawn before a decision' },
    ] },
  },
};

// Each route's kind of money, for the shared presentation helpers.
const KIND: Record<Category, TxKind> = { platform_fee: 'fee', wallet_topup: 'topup', withdrawal: 'cashout', refund_request: 'refund' };

const categoryOf = (path: string): Category => {
  if (path.includes('top-up')) return 'wallet_topup';
  if (path.includes('cashout')) return 'withdrawal';
  if (path.includes('refund')) return 'refund_request';
  return 'platform_fee';
};

const SORTS: { value: TransactionsSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount_desc', label: 'Highest amount' },
  { value: 'amount_asc', label: 'Lowest amount' },
];

/**
 * Transactions Page — Fee Records, Top-up, Cashout and Refund, one page per
 * route. The same counters, rows and footer as the Jobs page: counters by
 * status (with what is waiting first), each row naming who is involved and
 * what the money is waiting on.
 */
const Transactions: React.FC = () => {
  const location = useLocation();
  const { categories } = useJobCategories();
  const category = categoryOf(location.pathname);
  const pageDef = PAGES[category];
  const kind = KIND[category];

  // The status filter lives in the URL (the Dashboard links to ?status=pending).
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || 'all';
  const setStatus = (status: string) => {
    const next = new URLSearchParams();
    if (status !== 'all') next.set('status', status);
    setSearchParams(next, { replace: true });
  };
  const chooseStatus = (status: string) => setStatus(status === statusFilter ? 'all' : status);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<TransactionsSort>('newest');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionModal, setTransactionModal] = useState({ isOpen: false });

  // The list's own filters; the counters are narrowed by the same ones.
  const filters = useMemo(() => ({
    ...(searchTerm && { search: searchTerm }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  }), [searchTerm, dateFrom, dateTo]);

  const queryParams = useMemo(() => ({
    page,
    limit,
    type: pageDef.type,
    ...filters,
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(sort !== 'newest' && { sort }),
  }), [page, limit, pageDef.type, filters, statusFilter, sort]);

  const { data: transactionsData, isLoading, isPlaceholderData } = useTransactions(queryParams);
  const { data: counts } = useTransactionCounts(pageDef.type, filters);
  const mutations = useTransactionMutations();

  const transactions = transactionsData?.transactions || [];
  const total = transactionsData?.pagination?.total || 0;
  const pages = transactionsData?.pagination?.pages || 0;

  useEffect(() => {
    setPage(1);
  }, [category, searchTerm, statusFilter, dateFrom, dateTo, sort, limit]);

  // A new route is a new list: its own search, dates and order.
  useEffect(() => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setSort('newest');
  }, [category]);

  const countOf = (key: string): number | undefined => {
    if (!counts) return undefined;
    if (counts.byStatus) return counts.byStatus[key]?.count || 0;
    return (counts as any)[key] ?? 0; // a backend from before byStatus
  };
  const amountOf = (key: string): number => (counts?.byStatus ? counts.byStatus[key]?.amount || 0 : (counts as any)?.[`${key}Amount`] || 0);

  const toCounter = (def: StatusDef): Counter => {
    const amount = amountOf(def.key);
    return {
      key: def.key,
      label: def.label,
      tone: def.tone,
      hint: def.hint,
      alert: def.alert,
      count: countOf(def.key),
      selected: statusFilter === def.key,
      onClick: () => chooseStatus(def.key),
      ...(def.money && amount > 0 ? { extra: { full: peso(amount), short: pesoShort(amount) } } : {}),
    };
  };

  // Any status the page has no counter for (processing, refunded…) still gets
  // one when it has rows, so the counters always add up to All.
  const known = new Set([...pageDef.waiting.statuses, ...pageDef.finished.statuses].map((s) => s.key));
  const extraStatuses: StatusDef[] = Object.entries(counts?.byStatus || {})
    .filter(([key, v]) => !known.has(key) && v.count > 0)
    .map(([key]) => ({ key, label: titleCase(key), tone: 'gray' as Tone, hint: `Status: ${key}` }));
  const finishedDefs = [...pageDef.finished.statuses, ...extraStatuses];

  const groups: CounterGroup[] = [
    { label: pageDef.waiting.label, cells: pageDef.waiting.statuses.map(toCounter) },
    {
      label: pageDef.finished.label,
      total: counts ? finishedDefs.reduce((n, s) => n + (countOf(s.key) || 0), 0) : undefined,
      cells: finishedDefs.map(toCounter),
    },
  ];
  const finishedCells = finishedDefs.length;
  const gridClass = finishedCells >= 4 ? 'grid-cols-[0.8fr_1.3fr_4fr]' : 'grid-cols-[0.8fr_1.3fr_3fr]';

  const anyFilterActive = Boolean(searchTerm || dateFrom || dateTo) || statusFilter !== 'all' || sort !== 'newest';
  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setSort('newest');
    setStatus('all');
  };

  const updateTransactionStatus = async (transactionId: string, status: string) => {
    try {
      await mutations.updateTransactionStatus.mutateAsync({ transactionId, status, type: pageDef.type });
    } catch (error) {
      console.error('Failed to update transaction status:', error);
    }
  };

  // One details panel for every kind of transaction.
  const openTransactionModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setTransactionModal({ isOpen: true });
  };

  const closeTransactionModal = () => {
    setTransactionModal({ isOpen: false });
    setTimeout(() => setSelectedTransaction(null), 300);
  };

  const rowIcon = (tx: Transaction, size: string) => {
    if (kind === 'fee') {
      return <div className={`${size} rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden`}>{getTransactionIcon(tx, categories)}</div>;
    }
    const { icon: Icon, tile } = KIND_ICON[kind];
    return <div className={`${size} rounded-xl border flex items-center justify-center flex-shrink-0 ${tile}`}><Icon className="h-5 w-5" /></div>;
  };

  const emptyText = statusFilter === 'pending' && !searchTerm && !dateFrom && !dateTo
    ? { title: 'Nothing waiting', text: category === 'refund_request' ? 'Every refund request has been decided.' : category === 'withdrawal' ? 'Every cash-out has been paid out or closed.' : 'Nothing is pending right now.' }
    : { title: 'No transactions found', text: 'Try adjusting your search or filters.' };

  const PageIcon = pageDef.icon;

  return (
    <div className="fixed top-16 md:top-0 bottom-0 left-0 md:left-72 right-0 flex flex-col bg-gray-50 overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30 shadow-sm relative">
        <div className="px-4 pt-3 md:px-6 md:pt-5">
          <div className="hidden md:flex items-start justify-between gap-6 mb-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 bg-blue-50 rounded-lg">
                  <PageIcon className="h-5 w-5 text-blue-600" />
                </span>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">{pageDef.title}</h1>
              </div>
              <p className="text-xs text-gray-500 font-medium">
                {counts ? `${counts.total.toLocaleString()} ${pageDef.noun}` : pageDef.noun.replace(/^\w/, (c) => c.toUpperCase())}
                {counts && counts.total > 0 && <span className="text-gray-400"> · {peso(counts.totalAmount || 0)} in all</span>}
              </p>
            </div>
          </div>

          <CounterGroups
            groups={groups}
            gridClass={gridClass}
            all={{ count: counts?.total, selected: statusFilter === 'all', onClick: () => setStatus('all') }}
            filtered={anyFilterActive}
            onClear={clearFilters}
            testId="tx-counters"
            idPrefix="tx"
            allCell={{ label: 'All', hint: `Every ${pageDef.noun.replace(/s\b.*/, '')}` }}
          />
        </div>

        {/* Filter Bar — one bar for every width. Phones stack it (search, then
            the dates and order); from lg it's one row. */}
        <div className="px-4 lg:px-6 py-2 lg:py-3 bg-gray-50/50 border-t border-gray-100 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 w-full lg:w-auto lg:flex-1 lg:min-w-[200px]">
            <div className="relative flex-1">
              <Search className="absolute left-3 lg:left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-3.5 w-3.5 lg:h-4 lg:w-4" />
              <input
                type="text"
                data-testid="transactions-search"
                placeholder={category === 'platform_fee' || category === 'refund_request' ? 'Search by job or description...' : 'Search transactions...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 h-8 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs font-medium transition-all shadow-sm lg:pl-10 lg:pr-4 lg:h-9 lg:rounded-xl lg:text-sm"
              />
            </div>

            {/* Page Limit - phones (the desktop one sits by the pages) */}
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="lg:hidden bg-white border border-gray-200 rounded-lg shadow-sm text-[11px] font-black text-gray-600 focus:outline-none h-8 px-2 shrink-0"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2 w-full lg:contents">
            <div className="lg:w-auto">
              <DateRangePicker
                startDate={dateFrom}
                endDate={dateTo}
                onStartDateChange={setDateFrom}
                onEndDateChange={setDateTo}
                onClear={() => { setDateFrom(''); setDateTo(''); }}
              />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as TransactionsSort)} aria-label="Sort transactions" className={`${selectClass} lg:w-[170px] xl:hidden`}>
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className={`flex-1 overflow-y-auto transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading transactions...</p>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white p-12 text-center" data-testid="transactions-empty">
              <div className="text-gray-300 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-700 font-semibold">{emptyText.title}</p>
              <p className="text-sm text-gray-500 mt-1">{emptyText.text}</p>
              {anyFilterActive && (
                <button type="button" onClick={clearFilters} className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700">
                  Show all
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
                      <th className="w-[37%] xl:w-[32%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Transaction
                      </th>
                      <th className="w-[26%] xl:w-[24%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        {category === 'platform_fee' || category === 'refund_request' ? 'Client & provider' : 'Account'}
                      </th>
                      <th
                        className="w-[15%] xl:w-[13%] px-4 xl:px-6 py-3.5 text-right text-xs font-semibold text-gray-600 border-b border-gray-200"
                        aria-sort={sort === 'amount_desc' ? 'descending' : sort === 'amount_asc' ? 'ascending' : 'none'}
                      >
                        <SortHeader
                          label="Amount"
                          dir={sort === 'amount_desc' ? 'desc' : sort === 'amount_asc' ? 'asc' : null}
                          onClick={() => setSort(sort === 'amount_desc' ? 'amount_asc' : 'amount_desc')}
                        />
                      </th>
                      <th className="w-[22%] xl:w-[17%] px-4 xl:px-6 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-b border-gray-200">
                        Status
                      </th>
                      <th
                        className="hidden xl:table-cell w-[14%] px-6 py-3.5 text-left text-xs font-semibold text-gray-600 border-b border-gray-200"
                        aria-sort={sort === 'newest' ? 'descending' : sort === 'oldest' ? 'ascending' : 'none'}
                      >
                        <SortHeader
                          label="Date"
                          dir={sort === 'newest' ? 'desc' : sort === 'oldest' ? 'asc' : null}
                          onClick={() => setSort(sort === 'newest' ? 'oldest' : 'newest')}
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {transactions.map((tx) => {
                      const info = describe(tx, kind);
                      const parties = partiesOf(tx, kind);
                      return (
                        <tr
                          key={tx._id}
                          data-testid={`transaction-row-${tx._id}`}
                          onClick={() => openTransactionModal(tx)}
                          className="group h-20 cursor-pointer transition-colors hover:bg-gray-50/70"
                        >
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle overflow-hidden">
                            <div className="flex items-center gap-4 min-w-0">
                              {rowIcon(tx, 'h-11 w-11')}
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] text-gray-400 font-bold tracking-wider truncate">{kindLabel(tx, kind)}</p>
                                <p className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">{info.title}</p>
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-500 min-w-0">
                                  <span className="truncate" title={info.detail}>{info.detail}</span>
                                  {/* Below xl the Date column is hidden; its age rides here. */}
                                  <span className="xl:hidden flex-shrink-0 text-gray-400">· {ago(tx.createdAt)}</span>
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <div className="space-y-1.5 min-w-0">
                              {parties.map((party) => <PartyLine key={party.role} party={party} />)}
                              {parties.length === 1 && parties[0].sub && (
                                <p className="pl-[68px] text-[11px] text-gray-400 truncate">{parties[0].sub}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 xl:px-6 py-2 text-right border-b border-gray-200 h-20 align-middle">
                            <p className="text-sm font-black text-gray-900 tabular-nums">{peso(tx.amount)}</p>
                            <p className="mt-0.5 text-[9px] font-black text-gray-400 uppercase tracking-wider truncate">{methodOf(tx, kind)}</p>
                          </td>
                          <td className="px-4 xl:px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <div className="flex flex-col items-start gap-1.5 min-w-0">
                              <StatusBadge tx={tx} kind={kind} />
                              <StatusText tx={tx} kind={kind} className="text-[11px] max-w-full" />
                            </div>
                          </td>
                          <td className="hidden xl:table-cell px-6 py-2 border-b border-gray-200 h-20 align-middle">
                            <p className="text-xs font-bold text-gray-900 truncate">{ago(tx.createdAt)}</p>
                            <p className="text-[10px] font-medium text-gray-400 mt-1">{format(new Date(tx.createdAt), 'MMM d, yyyy')}</p>
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
                  {transactions.map((tx) => {
                    const info = describe(tx, kind);
                    const parties = partiesOf(tx, kind);
                    return (
                      <div
                        key={tx._id}
                        data-testid={`transaction-card-${tx._id}`}
                        onClick={() => openTransactionModal(tx)}
                        className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <div className="flex items-start gap-3 px-3 pt-3 pb-2.5">
                          {rowIcon(tx, 'h-12 w-12')}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-gray-400 tracking-wider truncate">{kindLabel(tx, kind)}</p>
                            <p className="text-[13px] font-black text-gray-900 truncate leading-snug">{info.title}</p>
                            <StatusText tx={tx} kind={kind} className="mt-1 text-[11px]" />
                          </div>
                          <StatusBadge tx={tx} kind={kind} small />
                        </div>
                        <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 border-t border-gray-100">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            {parties.filter((party) => party.name).map((party) => <PartyLine key={party.role} party={party} small />)}
                          </div>
                          <p className="text-sm font-black text-gray-900 flex-shrink-0">{peso(tx.amount)}</p>
                          <div className="flex items-center gap-0.5 text-[9px] font-bold text-gray-400 flex-shrink-0">
                            <Clock className="h-2.5 w-2.5" />
                            {ago(tx.createdAt)}
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

        {!isLoading && transactions.length > 0 && (
          <ListFooter page={page} limit={limit} total={total} pages={pages} onPage={setPage} onLimit={setLimit} />
        )}
      </div>

      {/* Details panel */}
      <TransactionDetailsModal
        isOpen={transactionModal.isOpen}
        onClose={closeTransactionModal}
        transaction={selectedTransaction}
        onStatusUpdate={updateTransactionStatus}
      />
    </div>
  );
};

export default Transactions;
