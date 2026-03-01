import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { verificationsService } from '../services';
import type { Verification } from '../types';

const VERIFICATIONS_QUERY_KEY = 'verifications';

export const useVerifications = () => {
  return useQuery({
    queryKey: [VERIFICATIONS_QUERY_KEY],
    queryFn: async () => {
      const response = await verificationsService.getAllVerifications();
      return response.data || [];
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};

export const useUpdateVerificationStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      verificationId,
      status,
      adminNotes,
      rejectionReason,
      banUser
    }: {
      verificationId: string;
      status: string;
      adminNotes?: string;
      rejectionReason?: string;
      banUser?: boolean;
    }) => {
      const response = await verificationsService.updateVerificationStatus(verificationId, {
        status: status as any,
        adminNotes,
        rejectionReason,
        banUser
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VERIFICATIONS_QUERY_KEY] });
    },
  });
};
