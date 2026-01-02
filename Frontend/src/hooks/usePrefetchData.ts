import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { 
  usersService, 
  jobsService, 
  transactionsService, 
  verificationsService, 
  supportService, 
  flaggedService 
} from '../services';
import apiClient from '../utils/apiClient';

export const usePrefetchData = () => {
  const queryClient = useQueryClient();
  const [prefetched, setPrefetched] = useState(false);

  useEffect(() => {
    if (prefetched) return;

    const prefetchAllData = async () => {
      console.log('[Prefetch] Starting to prefetch all data...');
      console.log('[Prefetch] Prefetching: Dashboard, Users, Jobs, Transactions, Verifications, Support, Activity, Flagged');
      
      try {
        await Promise.all([
          // Dashboard data
          queryClient.prefetchQuery({
            queryKey: ['dashboard', 'comparison'],
            queryFn: async () => {
              try {
                const response = await apiClient.get('/api/dashboard/stats-comparison');
                return response.data;
              } catch {
                return { users: { percentage: 0 }, jobs: { percentage: 0 }, revenue: { percentage: 0 } };
              }
            },
          }),
          queryClient.prefetchQuery({
            queryKey: ['dashboard', 'revenue-chart', 'month'],
            queryFn: async () => {
              try {
                const response = await apiClient.get('/api/dashboard/revenue-chart?days=30');
                return response.data;
              } catch {
                return [];
              }
            },
          }),

          // Users - All pages
          queryClient.prefetchQuery({
            queryKey: ['users', { page: 1, limit: 20 }],
            queryFn: () => usersService.getUsers({ page: 1, limit: 20 }),
          }),
          queryClient.prefetchQuery({
            queryKey: ['users', { page: 1, limit: 20, userType: 'client' }],
            queryFn: () => usersService.getUsers({ page: 1, limit: 20, userType: 'client' }),
          }),
          queryClient.prefetchQuery({
            queryKey: ['users', { page: 1, limit: 20, userType: 'provider' }],
            queryFn: () => usersService.getUsers({ page: 1, limit: 20, userType: 'provider' }),
          }),
          queryClient.prefetchQuery({
            queryKey: ['users', { page: 1, limit: 20, restricted: 'true' }],
            queryFn: () => usersService.getUsers({ page: 1, limit: 20, restricted: 'true' }),
          }),

          // User counts
          queryClient.prefetchQuery({
            queryKey: ['users', 'counts', {}],
            queryFn: async () => {
              const [totalData, customersData, providersData, suspendedData, restrictedData, bannedData] = await Promise.all([
                usersService.getUsers({ limit: 1, page: 1 }),
                usersService.getUsers({ userType: 'client', limit: 1, page: 1 }),
                usersService.getUsers({ userType: 'provider', limit: 1, page: 1 }),
                usersService.getUsers({ status: 'suspended', limit: 1, page: 1 }),
                usersService.getUsers({ status: 'restricted', limit: 1, page: 1 }),
                usersService.getUsers({ status: 'banned', limit: 1, page: 1 })
              ]);
              return {
                total: totalData.pagination?.total || 0,
                customers: customersData.pagination?.total || 0,
                providers: providersData.pagination?.total || 0,
                suspended: suspendedData.pagination?.total || 0,
                restricted: restrictedData.pagination?.total || 0,
                banned: bannedData.pagination?.total || 0,
                verified: 0,
                unverified: 0
              };
            },
          }),

          // Jobs
          queryClient.prefetchQuery({
            queryKey: ['jobs', { page: 1, limit: 20 }],
            queryFn: () => jobsService.getJobs({ page: 1, limit: 20 }),
          }),
          queryClient.prefetchQuery({
            queryKey: ['jobs', 'counts'],
            queryFn: async () => {
              const [totalData, openData, assignedData, completedData] = await Promise.all([
                jobsService.getJobs({ limit: 1, page: 1 }),
                jobsService.getJobs({ status: 'open', limit: 1, page: 1 }),
                jobsService.getJobs({ status: 'in_progress', limit: 1, page: 1 }),
                jobsService.getJobs({ status: 'completed', limit: 1, page: 1 })
              ]);
              return {
                total: totalData.pagination?.total || 0,
                open: openData.pagination?.total || 0,
                assigned: assignedData.pagination?.total || 0,
                completed: completedData.pagination?.total || 0,
                totalValue: totalData.stats?.totalValue || 0
              };
            },
          }),

          // Transactions - Fee Records
          queryClient.prefetchQuery({
            queryKey: ['transactions', { page: 1, limit: 20, type: 'fee_record', includeFees: 'true' }],
            queryFn: () => transactionsService.getTransactions({ page: 1, limit: 20, type: 'fee_record', includeFees: 'true' }),
          }),

          // Transactions - Top Up
          queryClient.prefetchQuery({
            queryKey: ['transactions', { page: 1, limit: 20, type: 'xendit_topup' }],
            queryFn: () => transactionsService.getTransactions({ page: 1, limit: 20, type: 'xendit_topup' }),
          }),

          // Transactions - Cashout
          queryClient.prefetchQuery({
            queryKey: ['transactions', { page: 1, limit: 20, type: 'withdrawal' }],
            queryFn: () => transactionsService.getTransactions({ page: 1, limit: 20, type: 'withdrawal' }),
          }),

          // Transactions - Refund
          queryClient.prefetchQuery({
            queryKey: ['transactions', { page: 1, limit: 20, type: 'refund' }],
            queryFn: () => transactionsService.getTransactions({ page: 1, limit: 20, type: 'refund' }),
          }),

          // Transaction counts
          queryClient.prefetchQuery({
            queryKey: ['transactions', 'counts', 'fee_record'],
            queryFn: async () => {
              const [totalData, pendingData, completedData, failedData, cancelledData] = await Promise.all([
                transactionsService.getTransactions({ type: 'fee_record', limit: 1, page: 1 }),
                transactionsService.getTransactions({ type: 'fee_record', status: 'pending', limit: 1, page: 1 }),
                transactionsService.getTransactions({ type: 'fee_record', status: 'completed', limit: 1, page: 1 }),
                transactionsService.getTransactions({ type: 'fee_record', status: 'failed', limit: 1, page: 1 }),
                transactionsService.getTransactions({ type: 'fee_record', status: 'cancelled', limit: 1, page: 1 })
              ]);
              return {
                total: totalData.pagination?.total || 0,
                pending: pendingData.pagination?.total || 0,
                completed: completedData.pagination?.total || 0,
                failed: failedData.pagination?.total || 0,
                cancelled: cancelledData.pagination?.total || 0
              };
            },
          }),

          // Verifications
          queryClient.prefetchQuery({
            queryKey: ['verifications'],
            queryFn: async () => {
              try {
                const response = await verificationsService.getAllVerifications();
                return response.data || [];
              } catch {
                return [];
              }
            },
          }),

          // Support Tickets
          queryClient.prefetchQuery({
            queryKey: ['support'],
            queryFn: async () => {
              try {
                const data = await supportService.getChatSupports();
                return data.chatSupports || [];
              } catch {
                return [];
              }
            },
          }),

          // Activity Logs
          queryClient.prefetchQuery({
            queryKey: ['activity'],
            queryFn: async () => {
              try {
                const response = await apiClient.get('/api/admin/activity-logs');
                return response.data.logs || [];
              } catch {
                return [];
              }
            },
          }),

          // Flagged Posts
          queryClient.prefetchQuery({
            queryKey: ['flagged'],
            queryFn: async () => {
              try {
                const response = await flaggedService.getReportedPosts();
                return response.reportedPosts || [];
              } catch {
                return [];
              }
            },
          }),

          // Flagged Users Stats
          queryClient.prefetchQuery({
            queryKey: ['flagged-stats'],
            queryFn: async () => {
              try {
                const [flaggedTotalData, flaggedCustomersData, flaggedProvidersData] = await Promise.all([
                  usersService.getUsers({ restricted: 'true', limit: 1, page: 1 }),
                  usersService.getUsers({ restricted: 'true', userType: 'client', limit: 1, page: 1 }),
                  usersService.getUsers({ restricted: 'true', userType: 'provider', limit: 1, page: 1 })
                ]);
                
                return {
                  total: flaggedTotalData.pagination?.total || 0,
                  customers: flaggedCustomersData.pagination?.total || 0,
                  providers: flaggedProvidersData.pagination?.total || 0
                };
              } catch {
                return { total: 0, customers: 0, providers: 0 };
              }
            },
          }),
        ]);

        setPrefetched(true);
        console.log('[Prefetch] ✅ All data prefetched successfully!');
        console.log('[Prefetch] ✨ Navigation to Verifications, Support, Activity, and Flagged will be instant!');
      } catch (error: any) {
        if (error?.isNetworkError || error?.code === 'ECONNABORTED') {
          console.log('[Prefetch] Skipped due to network error');
        } else {
          console.error('[Prefetch] Error prefetching data:', error);
        }
      }
    };

    prefetchAllData();
  }, [queryClient, prefetched]);
};
