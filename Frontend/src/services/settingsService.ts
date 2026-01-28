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
  },

  // Job Categories
  getJobCategories: async () => {
    const response = await apiClient.get('/api/admin/configurations/job-categories');
    return response.data;
  },

  createJobCategory: async (data: { name: string }) => {
    const response = await apiClient.post('/api/admin/configurations/job-categories', data);
    return response.data;
  },

  updateJobCategory: async (categoryId: string, data: { name: string }) => {
    const response = await apiClient.patch(`/api/admin/configurations/job-categories/${categoryId}`, data);
    return response.data;
  },

  deleteJobCategory: async (categoryId: string) => {
    const response = await apiClient.delete(`/api/admin/configurations/job-categories/${categoryId}`);
    return response.data;
  },

  // Professions
  createProfession: async (data: { name: string; categoryId: string }) => {
    const response = await apiClient.post('/api/admin/configurations/professions', data);
    return response.data;
  },

  updateProfession: async (professionId: string, data: { name?: string; icon?: string }) => {
    const response = await apiClient.patch(`/api/admin/configurations/professions/${professionId}`, data);
    return response.data;
  },

  deleteProfession: async (professionId: string) => {
    const response = await apiClient.delete(`/api/admin/configurations/professions/${professionId}`);
    return response.data;
  },

  uploadCategoryIcon: async (file: File, categoryName: string, oldIcon?: string) => {
    const formData = new FormData();
    formData.append('icon', file);
    formData.append('categoryName', categoryName);
    if (oldIcon) {
      formData.append('oldIcon', oldIcon);
    }
    const response = await apiClient.post('/api/admin/configurations/upload-category-icon', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  uploadProfessionIcon: async (file: File, professionName: string, oldIcon?: string) => {
    const formData = new FormData();
    formData.append('icon', file);
    formData.append('professionName', professionName);
    if (oldIcon) {
      formData.append('oldIcon', oldIcon);
    }
    const response = await apiClient.post('/api/admin/configurations/upload-profession-icon', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  updateQuickAccessProfessions: async (professions: Array<{ professionId: string }>) => {
    const response = await apiClient.post('/api/admin/configurations/quick-access-professions', { professions });
    return response.data;
  },
};
