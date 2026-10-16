import apiClient from '../utils/apiClient';
import type {
  Transaction,
  TransactionsQueryParams,
  TransactionsResponse,
  TransactionCounts,
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
   * Status tallies for the list header, in one request.
   *
   * Replaces five calls to getTransactions({ limit: 1 }) that existed only to
   * read a count off each reply — ~1,315ms of round trips for five integers.
   */
  async getTransactionCounts(type?: string): Promise<TransactionCounts> {
    const params = type && type !== 'all' ? { type } : undefined;
    const response = await apiClient.get<TransactionCounts>(
      `${this.baseUrl}/counts`,
      { params }
    );
    return response.data;
  }

  /**
   * Get a single transaction by ID
   */
  async getTransactionById(transactionId: string): Promise<Transaction | null> {
    try {
      const response = await apiClient.get<Transaction>(
        `${this.baseUrl}/${transactionId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      return null;
    }
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

  async approveRefund(transactionId: string): Promise<{ success: boolean; message: string; refundTransactionId?: string }> {
    const response = await apiClient.post<{ success: boolean; message: string; refundTransactionId?: string }>(
      `${this.baseUrl}/${transactionId}/approve-refund`
    );
    return response.data;
  }

  async declineRefund(transactionId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `${this.baseUrl}/${transactionId}/decline-refund`
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
