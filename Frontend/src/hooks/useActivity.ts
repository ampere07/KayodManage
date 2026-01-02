import { useQuery } from '@tanstack/react-query';
import apiClient from '../utils/apiClient';

const ACTIVITY_QUERY_KEY = 'activity';

export const useActivityLogs = () => {
  return useQuery({
    queryKey: [ACTIVITY_QUERY_KEY],
    queryFn: async () => {
      const response = await apiClient.get('/api/admin/activity-logs');
      return response.data.logs || [];
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};
