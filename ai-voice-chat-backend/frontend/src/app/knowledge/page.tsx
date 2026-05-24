'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import Link from 'next/link';

export default function KnowledgePage() {
  const { user, token } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [newDoc, setNewDoc] = useState({ content: '', metadata: '' });
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    loadStats();
  }, [token]);

  const loadStats = async () => {
    try {
      const data = await api.getKnowledgeStats(token);
      setStats(data);
    } catch (error: any) {
      console.error('Stats error:', error);
    }
  };

  const addDocument = async () => {
    if (!newDoc.content.trim()) return;
    try {
      setLoading(true);
      await api.addDocument(token, newDoc.content, { title: newDoc.metadata || 'Untitled' });
      setNewDoc({ content: '', metadata: '' });
      loadStats();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const searchKnowledge = async () => {
    if (!searchQuery.trim()) return;
    try {
      setLoading(true);
      const data = await api.searchKnowledge(token, searchQuery, 5);
      setSearchResults(data.results);
    } catch (error: any) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteKnowledge = async () => {
    if (!confirm('Are you sure you want to delete all knowledge?')) return;
    try {
      await api.deleteKnowledge(token);
      loadStats();
      setSearchResults([]);
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
        <h1 className="text-lg font-semibold text-white">Knowledge Base (RAG)</h1>
        <div className="flex items-center gap-4">
          <Link href="/analytics" className="text-sm text-gray-400 hover:text-white transition-colors">Analytics</Link>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
          <Link href="/chat" className="text-sm text-gray-400 hover:text-white transition-colors">Chat</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="text-gray-400 text-sm">Total Documents</p>
              <p className="text-3xl font-bold text-white">{stats.totalDocs}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="text-gray-400 text-sm">Last Updated</p>
              <p className="text-lg font-semibold text-white">{new Date(stats.lastUpdated).toLocaleDateString()}</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
              <p className="text-gray-400 text-sm">Status</p>
              <p className="text-lg font-semibold text-green-400">Active</p>
            </div>
          </div>
        )}

        {/* Add Document */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Add Document</h3>
          <div className="space-y-4">
            <input
              type="text"
              value={newDoc.metadata}
              onChange={(e) => setNewDoc({ ...newDoc, metadata: e.target.value })}
              placeholder="Document title/metadata"
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <textarea
              value={newDoc.content}
              onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
              placeholder="Document content..."
              rows={6}
              className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
            />
            <button
              onClick={addDocument}
              disabled={loading || !newDoc.content.trim()}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
            >
              {loading ? 'Adding...' : 'Add Document'}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Search Knowledge Base</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your knowledge..."
              className="flex-1 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              onKeyDown={(e) => e.key === 'Enter' && searchKnowledge()}
            />
            <button
              onClick={searchKnowledge}
              disabled={loading || !searchQuery.trim()}
              className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors border border-gray-700"
            >
              Search
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((result: any, i: number) => (
                <div key={i} className="p-3 bg-gray-800 rounded-lg">
                  <p className="text-gray-300 text-sm">{result.content}</p>
                  <p className="text-xs text-gray-500 mt-1">Score: {result.score.toFixed(3)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
          <h3 className="text-lg font-semibold text-white mb-4">Actions</h3>
          <button
            onClick={deleteKnowledge}
            className="px-6 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium rounded-lg transition-colors border border-red-600/30"
          >
            Delete All Knowledge
          </button>
        </div>
      </div>
    </div>
  );
}
