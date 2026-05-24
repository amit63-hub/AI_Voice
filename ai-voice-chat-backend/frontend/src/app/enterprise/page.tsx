'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function EnterprisePage() {
  const { user, token } = useAuth();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadApiKeys();
    loadAuditLogs();
  }, [token]);

  const loadApiKeys = async () => {
    try {
      const data = await api.getApiKeys(token);
      setApiKeys(data.keys);
    } catch (error: any) {
      console.error('API keys error:', error);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const data = await api.getAuditLogs(token, 50);
      setAuditLogs(data.logs);
    } catch (error: any) {
      console.error('Audit logs error:', error);
    }
  };

  const generateApiKey = async () => {
    try {
      setLoading(true);
      const data = await api.generateApiKey(token, newKeyName || 'API Key');
      setNewKeyName('');
      loadApiKeys();
      alert(`API Key Generated: ${data.apiKey}\n\nSave this key securely. You won't see it again!`);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const revokeApiKey = async (keyId: number) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    try {
      await api.revokeApiKey(token, keyId);
      loadApiKeys();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const enableEnterprise = async () => {
    if (!confirm('Enable enterprise features? This will upgrade your plan.')) return;
    try {
      const data = await api.enableEnterprise(token);
      alert('Enterprise features enabled!');
    } catch (error: any) {
      alert(error.message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Please sign in</p>
          <Link href="/login" className="text-blue-400 hover:text-blue-300">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <h1 className="text-lg font-semibold text-white">Enterprise Settings</h1>
        <div className="flex items-center gap-4">
          <Link href="/analytics" className="text-sm text-gray-400 hover:text-white transition-colors">Analytics</Link>
          <Link href="/knowledge" className="text-sm text-gray-400 hover:text-white transition-colors">Knowledge</Link>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
          <Link href="/chat" className="text-sm text-gray-400 hover:text-white transition-colors">Chat</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Enterprise Features */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Enterprise Features</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-2xl mb-2">🔐</div>
              <div className="text-sm text-gray-300">SSO</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-2xl mb-2">📊</div>
              <div className="text-sm text-gray-300">Audit Logs</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-2xl mb-2">🔑</div>
              <div className="text-sm text-gray-300">API Access</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg">
              <div className="text-2xl mb-2">🔔</div>
              <div className="text-sm text-gray-300">Webhooks</div>
            </div>
          </div>
          <button
            onClick={enableEnterprise}
            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            Enable Enterprise Features
          </button>
        </div>

        {/* API Keys */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">API Keys</h3>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (optional)"
              className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              onClick={generateApiKey}
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              Generate Key
            </button>
          </div>
          {apiKeys.length > 0 ? (
            <div className="space-y-2">
              {apiKeys.map((key: any) => (
                <div key={key.id} className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                  <div>
                    <div className="text-white font-medium">{key.name}</div>
                    <div className="text-xs text-gray-500">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                      {key.lastUsed && ` • Last used: ${new Date(key.lastUsed).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      key.status === 'active' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                    }`}>
                      {key.status}
                    </span>
                    {key.status === 'active' && (
                      <button
                        onClick={() => revokeApiKey(key.id)}
                        className="text-sm text-red-400 hover:text-red-300"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No API keys generated yet</p>
          )}
        </div>

        {/* Audit Logs */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Audit Logs</h3>
          {auditLogs.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLogs.map((log: any, i: number) => (
                <div key={i} className="p-3 bg-gray-800 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium">{log.action}</span>
                    <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="text-gray-400">Resource: {log.resource}</div>
                  {log.ipAddress && <div className="text-xs text-gray-500">IP: {log.ipAddress}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No audit logs available</p>
          )}
        </div>
      </div>
    </div>
  );
}
