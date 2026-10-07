// API URL configuration
// Empty string = relative URLs (Vercel serverless functions on same domain)
// For local development: set VITE_API_URL=http://localhost:3000
export const API_URL = import.meta.env.VITE_API_URL || '';

// Helper function to get full API endpoint URL
export const getApiUrl = (endpoint) => {
  if (!API_URL) return endpoint; // relative URL — handled by Vercel on same domain
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_URL}/${cleanEndpoint}`;
};
