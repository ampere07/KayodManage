// Job Types
export interface Application {
  _id: string;
  provider: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  status: 'pending' | 'accepted' | 'rejected';
  appliedAt: Date | string;
  message?: string;
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
  icon?: string;
  media: string[];
  location?: any;
  locationDisplay: string;
  locationDetails?: string;
  date: Date | string;
  isUrgent: boolean;
  serviceTier: 'basic' | 'standard' | 'premium';
  paymentMethod: 'wallet' | 'xendit';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
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
  applicationCount: number;
  applications?: Application[];
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
      resolution?: 'provider_paid' | 'client_refunded' | 'rebook' | null;
    };
    disputeHistory?: Array<{
      raisedBy: 'client' | 'provider';
      raisedAt: Date | string;
      reason: string;
      resolvedAt: Date | string;
      resolution: 'provider_paid' | 'client_refunded' | 'rebook';
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
  paymentMethod?: string;
  isUrgent?: string;
  archived?: boolean;
  archiveType?: 'hidden' | 'removed';
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
  applications: Application[];
}

export interface UpdateJobStatusRequest {
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
}

export interface UpdateJobStatusResponse {
  success: boolean;
  job: Job;
}

export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type ServiceTier = 'basic' | 'standard' | 'premium';
export type PaymentMethod = 'wallet' | 'xendit';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';
