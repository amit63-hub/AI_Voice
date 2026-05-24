'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';

interface UserAnalytics {
  overview: any;
  engagement: any;
  modelUsage: any[];
  timeDistribution: any;
  sentiment: any;
  topics: any[];
}

export default function AnalyticsPage() {
  const { user, token } = useAuth();
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    loadAnalytics();
  }, [token, period]);

  const loadAnalytics = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await api.getUserAnalytics(token, period);
      setAnalytics(data);
    } catch (error: any) {
      console.error('Analytics error:', error);
    } finally {
      setLoading(false);
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
        <h1 className="text-lg font-semibold text-white">Analytics Dashboard</h1>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
          <Link href="/chat" className="text-sm text-gray-400 hover:text-white transition-colors">Chat</Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Period Selector */}
        <div className="flex items-center gap-2">
          {['7d', '30d', '90d', '1y'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : p === '90d' ? '90 Days' : '1 Year'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-pulse text-gray-400">Loading analytics...</div>
          </div>
        ) : analytics ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <p className="text-gray-400 text-sm">Total Messages</p>
                <p className="text-3xl font-bold text-white">{analytics.overview.totalMessages}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <p className="text-gray-400 text-sm">Daily Average</p>
                <p className="text-3xl font-bold text-white">{analytics.overview.dailyAverage}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <p className="text-gray-400 text-sm">Active Days</p>
                <p className="text-3xl font-bold text-white">{analytics.engagement.activeDays}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <p className="text-gray-400 text-sm">Account Age</p>
                <p className="text-3xl font-bold text-white">{analytics.overview.accountAge}</p>
              </div>
            </div>

            {/* Model Usage */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-4">AI Model Usage</h3>
              <div className="space-y-3">
                {analytics.modelUsage.map((model: any) => (
                  <div key={model.model} className="flex items-center justify-between">
                    <span className="text-gray-300">{model.model}</span>
                    <div className="flex items-center gap-4">
                      <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600" style={{ width: `${model.percentage}%` }} />
                      </div>
                      <span className="text-sm text-gray-400 w-20 text-right">{model.count} ({model.percentage}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment Analysis */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-4">Sentiment Analysis</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-green-400">{analytics.sentiment.positive}%</div>
                  <div className="text-sm text-gray-400">Positive</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-400">{analytics.sentiment.neutral}%</div>
                  <div className="text-sm text-gray-400">Neutral</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-red-400">{analytics.sentiment.negative}%</div>
                  <div className="text-sm text-gray-400">Negative</div>
                </div>
              </div>
            </div>

            {/* Topics */}
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h3 className="text-lg font-semibold text-white mb-4">Top Topics</h3>
              <div className="flex flex-wrap gap-2">
                {analytics.topics.map((topic: any, i: number) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-full text-sm"
                  >
                    {topic.topic} ({topic.count})
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-gray-400">No analytics data available</div>
        )}
      </div>
    </div>
  );
}
