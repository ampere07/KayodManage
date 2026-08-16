import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { advertisementsService } from '../services/advertisementsService';
import toast from 'react-hot-toast';
import { Advertisement, AdvertisementInput } from '../types/configuration.types';

export const ADVERTISEMENTS_KEY = 'advertisements';

export const useAdvertisements = () => {
  const { data, isLoading } = useQuery({
    queryKey: [ADVERTISEMENTS_KEY],
    queryFn: () => advertisementsService.getAdvertisements(),
  });

  return {
    advertisements: (data?.advertisements ?? []) as Advertisement[],
    isLoading,
  };
};

export const useAdvertisementMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: [ADVERTISEMENTS_KEY] });

  // `successMessage` lets the caller name what actually happened — "published",
  // "paused", "saved as draft" — instead of a generic "updated".
  const createAdvertisement = useMutation({
    mutationFn: ({ data }: { data: AdvertisementInput; successMessage?: string }) =>
      advertisementsService.createAdvertisement(data),
    onSuccess: (_result, variables) => {
      invalidate();
      toast.success(variables.successMessage || 'Advertisement added');
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || 'Failed to add advertisement'),
  });

  const updateAdvertisement = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdvertisementInput; successMessage?: string }) =>
      advertisementsService.updateAdvertisement(id, data),
    onSuccess: (_result, variables) => {
      invalidate();
      toast.success(variables.successMessage || 'Advertisement updated');
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || 'Failed to update advertisement'),
  });

  // Reordering is applied optimistically: the drag already moved the row, so
  // waiting on the round-trip would make it snap back and forth.
  const reorderAdvertisements = useMutation({
    mutationFn: (ids: string[]) => advertisementsService.reorderAdvertisements(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: [ADVERTISEMENTS_KEY] });
      const previous = queryClient.getQueryData<any>([ADVERTISEMENTS_KEY]);
      queryClient.setQueryData<any>([ADVERTISEMENTS_KEY], (old: any) => {
        if (!old?.advertisements) return old;
        const byId = new Map<string, Advertisement>(
          old.advertisements.map((a: Advertisement) => [a._id, a]),
        );
        const next = ids
          .map((id) => byId.get(id))
          .filter((a): a is Advertisement => Boolean(a));
        // Anything not in `ids` (e.g. added in another tab) keeps its place at the end.
        const rest = old.advertisements.filter((a: Advertisement) => !ids.includes(a._id));
        return { ...old, advertisements: [...next, ...rest] };
      });
      return { previous };
    },
    onError: (error: any, _ids, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData([ADVERTISEMENTS_KEY], context.previous);
      }
      toast.error(error?.response?.data?.message || 'Failed to reorder advertisements');
    },
    onSettled: () => invalidate(),
  });

  const deleteAdvertisement = useMutation({
    mutationFn: (id: string) => advertisementsService.deleteAdvertisement(id),
    onSuccess: () => {
      invalidate();
      toast.success('Advertisement deleted');
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || 'Failed to delete advertisement'),
  });

  return {
    createAdvertisement,
    updateAdvertisement,
    reorderAdvertisements,
    deleteAdvertisement,
  };
};
