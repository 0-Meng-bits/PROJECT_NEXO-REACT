// API URL configuration
// For local development: use localhost:3000
// For production: use Render backend URL
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Helper function to get full API endpoint URL
export const getApiUrl = (endpoint) => {
  // Remove leading slash if present to avoid double slashes
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_URL}/${cleanEndpoint}`;
};
