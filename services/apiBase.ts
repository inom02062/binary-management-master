const env = (import.meta as any).env;

export const API_BASE_URL = env?.PROD
  ? window.location.origin
  : env?.VITE_API_URL || 'http://localhost:4000';
