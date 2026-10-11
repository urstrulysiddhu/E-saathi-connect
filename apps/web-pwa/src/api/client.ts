export const API_BASE_URL = import.meta.env.VITE_API_URL;

if (import.meta.env.PROD && !API_BASE_URL) {
  throw new Error('VITE_API_URL is required in production.');
}

const getBaseUrl = () => API_BASE_URL || 'http://localhost:3000';

export interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string>;
}

async function fetchWithAuth(url: string, options: ApiRequestOptions = {}) {
  const token = localStorage.getItem('authToken');
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/json');

  const baseUrl = getBaseUrl().replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  const urlObj = new URL(`${baseUrl}${path}`);
  if (options.params) {
    Object.keys(options.params).forEach((key) =>
      urlObj.searchParams.append(key, options.params![key])
    );
  }

  const response = await fetch(urlObj.toString(), {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || errorBody.message || 'An API error occurred');
  }

  return response.json();
}

export const apiClient = {
  get: (url: string, options?: ApiRequestOptions) =>
    fetchWithAuth(url, { ...options, method: 'GET' }),
  post: (url: string, data?: unknown, options?: ApiRequestOptions) =>
    fetchWithAuth(url, { ...options, method: 'POST', body: JSON.stringify(data) }),
  patch: (url: string, data?: unknown, options?: ApiRequestOptions) =>
    fetchWithAuth(url, { ...options, method: 'PATCH', body: JSON.stringify(data) }),
  delete: (url: string, options?: ApiRequestOptions) =>
    fetchWithAuth(url, { ...options, method: 'DELETE' }),
};
