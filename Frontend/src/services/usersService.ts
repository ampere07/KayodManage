import apiClient from '../utils/apiClient';
import type {
  User,
  UsersResponse,
  UserDetailsResponse,
  UsersQueryParams,
  UserActionRequest,
  UserActionResponse,
  VerificationDetails,
  PenaltyData
} from '../types/users.types';

/**
 * Users Service
 * Handles all API calls related to users
 */
class UsersService {
  private baseUrl = '/api/users';
  private verificationUrl = '/api/verifications';
  private activityUrl = '/api/admin/activity-logs';

  /**
   * Fetch all users with optional filtering and pagination
   */
  async getUsers(params?: UsersQueryParams): Promise<UsersResponse> {
    const response = await apiClient.get<UsersResponse>(this.baseUrl, { params });
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
   * Get verification details for a user
   */
  async getVerificationDetails(userId: string): Promise<VerificationDetails | null> {
    try {
      const response = await apiClient.get<any>(`${this.verificationUrl}/${userId}`);
      const data = response.data;
      
      if (data.reviewedBy && data.reviewedAt) {
        return {
          verifiedBy: data.reviewedBy,
          verifiedAt: data.reviewedAt
        };
      }
      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      console.error('Error fetching verification details:', error);
      return null;
    }
  }

  /**
   * Get penalty data for a user
   */
  async getPenaltyData(userId: string): Promise<PenaltyData> {
    try {
      const response = await apiClient.get<any>(
        `${this.activityUrl}?targetId=${userId}&limit=1000`
      );
      
      const logs = response.data.logs || [];
      
      const userLogs = logs.filter((log: any) => 
        log.targetId?._id === userId
      );
      
      const penaltyActions = userLogs.filter((log: any) => 
        ['user_restricted', 'user_suspended', 'user_banned'].includes(log.actionType)
      );
      
      const totalPenalties = penaltyActions.length;
      const lastPenalty = penaltyActions.length > 0 
        ? new Date(penaltyActions[0].createdAt) 
        : null;
      
      return {
        totalPenalties,
        activeWarnings: 0,
        lastPenalty
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
