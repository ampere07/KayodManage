import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
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
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X as XIcon
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

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

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onClear: () => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onClear
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingStart, setSelectingStart] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  const handleDateClick = (day: number) => {
    const selectedDate = new Date(year, month, day);
    const dateString = selectedDate.toISOString().split('T')[0];

    if (selectingStart) {
      onStartDateChange(dateString);
      setSelectingStart(false);
    } else {
      if (startDate && new Date(dateString) < new Date(startDate)) {
        onStartDateChange(dateString);
        onEndDateChange('');
      } else {
        onEndDateChange(dateString);
        setIsOpen(false);
        setSelectingStart(true);
      }
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1));
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    onStartDateChange(start.toISOString().split('T')[0]);
    onEndDateChange(end.toISOString().split('T')[0]);
    setIsOpen(false);
    setSelectingStart(true);
  };

  const handleClear = () => {
    onClear();
    setSelectingStart(true);
    setIsOpen(false);
  };

  const isDateInRange = (day: number) => {
    if (!startDate || !endDate) return false;
    const date = new Date(year, month, day);
    return date >= new Date(startDate) && date <= new Date(endDate);
  };

  const isStartDate = (day: number) => {
    if (!startDate) return false;
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0] === startDate;
  };

  const isEndDate = (day: number) => {
    if (!endDate) return false;
    const date = new Date(year, month, day);
    return date.toISOString().split('T')[0] === endDate;
  };

  const formatDisplayDate = () => {
    if (!startDate && !endDate) return 'Select date range';
    if (startDate && !endDate) return `${new Date(startDate).toLocaleDateString()} - Select end`;
    if (startDate && endDate) {
      return `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
    }
    return 'Select date range';
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
      >
        <Calendar className="h-4 w-4 text-gray-400" />
        <span className="text-gray-700">{formatDisplayDate()}</span>
        {(startDate || endDate) && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            <XIcon className="h-3 w-3" />
          </button>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4 w-80">
          {/* Quick Select Buttons */}
          <div className="flex gap-2 mb-4 pb-4 border-b border-gray-200">
            <button
              onClick={() => handleQuickSelect(7)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Last 7 days
            </button>
            <button
              onClick={() => handleQuickSelect(30)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Last 30 days
            </button>
            <button
              onClick={() => handleQuickSelect(90)}
              className="flex-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Last 90 days
            </button>
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>
            <span className="text-sm font-semibold text-gray-900">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>

          {/* Day Names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map(day => (
              <div key={day} className="text-center text-xs font-medium text-gray-500 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startingDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const inRange = isDateInRange(day);
              const isStart = isStartDate(day);
              const isEnd = isEndDate(day);
              const isSelected = isStart || isEnd;

              return (
                <button
                  key={day}
                  onClick={() => handleDateClick(day)}
                  className={`
                    h-8 w-8 text-sm rounded-lg transition-colors
                    ${isSelected 
                      ? 'bg-blue-600 text-white font-semibold' 
                      : inRange 
                        ? 'bg-blue-100 text-blue-900' 
                        : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Status Text */}
          <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600 text-center">
            {selectingStart ? 'Select start date' : 'Select end date'}
          </div>
        </div>
      )}
    </div>
  );
};

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

  useEffect(() => {
    fetchTransactions();
  }, []);
  
  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = !searchTerm || 
      transaction.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction._id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === 'all' || transaction.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    const matchesPaymentMethod = paymentMethodFilter === 'all' || transaction.paymentMethod === paymentMethodFilter;
    
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

  const clearDateRange = () => {
    setDateFrom('');
    setDateTo('');
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
        return 'bg-green-50 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'cancelled':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
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
    <div className="fixed inset-0 md:left-64 flex flex-col bg-gray-50">
      <div className="flex-shrink-0 bg-white px-6 py-5 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="text-sm text-gray-500 mt-1">
              {transactionStats ? (
                <span>
                  {transactionStats.total} transactions • {transactionStats.pending} pending • {transactionStats.completed} completed
                </span>
              ) : (
                `${filteredTransactions.length} transactions`
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
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
        </div>

        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
            
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
            >
              <option value="all">All Types</option>
              <option value="immediate_payment">Immediate Payment</option>
              <option value="escrow_payment">Escrow Payment</option>
              <option value="escrow_release">Escrow Release</option>
              <option value="wallet_topup">Wallet Top-up</option>
              <option value="fee_payment">Fee Payment</option>
              <option value="refund">Refund</option>
            </select>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
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
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
            >
              <option value="all">All Methods</option>
              <option value="wallet">Wallet</option>
              <option value="cash">Cash</option>
              <option value="xendit">Xendit</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
            <DateRangePicker
              startDate={dateFrom}
              endDate={dateTo}
              onStartDateChange={setDateFrom}
              onEndDateChange={setDateTo}
              onClear={clearDateRange}
            />
            
            <label className="flex items-center gap-2 ml-auto">
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

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading transactions...</p>
            </div>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center">
            <div className="text-gray-400 mb-4">
              <Search className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-gray-600 font-medium">No transactions found</p>
            <p className="text-sm text-gray-500 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Transaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTransactions.map((transaction) => {
                  const user = getUser(transaction);
                  const toUser = getToUser(transaction);
                  
                  return (
                    <tr key={transaction._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-1">
                            {getTransactionIcon(transaction.type, transaction.transactionType)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getTypeColor(transaction.type, transaction.transactionType)}`}>
                                {transaction.transactionType === 'fee_record' ? 'Fee Record' : transaction.type?.replace('_', ' ')}
                              </span>
                              {isOverdue(transaction) && (
                                <AlertTriangle className="h-3 w-3 text-red-500" title="Overdue" />
                              )}
                            </div>
                            <p className="text-sm text-gray-900 line-clamp-2">{transaction.description}</p>
                            {(transaction.job || transaction.jobId) && (
                              <div className="flex items-center text-xs text-gray-500 mt-1">
                                <Briefcase className="h-3 w-3 mr-1" />
                                <span className="truncate">{transaction.job?.title || transaction.jobId?.title}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          {user && (
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <User className="h-3 w-3 text-blue-600" />
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
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${getStatusColor(transaction.status)}`}>
                            {getStatusIcon(transaction.status)}
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
                            {new Date(transaction.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {transaction.status === 'pending' && (
                            <>
                              <button
                                onClick={() => updateTransactionStatus(transaction._id, 'completed', transaction.transactionType)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Mark as completed"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => updateTransactionStatus(transaction._id, 'failed', transaction.transactionType)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Mark as failed"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => openTransactionModal(transaction)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
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

      <TransactionDetailsModal
        isOpen={transactionModal.isOpen}
        onClose={closeTransactionModal}
        transaction={selectedTransaction}
      />
    </div>
  );
};

export default Transactions;
