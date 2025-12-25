import apiClient from '../utils/apiClient';
import type {
  VerificationsResponse,
  VerificationDetailsResponse,
  VerificationsQueryParams,
  UpdateVerificationStatusRequest,
  UpdateVerificationStatusResponse,
  UserImagesResponse,
  VerificationStatsResponse
} from '../types/verifications.types';

/**
 * Verifications Service
 * Handles all API calls related to credential verifications
 */
class VerificationsService {
  private baseUrl = '/api/admin/verifications';

  /**
   * Fetch all verifications with optional filtering
   */
  async getAllVerifications(params?: VerificationsQueryParams): Promise<VerificationsResponse> {
    const response = await apiClient.get<VerificationsResponse>(this.baseUrl, { params });
    return response.data;
  }

  /**
   * Get a single verification by ID
   */
  async getVerificationById(verificationId: string): Promise<VerificationDetailsResponse> {
    const response = await apiClient.get<VerificationDetailsResponse>(`${this.baseUrl}/${verificationId}`);
    return response.data;
  }

  /**
   * Update verification status
   */
  async updateVerificationStatus(
    verificationId: string,
    data: UpdateVerificationStatusRequest
  ): Promise<UpdateVerificationStatusResponse> {
    const response = await apiClient.patch<UpdateVerificationStatusResponse>(
      `${this.baseUrl}/${verificationId}`,
      data
    );
    return response.data;
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats(): Promise<VerificationStatsResponse> {
    const response = await apiClient.get<VerificationStatsResponse>(`${this.baseUrl}/stats`);
    return response.data;
  }

  /**
   * Get user images from latest verification
   */
  async getUserImages(userId: string): Promise<UserImagesResponse> {
    const response = await apiClient.get<UserImagesResponse>(`${this.baseUrl}/user/${userId}/images`);
    return response.data;
  }
}

// Export a singleton instance
export const verificationsService = new VerificationsService();
export default verificationsService;
