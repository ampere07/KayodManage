import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../services';
import toast from 'react-hot-toast';
import {
  JobPostingSettings,
  UpdateJobPostingSettingsRequest,
} from '../types/configuration.types';

export const JOB_POSTING_SETTINGS_KEY = 'job-posting-settings';

export const useJobPostingSettings = () => {
  const { data, isLoading } = useQuery({
    queryKey: [JOB_POSTING_SETTINGS_KEY],
    queryFn: () => settingsService.getJobPostingSettings(),
  });

  return {
    settings: data?.settings as JobPostingSettings | undefined,
    isLoading,
  };
};

export const useUpdateJobPostingSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateJobPostingSettingsRequest) =>
      settingsService.updateJobPostingSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [JOB_POSTING_SETTINGS_KEY] });
      toast.success('Job posting settings saved');
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.message || 'Failed to save job posting settings'
      );
    },
  });
};
