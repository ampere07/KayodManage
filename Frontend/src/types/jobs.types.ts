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
  category: string;
  icon?: string;
  media: string[];
  location?: any;
  locationDisplay: string;
  locationDetails?: string;
  date: Date | string;
  isUrgent: boolean;
  serviceTier: 'basic' | 'standard' | 'premium';
  paymentMethod: 'wallet' | 'cash' | 'xendit';
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
  user?: {
    _id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    email: string;
    phone?: string;
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
  paymentStatus: 'pending' | 'paid' | 'refunded';
  escrowAmount: number;
  paidAmount: number;
  paidAt?: Date | string;
  applicationCount: number;
  applications?: Application[];
  archived?: boolean;
  archiveType?: 'hidden' | 'removed';
  archivedAt?: Date | string;
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
export type PaymentMethod = 'wallet' | 'cash' | 'xendit';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';
