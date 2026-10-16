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
  cancelled: number;
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
  jobId?: string;
  page?: number;
  limit?: number;
}

export interface TransactionsResponse {
  success: boolean;
  transactions: Transaction[];
  stats: TransactionStats | null;
  pagination?: {
    total: number;
    pages: number;
    page: number;
    limit: number;
  };
}

export interface UpdateTransactionStatusRequest {
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  type: string;
}

export interface UpdateTransactionStatusResponse {
  success: boolean;
  transaction: Transaction;
}

/**
 * Status tallies for the transactions list header, from GET /api/transactions/counts.
 *
 * The `*Amount` fields are real sums. Under the previous five-call approach they
 * were read from a `stats` key the list reply never returned, so they were
 * always 0 — the page does not render them today, but they are correct now.
 */
export interface TransactionCounts {
  total: number;
  totalAmount: number;
  pending: number;
  pendingAmount: number;
  completed: number;
  completedAmount: number;
  completedRevenue: number;
  failed: number;
  failedAmount: number;
  cancelled: number;
  cancelledAmount: number;
}

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type TransactionType = 'transaction' | 'fee_record';
export type PaymentMethod = 'wallet' | 'xendit';
