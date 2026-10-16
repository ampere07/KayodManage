// Flagged/Reported Post Types

/**
 * The report status lifecycle. Mirrors REPORT_STATUSES in
 * Backend/app/constants/reportTaxonomy.js, which is the source of truth.
 *
 * Declared once here and reused everywhere (ReportedPost, the Report served by
 * /api/reports, and the page filters) so a future status change is a single
 * edit and tsc flags every consumer. The retired pending/reviewed/resolved
 * vocabulary is mapped in that file's LEGACY_STATUS_MAP.
 */
export type ReportStatus =
  | 'open'
  | 'under_review'
  | 'action_taken'
  | 'dismissed'
  | 'escalated';

/**
 * What admins read for each status. The stored values belong to the shared
 * taxonomy the Kayod app also reads, so only the wording changes here: the raw
 * "action_taken" was showing on screen, and admins call it "Resolved".
 */
export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'Open',
  under_review: 'Under Review',
  action_taken: 'Resolved',
  dismissed: 'Dismissed',
  escalated: 'Escalated to Dispute',
};

export const reportStatusLabel = (status: string) =>
  REPORT_STATUS_LABELS[status as ReportStatus] || status;

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

/** 'needs_review' = open + under review — OPEN_REPORT_STATUSES in reportTaxonomy.js. */
export type ReportFilterStatus = 'all' | 'needs_review' | ReportStatus;
