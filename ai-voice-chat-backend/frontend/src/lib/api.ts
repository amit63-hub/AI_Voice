const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch(path: string, options: FetchOptions = {}) {
  const { token, ...fetchOptions } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...fetchOptions, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

export const api = {
  // Auth
  register: (name: string, email: string, password: string) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  login: (email: string) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email }) }),

  getMe: (token: string) =>
    apiFetch('/auth/me', { token }),

  // Chat
  chat: (token: string, userId: string, message: string) =>
    apiFetch('/chat', { method: 'POST', body: JSON.stringify({ userId, message }), token }),

  // Voice
  voiceChat: (token: string, userId: string, message: string) =>
    apiFetch('/chat', { method: 'POST', body: JSON.stringify({ userId, message }), token }),

  // Leads
  saveLead: (name: string, contact: string, intent: string, source: string) =>
    apiFetch('/lead', { method: 'POST', body: JSON.stringify({ name, contact, intent, source }) }),

  getLeads: (token: string, status?: string) =>
    apiFetch(`/leads${status ? `?status=${status}` : ''}`, { token }),

  // Subscriptions
  getPlans: () => apiFetch('/plans'),

  subscribe: (token: string, plan: string) =>
    apiFetch('/subscribe', { method: 'POST', body: JSON.stringify({ plan }), token }),

  // Usage
  getUsage: (token: string) => apiFetch('/usage', { token }),

  // Dashboard
  getDashboardStats: (token: string) => apiFetch('/dashboard/stats', { token }),

  // Multi-Model AI
  getModels: () => apiFetch('/ai/models'),
  
  aiChat: (token: string, message: string, model: string, stream: boolean = false) =>
    apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ message, model, stream }), token }),

  // RAG System
  addDocument: (token: string, content: string, metadata: any) =>
    apiFetch('/rag/document', { method: 'POST', body: JSON.stringify({ content, metadata }), token }),

  searchKnowledge: (token: string, query: string, topK: number = 5) =>
    apiFetch('/rag/search', { method: 'POST', body: JSON.stringify({ query, topK }), token }),

  ragChat: (token: string, query: string, model: string = 'gpt-4o-mini') =>
    apiFetch('/rag/chat', { method: 'POST', body: JSON.stringify({ query, model }), token }),

  deleteKnowledge: (token: string) =>
    apiFetch('/rag/knowledge', { method: 'DELETE', token }),

  getKnowledgeStats: (token: string) =>
    apiFetch('/rag/stats', { token }),

  // Analytics
  getUserAnalytics: (token: string, period: string = '30d') =>
    apiFetch(`/analytics/user?period=${period}`, { token }),

  getPlatformAnalytics: (token: string, period: string = '30d') =>
    apiFetch(`/analytics/platform?period=${period}`, { token }),

  // Enterprise
  generateApiKey: (token: string, name: string = 'API Key') =>
    apiFetch('/enterprise/api-key', { method: 'POST', body: JSON.stringify({ name }), token }),

  getApiKeys: (token: string) =>
    apiFetch('/enterprise/api-keys', { token }),

  revokeApiKey: (token: string, keyId: number) =>
    apiFetch(`/enterprise/api-key/${keyId}`, { method: 'DELETE', token }),

  createWebhook: (token: string, url: string, events: string[]) =>
    apiFetch('/enterprise/webhook', { method: 'POST', body: JSON.stringify({ url, events }), token }),

  getAuditLogs: (token: string, limit: number = 100) =>
    apiFetch(`/enterprise/audit-logs?limit=${limit}`, { token }),

  enableEnterprise: (token: string) =>
    apiFetch('/enterprise/enable', { method: 'POST', token }),

  // Health
  health: () => apiFetch('/health'),
};
