import { useQuery } from '@tanstack/react-query';
import apiClient from '../utils/apiClient';

const DASHBOARD_QUERY_KEY = 'dashboard';

export const useDashboardComparison = () => {
  return useQuery({
    queryKey: [DASHBOARD_QUERY_KEY, 'comparison'],
    queryFn: async () => {
      try {
        const response = await apiClient.get('/api/dashboard/stats-comparison');
        return response.data;
      } catch (error: any) {
        if (error.code === 'ECONNABORTED' || error.isNetworkError) {
          return { 
            users: { percentage: 0 }, 
            jobs: { percentage: 0 }, 
            revenue: { percentage: 0 } 
          };
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useDashboardRevenueChart = (period: 'week' | 'month' | 'year') => {
  return useQuery({
    queryKey: [DASHBOARD_QUERY_KEY, 'revenue-chart', period],
    queryFn: async () => {
      try {
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
        const response = await apiClient.get(`/api/dashboard/revenue-chart?days=${days}`);
        return response.data;
      } catch (error: any) {
        if (error.code === 'ECONNABORTED' || error.isNetworkError) {
          return [];
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};
