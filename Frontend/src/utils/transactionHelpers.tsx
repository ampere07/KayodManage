import React from 'react';
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

/**
 * Transaction utility helper functions
 */

/**
 * Get type color classes based on transaction type
 */
export const getTypeColor = (type: string, transactionType: string): string => {
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
    case 'xendit_topup':
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
export const getTransactionIcon = (type: string, transactionType: string): JSX.Element => {
  if (transactionType === 'fee_record') {
    return <DollarSign className="h-4 w-4" />;
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
    transaction.transactionType === 'fee_record' &&
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
    case 'fee_record':
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
