import { Verification } from './verifications.types';

export type UserType = 'client' | 'provider' | 'admin' | 'superadmin';
export type AccountStatus = 'active' | 'restricted' | 'suspended' | 'banned' | 'deleted';
// Mirrors the restrictionDetails.type enum on the server's User schema, which
// includes 'deleted' for soft-deleted accounts.
export type RestrictionType = 'restricted' | 'suspended' | 'banned' | 'deleted';

export interface RestrictionDetails {
  type: RestrictionType;
  reason: string;
  restrictedAt: Date;
  suspendedUntil?: Date;
  expiresAt?: Date;
  appealAllowed: boolean;
  restrictedBy?: string | {
    _id: string;
    name: string;
  };
}

export interface UserWallet {
  balance: number;
  availableBalance: number;
  heldBalance: number;
  currency: string;
  isActive: boolean;
  isVerified: boolean;
}

export interface UserFee {
  _id: string;
  amount: number;
  dueDate: Date;
  isPaid: boolean;
  status: string;
  paymentMethod?: string;
  createdAt: Date;
}

export interface JobVerification {
  category: string;
  status: 'none' | 'pending' | 'approved' | 'rejected' | 'under_review' | 'expired';
  isVerified: boolean;
  documents?: any[];
  reviewedAt?: string | Date;
  reviewedBy?: string | any;
  // Credential details captured by kayod/server.
  verifiedAt?: string | null;
  certificationType?: string | null;
  certificateNumber?: string | null;
  expiresAt?: string | null;
  expiredAt?: string | null;
}

/**
 * What this user has moved through their wallet, summarised for the list.
 * Totals count only settled movements; `pending` is money still in flight.
 */
export interface UserFinancialTotals {
  topUpTotal: number;
  topUpPending: number;
  cashOutTotal: number;
  cashOutPending: number;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  phoneNumber?: string;
  location: string;
  categories: string[];
  jobCategories?: string | string[];
  category?: string;
  jobVerificationStatus?: JobVerification[];
  userType?: UserType;
  profileImage?: string;
  profileImagePublicId?: string;
  isVerified: boolean;
  isRestricted: boolean;
  isOnline: boolean;
  dateOfBirth?: string;
  accountStatus?: AccountStatus;
  restrictionDetails?: RestrictionDetails;
  wallet: UserWallet;
  financials?: UserFinancialTotals;
  fees: UserFee[];
  verificationAudit?: Verification | null;
  createdAt: Date;
  lastLogin?: Date;
  /** Running average kept on the user by kayod/server (providers). */
  ratings?: number;
  /** Jobs completed as a provider, kept by kayod/server. */
  completedJobs?: number;
  /** Dispute findings against this user (written by resolveDispute). */
  faultFindings?: FaultFinding[];

  // ── Written by kayod/server on the shared users document. The admin schema
  // doesn't declare them, but lean() reads return them, so they arrive here.
  // All optional: older accounts predate most of them.
  firstName?: string;
  lastName?: string;
  bio?: string;
  phoneNumberWithCountryCode?: string;
  referralCode?: string;
  isGoogleUser?: boolean;
  isFacebookUser?: boolean;
  isAuth0User?: boolean;
  isPremium?: boolean;
  premiumSubscribedAt?: string;
  premiumExpiresAt?: string;
  languages?: string[];
  skills?: string[];
  certifications?: string[];
  availability?: string;
  acceptingJobs?: boolean;
  averageResponseTime?: string;
  totalJobsPosted?: number;
  ticketsSubmittedResolved?: number;
  addresses?: {
    name?: string;
    address?: string;
    city?: string;
    region?: string;
    isDefault?: boolean;
  }[];
  serviceArea?: {
    radius?: number;
    center?: { name?: string; city?: string; region?: string };
  };
  feeStatus?: {
    unpaidFees?: number;
    lastUnpaidDate?: string | null;
    restrictionLevel?: 'none' | 'warning' | 'restricted';
    warningCount?: number;
    totalFeesPaid?: number;
    lastFeePayment?: string | null;
  };
  cancellationStrikes?: {
    count?: number;
    history?: { jobId?: string; cancelledAt?: string; strikeNumber?: number; ratingDeducted?: number }[];
  };
}

/** GET /api/users/:id/standing — trust signals stored outside the user document. */
export interface UserStandingResponse {
  reportsAgainst: { total: number; open: number };
  reportsFiled: number;
  support: { total: number; open: number };
}

export interface FaultFinding {
  jobId?: string;
  role?: 'client' | 'provider';
  faultParty?: 'client' | 'provider' | 'both';
  findingReason?: 'no_show' | 'late_cancel' | 'access_failure' | 'emergency' | 'other';
  notes?: string | null;
  sanctioned?: boolean;
  decidedAt?: string;
}

/** GET /api/users/:id/reviews — what clients said about a provider. */
export interface UserReview {
  _id: string;
  rating: number;
  review: string;
  categoryRatings: { key: string; label?: string; value: number }[];
  images: string[];
  createdAt: string;
  client: { _id: string; name: string; profileImage?: string } | null;
  job: { _id: string; title: string } | null;
}

export interface UserReviewsSummary {
  average: number;
  count: number;
  /** Count per star, keyed "1"–"5". */
  distribution: Record<string, number>;
  categories: { key: string; label: string; average: number; count: number }[];
}

export interface UserReviewsResponse {
  summary: UserReviewsSummary;
  reviews: UserReview[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface UserStats {
  totalUsers: number;
  onlineUsers: number;
  verifiedUsers: number;
  restrictedUsers: number;
}

export interface PenaltyData {
  totalPenalties: number;
  activeWarnings: number;
  lastPenalty: Date | null;
}

export interface UsersQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  /** 'client', 'provider', or both comma-separated ('client,provider'). */
  userType?: string;
  restricted?: string;
  isVerified?: string;
  accountStatus?: string;
  profession?: string;
}

/** One cell of GET /api/users/counts (Backend userService.countUsersByFacet). */
export interface UserCountCell {
  userType: 'client' | 'provider';
  accountStatus: string;
  isVerified: boolean;
  count: number;
}

export interface UserCountsResponse {
  success: boolean;
  cells: UserCountCell[];
}

export interface UsersResponse {
  users: User[];
  stats?: UserStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * One affirmation of the platform's agreements, appended by the Kayod server.
 *
 * Read-only in the admin: it is an audit trail, and support reads it during a
 * dispute to establish which version of which documents a user accepted, and
 * when. Mirrors the subdocument on the User schema in both backends.
 */
export interface LegalAcceptance {
  version: string;
  documentIds: string[];
  context: 'registration' | 'booking' | 'job-post' | 'provider-confirm';
  jobId?: string;
  acceptedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserDetailsResponse extends User {
  legalAcceptances?: LegalAcceptance[];
}

export interface UserActionRequest {
  reason?: string;
  duration?: number;
  verified?: boolean;
  restricted?: boolean;
}

export interface UserActionResponse extends User { }

/* ------------------------------------------------------------------------ *
 * Per-user history: activity timeline, jobs, and money in/out
 * ------------------------------------------------------------------------ */

export type ActivityEventType =
  | 'job'
  | 'money'
  | 'quote'
  | 'review'
  | 'verification'
  | 'support'
  | 'report'
  | 'admin';

/**
 * One thing the user did. The server merges these out of jobs, transactions,
 * withdrawals, quotes, reviews, verifications, tickets, reports and the admin
 * audit log, so every field past `type`/`title`/`timestamp` is optional —
 * which ones are present depends on which collection the row came from.
 */
export interface UserActivityEvent {
  id: string;
  type: ActivityEventType;
  action: string;
  title: string;
  description?: string;
  amount?: number | null;
  direction?: 'in' | 'out';
  status?: string;
  category?: string | null;
  rating?: number;
  actor?: string;
  metadata?: Record<string, unknown>;
  targetId?: string;
  targetType?: string;
  jobId?: string | null;
  timestamp: string;
}

export interface UserActivityResponse {
  events: UserActivityEvent[];
  pagination: {
    page: number;
    limit: number;
    /** Rows merged so far, not a collection-wide total — page on `hasMore`. */
    loaded: number;
    hasMore: boolean;
  };
}

export interface UserJobSummary {
  posted: number;
  worked: number;
  /** Sum of what the posted jobs are worth, agreed price included. */
  postedValue: number;
  byStatus: Record<string, number>;
}

export interface UserJob {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  budget?: number;
  agreedPrice?: number;
  /** Server-resolved worth: budget, else agreed price, else what was paid. */
  value: number;
  userRole: 'poster' | 'provider';
  userId?: { _id: string; name: string; profileImage?: string } | string;
  assignedToId?: { _id: string; name: string; profileImage?: string } | string;
  createdAt: string;
}

export interface UserJobsResponse {
  jobs: UserJob[];
  summary: UserJobSummary;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface TopUpEntry {
  _id: string;
  amount: number;
  status: string;
  method?: string;
  description?: string;
  reference?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface CashOutEntry {
  _id: string;
  amount: number;
  /** What the user actually received, after any processing fee. */
  netAmount: number;
  fee: number;
  status: string;
  destination?: string | null;
  destinationType?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  method?: string | null;
  reference?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface UserFinancialsResponse {
  topUp: {
    total: number;
    pending: number;
    count: number;
    entries: TopUpEntry[];
  };
  cashOut: {
    total: number;
    pending: number;
    count: number;
    entries: CashOutEntry[];
  };
  /** Money in that the user did not put there themselves. */
  earned: number;
  /** Money out that was not a cash-out. */
  spent: number;
  feesPaid: number;
  refunded: number;
}

export interface UserActivityQueryParams {
  page?: number;
  limit?: number;
  types?: string;
}
