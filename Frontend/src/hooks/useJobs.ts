import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsService, settingsService } from '../services';
import toast from 'react-hot-toast';
import { useMemo } from 'react';

interface UseJobsParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  category?: string;
  paymentMethod?: string;
  isUrgent?: string;
  archived?: boolean;
  archiveType?: 'hidden' | 'removed';
}

const JOBS_QUERY_KEY = 'jobs';

export const useJobs = (params: UseJobsParams) => {
  return useQuery({
    queryKey: [JOBS_QUERY_KEY, params],
    queryFn: () => jobsService.getJobs(params),
    placeholderData: (previousData) => previousData,
  });
};

export const useJobCounts = () => {
  return useQuery({
    queryKey: [JOBS_QUERY_KEY, 'counts'],
    queryFn: async () => {
      // Was labeled "assigned" — there is no "assigned" job status in the
      // real app (see improvements doc §2); this counts in_progress jobs.
      const [totalData, openData, inProgressData, completedData] = await Promise.all([
        jobsService.getJobs({ limit: 1, page: 1 }),
        jobsService.getJobs({ status: 'open', limit: 1, page: 1 }),
        jobsService.getJobs({ status: 'in_progress', limit: 1, page: 1 }),
        jobsService.getJobs({ status: 'completed', limit: 1, page: 1 })
      ]);

      const totalValue = totalData.stats?.totalValue || 0;

      return {
        total: totalData.pagination?.total || 0,
        open: openData.pagination?.total || 0,
        inProgress: inProgressData.pagination?.total || 0,
        completed: completedData.pagination?.total || 0,
        totalValue
      };
    },
    placeholderData: (previousData) => previousData,
  });
};

export const useArchivedJobs = (params: UseJobsParams) => {
  return useQuery({
    queryKey: [JOBS_QUERY_KEY, 'archived', params],
    queryFn: () => jobsService.getJobs({ ...params, archived: true }),
    placeholderData: (previousData) => previousData,
  });
};

export const useArchivedJobCounts = () => {
  return useQuery({
    queryKey: [JOBS_QUERY_KEY, 'archived-counts'],
    queryFn: async () => {
      const [hiddenData, removedData] = await Promise.all([
        jobsService.getJobs({ limit: 1, page: 1, archived: true, archiveType: 'hidden' }),
        jobsService.getJobs({ limit: 1, page: 1, archived: true, archiveType: 'removed' })
      ]);

      return {
        hidden: hiddenData.pagination?.total || 0,
        removed: removedData.pagination?.total || 0
      };
    },
    placeholderData: (previousData) => previousData,
  });
};

export const useJobMutations = () => {
  const queryClient = useQueryClient();

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY] });
  };

  const updateJobStatus = useMutation({
    // "cancelled" intentionally excluded — see forceCancelJob below.
    mutationFn: ({ jobId, status }: { jobId: string; status: 'open' | 'in_progress' | 'completed' }) =>
      jobsService.updateJobStatus(jobId, { status }),
    onSuccess: () => {
      invalidateJobs();
      toast.success('Job status updated successfully');
    },
    onError: () => {
      toast.error('Failed to update job status');
    },
  });

  const forceCancelJob = useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason?: string }) =>
      jobsService.forceCancelJob(jobId, reason),
    onSuccess: (data) => {
      invalidateJobs();
      toast.success(
        data.refundedAmount > 0
          ? `Job cancelled — ₱${data.refundedAmount} refunded to client`
          : 'Job cancelled successfully'
      );
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Failed to cancel job');
    },
  });

  const deleteJob = useMutation({
    mutationFn: (jobId: string) => jobsService.deleteJob(jobId),
    onSuccess: () => {
      invalidateJobs();
      toast.success('Job deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete job');
    },
  });

  const hideJob = useMutation({
    mutationFn: (jobId: string) => jobsService.hideJob(jobId),
    onSuccess: () => {
      invalidateJobs();
      toast.success('Job hidden successfully');
    },
    onError: () => {
      toast.error('Failed to hide job');
    },
  });

  const unhideJob = useMutation({
    mutationFn: (jobId: string) => jobsService.unhideJob(jobId),
    onSuccess: () => {
      invalidateJobs();
      toast.success('Job unhidden successfully');
    },
    onError: () => {
      toast.error('Failed to unhide job');
    },
  });

  const restoreJob = useMutation({
    mutationFn: (jobId: string) => jobsService.restoreJob(jobId),
    onSuccess: () => {
      invalidateJobs();
      toast.success('Job restored successfully');
    },
    onError: () => {
      toast.error('Failed to restore job');
    },
  });

  return {
    updateJobStatus,
    forceCancelJob,
    deleteJob,
    hideJob,
    unhideJob,
    restoreJob,
  };
};

export const useJobCategories = () => {
  const { data: jobCategoriesData, isLoading } = useQuery({
    queryKey: ['job-categories'],
    queryFn: () => settingsService.getJobCategories(),
  });
  const categories = useMemo(() => jobCategoriesData?.categories || [], [jobCategoriesData]);
  const professionsList = useMemo(() => {
    const allProfessions = categories.flatMap(cat => cat.professions || []).map(prof => prof.name);
    // Deduplicate profession names
    return [...new Set(allProfessions)].sort();
  }, [categories]);
  return { categories, professionsList, isLoading };
};
