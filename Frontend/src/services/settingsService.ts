import apiClient from '../utils/apiClient';

export const settingsService = {
  getAllAdmins: async () => {
    const response = await apiClient.get('/api/admin/admins');
    return response.data;
  },
  
  getAdminById: async (adminId: string) => {
    const response = await apiClient.get(`/api/admin/admins/${adminId}`);
    return response.data;
  },
  
  createAdmin: async (adminData: any) => {
    const response = await apiClient.post('/api/admin/admins', adminData);
    return response.data;
  },
  
  updateAdmin: async (adminId: string, adminData: any) => {
    const response = await apiClient.patch(`/api/admin/admins/${adminId}`, adminData);
    return response.data;
  },
  
  updateAdminPermissions: async (adminId: string, permissions: any) => {
    const response = await apiClient.patch(`/api/admin/admins/${adminId}/permissions`, { permissions });
    return response.data;
  }
};
