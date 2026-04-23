import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  ArrowDownLeft,
  Calendar,
  AlertTriangle,
  RefreshCw,
  Wallet as WalletIcon,
  LayoutGrid,
  Table2,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// Component imports
import { DateRangePicker } from '../components/Transactions';
import { TransactionDetailsModal, TopUpModal } from '../components/Modals';
import StatsCard from '../components/Dashboard/StatsCard';

// Type imports
import type { Transaction } from '../types';

// Utility imports
import {
  getInitials,
  formatPHPCurrency,
  getTypeColor,
  getTransactionStatusColor,
  getTransactionIcon,
  getUser,
  getToUser,
  isOverdue,
  getCategoryTitle
} from '../utils';

// Hooks
import { useTransactions, useTransactionCounts, useTransactionMutations } from '../hooks/useTransactions';

/**
 * Transactions Management Page
 * Displays and manages all financial transactions
 */
const Transactions: React.FC = () => {
  const location = useLocation();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('status') || 'all';
  });
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionModal, setTransactionModal] = useState({ isOpen: false });
  const [topUpModal, setTopUpModal] = useState({ isOpen: false });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });
  const [mobileViewType, setMobileViewType] = useState<'card' | 'table'>('card');

  // Handle query parameters when URL changes
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const status = searchParams.get('status');

    if (status && status !== statusFilter) {
      setStatusFilter(status);
    } else if (!status && statusFilter !== 'all') {
      setStatusFilter('all');
    }
  }, [location.search]);

  /**
   * Get transaction category from URL path
   */
  const getTransactionCategory = () => {
    const path = location.pathname;
    if (path.includes('fee-records')) return 'platform_fee';
    if (path.includes('top-up')) return 'wallet_topup';
    if (path.includes('cashout')) return 'withdrawal';
    if (path.includes('refund')) return 'refund_request';
    return 'all';
  };

  const category = getTransactionCategory();

  const queryParams = useMemo(() => {
    const params: any = {
      page: pagination.page,
      limit: pagination.limit
    };
    if (searchTerm) params.search = searchTerm;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (paymentMethodFilter !== 'all') params.paymentMethod = paymentMethodFilter;
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;

    if (category === 'platform_fee') {
      params.type = 'platform_fee';
    } else if (category === 'wallet_topup') {
      params.type = 'xendit_topup';
    } else if (category === 'refund_request') {
      params.type = 'refund_request';
    } else if (category !== 'all') {
      params.type = category;
    } else {
      params.includeFees = 'true';
    }

    return params;
  }, [pagination.page, pagination.limit, searchTerm, statusFilter, paymentMethodFilter, dateFrom, dateTo, category]);

  const transactionType = category === 'wallet_topup'
    ? 'xendit_topup'
    : category === 'platform_fee'
      ? 'platform_fee'
      : category === 'refund_request'
        ? 'refund_request'
        : category;

  const { data: transactionsData, isLoading, refetch } = useTransactions(queryParams);
  const { data: statusCounts = { total: 0, pending: 0, completed: 0, failed: 0, cancelled: 0 } } = useTransactionCounts(transactionType);
  const mutations = useTransactionMutations();

  const transactions = transactionsData?.transactions || [];
  const loading = isLoading;

  useEffect(() => {
    const paginationData = transactionsData?.pagination;
    if (paginationData) {
      setPagination(prev => ({
        ...prev,
        total: paginationData.total ?? 0,
        pages: paginationData.pages ?? 1
      }));
    }
  }, [transactionsData]);

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [category, searchTerm, statusFilter, paymentMethodFilter, dateFrom, dateTo]);

  const updateTransactionStatus = async (transactionId: string, status: string) => {
    try {
      await mutations.updateTransactionStatus.mutateAsync({ 
        transactionId, 
        status, 
        type: transactionType 
      });
    } catch (error) {
      console.error('Failed to update transaction status:', error);
    }
  };

  /**
   * Open transaction modal
   */
  const openTransactionModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    // Check if it's a top-up transaction
    if (transaction.type === 'wallet_topup' || transaction.type === 'xendit_topup') {
      setTopUpModal({ isOpen: true });
    } else {
      setTransactionModal({ isOpen: true });
    }
  };

  /**
   * Close modals
   */
  const closeTransactionModal = () => {
    setTransactionModal({ isOpen: false });
    setTimeout(() => setSelectedTransaction(null), 300);
  };

  const closeTopUpModal = () => {
    setTopUpModal({ isOpen: false });
    setTimeout(() => setSelectedTransaction(null), 300);
  };

  /**
   * Clear date range filter
   */
  const clearDateRange = () => {
    setDateFrom('');
    setDateTo('');
  };

  /**
   * Format currency with zero decimals
   */
  const formatCurrency = (amount: number) => {
    return formatPHPCurrency(amount, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).replace('PHP', '₱');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-screen bg-gray-50 -mx-2 sm:-mx-4 md:-mx-8 lg:-mx-8 -my-2 sm:-my-3 md:-my-4 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        {/* Page Title & Refresh - Desktop only (mobile layout already shows title) */}
        <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{getCategoryTitle(category)}</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              {category === 'platform_fee'
                ? 'Track and manage platform service fees collected from completed job transactions'
                : category === 'wallet_topup'
                  ? 'Monitor and manage wallet top-up transactions processed through payment gateways'
                  : category === 'withdrawal'
                    ? 'Monitor and manage user withdrawal requests to external payment methods'
                    : category === 'refund_request'
                      ? 'Review and process user refund requests for job payments'
                      : `${pagination.total.toLocaleString()} total transactions`
              }
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">

          </div>
        </div>

        {/* Transaction Type Counters Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-5">
           {category === 'all' ? (
             <>
               <StatsCard
                 title="Fee Records"
                 value={statusCounts.total.toLocaleString()}
                 icon={CreditCard}
                 color="purple"
                 variant="tinted"
                 smallIcon={true}
               />
               <StatsCard
                 title="Top-up"
                 value={transactions.filter(t => t.type === 'wallet_topup' || t.type === 'xendit_topup' || t.type === 'topup').length.toLocaleString()}
                 icon={WalletIcon}
                 color="blue"
                 variant="tinted"
                 smallIcon={true}
               />
               <StatsCard
                 title="Cashout"
                 value={transactions.filter(t => t.type === 'withdrawal').length.toLocaleString()}
                 icon={ArrowDownLeft}
                 color="orange"
                 variant="tinted"
                 smallIcon={true}
               />
               <StatsCard
                 title="Refund"
                 value={transactions.filter(t => t.type === 'refund' || t.type === 'refund_request').length.toLocaleString()}
                 icon={RefreshCw}
                 color="green"
                 variant="tinted"
                 smallIcon={true}
               />
             </>
           ) : (
             <>
               <StatsCard
                 title="Total"
                 value={statusCounts.total.toLocaleString()}
                 icon={CreditCard}
                 color="blue"
                 variant="tinted"
                 onClick={() => setStatusFilter('all')}
                 isActive={statusFilter === 'all'}
                 smallIcon={true}
               />
               <StatsCard
                 title="Pending"
                 value={statusCounts.pending.toLocaleString()}
                 icon={Clock}
                 color="orange"
                 variant="tinted"
                 onClick={() => setStatusFilter('pending')}
                 isActive={statusFilter === 'pending'}
                 smallIcon={true}
               />
               <StatsCard
                 title="Completed"
                 value={statusCounts.completed.toLocaleString()}
                 icon={CheckCircle}
                 color="green"
                 variant="tinted"
                 onClick={() => setStatusFilter('completed')}
                 isActive={statusFilter === 'completed'}
                 smallIcon={true}
               />
               <StatsCard
                 title="Failed"
                 value={statusCounts.failed.toLocaleString()}
                 icon={XCircle}
                 color="red"
                 variant="tinted"
                 onClick={() => setStatusFilter('failed')}
                 isActive={statusFilter === 'failed'}
                 smallIcon={true}
               />
               <StatsCard
                 title="Cancelled"
                 value={statusCounts.cancelled.toLocaleString()}
                 icon={XCircle}
                 color="indigo"
                 variant="tinted"
                 onClick={() => setStatusFilter('cancelled')}
                 isActive={statusFilter === 'cancelled'}
                 smallIcon={true}
               />
             </>
           )}
        </div>

        {/* Filter Bar */}
        <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
          {/* Row 1 on Mobile / Search on Desktop */}
          <div className="flex items-center gap-2 md:contents">
            <div className="relative flex-1 md:order-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-medium transition-all shadow-sm h-10"
              />
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
          </div>

          {/* Row 2 on Mobile / Desktop Right-side group */}
          <div className="flex items-center justify-between gap-3 md:flex-initial md:order-2 md:justify-end md:gap-6 shrink-0">
            <div className="flex-1 md:flex-initial flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5 md:pb-0">
              <div className="shrink-0">
                <DateRangePicker
                  startDate={dateFrom}
                  endDate={dateTo}
                  onStartDateChange={setDateFrom}
                  onEndDateChange={setDateTo}
                  onClear={clearDateRange}
                />
              </div>

              {category !== 'platform_fee' && category !== 'wallet_topup' && category !== 'withdrawal' && category !== 'refund_request' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm text-xs font-black uppercase tracking-wider text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 md:min-w-[120px]"
                >
                  <option value="all">ALL STATUS</option>
                  <option value="pending">PENDING</option>
                  <option value="completed">COMPLETED</option>
                  <option value="failed">FAILED</option>
                  <option value="cancelled">CANCELLED</option>
                </select>
              )}

              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="bg-white px-3 py-2 border border-gray-200 rounded-xl shadow-sm text-xs font-black uppercase tracking-wider text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 md:min-w-[120px]"
              >
                <option value="all">ALL METHODS</option>
                <option value="wallet">WALLET</option>
                <option value="cash">CASH</option>
                <option value="xendit">XENDIT</option>
              </select>
            </div>

            {/* Pagination Limit for Desktop */}
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

            {/* View Type Toggle - Mobile only */}
            <div className="flex md:hidden items-center bg-white border border-gray-200 rounded-[12px] p-1 shadow-sm shrink-0 md:order-4">
               <button
                 onClick={() => setMobileViewType('card')}
                 className={`p-1.5 rounded-[10px] transition-all ${mobileViewType === 'card' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 <LayoutGrid className="h-3.5 w-3.5" />
               </button>
               <button
                 onClick={() => setMobileViewType('table')}
                 className={`p-1.5 rounded-[10px] transition-all ${mobileViewType === 'table' ? 'bg-blue-50 text-blue-600 shadow-inner' : 'text-gray-400 hover:text-gray-600'}`}
               >
                 <Table2 className="h-3.5 w-3.5" />
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500 font-medium tracking-tight">Loading transactions...</p>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl mx-4 my-8 border border-gray-100 shadow-sm">
              <div className="text-gray-300 mb-4 bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                <Search className="h-10 w-10" />
              </div>
              <p className="text-gray-600 font-bold text-lg">No transactions found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white shadow-sm border-b border-gray-200">
                <table className="min-w-full w-full table-fixed">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="w-[30%] px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Transaction Info
                      </th>
                      <th className="w-[20%] px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        {category === 'platform_fee' ? 'Provider' : 'Involved Users'}
                      </th>
                      <th className="w-[12%] px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Amount
                      </th>
                      <th className="w-[12%] px-6 py-4 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Status
                      </th>
                      <th className="w-[16%] px-6 py-4 text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Date
                      </th>
                      {category !== 'platform_fee' && category !== 'wallet_topup' && category !== 'withdrawal' && category !== 'refund_request' && (
                        <th className="w-[10%] px-6 py-4 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white border-b border-gray-300">
                    {transactions.map((transaction) => {
                      const user = getUser(transaction);
                      const toUser = getToUser(transaction);

                      return (
                        <tr 
                          key={transaction._id}
                          onClick={() => openTransactionModal(transaction)} 
                          className="group transition-all duration-150 cursor-pointer"
                        >
                          <td className="px-6 py-4 border-b border-gray-300">
                            <div className="flex items-start gap-4">
                              <div className="w-11 h-11 rounded-xl bg-gray-50 group-hover:bg-white transition-colors border border-gray-100 items-center justify-center flex flex-shrink-0">
                                {getTransactionIcon(transaction)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${getTypeColor(transaction.type, transaction.transactionType)}`}>
                                    {transaction.type?.replace('_', ' ')}
                                  </span>
                                  {isOverdue(transaction) && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                                </div>
                                <p className="text-sm font-semibold text-gray-900 line-clamp-1 transition-colors">
                                  {transaction.type === 'platform_fee'
                                    ? transaction.description.replace(/^Platform fee for job:\s*/i, '')
                                    : transaction.description}
                                </p>
                                <p className="text-[11px] text-gray-400 mt-1 font-medium">ID: {transaction._id.slice(-8).toUpperCase()}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-300">
                            <div className="space-y-2">
                              {user && (
                                <div className="flex items-center gap-3">
                                  <div className="h-8 w-8 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100 flex-shrink-0">
                                    <span className="text-[10px] font-bold text-gray-600">{getInitials(user.name)}</span>
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-gray-900 truncate">{user.name}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                                  </div>
                                </div>
                              )}
                              {toUser && transaction.type !== 'platform_fee' && user?._id !== toUser._id && (
                                <div className="flex items-center gap-3 pl-4">
                                  <ArrowDownLeft className="h-3 w-3 text-gray-300 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium text-gray-600 truncate">{toUser.name}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-300">
                            <div>
                              <p className="text-sm font-bold text-gray-900">
                                {formatCurrency(transaction.amount)}
                              </p>
                              <div className="flex items-center gap-1 mt-1">
                                <CreditCard className="h-3 w-3 text-gray-300" />
                                <span className="text-[10px] text-gray-400 font-bold uppercase">{transaction.paymentMethod}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-300">
                            <div className="flex justify-center">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border uppercase tracking-wider ${getTransactionStatusColor(transaction.status)}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  transaction.status === 'completed' ? 'bg-green-500' : 
                                  transaction.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                                }`} />
                                {transaction.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-300">
                            <div className="space-y-1">
                              <p className="text-xs font-semibold text-gray-900">
                                {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-400 uppercase">
                                <Calendar className="h-3 w-3" />
                                {new Date(transaction.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </td>
                          {category !== 'platform_fee' && category !== 'wallet_topup' && category !== 'withdrawal' && category !== 'refund_request' && (
                            <td className="px-6 py-4 border-b border-gray-300">
                              <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                                  <Eye className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile View */}
              <div className="md:hidden flex-1 overflow-y-auto">
                {mobileViewType === 'card' ? (
                  <div className="px-4 py-4 space-y-4">
                    {transactions.map((transaction) => {
                      const user = getUser(transaction);
                      return (
                        <div
                          key={transaction._id}
                          onClick={() => openTransactionModal(transaction)}
                          className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:scale-[0.98] transition-all"
                        >
                          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                              {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${getTransactionStatusColor(transaction.status)}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  transaction.status === 'completed' ? 'bg-green-500' :
                                  transaction.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                                }`} />
                                {transaction.status}
                              </span>
                            </div>
                          </div>

                          <div className="p-4">
                            <div className="flex items-center gap-4 mb-4">
                              <div className="relative flex-shrink-0">
                                <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
                                  {getTransactionIcon(transaction)}
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-black text-gray-900 leading-tight truncate">{transaction.description}</h3>
                                </div>
                                <div className="flex flex-col gap-1">
                                  <p className="text-xs text-gray-500 truncate">ID: {transaction._id.slice(-8).toUpperCase()}</p>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${getTypeColor(transaction.type, transaction.transactionType)}`}>
                                      {transaction.type?.replace('_', ' ')}
                                    </span>
                                    <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                      {transaction.paymentMethod}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-dashed border-gray-100">
                              <div className="flex flex-col">
                                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Amount</span>
                                <span className="text-sm font-black text-gray-900">{formatCurrency(transaction.amount)}</span>
                                {user && (
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <div className="h-5 w-5 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
                                      <span className="text-[7px] font-black text-blue-600">{getInitials(user.name || 'U')}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-500 truncate">{user.name}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end text-right">
                                <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Action</span>
                                <button className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-1">
                                  Details <ChevronRight className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-white">
                    <table className="w-full table-fixed border-separate border-spacing-0">
                      <thead className="bg-gray-50/80 sticky top-0 z-20">
                        <tr>
                          <th className="w-[50%] px-3 py-3 text-left text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Transaction</th>
                          <th className="w-[25%] px-2 py-3 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Status</th>
                          <th className="w-[25%] px-3 py-3 text-right text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {transactions.map((transaction) => (
                          <tr
                            key={transaction._id}
                            onClick={() => openTransactionModal(transaction)}
                            className="active:bg-gray-50 transition-colors"
                          >
                            <td className="px-3 py-3 overflow-hidden">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 flex-shrink-0">
                                  {React.cloneElement(getTransactionIcon(transaction) as React.ReactElement, { className: 'h-3.5 w-3.5' })}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-black text-gray-900 truncate leading-tight">
                                    {transaction._id.slice(-8).toUpperCase()}
                                  </p>
                                  <p className="text-[9px] text-gray-400 font-bold truncate uppercase">
                                    {transaction.type?.replace('_', ' ')}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-3 text-center">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tight border ${getTransactionStatusColor(transaction.status)}`}>
                                {transaction.status?.slice(0, 4).toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <p className="text-[11px] font-black text-gray-900 leading-none mb-1">
                                {formatPHPCurrency(transaction.amount)}
                              </p>
                              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{transaction.paymentMethod}</p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
          </>
        )}
      </div>

        {/* Pagination Toolbar */}
        {pagination.pages > 1 && (
          <div className="flex-shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
            <div className="hidden sm:block">
              <p className="text-sm text-gray-500 font-medium">
                Showing <span className="font-bold text-gray-900">{((pagination.page - 1) * pagination.limit) + 1}</span> to <span className="font-bold text-gray-900">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="font-bold text-gray-900">{pagination.total}</span> results
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-all shadow-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.pages, prev.page + 1) }))}
                disabled={pagination.page === pagination.pages}
                className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-all shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedTransaction && (
        <>
          <TransactionDetailsModal
            isOpen={transactionModal.isOpen}
            onClose={closeTransactionModal}
            transaction={selectedTransaction}
            onStatusUpdate={updateTransactionStatus}
          />
          <TopUpModal
            isOpen={topUpModal.isOpen}
            onClose={closeTopUpModal}
            transaction={selectedTransaction}
            onStatusUpdate={updateTransactionStatus}
          />
        </>
      )}
    </div>
  );
};

export default Transactions;
