import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersService } from '../services';
import toast from 'react-hot-toast';

interface UseUsersParams {
  page: number;
  limit: number;
  search?: string;
  userType?: string;
  isVerified?: string;
  status?: string;
  restricted?: string;
  accountStatus?: string;
  profession?: string;
}

const USERS_QUERY_KEY = 'users';

export const useUsers = (params: UseUsersParams) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, params],
    queryFn: () => usersService.getUsers(params),
    placeholderData: (previousData) => previousData,
  });
};

/**
 * One user's merged activity timeline. Only fetched while the detail panel has
 * the tab open — `enabled` keeps the nine-collection merge off the critical
 * path of simply opening a user.
 */
export const useUserActivity = (
  userId: string | undefined,
  params: { page?: number; limit?: number; types?: string } = {},
  enabled = true
) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'activity', userId, params],
    queryFn: () => usersService.getUserActivity(userId!, params),
    enabled: Boolean(userId) && enabled,
    placeholderData: (previousData) => previousData,
  });
};

/**
 * The full user record (wallet, restriction, professions, verification audit).
 * No placeholderData: when the panel moves to another user it must show a
 * loading state, never the previous user's details under the new name.
 */
export const useUserDetails = (userId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'details', userId],
    queryFn: () => usersService.getUserById(userId!),
    enabled: Boolean(userId) && enabled,
  });
};

export const useUserJobs = (
  userId: string | undefined,
  params: { page?: number; limit?: number; role?: 'all' | 'posted' | 'worked' } = {},
  enabled = true
) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'jobs', userId, params],
    queryFn: () => usersService.getUserJobs(userId!, params),
    enabled: Boolean(userId) && enabled,
    placeholderData: (previousData) => previousData,
  });
};

/**
 * A provider's reviews. Paging within one provider keeps the previous page on
 * screen; switching to another user never shows the last user's reviews.
 */
export const useUserReviews = (
  userId: string | undefined,
  params: { page?: number; limit?: number; rating?: number } = {},
  enabled = true
) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'reviews', userId, params],
    queryFn: () => usersService.getUserReviews(userId!, params),
    enabled: Boolean(userId) && enabled,
    placeholderData: (previousData, previousQuery) =>
      previousQuery?.queryKey[2] === userId ? previousData : undefined,
  });
};

/** Reports and support counts for one user. No placeholder: never another user's numbers. */
export const useUserStanding = (userId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'standing', userId],
    queryFn: () => usersService.getUserStanding(userId!),
    enabled: Boolean(userId) && enabled,
  });
};

/** How many penalties (restrict/suspend/ban) the user has had, and the latest. */
export const useUserPenalties = (userId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'penalties', userId],
    queryFn: () => usersService.getPenaltyData(userId!),
    enabled: Boolean(userId) && enabled,
  });
};

export const useUserFinancials = (userId: string | undefined, enabled = true) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'financials', userId],
    queryFn: () => usersService.getUserFinancials(userId!),
    enabled: Boolean(userId) && enabled,
    placeholderData: (previousData) => previousData,
  });
};

/**
 * Every number on the Users page — stat cards and verification tabs — is a sum
 * over these cells (type × account status × verification), computed under the
 * same search/profession as the list. One request instead of ~20 limit=1 probes,
 * and the numbers cannot disagree with each other or with the list.
 */
export const useUserCountCells = (params: { search?: string; profession?: string }) => {
  return useQuery({
    queryKey: [USERS_QUERY_KEY, 'countCells', params],
    queryFn: async () => (await usersService.getUserCounts(params)).cells,
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

  const softDeleteUser = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      usersService.softDeleteUser(userId, reason),
    onSuccess: () => {
      invalidateUsers();
      toast.success('User deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete user');
    },
  });

  return {
    verifyUser,
    banUser,
    suspendUser,
    restrictUser,
    unrestrictUser,
    softDeleteUser,
  };
};
