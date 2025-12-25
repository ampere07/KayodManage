import apiClient from '../utils/apiClient';
import type {
  ChatSupport,
  ChatSupportsResponse,
  ChatSupportDetailsResponse,
  SendMessageRequest,
  SendMessageResponse,
  ChatActionResponse
} from '../types/support.types';

/**
 * Support Service
 * Handles all API calls related to support tickets
 */
class SupportService {
  private baseUrl = '/api/support/chatsupports';

  /**
   * Fetch all chat supports
   */
  async getChatSupports(): Promise<ChatSupportsResponse> {
    const response = await apiClient.get<ChatSupportsResponse>(this.baseUrl);
    return response.data;
  }

  /**
   * Get a single chat support by ID
   */
  async getChatSupportById(chatSupportId: string): Promise<ChatSupportDetailsResponse> {
    const response = await apiClient.get<ChatSupportDetailsResponse>(`${this.baseUrl}/${chatSupportId}`);
    return response.data;
  }

  /**
   * Send a message to a chat support
   */
  async sendMessage(
    chatSupportId: string,
    data: SendMessageRequest
  ): Promise<SendMessageResponse> {
    const response = await apiClient.post<SendMessageResponse>(
      `${this.baseUrl}/${chatSupportId}/messages`,
      data
    );
    return response.data;
  }

  /**
   * Accept a chat support ticket
   */
  async acceptTicket(chatSupportId: string): Promise<ChatActionResponse> {
    const response = await apiClient.put<ChatActionResponse>(
      `${this.baseUrl}/${chatSupportId}/accept`
    );
    return response.data;
  }

  /**
   * Close a chat support ticket
   */
  async closeTicket(chatSupportId: string): Promise<ChatActionResponse> {
    const response = await apiClient.put<ChatActionResponse>(
      `${this.baseUrl}/${chatSupportId}/close`
    );
    return response.data;
  }

  /**
   * Reopen a chat support ticket
   */
  async reopenTicket(chatSupportId: string): Promise<ChatActionResponse> {
    const response = await apiClient.put<ChatActionResponse>(
      `${this.baseUrl}/${chatSupportId}/reopen`
    );
    return response.data;
  }

  /**
   * Perform a generic action on a chat support
   */
  async performAction(
    chatSupportId: string,
    action: string
  ): Promise<ChatActionResponse> {
    const response = await apiClient.put<ChatActionResponse>(
      `${this.baseUrl}/${chatSupportId}/${action}`
    );
    return response.data;
  }
}

// Export a singleton instance
export const supportService = new SupportService();
export default supportService;
