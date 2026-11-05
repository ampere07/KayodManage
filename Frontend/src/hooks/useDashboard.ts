import { useQuery } from '@tanstack/react-query';
import apiClient from '../utils/apiClient';
import type { DashboardOverview } from '../types/dashboard.types';

const DASHBOARD_QUERY_KEY = 'dashboard';

/**
 * Everything the Dashboard shows, in one request. Refreshed every minute while
 * the page is open, so the "Needs attention" counts follow the queues without
 * relying on the live-update socket.
 */
export const useDashboardOverview = () => {
  return useQuery({
    queryKey: [DASHBOARD_QUERY_KEY, 'overview'],
    queryFn: async () => (await apiClient.get<DashboardOverview>('/api/dashboard/overview')).data,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });
};

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
    placeholderData: (previousData) => previousData,
  });
};

export const useDashboardRevenueChart = (period: 'week' | 'month' | 'year' | 'overall') => {
  return useQuery({
    queryKey: [DASHBOARD_QUERY_KEY, 'revenue-chart', period],
    queryFn: async () => {
      try {
        const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'year' ? 365 : 3600;
        const response = await apiClient.get(`/api/dashboard/revenue-chart?days=${days}`);
        return response.data;
      } catch (error: any) {
        if (error.code === 'ECONNABORTED' || error.isNetworkError) {
          return [];
        }
        throw error;
      }
    },
    placeholderData: (previousData) => previousData,
  });
};

export const useDashboardPopularJobs = (period: 'overall' | 'week' | 'month' | '6months' | 'year' = 'overall') => {
  return useQuery({
    queryKey: [DASHBOARD_QUERY_KEY, 'popular-jobs', period],
    queryFn: async () => {
      try {
        const response = await apiClient.get(`/api/dashboard/popular-jobs?period=${period}`);
        return response.data;
      } catch (error: any) {
        if (error.code === 'ECONNABORTED' || error.isNetworkError) {
          return [];
        }
        throw error;
      }
    },
    placeholderData: (previousData) => previousData,
  });
};
