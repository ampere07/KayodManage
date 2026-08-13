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

  const createAdvertisement = useMutation({
    mutationFn: (data: AdvertisementInput) =>
      advertisementsService.createAdvertisement(data),
    onSuccess: () => {
      invalidate();
      toast.success('Advertisement added');
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || 'Failed to add advertisement'),
  });

  const updateAdvertisement = useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdvertisementInput }) =>
      advertisementsService.updateAdvertisement(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Advertisement updated');
    },
    onError: (error: any) =>
      toast.error(error?.response?.data?.message || 'Failed to update advertisement'),
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

  return { createAdvertisement, updateAdvertisement, deleteAdvertisement };
};
