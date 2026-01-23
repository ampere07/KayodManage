import apiClient from '../utils/apiClient';
import type {
  ReportedPost,
  ReportedPostsResponse,
  ReviewPostRequest,
  ReviewPostResponse,
  ReportsSummary
} from '../types/alerts.types';

/**
 * Alerts Service
 * Handles all API calls related to reported posts/alerts
 */
class AlertsService {
  private baseUrl = '/api/admin/reported-posts';

  /**
   * Fetch all reported posts with optional filtering and pagination
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

  /**
   * Reset all alerts (clear dismissedBy for all alerts)
   */
  async resetAlerts(): Promise<{ success: boolean; message: string; modifiedCount: number }> {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
      modifiedCount: number;
    }>('/api/admin/alerts/reset');
    return response.data;
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(alertId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.patch<{
      success: boolean;
      message: string;
    }>(`/api/admin/alerts/${alertId}/dismiss`);
    return response.data;
  }
}

// Export a singleton instance
export const alertsService = new AlertsService();
export default alertsService;
