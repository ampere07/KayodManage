import apiClient from '../utils/apiClient';
import type {
  UsersResponse,
  UserDetailsResponse,
  UsersQueryParams,
  UserCountsResponse,
  UserActionResponse,
  PenaltyData,
  UserActivityResponse,
  UserJobsResponse,
  UserFinancialsResponse,
  UserReviewsResponse,
  UserStandingResponse
} from '../types/users.types';

/**
 * Users Service
 * Handles all API calls related to users
 */
class UsersService {
  private baseUrl = '/api/users';

  /**
   * Fetch all users with optional filtering and pagination
   */
  async getUsers(params?: UsersQueryParams): Promise<UsersResponse> {
    const response = await apiClient.get<UsersResponse>(this.baseUrl, { params });
    return response.data;
  }

  /**
   * Client/provider counts by type × account status × verification, under the
   * given search/profession — the source of every number on the Users page.
   */
  async getUserCounts(params?: Pick<UsersQueryParams, 'search' | 'profession'>): Promise<UserCountsResponse> {
    const response = await apiClient.get<UserCountsResponse>(`${this.baseUrl}/counts`, { params });
    return response.data;
  }

  /**
   * Get a single user by ID
   */
  async getUserById(userId: string): Promise<UserDetailsResponse> {
    const response = await apiClient.get<UserDetailsResponse>(`${this.baseUrl}/${userId}`);
    return response.data;
  }

  /**
   * Update user verification status
   */
  async verifyUser(userId: string, verified: boolean): Promise<UserActionResponse> {
    const response = await apiClient.patch<UserActionResponse>(
      `${this.baseUrl}/${userId}/verify`,
      { verified }
    );
    return response.data;
  }

  /**
   * Restrict a user
   */
  async restrictUser(userId: string, duration?: number, reason?: string): Promise<UserActionResponse> {
    const payload = { restricted: true, duration, reason };

    const response = await apiClient.patch<UserActionResponse>(
      `${this.baseUrl}/${userId}/restrict`,
      payload
    );

    return response.data;
  }

  /**
   * Ban a user
   */
  async banUser(userId: string, reason: string, duration?: number): Promise<UserActionResponse> {
    const response = await apiClient.patch<UserActionResponse>(
      `${this.baseUrl}/${userId}/ban`,
      { reason, duration }
    );
    return response.data;
  }

  /**
   * Suspend a user
   */
  async suspendUser(
    userId: string,
    reason: string,
    duration?: number
  ): Promise<UserActionResponse> {
    const response = await apiClient.patch<UserActionResponse>(
      `${this.baseUrl}/${userId}/suspend`,
      { reason, duration: duration || 7 }
    );
    return response.data;
  }

  /**
   * Remove restrictions from a user
   */
  async unrestrictUser(userId: string): Promise<UserActionResponse> {
    const response = await apiClient.patch<UserActionResponse>(
      `${this.baseUrl}/${userId}/unrestrict`
    );
    return response.data;
  }

  /**
   * Soft delete a user
   */
  async softDeleteUser(userId: string, reason: string): Promise<UserActionResponse> {
    const response = await apiClient.patch<UserActionResponse>(
      `${this.baseUrl}/${userId}/delete`,
      { reason }
    );
    return response.data;
  }

  /**
   * Everything this user has done, newest first: jobs, money, quotes, reviews,
   * verifications, support tickets, reports and admin actions taken on them.
   */
  async getUserActivity(
    userId: string,
    params?: { page?: number; limit?: number; types?: string }
  ): Promise<UserActivityResponse> {
    const response = await apiClient.get<UserActivityResponse>(
      `${this.baseUrl}/${userId}/activity`,
      { params }
    );
    return response.data;
  }

  /**
   * Jobs the user posted, jobs they were assigned to, or both.
   */
  async getUserJobs(
    userId: string,
    params?: { page?: number; limit?: number; role?: 'all' | 'posted' | 'worked' }
  ): Promise<UserJobsResponse> {
    const response = await apiClient.get<UserJobsResponse>(
      `${this.baseUrl}/${userId}/jobs`,
      { params }
    );
    return response.data;
  }

  /**
   * Top-ups, cash-outs, earnings and spending for one user.
   */
  async getUserFinancials(userId: string): Promise<UserFinancialsResponse> {
    const response = await apiClient.get<UserFinancialsResponse>(
      `${this.baseUrl}/${userId}/financials`
    );
    return response.data;
  }

  /**
   * Reviews clients left for a provider, with average, star distribution and
   * per-category averages. `rating` narrows the list (not the summary) to one star value.
   */
  async getUserReviews(
    userId: string,
    params?: { page?: number; limit?: number; rating?: number }
  ): Promise<UserReviewsResponse> {
    const response = await apiClient.get<UserReviewsResponse>(`${this.baseUrl}/${userId}/reviews`, { params });
    return response.data;
  }

  /** Reports against/by the user and their support tickets (counts). */
  async getUserStanding(userId: string): Promise<UserStandingResponse> {
    const response = await apiClient.get<UserStandingResponse>(`${this.baseUrl}/${userId}/standing`);
    return response.data;
  }

  /**
   * Get penalty data for a user
   */
  async getPenaltyData(userId: string): Promise<PenaltyData> {
    try {
      // Counted on the server: the audit log itself is superadmin-only.
      const response = await apiClient.get<{ totalPenalties: number; lastPenalty: string | null }>(
        `${this.baseUrl}/${userId}/penalties`
      );

      return {
        totalPenalties: response.data.totalPenalties || 0,
        activeWarnings: 0,
        lastPenalty: response.data.lastPenalty ? new Date(response.data.lastPenalty) : null
      };
    } catch (error) {
      console.error('Error fetching penalty data:', error);
      return {
        totalPenalties: 0,
        activeWarnings: 0,
        lastPenalty: null
      };
    }
  }
}

// Export a singleton instance
export const usersService = new UsersService();
export default usersService;
