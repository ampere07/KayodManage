import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '../services';
import toast from 'react-hot-toast';
import type { User } from '../types';

interface UseUsersParams {
  page: number;
  limit: number;
  search?: string;
  userType?: string;
  isVerified?: string;
  status?: string;
  restricted?: string;
}

const USERS_QUERY_KEY = 'users';

export const useUsers = (params: UseUsersParams) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, params],
    queryFn: () => usersService.getUsers(params),
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useUserCounts = (params?: any) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'counts', params],
    queryFn: async () => {
      const [totalData, customersData, providersData, suspendedData, restrictedData, bannedData] = await Promise.all([
        usersService.getUsers({ limit: 1, page: 1 }),
        usersService.getUsers({ userType: 'client', limit: 1, page: 1 }),
        usersService.getUsers({ userType: 'provider', limit: 1, page: 1 }),
        usersService.getUsers({ ...params, status: 'suspended', limit: 1, page: 1 }),
        usersService.getUsers({ ...params, status: 'restricted', limit: 1, page: 1 }),
        usersService.getUsers({ ...params, status: 'banned', limit: 1, page: 1 })
      ]);

      return {
        total: totalData.pagination?.total || 0,
        customers: customersData.pagination?.total || 0,
        providers: providersData.pagination?.total || 0,
        suspended: suspendedData.pagination?.total || 0,
        restricted: restrictedData.pagination?.total || 0,
        banned: bannedData.pagination?.total || 0,
        verified: 0,
        unverified: 0
      };
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useStatusCounts = (baseParams: any) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'statusCounts', baseParams],
    queryFn: async () => {
      const [allData, verifiedData, unverifiedData] = await Promise.all([
        usersService.getUsers({ ...baseParams, limit: 1, page: 1 }),
        usersService.getUsers({ ...baseParams, isVerified: 'true', limit: 1, page: 1 }),
        usersService.getUsers({ ...baseParams, isVerified: 'false', limit: 1, page: 1 })
      ]);

      return {
        all: allData.pagination?.total || 0,
        verified: verifiedData.pagination?.total || 0,
        unverified: unverifiedData.pagination?.total || 0
      };
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useFlaggedUserCounts = () => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'flaggedCounts'],
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
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useUserMutations = () => {
  const queryClient = useQueryClient();

  const invalidateUsers = () => {
    queryClient.invalidateQueries({ queryKey: [USERS_QUERY_KEY] });
  };

  const verifyUser = useMutation({
    mutationFn: ({ userId, isVerified }: { userId: string; isVerified: boolean }) =>
      usersService.verifyUser(userId, isVerified),
    onSuccess: () => {
      invalidateUsers();
      toast.success('User verification updated successfully');
    },
    onError: () => {
      toast.error('Failed to update verification');
    },
  });

  const banUser = useMutation({
    mutationFn: ({ userId, reason, duration }: { userId: string; reason: string; duration?: number }) =>
      usersService.banUser(userId, reason, duration),
    onSuccess: () => {
      invalidateUsers();
      toast.success('User banned successfully');
    },
    onError: () => {
      toast.error('Failed to ban user');
    },
  });

  const suspendUser = useMutation({
    mutationFn: ({ userId, reason, duration }: { userId: string; reason: string; duration: number }) =>
      usersService.suspendUser(userId, reason, duration),
    onSuccess: () => {
      invalidateUsers();
      toast.success('User suspended successfully');
    },
    onError: () => {
      toast.error('Failed to suspend user');
    },
  });

  const restrictUser = useMutation({
    mutationFn: ({ userId, duration, reason }: { userId: string; duration?: number; reason?: string }) =>
      usersService.restrictUser(userId, duration, reason),
    onSuccess: () => {
      invalidateUsers();
      toast.success('User restricted successfully');
    },
    onError: () => {
      toast.error('Failed to restrict user');
    },
  });

  const unrestrictUser = useMutation({
    mutationFn: (userId: string) => usersService.unrestrictUser(userId),
    onSuccess: () => {
      invalidateUsers();
      toast.success('User unrestricted successfully');
    },
    onError: () => {
      toast.error('Failed to unrestrict user');
    },
  });

  return {
    verifyUser,
    banUser,
    suspendUser,
    restrictUser,
    unrestrictUser,
  };
};
