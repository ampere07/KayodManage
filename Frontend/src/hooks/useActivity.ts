import { useQuery } from '@tanstack/react-query';
import apiClient from '../utils/apiClient';

const ACTIVITY_QUERY_KEY = 'activity';

export const useActivityLogs = () => {
  return useQuery({
    queryKey: [ACTIVITY_QUERY_KEY],
    queryFn: async () => {
      console.log('🔄 Fetching activity logs...');
      const response = await apiClient.get('/api/admin/activity-logs');
      console.log('✅ Activity logs fetched:', response.data.logs?.length, 'logs');
      return response.data.logs || [];
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
};
