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
  
  getAdminActivity: async (adminId: string, limit: number = 10, skip: number = 0) => {
    const response = await apiClient.get(`/api/admin/admins/${adminId}/activity`, {
      params: { limit, skip }
    });
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
  },
  
  getAdminSessions: async (adminId: string) => {
    const response = await apiClient.get(`/api/admin/admins/${adminId}/sessions`);
    return response.data;
  }
};
