'use client';

import { useState, useEffect } from 'react';

const API_URL = 'http://91.134.135.247:3001';

// Types
interface User {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
}

interface Event {
  id: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED';
  createdAt: string;
}

interface Session {
  id: string;
  code: string;
  eventId: string;
  status: 'LOBBY' | 'IN_PROGRESS' | 'PAUSED' | 'COMPLETED';
  teamsCount: number;
  createdAt: string;
}

interface Stats {
  totalEvents: number;
  activeSessions: number;
  totalTeams: number;
  totalQuestions: number;
}

export default function Home() {
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // Dashboard state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'events' | 'sessions' | 'users'>('dashboard');
  const [events, setEvents] = useState<Event[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState<Stats>({ totalEvents: 0, activeSessions: 0, totalTeams: 0, totalQuestions: 0 });

  // Modal state
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDescription, setNewEventDescription] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');

  // Check if user is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
      setIsLoggedIn(true);
    }
  }, []);

  // Load dashboard data when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadDashboardData();
    }
  }, [isLoggedIn]);

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Load events
      const eventsRes = await fetch(`${API_URL}/api/events`, { headers });
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events || []);
      }

      // Load sessions
      const sessionsRes = await fetch(`${API_URL}/api/sessions`, { headers });
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData.sessions || []);
      }

      // Calculate stats
      setStats({
        totalEvents: events.length,
        activeSessions: sessions.filter(s => s.status === 'IN_PROGRESS').length,
        totalTeams: sessions.reduce((acc, s) => acc + (s.teamsCount || 0), 0),
        totalQuestions: 0,
      });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setIsLoggedIn(true);
      setLoading(false);
    } catch (err) {
      console.error('Login error:', err);
      setError('Network error. Please check if API is running.');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsLoggedIn(false);
    setUser(null);
    setEmail('');
    setPassword('');
    setEvents([]);
    setSessions([]);
  };

  const createEvent = async () => {
    if (!newEventName.trim()) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newEventName,
          description: newEventDescription,
        }),
      });

      if (response.ok) {
        const newEvent = await response.json();
        setEvents([...events, newEvent]);
        setShowCreateEvent(false);
        setNewEventName('');
        setNewEventDescription('');
      }
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  };

  const createSession = async () => {
    if (!selectedEventId) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventId: selectedEventId }),
      });

      if (response.ok) {
        const newSession = await response.json();
        setSessions([...sessions, newSession]);
        setShowCreateSession(false);
        setSelectedEventId('');
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const generateSessionCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Login page
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%239C92AC\" fill-opacity=\"0.08\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>

        <div className="relative z-10 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎮</div>
            <h1 className="text-4xl font-bold text-white">Arena Event</h1>
            <p className="text-purple-200 mt-2">Admin Dashboard</p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-200 text-sm text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="admin@arena-event.com"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition duration-300 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-purple-300/70">
              Demo: admin@arena-event.com / admin123
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-gray-900">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-gray-800 border-r border-gray-700">
        <div className="p-6">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">🎮</span>
            <div>
              <h1 className="text-xl font-bold text-white">Arena Event</h1>
              <p className="text-xs text-gray-400">Admin Panel</p>
            </div>
          </div>
        </div>

        <nav className="mt-6 px-3">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
              activeTab === 'dashboard' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span>📊</span>
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition mt-1 ${
              activeTab === 'events' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span>🎯</span>
            <span>Events</span>
          </button>
          <button
            onClick={() => setActiveTab('sessions')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition mt-1 ${
              activeTab === 'sessions' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span>📡</span>
            <span>Sessions</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition mt-1 ${
              activeTab === 'users' ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'
            }`}
          >
            <span>👥</span>
            <span>Users</span>
          </button>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-400 transition"
              title="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-64 p-8">
        {/* Header */}
        <header className="mb-8">
          <h2 className="text-3xl font-bold text-white">
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'events' && 'Events Management'}
            {activeTab === 'sessions' && 'Live Sessions'}
            {activeTab === 'users' && 'User Management'}
          </h2>
          <p className="text-gray-400 mt-1">
            {activeTab === 'dashboard' && 'Overview of your Arena Event platform'}
            {activeTab === 'events' && 'Create and manage your quiz events'}
            {activeTab === 'sessions' && 'Monitor and control active game sessions'}
            {activeTab === 'users' && 'Manage users and permissions'}
          </p>
        </header>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm">Total Events</p>
                    <p className="text-4xl font-bold text-white mt-1">{events.length}</p>
                  </div>
                  <div className="text-5xl opacity-80">🎯</div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">Active Sessions</p>
                    <p className="text-4xl font-bold text-white mt-1">{sessions.filter(s => s.status === 'IN_PROGRESS' || s.status === 'LOBBY').length}</p>
                  </div>
                  <div className="text-5xl opacity-80">📡</div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-100 text-sm">Total Teams</p>
                    <p className="text-4xl font-bold text-white mt-1">{stats.totalTeams}</p>
                  </div>
                  <div className="text-5xl opacity-80">👥</div>
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-100 text-sm">Questions</p>
                    <p className="text-4xl font-bold text-white mt-1">{stats.totalQuestions}</p>
                  </div>
                  <div className="text-5xl opacity-80">❓</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={() => { setActiveTab('events'); setShowCreateEvent(true); }}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-4 px-6 rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <span className="text-2xl">➕</span>
                  <span className="font-semibold">Create Event</span>
                </button>
                <button
                  onClick={() => { setActiveTab('sessions'); setShowCreateSession(true); }}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 px-6 rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <span className="text-2xl">🚀</span>
                  <span className="font-semibold">Start Session</span>
                </button>
                <a
                  href="http://91.134.135.247:3002"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white py-4 px-6 rounded-xl transition flex items-center justify-center space-x-2"
                >
                  <span className="text-2xl">🎮</span>
                  <span className="font-semibold">Open Studio</span>
                </a>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Recent Events</h3>
                {events.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No events yet. Create your first event!</p>
                ) : (
                  <div className="space-y-3">
                    {events.slice(0, 5).map((event, idx) => (
                      <div key={idx} className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium">{event.name || `Event ${idx + 1}`}</p>
                          <p className="text-gray-400 text-sm">{event.description || 'No description'}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          event.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                          event.status === 'COMPLETED' ? 'bg-gray-500/20 text-gray-400' :
                          'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {event.status || 'DRAFT'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-800 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Active Sessions</h3>
                {sessions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No active sessions. Start one now!</p>
                ) : (
                  <div className="space-y-3">
                    {sessions.slice(0, 5).map((session, idx) => (
                      <div key={idx} className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div className="bg-purple-600 text-white px-3 py-2 rounded-lg font-mono font-bold">
                            {session.code || generateSessionCode()}
                          </div>
                          <div>
                            <p className="text-white font-medium">Session {idx + 1}</p>
                            <p className="text-gray-400 text-sm">{session.teamsCount || 0} teams connected</p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          session.status === 'IN_PROGRESS' ? 'bg-green-500/20 text-green-400' :
                          session.status === 'LOBBY' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {session.status || 'LOBBY'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateEvent(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-xl transition flex items-center space-x-2"
              >
                <span>➕</span>
                <span>Create Event</span>
              </button>
            </div>

            {events.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h3 className="text-xl font-semibold text-white mb-2">No Events Yet</h3>
                <p className="text-gray-400 mb-6">Create your first event to get started with Arena Event</p>
                <button
                  onClick={() => setShowCreateEvent(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-xl transition"
                >
                  Create Your First Event
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {events.map((event, idx) => (
                  <div key={idx} className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition">
                    <div className="flex items-start justify-between mb-4">
                      <div className="text-4xl">🎯</div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        event.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' :
                        event.status === 'COMPLETED' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {event.status || 'DRAFT'}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-white mb-2">{event.name || `Event ${idx + 1}`}</h3>
                    <p className="text-gray-400 text-sm mb-4">{event.description || 'No description'}</p>
                    <div className="flex space-x-2">
                      <button className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition text-sm">
                        Edit
                      </button>
                      <button
                        onClick={() => { setSelectedEventId(event.id); setShowCreateSession(true); }}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition text-sm"
                      >
                        Start Session
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setShowCreateSession(true)}
                className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold py-3 px-6 rounded-xl transition flex items-center space-x-2"
              >
                <span>🚀</span>
                <span>New Session</span>
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center">
                <div className="text-6xl mb-4">📡</div>
                <h3 className="text-xl font-semibold text-white mb-2">No Sessions Yet</h3>
                <p className="text-gray-400 mb-6">Start a new game session to invite players</p>
                <button
                  onClick={() => setShowCreateSession(true)}
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-xl transition"
                >
                  Start Your First Session
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session, idx) => (
                  <div key={idx} className="bg-gray-800 rounded-xl p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-6">
                        <div className="bg-gradient-to-br from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl font-mono text-2xl font-bold tracking-widest">
                          {session.code || generateSessionCode()}
                        </div>
                        <div>
                          <h3 className="text-xl font-semibold text-white">Session {idx + 1}</h3>
                          <p className="text-gray-400">{session.teamsCount || 0} teams connected</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                          session.status === 'IN_PROGRESS' ? 'bg-green-500/20 text-green-400' :
                          session.status === 'LOBBY' ? 'bg-yellow-500/20 text-yellow-400' :
                          session.status === 'PAUSED' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-gray-500/20 text-gray-400'
                        }`}>
                          {session.status || 'LOBBY'}
                        </span>
                        <a
                          href="http://91.134.135.247:3002"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded-lg transition"
                        >
                          Open Studio
                        </a>
                        <a
                          href="http://91.134.135.247:3004"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition"
                        >
                          Open Screen
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-gray-800 rounded-xl p-6">
            <h3 className="text-xl font-semibold text-white mb-6">Registered Users</h3>
            <div className="space-y-4">
              <div className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    AU
                  </div>
                  <div>
                    <p className="text-white font-medium">Admin User</p>
                    <p className="text-gray-400 text-sm">admin@arena-event.com</p>
                  </div>
                </div>
                <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm font-medium">
                  SUPER_ADMIN
                </span>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    OU
                  </div>
                  <div>
                    <p className="text-white font-medium">Organizer User</p>
                    <p className="text-gray-400 text-sm">organizer@arena-event.com</p>
                  </div>
                </div>
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm font-medium">
                  ORGANIZER
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create Event Modal */}
      {showCreateEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Create New Event</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Event Name</label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="My Awesome Quiz"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 h-24 resize-none"
                  placeholder="Describe your event..."
                />
              </div>
            </div>
            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowCreateEvent(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={createEvent}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white py-3 px-4 rounded-xl transition"
              >
                Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateSession && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Start New Session</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Event</label>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Choose an event...</option>
                  {events.map((event, idx) => (
                    <option key={idx} value={event.id}>{event.name || `Event ${idx + 1}`}</option>
                  ))}
                </select>
              </div>
              <div className="bg-gray-700/50 rounded-xl p-4">
                <p className="text-gray-400 text-sm mb-2">Session Code Preview:</p>
                <p className="text-3xl font-mono font-bold text-purple-400 tracking-widest text-center">
                  {generateSessionCode()}
                </p>
              </div>
            </div>
            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowCreateSession(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={createSession}
                className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white py-3 px-4 rounded-xl transition"
              >
                Start Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
