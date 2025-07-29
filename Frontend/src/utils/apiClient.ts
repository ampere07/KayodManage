import axios from 'axios';
import toast from 'react-hot-toast';

// Create axios instance with default config
const apiClient = axios.create({
  withCredentials: true,
  timeout: 30000,
});

// Request interceptor to add auth headers if needed
apiClient.interceptors.request.use(
  (config) => {
    console.log('[API] Making request to:', config.url);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
apiClient.interceptors.response.use(
  (response) => {
    console.log('[API] Response from:', response.config.url, 'Status:', response.status);
    return response;
  },
  (error) => {
    console.error('[API] Response error:', error);
    
    if (error.response?.status === 401) {
      console.log('[API] Unauthorized response, user might need to re-login');
      // Don't show toast for auth check endpoints to avoid spam
      if (!error.config?.url?.includes('/api/auth/check')) {
        toast.error('Session expired. Please login again.');
      }
      // Don't automatically reload - let the auth context handle it
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
