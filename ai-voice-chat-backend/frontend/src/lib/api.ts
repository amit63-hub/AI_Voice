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

  // Health
  health: () => apiFetch('/health'),
};
