'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function CallingAssistantPage() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [script, setScript] = useState('');
  const [priority, setPriority] = useState('normal');
  const [objective, setObjective] = useState('');
  const [tone, setTone] = useState('professional');
  const [language, setLanguage] = useState('english');
  const [calls, setCalls] = useState<any[]>([]);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('token');
    const u = localStorage.getItem('user');
    if (t) setToken(t);
    if (u) setUser(JSON.parse(u));
  }, []);

  useEffect(() => {
    if (token) {
      loadCalls();
      loadActiveCalls();
      loadQueueStatus();
      loadAnalytics();
    }
  }, [token]);

  const loadCalls = async () => {
    if (!token) return;
    try {
      const data = await api.getCalls(token);
      setCalls(data.calls || []);
    } catch (error) {
      console.error('Error loading calls:', error);
    }
  };

  const loadActiveCalls = async () => {
    if (!token) return;
    try {
      const data = await api.getActiveCalls(token);
      setActiveCalls(data.activeCalls || []);
    } catch (error) {
      console.error('Error loading active calls:', error);
    }
  };

  const loadQueueStatus = async () => {
    if (!token) return;
    try {
      const data = await api.getQueueStatus(token);
      setQueueStatus(data);
    } catch (error) {
      console.error('Error loading queue status:', error);
    }
  };

  const loadAnalytics = async () => {
    if (!token) return;
    try {
      const data = await api.getCallAnalytics(token);
      setAnalytics(data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const createCall = async () => {
    if (!token || !phoneNumber || !script) return;
    setLoading(true);
    try {
      await api.createCall(token, phoneNumber, script, priority);
      alert('Call created successfully!');
      setPhoneNumber('');
      setScript('');
      loadCalls();
      loadActiveCalls();
      loadQueueStatus();
    } catch (error) {
      console.error('Error creating call:', error);
      alert('Failed to create call');
    } finally {
      setLoading(false);
    }
  };

  const generateScript = async () => {
    if (!token || !objective) return;
    setGeneratingScript(true);
    try {
      const data = await api.generateScript(token, objective, tone, language);
      setGeneratedScript(data.script);
      setScript(data.script);
    } catch (error) {
      console.error('Error generating script:', error);
      alert('Failed to generate script');
    } finally {
      setGeneratingScript(false);
    }
  };

  const cancelCall = async (callId: string) => {
    if (!token) return;
    try {
      await api.cancelCall(token, callId);
      alert('Call cancelled successfully!');
      loadCalls();
      loadActiveCalls();
      loadQueueStatus();
    } catch (error) {
      console.error('Error cancelling call:', error);
      alert('Failed to cancel call');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-600';
      case 'in-progress': return 'bg-blue-600';
      case 'queued': return 'bg-yellow-600';
      case 'failed': return 'bg-red-600';
      case 'cancelled': return 'bg-gray-600';
      default: return 'bg-gray-600';
    }
  };

  if (!token || !user) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Please login to access this page</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
        <h1 className="text-lg font-semibold">AI Calling Assistant</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
          <Link href="/analytics" className="text-sm text-gray-400 hover:text-white transition-colors">Analytics</Link>
          <Link href="/knowledge" className="text-sm text-gray-400 hover:text-white transition-colors">Knowledge</Link>
          <Link href="/enterprise" className="text-sm text-gray-400 hover:text-white transition-colors">Enterprise</Link>
          <Link href="/chat" className="text-sm text-gray-400 hover:text-white transition-colors">Chat</Link>
          <button onClick={() => { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = '/login'; }} className="text-sm text-gray-400 hover:text-red-400 transition-colors">Logout</button>
        </div>
      </header>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Queue Status */}
        {queueStatus && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
            <h2 className="text-xl font-semibold mb-4">Queue Status</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Active Calls</p>
                <p className="text-2xl font-bold text-white">{queueStatus.activeCalls}/{queueStatus.maxConcurrentCalls}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Queued Calls</p>
                <p className="text-2xl font-bold text-white">{queueStatus.queuedCalls}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Max Concurrent</p>
                <p className="text-2xl font-bold text-white">{queueStatus.maxConcurrentCalls}</p>
              </div>
            </div>
          </div>
        )}

        {/* Create Call */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create Outbound Call</h2>
          
          {/* AI Script Generator */}
          <div className="mb-6 p-4 bg-gray-800 rounded-xl">
            <h3 className="text-lg font-medium mb-3">AI Script Generator</h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <input
                type="text"
                placeholder="Call objective (e.g., Schedule a meeting)"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400"
              />
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                aria-label="Tone"
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="professional">Professional</option>
                <option value="friendly">Friendly</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                aria-label="Language"
                className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white"
              >
                <option value="english">English</option>
                <option value="hindi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
              <button
                onClick={generateScript}
                disabled={generatingScript || !objective}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {generatingScript ? 'Generating...' : 'Generate Script'}
              </button>
            </div>
            {generatedScript && (
              <div className="mt-3 p-3 bg-gray-700 rounded-lg">
                <p className="text-sm text-gray-300 whitespace-pre-wrap">{generatedScript}</p>
              </div>
            )}
          </div>

          {/* Call Form */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400"
            />
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              aria-label="Priority"
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
            >
              <option value="normal">Normal Priority</option>
              <option value="high">High Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
          <textarea
            placeholder="Call Script"
            value={script}
            onChange={(e) => setScript(e.target.value)}
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 mb-4"
          />
          <button
            onClick={createCall}
            disabled={loading || !phoneNumber || !script}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            {loading ? 'Creating...' : 'Create Call'}
          </button>
        </div>

        {/* Active Calls */}
        {activeCalls.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
            <h2 className="text-xl font-semibold mb-4">Active Calls</h2>
            <div className="space-y-3">
              {activeCalls.map((call) => (
                <div key={call.id} className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{call.phoneNumber}</p>
                    <p className="text-sm text-gray-400">Started: {new Date(call.startedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(call.status)}`}>
                      {call.status}
                    </span>
                    <button
                      onClick={() => cancelCall(call.id)}
                      className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Call History */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6">
          <h2 className="text-xl font-semibold mb-4">Call History</h2>
          <div className="space-y-3">
            {calls.map((call) => (
              <div key={call.id} className="bg-gray-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium">{call.phoneNumber}</p>
                    <p className="text-sm text-gray-400">{new Date(call.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(call.status)}`}>
                    {call.status}
                  </span>
                </div>
                {call.duration > 0 && (
                  <p className="text-sm text-gray-400">Duration: {call.duration}s</p>
                )}
                {call.transcript && (
                  <details className="mt-2">
                    <summary className="text-sm text-blue-400 cursor-pointer">View Transcript</summary>
                    <pre className="mt-2 text-xs text-gray-300 whitespace-pre-wrap bg-gray-700 p-2 rounded">
                      {typeof call.transcript === 'string' ? call.transcript : JSON.stringify(call.transcript, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Analytics */}
        {analytics && (
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-xl font-semibold mb-4">Call Analytics</h2>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Total Calls</p>
                <p className="text-2xl font-bold text-white">{analytics.totalCalls}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Completed</p>
                <p className="text-2xl font-bold text-green-400">{analytics.completedCalls}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Failed</p>
                <p className="text-2xl font-bold text-red-400">{analytics.failedCalls}</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-4">
                <p className="text-gray-400 text-sm">Avg Duration</p>
                <p className="text-2xl font-bold text-white">{Math.round(analytics.averageDuration)}s</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
