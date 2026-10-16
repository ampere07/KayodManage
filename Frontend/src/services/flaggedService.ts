import apiClient from '../utils/apiClient';
import type {
  ReportedPost,
  ReportedPostsResponse,
  ReviewPostRequest,
  ReviewPostResponse,
  ReportsSummary,
  ReportStatus
} from '../types/flagged.types';

// New types for the unified reports collection
export interface Report {
  _id: string;
  reportType: 'job' | 'user' | 'message' | 'conversation' | 'review' | 'payment' | 'other';
  reportedUserId?: {
    _id: string;
    name: string;
    email: string;
    userType: string;
  };
  relatedId: string;
  reportedBy: {
    _id: string;
    name: string;
    email: string;
    userType: string;
  };
  reason: string;
  comment: string;
  status: ReportStatus;
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewedAt?: string;
  adminNotes: string;
  actionTaken: string;
  reportMetadata: {
    reporterIP?: string;
    reporterUserAgent?: string;
    reportSource: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Which collection a row came from. `reports` and `reportedposts` are two
 * generations of the same feature and the admin page shows both, so every row
 * carries the collection it belongs to — the status-update call has to go back
 * to the right one.
 */
export type ReportSource = 'report' | 'reported_post';

/** The job a report is about, whether resolved live or from the stored snapshot. */
export interface ReportJob {
  _id: string;
  title: string;
  description: string;
  category: string;
  budget: number;
  budgetType: string;
  paymentMethod: string;
  location: { address?: string; city?: string; region?: string; country?: string };
  media: string[];
  createdAt: string;
  status?: string;
  isDeleted: boolean;
  isHidden?: boolean;
}

export interface ReportParty {
  _id: string;
  name: string;
  /** Empty for phone-registered accounts — fall back to phoneNumber. */
  email: string;
  phoneNumber: string;
  userType: string;
  /** active | restricted | suspended | banned | deleted; absent for reporters known only from a snapshot. */
  accountStatus?: string;
}

/**
 * A row from GET /api/reports/admin/combined — either collection, normalized to
 * one shape with legacy statuses/reasons already mapped to the canonical
 * vocabulary (see Backend/app/constants/reportTaxonomy.js).
 */
export interface CombinedReport {
  _id: string;
  source: ReportSource;
  reportType: 'job' | 'user' | 'message' | 'conversation' | 'review' | 'payment' | 'other';
  reportedBy: ReportParty | null;
  reportedUserId: ReportParty | null;
  relatedId: string;
  job: ReportJob | null;
  reason: string;
  /** The value as stored, before legacy mapping — handy when auditing old rows. */
  rawReason: string;
  comment: string;
  status: ReportStatus;
  rawStatus: string;
  reviewedBy: ReportParty | null;
  reviewedAt: string | null;
  adminNotes: string;
  actionTaken: string;
  reportMetadata: { reporterIP?: string; reporterUserAgent?: string; reportSource: string };
  createdAt: string;
  updatedAt: string;
}

export interface BulkReportResult {
  success: boolean;
  updated: number;
  skipped: { id: string; source: ReportSource; reason: string }[];
  failed: { id: string; source: ReportSource; error: string }[];
}

export interface CombinedReportsResponse {
  success: boolean;
  data: {
    reports: CombinedReport[];
    stats: {
      total: number;
      open: number;
      under_review: number;
      action_taken: number;
      dismissed: number;
      escalated: number;
      open_total: number;
      bySource: { report: number; reported_post: number };
    };
    pagination: {
      current: number;
      total: number;
      totalReports: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

export interface ReportsResponse {
  success: boolean;
  data: {
    reports: Report[];
    // Shape of Report.getReportStats() — one key per REPORT_STATUSES entry,
    // plus open_total (open + under_review) for the queue badge.
    stats: {
      total: number;
      open: number;
      under_review: number;
      action_taken: number;
      dismissed: number;
      escalated: number;
      open_total: number;
    };
    pagination?: {
      current: number;
      total: number;
      totalReports: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

/**
 * Flagged Service
 * Handles all API calls related to reported posts/flagged content
 */
class FlaggedService {
  // ReportedPost legacy collection (backend is under /api/reports/reported-posts)
  private baseUrl = '/api/reports/reported-posts';
  private reportsUrl = '/api/reports';

  // Legacy reported-posts collection (ReportedPost)
  async getAllReportedPosts(params?: {
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    reason?: string;
  }): Promise<ReportedPostsResponse & { success?: boolean }> {
    const response = await apiClient.get<ReportedPostsResponse & { success?: boolean }>(`${this.baseUrl}/admin/all`, { params });
    // Normalize shape to match existing expectations
    return {
      success: (response.data as any).success ?? true,
      reportedPosts: (response.data as any).reports || (response.data as any).reportedPosts || [],
      stats: (response.data as any).stats,
      pagination: (response.data as any).pagination,
    } as any;
  }

  /**
   * Fetch all reports from the new unified reports collection
   */
  async getAllReports(params?: {
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    reason?: string;
  }): Promise<ReportsResponse> {
    const response = await apiClient.get<ReportsResponse>(`${this.reportsUrl}/admin/all`, { params });
    return response.data;
  }

  /**
   * Fetch the `reports` and `reportedposts` collections as one normalized feed.
   * This is what the Flagged page uses; getAllReports() below only sees the
   * newer collection.
   */
  async getCombinedReports(params?: {
    status?: string;
    reason?: string;
    reportType?: string;
    source?: ReportSource;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<CombinedReportsResponse> {
    const response = await apiClient.get<CombinedReportsResponse>(
      `${this.reportsUrl}/admin/combined`,
      { params }
    );
    return response.data;
  }

  /**
   * Decide several reports at once (either collection). Only reports still open or
   * under review change; the rest come back in `skipped` with the reason.
   */
  async bulkUpdateReportStatus(data: {
    items: { id: string; source: ReportSource }[];
    status: 'under_review' | 'action_taken' | 'dismissed';
    adminNotes?: string;
  }): Promise<BulkReportResult> {
    const response = await apiClient.patch(`${this.reportsUrl}/bulk-status`, data);
    return response.data;
  }

  /**
   * Update a report's status in whichever collection it came from.
   * ReportedPost has no actionTaken column, so that field is dropped for it.
   */
  async updateAnyReportStatus(
    reportId: string,
    source: ReportSource,
    data: { status: string; adminNotes?: string; actionTaken?: string }
  ): Promise<{ success: boolean; data: any }> {
    const url =
      source === 'reported_post'
        ? `${this.reportsUrl}/reported-posts/${reportId}/status`
        : `${this.reportsUrl}/${reportId}/status`;
    const body =
      source === 'reported_post'
        ? { status: data.status, adminNotes: data.adminNotes }
        : data;
    const response = await apiClient.put(url, body);
    return response.data;
  }

  /**
   * Get report statistics
   */
  async getReportStats(): Promise<{ success: boolean; data: any }> {
    const response = await apiClient.get(`${this.reportsUrl}/admin/stats`);
    return response.data;
  }

  /**
   * Update report status
   */
  async updateReportStatus(
    reportId: string,
    data: {
      status: string;
      adminNotes?: string;
      actionTaken?: string;
    }
  ): Promise<{ success: boolean; data: Report }> {
    const response = await apiClient.put(`${this.reportsUrl}/${reportId}/status`, data);
    return response.data;
  }

  /**
   * Fetch all reported posts with optional filtering and pagination (legacy)
   */
  async getReportedPosts(params?: {
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ReportedPostsResponse> {
    const response = await apiClient.get<ReportedPostsResponse>(`${this.baseUrl}/admin/all`, { params });
    return response.data;
  }

  /**
   * Get a single reported post by ID
   */
  async getReportedPostById(reportId: string): Promise<{ success: boolean; reportedPost: ReportedPost }> {
    const response = await apiClient.get<{ success: boolean; reportedPost: ReportedPost }>(
      `${this.baseUrl}/${reportId}`
    );
    return response.data;
  }

  /**
   * Review a reported post and take action
   */
  async reviewReportedPost(
    reportId: string,
    data: ReviewPostRequest
  ): Promise<ReviewPostResponse> {
    const response = await apiClient.put<ReviewPostResponse>(
      `${this.baseUrl}/${reportId}/review`,
      data
    );
    return response.data;
  }

  /**
   * Get reports summary/statistics
   */
  async getReportsSummary(): Promise<{ success: boolean; summary: ReportsSummary }> {
    const response = await apiClient.get<{ success: boolean; summary: ReportsSummary }>(
      `${this.baseUrl}/summary`
    );
    return response.data;
  }

  /**
   * Bulk update multiple reports
   */
  async bulkUpdateReports(data: {
    reportIds: string[];
    action: 'approve' | 'dismiss' | 'delete';
    adminNotes?: string;
  }): Promise<{ success: boolean; message: string; modifiedCount: number }> {
    const response = await apiClient.put<{
      success: boolean;
      message: string;
      modifiedCount: number;
    }>(`${this.baseUrl}/bulk-update`, data);
    return response.data;
  }

  /**
   * Create a new report (for when users report posts)
   */
  async createReport(data: {
    jobId: string;
    reason: string;
    comment: string;
  }): Promise<{ success: boolean; message: string; reportId: string }> {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      reportId: string;
    }>(this.baseUrl, data);
    return response.data;
  }
}

// Export a singleton instance
export const flaggedService = new FlaggedService();
export default flaggedService;
