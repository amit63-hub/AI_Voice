'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';

interface DashboardStats {
  totalUsers: number;
  totalLeads: number;
  todayMessages: number;
  proUsers: number;
}

interface Plan {
  id: string;
  name: string;
  price: number;
  messagesPerDay: number | string;
  voice: boolean;
  model: string;
  currency?: string;
}

export default function DashboardPage() {
  const { user, token, logout, refreshUser } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [leads, setLeads] = useState<any[]>([]);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.getDashboardStats(token).then(data => {
      setStats(data.stats);
      setLeads(data.recentLeads || []);
    }).catch(console.error);
    api.getPlans().then(data => setPlans(data.plans)).catch(console.error);
    api.getUsage(token).then(setUsage).catch(console.error);
  }, [token]);

  const handleUpgrade = async (plan: string) => {
    if (!token) return;
    setUpgrading(true);
    try {
      await api.subscribe(token, plan);
      await refreshUser();
      const newUsage = await api.getUsage(token);
      setUsage(newUsage);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpgrading(false);
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
        <h1 className="text-lg font-semibold text-white">Dashboard</h1>
        <div className="flex items-center gap-4">
          <Link href="/analytics" className="text-sm text-gray-400 hover:text-white transition-colors">Analytics</Link>
          <Link href="/knowledge" className="text-sm text-gray-400 hover:text-white transition-colors">Knowledge</Link>
          <Link href="/enterprise" className="text-sm text-gray-400 hover:text-white transition-colors">Enterprise</Link>
          <Link href="/calling" className="text-sm text-gray-400 hover:text-white transition-colors">Calling</Link>
          <Link href="/chat" className="text-sm text-gray-400 hover:text-white transition-colors">Chat</Link>
          <button onClick={logout} className="text-sm text-gray-400 hover:text-red-400 transition-colors">Logout</button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* User Info */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">{user.name}</h2>
              <p className="text-gray-400 text-sm">{user.email}</p>
            </div>
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-600/20 text-blue-400 border border-blue-600/30">
              {user.plan.toUpperCase()} Plan
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Messages Today</p>
              <p className="text-2xl font-bold text-white">{user.usage.today} <span className="text-sm text-gray-500">/ {user.usage.limit}</span></p>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <p className="text-gray-400 text-sm">Voice Access</p>
              <p className="text-2xl font-bold text-white">{user.voice ? '✅ Enabled' : '❌ Disabled'}</p>
            </div>
          </div>
        </div>

        {/* Plans */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Subscription Plans</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map(plan => (
              <div key={plan.id} className={`bg-gray-900 rounded-2xl p-6 border ${user.plan === plan.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-800'}`}>
                <h4 className="text-lg font-semibold text-white">{plan.name}</h4>
                <p className="text-3xl font-bold text-white mt-2">
                  {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                  {plan.price > 0 && <span className="text-sm text-gray-400">/month</span>}
                </p>
                <ul className="mt-4 space-y-2 text-sm text-gray-300">
                  <li>💬 {plan.messagesPerDay === 'unlimited' ? 'Unlimited' : plan.messagesPerDay} messages/day</li>
                  <li>🤖 Model: {plan.model}</li>
                  <li>🎤 Voice: {plan.voice ? 'Yes' : 'No'}</li>
                </ul>
                {user.plan !== plan.id && plan.price > 0 && (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={upgrading}
                    className="mt-4 w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {upgrading ? 'Upgrading...' : 'Upgrade'}
                  </button>
                )}
                {user.plan === plan.id && (
                  <div className="mt-4 w-full py-2 bg-green-600/20 text-green-400 rounded-lg text-sm font-medium text-center border border-green-600/30">
                    Current Plan
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Platform Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm">Total Users</p>
                <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm">Total Leads</p>
                <p className="text-2xl font-bold text-white">{stats.totalLeads}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm">Messages Today</p>
                <p className="text-2xl font-bold text-white">{stats.todayMessages}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                <p className="text-gray-400 text-sm">Pro Users</p>
                <p className="text-2xl font-bold text-white">{stats.proUsers}</p>
              </div>
            </div>
          </div>
        )}

        {/* Recent Leads */}
        {leads.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Recent Leads</h3>
            <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-400">Name</th>
                    <th className="px-4 py-3 text-left text-gray-400">Contact</th>
                    <th className="px-4 py-3 text-left text-gray-400">Intent</th>
                    <th className="px-4 py-3 text-left text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead: any, i: number) => (
                    <tr key={i} className="border-t border-gray-800">
                      <td className="px-4 py-3 text-white">{lead.name}</td>
                      <td className="px-4 py-3 text-gray-300">{lead.contact}</td>
                      <td className="px-4 py-3 text-gray-300">{lead.intent}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-600/30">{lead.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
