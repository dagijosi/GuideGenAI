import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] ?? 'http://localhost:3000',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message: string =
      axios.isAxiosError(error) && error.response?.data?.message
        ? String(error.response.data.message)
        : 'An unexpected error occurred';
    return Promise.reject(new Error(message));
  },
);
