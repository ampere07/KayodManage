import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsService } from '../services';
import toast from 'react-hot-toast';
import type { TransactionCountFilters, TransactionsSort } from '../types/transactions.types';

interface UseTransactionsParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  type?: string;
  paymentMethod?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: TransactionsSort;
}

const TRANSACTIONS_QUERY_KEY = 'transactions';

export const useTransactions = (params: UseTransactionsParams) => {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, params],
    queryFn: () => transactionsService.getTransactions(params),
    placeholderData: (previousData) => previousData,
  });
};

export const useTransactionCounts = (type?: string, filters: TransactionCountFilters = {}) => {
  return useQuery({
    queryKey: [TRANSACTIONS_QUERY_KEY, 'counts', type, filters],
    // One aggregation on the server instead of five calls to the list endpoint
    // that each fetched a row nobody used, purely to read a count off the
    // pagination block. Measured ~1,315ms -> ~82ms.
    queryFn: () => transactionsService.getTransactionCounts(type, filters),
    placeholderData: (previousData) => previousData,
  });
};

export const useTransactionMutations = () => {
  const queryClient = useQueryClient();

  const invalidateTransactions = () => {
    queryClient.invalidateQueries({ queryKey: [TRANSACTIONS_QUERY_KEY] });
  };

  const updateTransactionStatus = useMutation({
    mutationFn: ({ transactionId, status, type }: { transactionId: string; status: any; type: string }) =>
      transactionsService.updateTransactionStatus(transactionId, { status, type }),
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
