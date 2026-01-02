import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flaggedService, usersService } from '../services';
import type { ReportedPost } from '../types/flagged.types';

const FLAGGED_QUERY_KEY = 'flagged';
const FLAGGED_STATS_QUERY_KEY = 'flagged-stats';

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
