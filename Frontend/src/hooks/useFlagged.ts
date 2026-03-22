import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flaggedService, usersService } from '../services';

const FLAGGED_QUERY_KEY = 'flagged';
const FLAGGED_STATS_QUERY_KEY = 'flagged-stats';
const REPORTS_QUERY_KEY = 'reports';

export const useReports = (params?: {
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  reason?: string;
}) => {
  return useQuery({
    queryKey: [REPORTS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await flaggedService.getAllReports(params);
      return {
        reports: response.data?.reports || [],
        stats: response.data?.stats || { total: 0, pending: 0, reviewed: 0, resolved: 0, dismissed: 0 },
        pagination: response.data?.pagination,
      };
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData: any) => previousData,
  });
};

export const useReportStats = () => {
  return useQuery({
    queryKey: [REPORTS_QUERY_KEY, 'stats'],
    queryFn: async () => {
      const response = await flaggedService.getReportStats();
      return response.data;
    },
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
};

export const useUpdateReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      reportId, 
      status, 
      adminNotes, 
      actionTaken 
    }: { 
      reportId: string; 
      status: string;
      adminNotes?: string;
      actionTaken?: string;
    }) => {
      const response = await flaggedService.updateReportStatus(reportId, {
        status,
        adminNotes: adminNotes || 'Action taken by admin',
        actionTaken: actionTaken || 'none'
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [REPORTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [REPORTS_QUERY_KEY, 'stats'] });
    },
  });
};

export const useFlaggedPosts = () => {
  return useQuery({
    queryKey: [FLAGGED_QUERY_KEY],
    queryFn: async () => {
      const response = await flaggedService.getReportedPosts();
      return response.reportedPosts || [];
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useFlaggedUsersStats = () => {
  return useQuery({
    queryKey: [FLAGGED_STATS_QUERY_KEY],
    queryFn: async () => {
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
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useReviewReportedPost = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      postId, 
      action, 
      adminNotes 
    }: { 
      postId: string; 
      action: 'approve' | 'dismiss' | 'delete';
      adminNotes?: string;
    }) => {
      const response = await flaggedService.reviewReportedPost(postId, {
        action,
        adminNotes: adminNotes || 'Action taken by admin'
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FLAGGED_QUERY_KEY] });
    },
  });
};
