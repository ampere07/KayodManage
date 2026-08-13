import apiClient from '../utils/apiClient';
import { AdvertisementInput } from '../types/configuration.types';

const BASE = '/api/admin/configurations/advertisements';

export const advertisementsService = {
  getAdvertisements: async () => {
    const response = await apiClient.get(BASE);
    return response.data;
  },

  createAdvertisement: async (data: AdvertisementInput) => {
    const response = await apiClient.post(BASE, data);
    return response.data;
  },

  updateAdvertisement: async (id: string, data: AdvertisementInput) => {
    const response = await apiClient.patch(`${BASE}/${id}`, data);
    return response.data;
  },

  deleteAdvertisement: async (id: string) => {
    const response = await apiClient.delete(`${BASE}/${id}`);
    return response.data;
  },

  uploadAdvertisementImage: async (file: File, name?: string) => {
    const formData = new FormData();
    formData.append('image', file);
    if (name) formData.append('name', name);
    const response = await apiClient.post(`${BASE}/upload-image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
