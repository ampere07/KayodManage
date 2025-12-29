// Flagged/Reported Post Types
export interface ReportedPost {
  _id: string;
  jobId: JobDetails;
  reportedBy: ReporterInfo;
  jobPosterId: string;
  reason: string;
  comment: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
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
  pending: number;
  reviewed: number;
  resolved: number;
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

export type ReportFilterStatus = 'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed';
