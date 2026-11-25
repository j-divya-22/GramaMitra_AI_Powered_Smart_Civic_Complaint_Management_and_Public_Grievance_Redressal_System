import axios from 'axios';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AI_BASE_URL = import.meta.env.VITE_AI_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const aiApi = axios.create({
  baseURL: AI_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  registerAdmin: (data) => api.post('/api/auth/admin/register', data),
  login: (data) => api.post('/api/auth/login', data),
  logout: () => api.post('/api/auth/logout'),
  me: () => api.get('/api/auth/me'),
};

export const complaintAPI = {
  create: (data) => api.post('/api/complaints', data),
  geocodeAddress: (address) => api.post('/api/complaints/geocode-address', { address }),
  getMyComplaints: (params) => api.get('/api/complaints/mine', { params }),
  getById: (id) => api.get(`/api/complaints/${id}`),
  delete: (id) => api.delete(`/api/complaints/${id}`),
  replaceImage: (id, imageId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.put(`/api/complaints/${id}/images/${imageId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  deleteImage: (id, imageId) => api.delete(`/api/complaints/${id}/images/${imageId}`),
  getAll: (params) => api.get('/api/complaints', { params }),
  getStats: () => api.get('/api/complaints/stats'),
  createProgressUpdate: (id, data) => api.post(`/api/complaints/${id}/progress`, data),
  updateStatus: (id, data) => api.patch(`/api/complaints/${id}/status`, data),
};

export const adminAPI = {
  getStats: (params) => api.get('/api/admin/stats', { params }),
  getRegionalOptions: (params) => api.get('/api/admin/regional/options', { params }),
  getRegionalInsights: (params) => api.get('/api/admin/regional/insights', { params }),
  enrichRegionalLocations: (data) => api.post('/api/admin/regional/enrich', data),
  getDepartments: () => api.get('/api/admin/departments'),
  createDepartment: (data) => api.post('/api/admin/departments', data),
  updateDepartment: (id, data) => api.put(`/api/admin/departments/${id}`, data),
  getKnowledge: () => api.get('/api/admin/knowledge'),
  createKnowledge: (data) => api.post('/api/admin/knowledge', data),
  getAuditLogs: () => api.get('/api/admin/audit-logs'),
};

export const aiAPI = {
  classifyImage: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/ai/classify', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  generateComplaint: (data) => api.post('/api/ai/generate-complaint', data),
  translateToEnglish: (data) => api.post('/api/ai/translate', data),
  chat: (data) => api.post('/api/ai/chat', data),
};

export const uploadAPI = {
  uploadSingle: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/upload/single', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
  },
  uploadMultiple: (files, onProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return api.post('/api/upload/multiple', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          onProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      },
    });
  },
};

export const rewardAPI = {
  getMine: () => api.get('/api/rewards/mine'),
  requestWithdrawal: (data) => api.post('/api/rewards/withdrawals', data),
  getAdminCitizens: () => api.get('/api/rewards/admin/citizens'),
  getAdminCitizen: (citizenId) => api.get(`/api/rewards/admin/citizens/${citizenId}`),
  getAdminWithdrawals: () => api.get('/api/rewards/admin/withdrawals'),
  reviewWithdrawal: (withdrawalId, data) => api.post(`/api/rewards/admin/withdrawals/${withdrawalId}/review`, data),
  initiatePayment: (withdrawalId, data) => api.post(`/api/rewards/admin/withdrawals/${withdrawalId}/initiate`, data),
  confirmPayment: (withdrawalId, data) => api.post(`/api/rewards/admin/withdrawals/${withdrawalId}/confirm`, data),
};

export const healthCheck = () => api.get('/health');

export const getAuthErrorMessage = (error, fallback) => {
  if (error?.response?.data?.error) return error.response.data.error;
  if (error?.request) {
    return 'Cannot reach the Gramamitra backend. Start the backend and PostgreSQL, then try again.';
  }
  if (error?.message) return error.message;
  return fallback;
};
