// Alert/Reported Post Types
import type { ReportStatus } from './flagged.types';

// The status lifecycle lives in flagged.types.ts so there is exactly one copy
// of it — re-exported here for the existing importers of this module.
export type { ReportStatus, ReportFilterStatus } from './flagged.types';

export interface ReportedPost {
  _id: string;
  jobId: JobDetails;
  reportedBy: ReporterInfo;
  jobPosterId: string;
  reason: string;
  comment: string;
  status: ReportStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  adminNotes: string;
  actionTaken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JobDetails {
  _id: string;
  title: string;
  description: string;
  category: string;
  location: {
    address: string;
    city: string;
    region: string;
    country: string;
  };
  budget: number;
  budgetType: string;
  paymentMethod: string;
  media?: MediaItem[];
  isDeleted?: boolean;
  deletedAt?: string;
  deletionReason?: string;
  createdAt: string;
  status?: string;
}

export interface MediaItem {
  type?: string;
  mediaType?: string;
  originalName?: string;
  url?: string;
}

export interface ReporterInfo {
  _id: string;
  providerId: string;
  providerName: string;
  providerEmail: string;
}

export interface ReportsSummary {
  total: number;
  open: number;
  under_review: number;
  action_taken: number;
  escalated: number;
  dismissed: number;
  recentReports?: number;
  topReasons?: Array<{ _id: string; count: number }>;
}

export interface ReportedPostsResponse {
  success: boolean;
  reportedPosts: ReportedPost[];
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  summary?: ReportsSummary;
}

export interface ReviewPostRequest {
  action: 'approve' | 'dismiss' | 'delete';
  adminNotes?: string;
}

export interface ReviewPostResponse {
  success: boolean;
  message: string;
  reportedPost: ReportedPost;
}
