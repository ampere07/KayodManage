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
    userType?: 'client' | 'provider';
  };
  toUser?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
    profileImage?: string;
    userType?: 'client' | 'provider';
  };
  fromUserData?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
    profileImage?: string;
    userType?: 'client' | 'provider';
  };
  toUserData?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
    profileImage?: string;
    userType?: 'client' | 'provider';
  };
  user?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    location?: string;
    profileImage?: string;
    userType?: 'client' | 'provider';
  };
  amount: number;
  type: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired' | 'processing' | 'held' | 'refunded' | 'escrowed';
  /** Per-type details: a top-up's Xendit channel, a cash-out's channel and
   *  account, a refund request's reason. */
  metadata?: Record<string, any>;
  failureReason?: string;
  failedAt?: Date;
  xenditId?: string;
  refundStatus?: 'pending' | 'approved' | 'declined';
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
  /** Date (newest first by default) or amount. */
  sort?: TransactionsSort;
}

export type TransactionsSort = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';

/** The list filters the counters are narrowed by, so a count is the rows it shows. */
export type TransactionCountFilters = Pick<TransactionsQueryParams, 'search' | 'paymentMethod' | 'dateFrom' | 'dateTo'>;

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
  /** Every status present (expired, processing… included), with its amount. */
  byStatus?: Record<string, { count: number; amount: number }>;
}

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type TransactionType = 'transaction' | 'fee_record';
export type PaymentMethod = 'wallet' | 'xendit';
