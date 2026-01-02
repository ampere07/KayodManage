import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsService } from '../services';
import toast from 'react-hot-toast';

interface UseTransactionsParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  type?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
}

const TRANSACTIONS_QUERY_KEY = 'transactions';

export const useTransactions = (params: UseTransactionsParams) => {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, params],
    queryFn: () => transactionsService.getTransactions(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useTransactionCounts = (type?: string) => {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, 'counts', type],
    queryFn: async () => {
      const baseParams = type && type !== 'all' ? { type } : {};
      
      const [totalData, pendingData, completedData, failedData, cancelledData] = await Promise.all([
        transactionsService.getTransactions({ ...baseParams, limit: 1, page: 1 }),
        transactionsService.getTransactions({ ...baseParams, status: 'pending', limit: 1, page: 1 }),
        transactionsService.getTransactions({ ...baseParams, status: 'completed', limit: 1, page: 1 }),
        transactionsService.getTransactions({ ...baseParams, status: 'failed', limit: 1, page: 1 }),
        transactionsService.getTransactions({ ...baseParams, status: 'cancelled', limit: 1, page: 1 })
      ]);

      return {
        total: totalData.pagination?.total || 0,
        pending: pendingData.pagination?.total || 0,
        completed: completedData.pagination?.total || 0,
        failed: failedData.pagination?.total || 0,
        cancelled: cancelledData.pagination?.total || 0
      };
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useTransactionMutations = () => {
  const queryClient = useQueryClient();

  const invalidateTransactions = () => {
    queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
  };

  const updateTransactionStatus = useMutation({
    mutationFn: ({ transactionId, status }: { transactionId: string; status: string }) =>
      transactionsService.updateTransactionStatus(transactionId, status),
    onSuccess: () => {
      invalidateTransactions();
      toast.success('Transaction status updated successfully');
    },
    onError: () => {
      toast.error('Failed to update transaction status');
    },
  });

  return {
    updateTransactionStatus,
  };
};
