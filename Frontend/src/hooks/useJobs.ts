import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsService } from '../services';
import toast from 'react-hot-toast';

interface UseJobsParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  category?: string;
  paymentMethod?: string;
  isUrgent?: string;
}

const JOBS_QUERY_KEY = 'jobs';

export const useJobs = (params: UseJobsParams) => {
  return useQuery({
    queryKey: [JOBS_QUERY_KEY, params],
    queryFn: () => jobsService.getJobs(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useJobCounts = () => {
  return useQuery({
    queryKey: [JOBS_QUERY_KEY, 'counts'],
    queryFn: async () => {
      const [totalData, openData, assignedData, completedData] = await Promise.all([
        jobsService.getJobs({ limit: 1, page: 1 }),
        jobsService.getJobs({ status: 'open', limit: 1, page: 1 }),
        jobsService.getJobs({ status: 'in_progress', limit: 1, page: 1 }),
        jobsService.getJobs({ status: 'completed', limit: 1, page: 1 })
      ]);

      const totalValue = totalData.stats?.totalValue || 0;

      return {
        total: totalData.pagination?.total || 0,
        open: openData.pagination?.total || 0,
        assigned: assignedData.pagination?.total || 0,
        completed: completedData.pagination?.total || 0,
        totalValue
      };
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useJobMutations = () => {
  const queryClient = useQueryClient();

  const invalidateJobs = () => {
    queryClient.invalidateQueries({ queryKey: [JOBS_QUERY_KEY] });
  };

  const updateJobStatus = useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: 'open' | 'in_progress' | 'completed' | 'cancelled' }) =>
      jobsService.updateJobStatus(jobId, { status }),
    onSuccess: () => {
      invalidateJobs();
      toast.success('Job status updated successfully');
    },
    onError: () => {
      toast.error('Failed to update job status');
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

  return {
    updateJobStatus,
    deleteJob,
  };
};
