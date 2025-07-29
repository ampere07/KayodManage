import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Calendar,
  User,
  Briefcase,
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// Add custom styles for text clamping
const lineClampStyles = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

interface Transaction {
  _id: string;
  transactionType: 'transaction' | 'fee_record';
  fromUser?: {
    _id: string;
    name: string;
    email: string;
  };
  toUser?: {
    _id: string;
    name: string;
    email: string;
  };
  fromUserData?: {
    _id: string;
    name: string;
    email: string;
  };
  toUserData?: {
    _id: string;
    name: string;
    email: string;
  };
  user?: {
    _id: string;
    name: string;
    email: string;
  };
  amount: number;
  type: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  jobId?: {
    _id: string;
    title: string;
  };
  job?: {
    _id: string;
    title: string;
  };
  description: string;
  currency: string;
  paymentMethod?: string;
  platformFee?: number;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  paidAt?: Date;
  // Fee record specific fields
  dueDate?: Date;
  isFirstOffense?: boolean;
  penaltyApplied?: boolean;
  remindersSent?: number;
}

interface TransactionStats {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  totalAmount: number;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
}

const TransactionDetailsModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, transaction }) => {
  if (!isOpen || !transaction) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

  const getUser = () => {
    return transaction.fromUserData || transaction.fromUser || transaction.user;
  };

  const getToUser = () => {
    return transaction.toUserData || transaction.toUser;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 shadow-2xl border border-gray-200 max-h-96 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Transaction Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-500">Transaction ID:</span>
              <p className="text-sm text-gray-900 font-mono">{transaction._id}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Type:</span>
              <div className="flex items-center space-x-2">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  transaction.transactionType === 'fee_record' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {transaction.transactionType === 'fee_record' ? 'Fee Record' : transaction.type?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-gray-500">Description:</span>
            <p className="text-sm text-gray-900 mt-1">{transaction.description}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-500">Amount:</span>
              <p className="text-lg font-semibold text-gray-900">{formatCurrency(transaction.amount)}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500">Status:</span>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                transaction.status === 'completed' ? 'bg-green-100 text-green-800' :
                transaction.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {transaction.status}
              </span>
            </div>
          </div>

          {getUser() && (
            <div>
              <span className="text-sm font-medium text-gray-500">
                {transaction.transactionType === 'fee_record' ? 'Provider:' : 'From User:'}
              </span>
              <div className="mt-1">
                <p className="text-sm text-gray-900">{getUser()?.name}</p>
                <p className="text-xs text-gray-500">{getUser()?.email}</p>
              </div>
            </div>
          )}

          {getToUser() && transaction.transactionType !== 'fee_record' && (
            <div>
              <span className="text-sm font-medium text-gray-500">To User:</span>
              <div className="mt-1">
                <p className="text-sm text-gray-900">{getToUser()?.name}</p>
                <p className="text-xs text-gray-500">{getToUser()?.email}</p>
              </div>
            </div>
          )}

          {(transaction.job || transaction.jobId) && (
            <div>
              <span className="text-sm font-medium text-gray-500">Related Job:</span>
              <p className="text-sm text-gray-900">{transaction.job?.title || transaction.jobId?.title}</p>
            </div>
          )}

          {transaction.paymentMethod && (
            <div>
              <span className="text-sm font-medium text-gray-500">Payment Method:</span>
              <p className="text-sm text-gray-900 capitalize">{transaction.paymentMethod}</p>
            </div>
          )}

          {transaction.platformFee && transaction.platformFee > 0 && (
            <div>
              <span className="text-sm font-medium text-gray-500">Platform Fee:</span>
              <p className="text-sm text-gray-900">{formatCurrency(transaction.platformFee)}</p>
            </div>
          )}

          {/* Fee Record Specific Details */}
          {transaction.transactionType === 'fee_record' && (
            <>
              {transaction.dueDate && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Due Date:</span>
                  <p className="text-sm text-gray-900">
                    {new Date(transaction.dueDate).toLocaleDateString()}
                    {new Date(transaction.dueDate) < new Date() && transaction.status !== 'completed' && (
                      <span className="ml-2 text-red-600 text-xs">(Overdue)</span>
                    )}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                {transaction.isFirstOffense !== undefined && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">First Offense:</span>
                    <p className="text-sm text-gray-900">{transaction.isFirstOffense ? 'Yes' : 'No'}</p>
                  </div>
                )}
                
                {transaction.penaltyApplied !== undefined && (
                  <div>
                    <span className="text-sm font-medium text-gray-500">Penalty Applied:</span>
                    <p className="text-sm text-gray-900">{transaction.penaltyApplied ? 'Yes' : 'No'}</p>
                  </div>
                )}
              </div>

              {transaction.remindersSent !== undefined && (
                <div>
                  <span className="text-sm font-medium text-gray-500">Reminders Sent:</span>
                  <p className="text-sm text-gray-900">{transaction.remindersSent}</p>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div>
              <span className="text-sm font-medium text-gray-500">Created:</span>
              <p className="text-sm text-gray-900">
                {new Date(transaction.createdAt).toLocaleString()}
              </p>
            </div>
            
            {(transaction.completedAt || transaction.paidAt) && (
              <div>
                <span className="text-sm font-medium text-gray-500">Completed:</span>
                <p className="text-sm text-gray-900">
                  {new Date(transaction.completedAt || transaction.paidAt!).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Transactions: React.FC = () => {
  // Local state for all data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionStats, setTransactionStats] = useState<TransactionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [includeFees, setIncludeFees] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [transactionModal, setTransactionModal] = useState({ isOpen: false });
  
  // API functions
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/transactions', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions || []);
        setTransactionStats(data.stats || null);
      } else {
        console.error('Failed to fetch transactions:', response.status);
        toast.error('Failed to load transactions');
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Error loading transactions');
    } finally {
      setLoading(false);
    }
  };

  // Load transactions on component mount
  useEffect(() => {
    fetchTransactions();
  }, []);
  
  // Filter transactions based on current filters
  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = !searchTerm || 
      transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction._id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || transaction.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    const matchesPaymentMethod = paymentMethodFilter === 'all' || transaction.paymentMethod === paymentMethodFilter;
    
    // Date filtering
    let matchesDate = true;
    if (dateFrom || dateTo) {
      const transactionDate = new Date(transaction.createdAt);
      if (dateFrom && transactionDate < new Date(dateFrom)) matchesDate = false;
      if (dateTo && transactionDate > new Date(dateTo + 'T23:59:59')) matchesDate = false;
    }
    
    return matchesSearch && matchesType && matchesStatus && matchesPaymentMethod && matchesDate;
  });

  const updateTransactionStatus = async (transactionId: string, status: string, transactionType: string) => {
    try {
      const response = await fetch(`/api/transactions/${transactionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status, type: transactionType })
      });

      if (response.ok) {
        const updatedTransaction = await response.json();
        setTransactions(prev => prev.map(transaction => 
          transaction._id === transactionId ? updatedTransaction : transaction
        ));
        toast.success(`Transaction ${status}`);
      }
    } catch (error) {
      console.error('Failed to update transaction status:', error);
      toast.error('Failed to update transaction status');
    }
  };

  const openTransactionModal = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setTransactionModal({ isOpen: true });
  };

  const closeTransactionModal = () => {
    setTransactionModal({ isOpen: false });
    setSelectedTransaction(null);
  };

  const getTypeColor = (type: string, transactionType: string) => {
    if (transactionType === 'fee_record') {
      return 'bg-yellow-100 text-yellow-800';
    }
    
    switch (type) {
      case 'immediate_payment':
        return 'bg-blue-100 text-blue-800';
      case 'escrow_payment':
        return 'bg-purple-100 text-purple-800';
      case 'escrow_release':
        return 'bg-green-100 text-green-800';
      case 'wallet_topup':
        return 'bg-emerald-100 text-emerald-800';
      case 'fee_payment':
        return 'bg-yellow-100 text-yellow-800';
      case 'refund':
        return 'bg-orange-100 text-orange-800';
      case 'withdrawal':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'failed':
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      case 'pending':
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTransactionIcon = (type: string, transactionType: string) => {
    if (transactionType === 'fee_record') {
      return <DollarSign className="h-4 w-4" />;
    }
    
    switch (type) {
      case 'immediate_payment':
      case 'escrow_release':
        return <ArrowUpRight className="h-4 w-4" />;
      case 'escrow_payment':
      case 'wallet_topup':
        return <ArrowDownLeft className="h-4 w-4" />;
      case 'fee_payment':
        return <DollarSign className="h-4 w-4" />;
      case 'refund':
        return <ArrowDownLeft className="h-4 w-4" />;
      default:
        return <CreditCard className="h-4 w-4" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      currencyDisplay: 'symbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('PHP', '₱');
  };

  const getUser = (transaction: Transaction) => {
    return transaction.fromUserData || transaction.fromUser || transaction.user;
  };

  const getToUser = (transaction: Transaction) => {
    return transaction.toUserData || transaction.toUser;
  };

  const isOverdue = (transaction: Transaction) => {
    return transaction.transactionType === 'fee_record' && 
           transaction.dueDate && 
           new Date(transaction.dueDate) < new Date() && 
           transaction.status !== 'completed';
  };

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h2 className="text-xl font-semibold text-gray-900">Transaction Management</h2>
              <div className="flex items-center space-x-2">
                <WifiOff className="h-4 w-4 text-gray-500" />
                <span className="text-xs text-gray-600">API Mode</span>
              </div>
            </div>
            <p className="text-sm text-gray-500">
              {transactionStats ? (
                <span>
                  {transactionStats.total} total transactions • 
                  {transactionStats.pending} pending • 
                  {transactionStats.completed} completed
                </span>
              ) : (
                `${filteredTransactions.length} transactions`
              )}
            </p>
            {transactionStats && (
              <p className="text-sm text-green-600 mt-1">
                Total Revenue: {formatCurrency(transactionStats.totalAmount)}
              </p>
            )}
          </div>
          
          <button
            onClick={fetchTransactions}
            disabled={loading}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
        
        {/* Search and Filters */}
        <div className="space-y-4">
          {/* Main search and primary filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full text-sm"
              />
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Types</option>
              <option value="immediate_payment">Immediate Payment</option>
              <option value="escrow_payment">Escrow Payment</option>
              <option value="escrow_release">Escrow Release</option>
              <option value="wallet_topup">Wallet Top-up</option>
              <option value="fee_payment">Fee Payment</option>
              <option value="fee_record">Fee Records</option>
              <option value="refund">Refund</option>
              <option value="withdrawal">Withdrawal</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
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
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Methods</option>
              <option value="wallet">Wallet</option>
              <option value="cash">Cash</option>
              <option value="xendit">Xendit</option>
              <option value="bank_transfer">Bank Transfer</option>
            </select>
          </div>

          {/* Date filters and options */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Date Range:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="From date"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="To date"
              />
            </div>
            
            <div className="flex items-center space-x-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={includeFees}
                  onChange={(e) => setIncludeFees(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Include Fee Records</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-500">Loading transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-500">
              {searchTerm || typeFilter !== 'all' || statusFilter !== 'all' ? (
                <p>No transactions match your filters</p>
              ) : (
                <p>No transactions found</p>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => {
                  const user = getUser(transaction);
                  const toUser = getToUser(transaction);
                  
                  return (
                    <tr key={transaction._id} className="hover:bg-gray-50">
                      <td className="px-3 py-3">
                        <div className="flex items-start space-x-2">
                          <div className="flex-shrink-0 mt-1">
                            {getTransactionIcon(transaction.type, transaction.transactionType)}
                          </div>
                          <div className="min-w-0 flex-1 max-w-xs">
                            <div className="flex flex-wrap items-center gap-1 mb-1">
                              <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full ${getTypeColor(transaction.type, transaction.transactionType)}`}>
                                {transaction.transactionType === 'fee_record' ? 'Fee Record' : transaction.type?.replace('_', ' ')}
                              </span>
                              {isOverdue(transaction) && (
                                <AlertTriangle className="h-3 w-3 text-red-500" title="Overdue" />
                              )}
                            </div>
                            <div 
                              className="text-sm text-gray-900" 
                              style={lineClampStyles}
                              title={transaction.description}
                            >
                              {transaction.description}
                            </div>
                            {(transaction.job || transaction.jobId) && (
                              <div className="flex items-center text-xs text-gray-500 mt-1">
                                <Briefcase className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate" title={transaction.job?.title || transaction.jobId?.title}>
                                  {transaction.job?.title || transaction.jobId?.title}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="space-y-1 max-w-sm">
                          {user && (
                            <div className="flex items-center space-x-2">
                              <div className="flex-shrink-0 h-5 w-5">
                                <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
                                  <User className="h-3 w-3 text-blue-600" />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-gray-900 truncate" title={user.name}>{user.name}</div>
                                <div className="text-xs text-gray-500 truncate" title={user.email}>{user.email}</div>
                              </div>
                            </div>
                          )}
                          {toUser && transaction.transactionType !== 'fee_record' && user?._id !== toUser._id && (
                            <div className="flex items-center space-x-2 pl-2">
                              <ArrowDownLeft className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <div className="text-sm text-gray-900 truncate" title={toUser.name}>{toUser.name}</div>
                                <div className="text-xs text-gray-500 truncate" title={toUser.email}>{toUser.email}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          {formatCurrency(transaction.amount)}
                        </div>
                        {transaction.platformFee && transaction.platformFee > 0 && (
                          <div className="text-xs text-gray-500 whitespace-nowrap">
                            Fee: {formatCurrency(transaction.platformFee)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center space-x-1">
                          <CreditCard className="h-3 w-3 text-gray-400 flex-shrink-0" />
                          <span className="text-xs text-gray-900 capitalize whitespace-nowrap" title={transaction.paymentMethod}>
                            {transaction.paymentMethod || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(transaction.status)}
                          <span className={`inline-flex px-1.5 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-xs text-gray-500" title={new Date(transaction.createdAt).toLocaleString()}>
                          {formatDistanceToNow(new Date(transaction.createdAt), { addSuffix: true })}
                        </div>
                        <div className="flex items-center text-xs text-gray-400 mt-1">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(transaction.createdAt).toLocaleDateString()}
                        </div>
                        {(transaction.completedAt || transaction.paidAt) && (
                          <div className="text-xs text-green-600 mt-1">
                            Completed {formatDistanceToNow(new Date(transaction.completedAt || transaction.paidAt!), { addSuffix: true })}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-1">
                          {transaction.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateTransactionStatus(transaction._id, 'completed', transaction.transactionType)}
                                className="p-1.5 text-green-600 hover:bg-green-100 rounded transition-colors"
                                title="Mark as completed"
                              >
                                <CheckCircle className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => updateTransactionStatus(transaction._id, 'failed', transaction.transactionType)}
                                className="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors"
                                title="Mark as failed"
                              >
                                <XCircle className="h-3 w-3" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openTransactionModal(transaction)}
                            className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        isOpen={transactionModal.isOpen}
        onClose={closeTransactionModal}
        transaction={selectedTransaction}
      />
    </div>
  );
};

export default Transactions;
