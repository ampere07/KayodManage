import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { flaggedService, usersService } from '../services';
import type { ReportSource } from '../services/flaggedService';

const FLAGGED_QUERY_KEY = 'flagged';
const FLAGGED_STATS_QUERY_KEY = 'flagged-stats';
const REPORTS_QUERY_KEY = 'reports';
const COMBINED_REPORTS_QUERY_KEY = 'combined-reports';

const EMPTY_COMBINED_STATS = {
  total: 0,
  open: 0,
  under_review: 0,
  action_taken: 0,
  dismissed: 0,
  escalated: 0,
  open_total: 0,
  bySource: { report: 0, reported_post: 0 },
};

/**
 * Both report collections in one list. Prefer this over useReports(), which
 * only reads `reports` and therefore misses everything in `reportedposts`.
 */
export const useCombinedReports = (params?: {
  status?: string;
  reason?: string;
  reportType?: string;
  source?: ReportSource;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) => {
  return useQuery({
    queryKey: [COMBINED_REPORTS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await flaggedService.getCombinedReports(params);
      return {
        reports: response.data?.reports || [],
        stats: response.data?.stats || EMPTY_COMBINED_STATS,
        pagination: response.data?.pagination,
      };
    },
    placeholderData: (previousData) => previousData,
  });
};

/**
 * Update a report in whichever collection it came from, then refresh the
 * combined feed and the legacy queries that also read these collections.
 */
/** Bulk triage from the Flagged page; refreshes the same queries as a single update. */
export const useBulkUpdateReports = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof flaggedService.bulkUpdateReportStatus>[0]) => flaggedService.bulkUpdateReportStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMBINED_REPORTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [REPORTS_QUERY_KEY] });
    },
  });
};

export const useUpdateCombinedReport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      source,
      status,
      adminNotes,
      actionTaken,
    }: {
      reportId: string;
      source: ReportSource;
      status: string;
      adminNotes?: string;
      actionTaken?: string;
    }) => {
      return flaggedService.updateAnyReportStatus(reportId, source, {
        status,
        // No note → the field is left out and the report keeps whatever it had,
        // instead of "Action taken by admin" on every decision.
        adminNotes: adminNotes || undefined,
        actionTaken: actionTaken || 'none',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [COMBINED_REPORTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [REPORTS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [FLAGGED_QUERY_KEY] });
    },
  });
};

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
        stats: response.data?.stats || { total: 0, open: 0, under_review: 0, action_taken: 0, dismissed: 0, escalated: 0, open_total: 0 },
        pagination: response.data?.pagination,
      };
    },
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
