import axios from 'axios';
import toast from 'react-hot-toast';

// Get base URL from environment or fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30000,
});

// Helper function to check if error is network-related
const isNetworkError = (error: any): boolean => {
  return error.code === 'ERR_NETWORK' || 
         error.code === 'ERR_CONNECTION_REFUSED' ||
         error.code === 'ECONNREFUSED' ||
         error.code === 'ECONNABORTED' ||
         error.message?.includes('Network Error') ||
         error.message?.includes('timeout') ||
         !error.response;
};

// Request interceptor to add auth headers if needed
apiClient.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const silent404Endpoints = ['/api/verifications/'];
    const isSilent404 = error.response?.status === 404 && 
      silent404Endpoints.some(endpoint => error.config?.url?.includes(endpoint));
    
    if (isNetworkError(error)) {
      const silentEndpoints = ['/api/auth/check', '/api/socket', '/api/dashboard'];
      const shouldShowToast = !silentEndpoints.some(endpoint => 
        error.config?.url?.includes(endpoint)
      );
      
      if (shouldShowToast) {
        toast.error('Cannot connect to server. Please ensure backend is running.');
      }
      
      return Promise.reject({
        ...error,
        isNetworkError: true,
        message: 'Cannot connect to server'
      });
    }
    
    // Handle authentication errors
    if (error.response?.status === 401) {
      console.log('[API] Unauthorized response, user might need to re-login');
      // Don't show toast for auth check endpoints to avoid spam
      if (!error.config?.url?.includes('/api/auth/check')) {
        toast.error('Session expired. Please login again.');
      }
      // Don't automatically reload - let the auth context handle it
    }
    
    // Handle server errors
    if (error.response?.status >= 500) {
      console.error('[API] Server error:', error.response.status);
      toast.error('Server error. Please try again later.');
    }
    
    // Handle other client errors (400-499)
    if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 401 && !isSilent404) {
      const message = error.response?.data?.message || 'Request failed';
      if (!error.config?.url?.includes('/api/auth/check')) {
        toast.error(message);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
export { isNetworkError };
