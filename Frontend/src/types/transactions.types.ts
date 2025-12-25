/**
 * Transaction Types
 */

export interface Transaction {
  _id: string;
  transactionType: 'transaction' | 'fee_record';
  fromUser?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
    profileImage?: string;
  };
  toUser?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
    profileImage?: string;
  };
  fromUserData?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
    profileImage?: string;
  };
  toUserData?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
    profileImage?: string;
  };
  user?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
    profileImage?: string;
  };
  amount: number;
  type: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  jobId?: {
    _id: string;
    title: string;
    category?: string;
    budget?: number;
  };
  job?: {
    _id: string;
    title: string;
    category?: string;
    budget?: number;
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

export interface TransactionStats {
  total: number;
  pending: number;
  completed: number;
  failed: number;
  totalAmount: number;
}

export interface TransactionsQueryParams {
  search?: string;
  status?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  includeFees?: string;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
  stats: TransactionStats | null;
}

export interface UpdateTransactionStatusRequest {
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  type: string;
}

export interface UpdateTransactionStatusResponse {
  success: boolean;
  transaction: Transaction;
}

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type TransactionType = 'transaction' | 'fee_record';
export type PaymentMethod = 'wallet' | 'cash' | 'xendit';
