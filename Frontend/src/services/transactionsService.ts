import apiClient from '../utils/apiClient';
import type {
  Transaction,
  TransactionsQueryParams,
  TransactionsResponse,
  UpdateTransactionStatusRequest,
  UpdateTransactionStatusResponse
} from '../types/transactions.types';

/**
 * Transactions Service
 * Handles all API calls related to transactions
 */
class TransactionsService {
  private baseUrl = '/api/transactions';

  /**
   * Fetch all transactions with optional filtering
   */
  async getTransactions(params?: TransactionsQueryParams): Promise<TransactionsResponse> {
    const response = await apiClient.get<TransactionsResponse>(this.baseUrl, { params });
    return response.data;
  }

  /**
   * Get a single transaction by ID
   */
  async getTransactionById(transactionId: string): Promise<{ success: boolean; transaction: Transaction }> {
    const response = await apiClient.get<{ success: boolean; transaction: Transaction }>(
      `${this.baseUrl}/${transactionId}`
    );
    return response.data;
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(
    transactionId: string,
    data: UpdateTransactionStatusRequest
  ): Promise<UpdateTransactionStatusResponse> {
    const response = await apiClient.patch<UpdateTransactionStatusResponse>(
      `${this.baseUrl}/${transactionId}/status`,
      data
    );
    return response.data;
  }

  /**
   * Delete a transaction
   */
  async deleteTransaction(transactionId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `${this.baseUrl}/${transactionId}`
    );
    return response.data;
  }
}

// Export a singleton instance
export const transactionsService = new TransactionsService();
export default transactionsService;
