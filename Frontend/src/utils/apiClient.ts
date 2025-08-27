import axios from 'axios';
import toast from 'react-hot-toast';

// Get base URL from environment or fallback
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 10000, // Reduced timeout for better error handling
});

// Helper function to check if error is network-related
const isNetworkError = (error: any): boolean => {
  return error.code === 'ERR_NETWORK' || 
         error.code === 'ERR_CONNECTION_REFUSED' ||
         error.code === 'ECONNREFUSED' ||
         error.message?.includes('Network Error') ||
         !error.response;
};

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

// Response interceptor to handle errors globally
apiClient.interceptors.response.use(
  (response) => {
    console.log('[API] Response from:', response.config.url, 'Status:', response.status);
    return response;
  },
  (error) => {
    console.error('[API] Response error:', error);
    
    // Handle network errors
    if (isNetworkError(error)) {
      console.error('[API] Network error detected:', error.message);
      // Don't show toast for specific endpoints to avoid spam
      const silentEndpoints = ['/api/auth/check', '/api/socket'];
      const shouldShowToast = !silentEndpoints.some(endpoint => 
        error.config?.url?.includes(endpoint)
      );
      
      if (shouldShowToast) {
        toast.error('Connection failed. Please check your network or server status.');
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
    if (error.response?.status >= 400 && error.response?.status < 500 && error.response?.status !== 401) {
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
