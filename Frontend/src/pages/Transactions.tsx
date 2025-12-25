import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  ArrowDownLeft,
  Calendar,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// Component imports
import { DateRangePicker } from '../components/Transactions';
import { TransactionDetailsModal, TopUpModal } from '../components/Modals';

// Service imports
import { transactionsService } from '../services';

// Type imports
import type { Transaction, TransactionStats } from '../types';

// Utility imports
import {
  getInitials,
  formatPHPCurrency,
  getTypeColor,
  getTransactionStatusColor,
  getTransactionStatusIcon,
  getTransactionIcon,
  getUser,
  getToUser,
  isOverdue,
  getCategoryTitle
} from '../utils';

/**
 * Transactions Management Page
 * Displays and manages all financial transactions
 */
const Transactions: React.FC = () => {
  const location = useLocation();

  // State management
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionStats, setTransactionStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
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
    if (path.includes('fee-records')) return 'fee_record';
    if (path.includes('top-up')) return 'wallet_topup';
    if (path.includes('cashout')) return 'withdrawal';
    if (path.includes('refund')) return 'refund';
    return 'all';
  };

  const category = getTransactionCategory();

  /**
   * Fetch transactions from API
   */
  const fetchTransactions = async () => {
    try {
      setLoading(true);

      const params: any = {
        page: pagination.page,
        limit: pagination.limit
      };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (paymentMethodFilter !== 'all') params.paymentMethod = paymentMethodFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      if (category === 'fee_record') {
        params.type = 'fee_record';
        params.includeFees = 'true';
      } else if (category === 'wallet_topup') {
        params.type = 'xendit_topup';
      } else if (category !== 'all') {
        params.type = category;
      } else {
        params.includeFees = 'true';
      }

      const data = await transactionsService.getTransactions(params);
      setTransactions(data.transactions || []);
      setTransactionStats(data.stats || null);
      setPagination(prev => ({
        ...prev,
        total: data.pagination?.total || 0,
        pages: data.pagination?.pages || 1
      }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Error loading transactions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [category, searchTerm, statusFilter, paymentMethodFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchTransactions();
  }, [category, searchTerm, statusFilter, paymentMethodFilter, dateFrom, dateTo, pagination.page]);

  /**
   * Update transaction status
   */
  const updateTransactionStatus = async (transactionId: string, status: string, transactionType: string) => {
    try {
      const updatedData = await transactionsService.updateTransactionStatus(transactionId, {
        status: status as any,
        type: transactionType
      });

      setTransactions((prev) =>
        prev.map((transaction) => (transaction._id === transactionId ? updatedData.transaction : transaction))
      );
      toast.success(`Transaction ${status}`);
    } catch (error) {
      console.error('Failed to update transaction status:', error);
      toast.error('Failed to update transaction status');
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
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white px-4 md:px-6 py-4 md:py-5 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">{getCategoryTitle(category)}</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">{pagination.total} total transactions</p>
          </div>

          {category !== 'fee_record' && category !== 'wallet_topup' && (
            <div className="hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-medium text-gray-600">Complete</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="font-medium text-gray-600">Fail</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-gray-600">View</span>
              </div>
              <button
                onClick={fetchTransactions}
                disabled={loading}
                className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="font-medium text-gray-600">Refresh</span>
              </button>
            </div>
          )}
        </div>

        {/* Transaction Type Counters */}
        {category === 'all' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 font-medium mb-1">Fee Records</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {transactions.filter(t => t.transactionType === 'fee_record' || t.type === 'fee_record').length}
              </p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 font-medium mb-1">Top-up</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {transactions.filter(t => t.type === 'wallet_topup' || t.type === 'xendit_topup').length}
              </p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 font-medium mb-1">Cashout</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {transactions.filter(t => t.type === 'withdrawal').length}
              </p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-gray-600 font-medium mb-1">Refund</p>
              <p className="text-xl md:text-2xl font-bold text-gray-900">
                {transactions.filter(t => t.type === 'refund').length}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 md:h-5 w-4 md:w-5" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 md:pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="hidden md:block px-3 md:px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
            >
              <option value="all">All Methods</option>
              <option value="wallet">Wallet</option>
              <option value="cash">Cash</option>
              <option value="xendit">Xendit</option>
            </select>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
            <DateRangePicker
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={setDateFrom}
              onEndDateChange={setDateTo}
              onClear={clearDateRange}
            />
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
                <p className="text-gray-500">Loading transactions...</p>
              </div>
            </div>
          ) : transactions.length === 0 ? (
            <div className="bg-white p-12 text-center">
              <div className="text-gray-400 mb-4">
                <Search className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-gray-600 font-medium">No transactions found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block bg-white">
                <table className="min-w-full w-full table-fixed">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                    <tr>
                      <th className="w-[25%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Transaction
                      </th>
                      <th className="w-[18%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {category === 'fee_record' ? 'Provider Name' : 'Users'}
                      </th>
                      <th className="w-[12%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="w-[10%] px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="w-[12%] px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="w-[13%] px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Date
                      </th>
                      {category !== 'fee_record' && category !== 'wallet_topup' && (
                        <th className="w-[10%] px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {transactions.map((transaction, index) => {
                      const user = getUser(transaction);
                      const toUser = getToUser(transaction);

                      return (
                        <React.Fragment key={transaction._id}>
                          <tr onClick={() => openTransactionModal(transaction)} className="hover:bg-gray-50 transition-colors cursor-pointer">
                            <td className="px-6 py-4">
                              <div className="flex items-start gap-2">
                                <div className="flex-shrink-0 mt-1">
                                  {getTransactionIcon(transaction.type, transaction.transactionType)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span
                                      className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getTypeColor(
                                        transaction.type,
                                        transaction.transactionType
                                      )}`}
                                    >
                                      {transaction.transactionType === 'fee_record'
                                        ? 'Fee Record'
                                        : transaction.type?.replace('_', ' ')}
                                    </span>
                                    {isOverdue(transaction) && <AlertTriangle className="h-3 w-3 text-red-500" title="Overdue" />}
                                  </div>
                                  <p className="text-sm text-gray-900 line-clamp-2">
                                    {transaction.transactionType === 'fee_record'
                                      ? transaction.description.replace(/^Platform fee for job:\s*/i, '')
                                      : transaction.description}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {transaction.transactionType === 'fee_record' ? (
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-shrink-0">
                                    {user?.profileImage ? (
                                      <img src={user.profileImage} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                                    ) : (
                                      <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                                        <span className="text-xs font-semibold text-gray-700">{getInitials(user?.name || 'Unknown')}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'N/A'}</p>
                                    <p className="text-xs text-gray-500 truncate">{user?.email || 'N/A'}</p>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  {user && (
                                    <div className="flex items-center gap-2">
                                      <div className="relative flex-shrink-0">
                                        {user.profileImage ? (
                                          <img src={user.profileImage} alt={user.name} className="h-6 w-6 rounded-full object-cover" />
                                        ) : (
                                          <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
                                            <span className="text-xs font-semibold text-gray-700">{getInitials(user.name)}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                      </div>
                                    </div>
                                  )}
                                  {toUser && transaction.transactionType !== 'fee_record' && user?._id !== toUser._id && (
                                    <div className="flex items-center gap-2 pl-2">
                                      <ArrowDownLeft className="h-3 w-3 text-gray-400" />
                                      <div className="min-w-0">
                                        <p className="text-sm text-gray-900 truncate">{toUser.name}</p>
                                        <p className="text-xs text-gray-500 truncate">{toUser.email}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div>
                                <p className="text-sm font-bold text-gray-900">{formatCurrency(transaction.amount)}</p>
                                {transaction.platformFee && transaction.platformFee > 0 && (
                                  <p className="text-xs text-gray-500">Fee: {formatCurrency(transaction.platformFee)}</p>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-center gap-1">
                                <CreditCard className="h-3 w-3 text-gray-400" />
                                <span className="text-xs text-gray-900 capitalize">{transaction.paymentMethod || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getTransactionStatusColor(
                                    transaction.status
                                  )}`}
                                >
                                  {getTransactionStatusIcon(transaction.status)}
                                  <span className="capitalize">{transaction.status}</span>
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1">
                                <p className="text-xs text-gray-500">
                                  {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                                </p>
                                <div className="flex items-center gap-1 text-xs text-gray-400">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(transaction.createdAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </div>
                              </div>
                            </td>
                            {category !== 'fee_record' && category !== 'wallet_topup' && (
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  {transaction.status === 'pending' &&
                                    transaction.transactionType !== 'fee_record' &&
                                    transaction.type !== 'xendit_topup' && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateTransactionStatus(transaction._id, 'completed', transaction.transactionType);
                                          }}
                                          className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                          title="Mark as completed"
                                        >
                                          <CheckCircle className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateTransactionStatus(transaction._id, 'failed', transaction.transactionType);
                                          }}
                                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                          title="Mark as failed"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </button>
                                      </>
                                    )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openTransactionModal(transaction);
                                    }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                          {index < transactions.length - 1 && (
                            <tr>
                              <td colSpan={category === 'fee_record' || category === 'wallet_topup' ? 6 : 7} className="p-0">
                                <div className="border-b border-gray-200" />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden px-4 py-4 space-y-3">
                {transactions.map((transaction) => {
                  const user = getUser(transaction);
                  const toUser = getToUser(transaction);

                  return (
                    <div
                      key={transaction._id}
                      onClick={() => openTransactionModal(transaction)}
                      className="bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="flex-shrink-0 mt-0.5">
                              {getTransactionIcon(transaction.type, transaction.transactionType)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getTypeColor(
                                    transaction.type,
                                    transaction.transactionType
                                  )}`}
                                >
                                  {transaction.transactionType === 'fee_record' ? 'Fee Record' : transaction.type?.replace('_', ' ')}
                                </span>
                                {isOverdue(transaction) && <AlertTriangle className="h-3 w-3 text-red-500" title="Overdue" />}
                              </div>
                              <p className="text-sm text-gray-900 line-clamp-2">
                                {transaction.transactionType === 'fee_record'
                                  ? transaction.description.replace(/^Platform fee for job:\s*/i, '')
                                  : transaction.description}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2 mb-3">
                          {transaction.transactionType === 'fee_record' ? (
                            user && (
                              <div className="flex items-center gap-2">
                                <div className="relative flex-shrink-0">
                                  {user.profileImage ? (
                                    <img src={user.profileImage} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
                                  ) : (
                                    <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                                      <span className="text-xs font-semibold text-gray-700">{getInitials(user.name)}</span>
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                </div>
                              </div>
                            )
                          ) : (
                            <>
                              {user && (
                                <div className="flex items-center gap-2">
                                  <div className="relative flex-shrink-0">
                                    {user.profileImage ? (
                                      <img src={user.profileImage} alt={user.name} className="h-6 w-6 rounded-full object-cover" />
                                    ) : (
                                      <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
                                        <span className="text-xs font-semibold text-gray-700">{getInitials(user.name)}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium text-gray-900 truncate">{user.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                                  </div>
                                </div>
                              )}
                              {toUser && transaction.transactionType !== 'fee_record' && user?._id !== toUser._id && (
                                <div className="flex items-center gap-2 pl-2">
                                  <ArrowDownLeft className="h-3 w-3 text-gray-400" />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs text-gray-900 truncate">{toUser.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{toUser.email}</p>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-bold text-gray-900">{formatCurrency(transaction.amount)}</p>
                            {transaction.platformFee && transaction.platformFee > 0 && (
                              <p className="text-xs text-gray-500">Fee: {formatCurrency(transaction.platformFee)}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-600 capitalize">{transaction.paymentMethod || 'N/A'}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          <div className="flex flex-col gap-1">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border self-start ${getTransactionStatusColor(
                                transaction.status
                              )}`}
                            >
                              {getTransactionStatusIcon(transaction.status)}
                              <span className="capitalize">{transaction.status}</span>
                            </span>
                            <div className="flex items-center gap-1 text-xs text-gray-400">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}</span>
                            </div>
                          </div>
                          {category !== 'fee_record' && category !== 'wallet_topup' && (
                            <div className="flex items-center gap-2">
                              {transaction.status === 'pending' &&
                                transaction.transactionType !== 'fee_record' &&
                                transaction.type !== 'xendit_topup' && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateTransactionStatus(transaction._id, 'completed', transaction.transactionType);
                                      }}
                                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                      title="Mark as completed"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        updateTransactionStatus(transaction._id, 'failed', transaction.transactionType);
                                      }}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                      title="Mark as failed"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTransactionModal(transaction);
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
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

      {/* Modals */}
      <TransactionDetailsModal isOpen={transactionModal.isOpen} onClose={closeTransactionModal} transaction={selectedTransaction} />

      <TopUpModal isOpen={topUpModal.isOpen} onClose={closeTopUpModal} transaction={selectedTransaction} />
    </div>
  );
};

export default Transactions;
