import apiClient from '../utils/apiClient';
import type {
  Job,
  JobsResponse,
  JobDetailsResponse,
  JobsQueryParams,
  UpdateJobStatusRequest,
  UpdateJobStatusResponse,
  Application
} from '../types/jobs.types';

/**
 * Jobs Service
 * Handles all API calls related to jobs
 */
class JobsService {
  private baseUrl = '/api/jobs';

  /**
   * Fetch all jobs with optional filtering and pagination
   */
  async getJobs(params?: JobsQueryParams): Promise<JobsResponse> {
    const response = await apiClient.get<JobsResponse>(this.baseUrl, { params });
    return response.data;
  }

  /**
   * Get a single job by ID with applications
   */
  async getJobById(jobId: string): Promise<JobDetailsResponse> {
    const response = await apiClient.get<JobDetailsResponse>(`${this.baseUrl}/${jobId}`);
    return response.data;
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    data: UpdateJobStatusRequest
  ): Promise<UpdateJobStatusResponse> {
    const response = await apiClient.patch<UpdateJobStatusResponse>(
      `${this.baseUrl}/${jobId}/status`,
      data
    );
    return response.data;
  }

  /**
   * Force-cancel a job — the only path that releases held funds and notifies
   * both parties correctly. updateJobStatus deliberately no longer accepts
   * "cancelled" (see improvements doc §1) — use this instead.
   */
  async forceCancelJob(
    jobId: string,
    reason?: string
  ): Promise<{ success: boolean; job: Job; refundedAmount: number }> {
    const response = await apiClient.post<{ success: boolean; job: Job; refundedAmount: number }>(
      `${this.baseUrl}/${jobId}/force-cancel`,
      { reason }
    );
    return response.data;
  }

  /**
   * Resolve an active dispute on a job. outcome must be one of:
   * 'pay_provider' | 'refund_client' | 'rebook' (see improvements doc §6).
   */
  async resolveDispute(
    jobId: string,
    outcome: 'pay_provider' | 'refund_client' | 'rebook',
    note?: string
  ): Promise<{ success: boolean; job: Job; outcome: string; refundedAmount: number; draftId: string | null }> {
    const response = await apiClient.post<{ success: boolean; job: Job; outcome: string; refundedAmount: number; draftId: string | null }>(
      `${this.baseUrl}/${jobId}/resolve-dispute`,
      { outcome, note }
    );
    return response.data;
  }

  /**
   * Get job applications
   */
  async getJobApplications(jobId: string): Promise<{ success: boolean; applications: Application[] }> {
    const response = await apiClient.get<{ success: boolean; applications: Application[] }>(
      `${this.baseUrl}/${jobId}/applications`
    );
    return response.data;
  }

  /**
   * Delete a job
   */
  async deleteJob(jobId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `${this.baseUrl}/${jobId}`
    );
    return response.data;
  }

  /**
   * Hide a job
   */
  async hideJob(jobId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.patch<{ success: boolean; message: string }>(
      `${this.baseUrl}/${jobId}/hide`
    );
    return response.data;
  }

  /**
   * Unhide a job
   */
  async unhideJob(jobId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.patch<{ success: boolean; message: string }>(
      `${this.baseUrl}/${jobId}/unhide`
    );
    return response.data;
  }

  /**
   * Accept job application
   */
  async acceptApplication(
    jobId: string,
    applicationId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/${jobId}/applications/${applicationId}/accept`
    );
    return response.data;
  }

  /**
   * Reject job application
   */
  async rejectApplication(
    jobId: string,
    applicationId: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/${jobId}/applications/${applicationId}/reject`
    );
    return response.data;
  }

  /**
   * Restore a job
   */
  async restoreJob(jobId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.patch<{ success: boolean; message: string }>(
      `${this.baseUrl}/${jobId}/restore`
    );
    return response.data;
  }
}

// Export a singleton instance
export const jobsService = new JobsService();
export default jobsService;
