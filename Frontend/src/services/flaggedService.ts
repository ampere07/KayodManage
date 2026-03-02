import apiClient from '../utils/apiClient';
import type {
  ReportedPost,
  ReportedPostsResponse,
  ReviewPostRequest,
  ReviewPostResponse,
  ReportsSummary
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
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
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

export interface ReportsResponse {
  success: boolean;
  data: {
    reports: Report[];
    stats: {
      total: number;
      pending: number;
      reviewed: number;
      resolved: number;
      dismissed: number;
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
  private baseUrl = '/api/admin/reported-posts';
  private reportsUrl = '/api/reports';

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
    const response = await apiClient.get<ReportedPostsResponse>(this.baseUrl, { params });
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
