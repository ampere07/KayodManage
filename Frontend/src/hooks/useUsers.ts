import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '../services';
import toast from 'react-hot-toast';

interface UseUsersParams {
  page: number;
  limit: number;
  search?: string;
  userType?: 'client' | 'provider';
  isVerified?: string;
  status?: string;
  restricted?: string;
  accountStatus?: string;
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
    queryKey: [USERS_QUERY_KEY, 'counts', params, 'v2'],
    queryFn: async () => {
      const [totalData, customersData, providersData, suspendedData, restrictedData, bannedData] = await Promise.all([
        usersService.getUsers({ limit: 1, page: 1 }),
        usersService.getUsers({ userType: 'client', limit: 1, page: 1 }),
        usersService.getUsers({ userType: 'provider', limit: 1, page: 1 }),
        usersService.getUsers({ ...params, accountStatus: 'suspended', limit: 1, page: 1 }),
        usersService.getUsers({ ...params, accountStatus: 'restricted', limit: 1, page: 1 }),
        usersService.getUsers({ ...params, accountStatus: 'banned', limit: 1, page: 1 })
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
    queryKey: [USERS_QUERY_KEY, 'flaggedCounts', 'v4'],
    queryFn: async () => {
      console.log('Fetching flagged user counts...');
      const [
        flaggedTotalData,
        flaggedCustomersData,
        flaggedProvidersData,
        flaggedSuspendedData,
        flaggedRestrictedData,
        flaggedBannedData
      ] = await Promise.all([
        usersService.getUsers({ accountStatus: 'restricted,suspended,banned', limit: 1, page: 1 }),
        usersService.getUsers({ accountStatus: 'restricted,suspended,banned', userType: 'client', limit: 1, page: 1 }),
        usersService.getUsers({ accountStatus: 'restricted,suspended,banned', userType: 'provider', limit: 1, page: 1 }),
        usersService.getUsers({ accountStatus: 'suspended', limit: 1, page: 1 }),
        usersService.getUsers({ accountStatus: 'restricted', limit: 1, page: 1 }),
        usersService.getUsers({ accountStatus: 'banned', limit: 1, page: 1 })
      ]);

      console.log('Flagged restricted count:', flaggedRestrictedData.pagination?.total || 0);
      console.log('Query params for restricted count:', { accountStatus: 'restricted' });
      console.log('Flagged total count:', flaggedTotalData.pagination?.total || 0);
      console.log('Query params for total flagged count:', { accountStatus: 'restricted,suspended,banned' });

      return {
        total: flaggedTotalData.pagination?.total || 0,
        customers: flaggedCustomersData.pagination?.total || 0,
        providers: flaggedProvidersData.pagination?.total || 0,
        suspended: flaggedSuspendedData.pagination?.total || 0,
        restricted: flaggedRestrictedData.pagination?.total || 0,
        banned: flaggedBannedData.pagination?.total || 0
      };
    },
    staleTime: 5 * 60 * 1000
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
