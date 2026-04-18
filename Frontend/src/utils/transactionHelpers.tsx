import {
  CheckCircle,
  XCircle,
  Clock,
  CreditCard,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign
} from 'lucide-react';
import type { Transaction } from '../types';
import { getProfessionIconFromName, getProfessionIconByName } from '../constants/categoryIcons';

/**
 * Transaction utility helper functions
 */

/**
 * Get type color classes based on transaction type
 */
export const getTypeColor = (type: string, transactionType: string): string => {
  if (transactionType === 'platform_fee' || transactionType === 'fee_record') {
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
    case 'xendit_topup':
      return 'bg-emerald-100 text-emerald-800';
    case 'fee_payment':
    case 'platform_fee':
      return 'bg-yellow-100 text-yellow-800';
    case 'refund':
      return 'bg-orange-100 text-orange-800';
    case 'withdrawal':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

/**
 * Get transaction status color classes
 */
export const getTransactionStatusColor = (status: string): string => {
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

/**
 * Get transaction status icon component
 */
export const getTransactionStatusIcon = (status: string): JSX.Element | null => {
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

/**
 * Get transaction icon based on type
 */
export const getTransactionIcon = (transaction: any): JSX.Element => {
  const { type, transactionType, jobId, job } = transaction;
  const isFeeRecord = transactionType === 'fee_record' || transactionType === 'platform_fee' || type === 'platform_fee' || type === 'fee_payment';
  const jobInfo = jobId || job;

  if (isFeeRecord) {
    let iconData;
    const professionName = jobInfo?.professionName || jobInfo?.categoryName || jobInfo?.category || jobInfo?.title;
    
    if (jobInfo?.icon) {
      iconData = getProfessionIconByName(jobInfo.icon);
    } else if (professionName) {
      iconData = getProfessionIconFromName(professionName);
    }
    
    if (iconData?.imagePath) {
        return (
          <div className="relative flex items-center justify-center h-full w-full p-2">
            <div className="absolute inset-0 bg-orange-50/80 rounded-lg group-hover:bg-white transition-colors"></div>
            <img 
              src={iconData.imagePath} 
              alt={jobInfo.category || jobInfo.title} 
              className="relative z-10 w-full h-full object-contain drop-shadow-sm"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>
        );
      }
    return <DollarSign className="h-5 w-5 text-yellow-600" />;
  }

  switch (type) {
    case 'immediate_payment':
    case 'escrow_release':
      return <ArrowUpRight className="h-4 w-4" />;
    case 'escrow_payment':
    case 'wallet_topup':
    case 'xendit_topup':
      return <ArrowDownLeft className="h-4 w-4" />;
    case 'fee_payment':
      return <DollarSign className="h-4 w-4" />;
    case 'refund':
      return <ArrowDownLeft className="h-4 w-4" />;
    default:
      return <CreditCard className="h-4 w-4" />;
  }
};

/**
 * Get user from transaction
 */
export const getUser = (transaction: Transaction) => {
  return transaction.fromUserData || transaction.fromUser || transaction.user;
};

/**
 * Get recipient user from transaction
 */
export const getToUser = (transaction: Transaction) => {
  return transaction.toUserData || transaction.toUser;
};

/**
 * Check if transaction is overdue
 */
export const isOverdue = (transaction: Transaction): boolean => {
  return (
    transaction.type === 'platform_fee' &&
    !!transaction.dueDate &&
    new Date(transaction.dueDate) < new Date() &&
    transaction.status !== 'completed'
  );
};

/**
 * Get category title based on transaction category
 */
export const getCategoryTitle = (category: string): string => {
  switch (category) {
    case 'platform_fee':
      return 'Fee Records';
    case 'wallet_topup':
      return 'Top-up Transactions';
    case 'withdrawal':
      return 'Cashout Transactions';
    case 'refund':
      return 'Refund Transactions';
    default:
      return 'Transactions';
  }
};

/**
 * Line clamp styles for text truncation
 */
export const lineClampStyles = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};
