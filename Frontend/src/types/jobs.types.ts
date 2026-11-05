// Job Types
import type { ServiceClassId } from '../constants/serviceClasses';

export type JobQuoteStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn' | 'expired';

/**
 * A provider's quote on a job — the app's "applicant". Read from kayod/server's
 * jobquotes; the admin panel shows them but never accepts one (accepting holds
 * the client's funds in escrow, which is the client's action).
 */
export interface JobQuote {
  _id: string;
  provider: {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    phoneNumber?: string;
  } | null;
  amount: number | null;
  status: JobQuoteStatus;
  submittedAt: Date | string | null;
}

export interface Job {
  _id: string;
  title: string;
  description: string;
  category?: string;
  categoryId?: string;
  categoryName?: string;
  profession?: string;
  professionName?: string;
  /** Payment-release terms, snapshotted onto the job when it was created. */
  serviceClass?: ServiceClassId;
  paymentReleaseHours?: number;
  icon?: string;
  media: string[];
  location?: any;
  locationDisplay: string;
  locationDetails?: string;
  date: Date | string;
  selectedDates?: (Date | string)[];
  timeWindows?: string[];
  paymentMethod: 'wallet' | 'xendit';
  status: 'open' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
  user?: {
    _id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
    phoneNumber?: string;
    location?: string;
    barangay?: string;
    city?: string;
    isVerified?: boolean;
    userType?: 'client' | 'provider';
    profileImage?: string;
  };
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  budget: number;
  agreedPrice?: number;
  acceptedProvider?: {
    providerId: string;
    agreedPrice: number;
    acceptedAt: string | Date;
  };
  paymentStatus: 'pending' | 'paid' | 'refunded' | 'escrow_required' | 'escrow_held' | 'failed';
  escrowAmount: number;
  escrowStatus?: 'none' | 'pending' | 'releasing' | 'released' | 'refunded' | 'failed';
  escrowReleaseAt?: Date | string | null;
  paidAmount: number;
  paidAt?: Date | string;
  /** Number of quotes providers have submitted (the job's applicants). */
  applicationCount: number;
  quotes?: JobQuote[];
  isHidden?: boolean;
  hiddenAt?: Date | string;
  hiddenBy?: string;
  isDeleted?: boolean;
  deletedAt?: Date | string;
  deletedBy?: string;
  cancellation?: {
    cancelledAt?: Date | string | null;
    cancelledBy?: string | null;
    reason?: string | null;
    feeApplied?: number | null;
  };
  completionStatus?: {
    clientConfirmed?: boolean;
    providerConfirmed?: boolean;
    completedAt?: Date | string | null;
    dispute?: {
      isActive: boolean;
      raisedBy?: 'client' | 'provider' | null;
      raisedAt?: Date | string | null;
      reason?: string | null;
      resolvedAt?: Date | string | null;
      resolution?: 'provider_paid' | 'client_refunded' | 'rebook' | 'no_show_payout' | null;
    };
    disputeHistory?: Array<{
      raisedBy: 'client' | 'provider';
      raisedAt: Date | string;
      reason: string;
      resolvedAt: Date | string;
      resolution: 'provider_paid' | 'client_refunded' | 'rebook' | 'no_show_payout';
    }>;
  };
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface JobsQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  category?: string;
  profession?: string;
  paymentMethod?: string;
  /** Quick filters: jobs in an active dispute, or open jobs nobody has quoted on. */
  flag?: JobsQuickFilter;
  sort?: JobsSort;
  archived?: boolean;
  archiveType?: 'hidden' | 'removed';
}

export type JobsQuickFilter = 'dispute' | 'no_quotes';
/** archived_* order by when the job was hidden or deleted (the Archived page). */
export type JobsSort = 'newest' | 'oldest' | 'price_desc' | 'price_asc' | 'archived_desc' | 'archived_asc';
export type JobStatus = Job['status'];

/** GET /api/jobs/summary — live jobs only (not hidden or deleted). */
export interface JobsSummary {
  total: number;
  byStatus: Record<JobStatus, number>;
  disputes: number;
  openWithoutQuotes: number;
  /** Value of completed jobs (budget, or the agreed quote). */
  totalValue: number;
}

/**
 * GET /api/jobs/archived-summary — archived jobs counted by status and by how
 * they were taken down. A job can be both hidden and deleted.
 */
export interface ArchivedJobsSummary {
  cells: { status: JobStatus; hidden: boolean; deleted: boolean; count: number }[];
}

export interface JobsPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface JobsResponse {
  success: boolean;
  jobs: Job[];
  pagination: JobsPagination;
  stats?: {
    totalValue: number;
  };
}

export interface JobDetailsResponse {
  success: boolean;
  job: Job;
  quotes: JobQuote[];
}

export interface UpdateJobStatusRequest {
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
}

export interface UpdateJobStatusResponse {
  success: boolean;
  job: Job;
}

export type ServiceTier = 'basic' | 'standard' | 'premium';
export type PaymentMethod = 'wallet' | 'xendit';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';

/**
 * resolveDispute's response. `escrow` describes what actually happened to the
 * hold: a dispute raised during the 5-day window RESUMES its original release
 * date rather than restarting it (resumed: true), and pays out immediately when
 * that date already passed during mediation (releasedImmediately: true).
 */
export interface ResolveDisputeResponse {
  success: boolean;
  job: Job;
  outcome: string;
  refundedAmount: number;
  draftId: string | null;
  escrow: {
    scheduledFor: string | null;
    originalScheduledFor: string | null;
    releasedImmediately: boolean;
    resumed: boolean;
  } | null;
  rebookDeadlineAt: string | null;
  /**
   * Present only for the 'no_show_payout' outcome: how the held amount was
   * split between the provider's reserved-time payout and the client's refund.
   * Returned by the server rather than recomputed here so the confirmation the
   * admin reads is the arithmetic that was actually committed.
   */
  noShowSettlement: {
    payout: number;
    clientRefund: number;
    heldAmount: number;
  } | null;
}

/**
 * What an admin established about a disputed booking.
 *
 * Deliberately separate from the resolution outcome. `refund_client` alone cannot
 * distinguish "the provider never arrived" from "the work was unacceptable" from
 * "both sides called it off" — three findings with three different consequences —
 * so the finding is stated rather than inferred. An omitted one is recorded as
 * `uncertain` and sanctions nobody.
 */
export type FaultParty = 'client' | 'provider' | 'both' | 'none' | 'uncertain';

export type FindingReason =
  | 'no_show'
  | 'late_cancel'
  | 'access_failure'
  | 'emergency'
  | 'other';

export interface DisputeFinding {
  faultParty: FaultParty;
  findingReason: FindingReason;
  notes?: string;
}
