'use client';

import { useState, useEffect, useCallback } from 'react';

// API URL - configurable via environment variable or defaults to the VPS
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://91.134.135.247:3001';

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
  logo?: string;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
  };
  status: string;
  createdAt: string;
  _count?: { sessions: number; rounds: number };
  rounds?: Round[];
}

interface Round {
  id: string;
  name: string;
  order: number;
  questions?: Question[];
}

interface Question {
  id: string;
  text: string;
  type: string;
  options: string[];
  correctAnswer: string;
  points: number;
  timeLimit: number;
  order: number;
  mediaUrl?: string;
  questionCueStart?: number;
  questionCueEnd?: number;
  revealCueStart?: number;
  revealCueEnd?: number;
}

interface Session {
  id: string;
  code: string;
  status: string;
  eventId: string;
  event?: { name: string };
  _count?: { teams: number };
  createdAt: string;
}

type Tab = 'dashboard' | 'events' | 'sessions' | 'users';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Data state
  const [events, setEvents] = useState<Event[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Modal state
  const [showEventModal, setShowEventModal] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  // Form state
  const [eventForm, setEventForm] = useState({
    name: '',
    description: '',
    logo: '',
    theme: { primaryColor: '#4f46e5', secondaryColor: '#9333ea', backgroundColor: '#ec4899' }
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [questionForm, setQuestionForm] = useState({
    text: '', type: 'MCQ', options: ['', '', '', ''], correctAnswer: 'A', points: 100, timeLimit: 30, mediaUrl: '',
    questionCueStart: null as number | null, questionCueEnd: null as number | null,
    revealCueStart: null as number | null, revealCueEnd: null as number | null
  });
  const [audioDuration, setAudioDuration] = useState(0);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [modalError, setModalError] = useState('');
  const [modalLoading, setModalLoading] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Load data when authenticated
  useEffect(() => {
    if (token) {
      loadEvents();
      loadSessions();
    }
  }, [token]);

  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });
    return response;
  }, [token]);

  const loadEvents = async () => {
    try {
      const res = await apiCall('/api/events');
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setEvents(data.events || []);
        } catch (parseError) {
          console.error('Failed to parse events response:', text);
          setEvents([]);
        }
      }
    } catch (err) {
      console.error('Load events error:', err);
      setEvents([]);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await apiCall('/api/sessions');
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setSessions(data.sessions || []);
        } catch (parseError) {
          console.error('Failed to parse sessions response:', text);
          setSessions([]);
        }
      }
    } catch (err) {
      console.error('Load sessions error:', err);
      setSessions([]);
    }
  };

  const loadEventDetails = async (eventId: string) => {
    try {
      const res = await apiCall(`/api/events/${eventId}`);
      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          setSelectedEvent(data.event);
        } catch (parseError) {
          console.error('Failed to parse event details response:', text);
        }
      }
    } catch (err) {
      console.error('Load event details error:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
      }
    } catch (err) {
      setError('Network error');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const createEvent = async () => {
    if (!eventForm.name.trim()) {
      setModalError('Event name is required');
      return;
    }
    setModalError('');
    setModalLoading(true);
    try {
      const res = await apiCall('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          name: eventForm.name,
          description: eventForm.description
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowEventModal(false);
        setEventForm({ name: '', description: '', logo: '', theme: { primaryColor: '#4f46e5', secondaryColor: '#9333ea', backgroundColor: '#ec4899' } });
        loadEvents();
      } else {
        setModalError(data.error || `Failed to create event (${res.status})`);
      }
    } catch (err) {
      console.error('Create event error:', err);
      setModalError('Network error - check if API is running');
    } finally {
      setModalLoading(false);
    }
  };

  const updateEvent = async () => {
    if (!editingEvent) return;
    if (!eventForm.name.trim()) {
      setModalError('Event name is required');
      return;
    }
    setModalError('');
    setModalLoading(true);
    try {
      const res = await apiCall(`/api/events/${editingEvent.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: eventForm.name,
          description: eventForm.description
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setShowEventModal(false);
        setEditingEvent(null);
        setEventForm({ name: '', description: '', logo: '', theme: { primaryColor: '#4f46e5', secondaryColor: '#9333ea', backgroundColor: '#ec4899' } });
        loadEvents();
        if (selectedEvent?.id === editingEvent.id) {
          loadEventDetails(editingEvent.id);
        }
      } else {
        setModalError(data.error || `Failed to update event (${res.status})`);
      }
    } catch (err) {
      console.error('Update event error:', err);
      setModalError('Network error - check if API is running');
    } finally {
      setModalLoading(false);
    }
  };

  const deleteEvent = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      const res = await apiCall(`/api/events/${eventId}`, { method: 'DELETE' });
      if (res.ok) {
        loadEvents();
        if (selectedEvent?.id === eventId) {
          setSelectedEvent(null);
        }
      }
    } catch (err) {
      console.error('Delete event error:', err);
    }
  };

  const createRound = async (eventId: string) => {
    try {
      const res = await apiCall(`/api/events/${eventId}/rounds`, {
        method: 'POST',
        body: JSON.stringify({ name: `Round ${(selectedEvent?.rounds?.length || 0) + 1}` }),
      });
      if (res.ok) {
        loadEventDetails(eventId);
      }
    } catch (err) {
      console.error('Create round error:', err);
    }
  };

  const createQuestion = async () => {
    if (!selectedRoundId) return;
    try {
      const res = await apiCall(`/api/rounds/${selectedRoundId}/questions`, {
        method: 'POST',
        body: JSON.stringify({
          ...questionForm,
          correctAnswer: questionForm.correctAnswer,
          mediaUrl: questionForm.mediaUrl || null,
          questionCueStart: questionForm.questionCueStart,
          questionCueEnd: questionForm.questionCueEnd,
          revealCueStart: questionForm.revealCueStart,
          revealCueEnd: questionForm.revealCueEnd,
        }),
      });
      if (res.ok) {
        setShowQuestionModal(false);
        setQuestionForm({ text: '', type: 'MCQ', options: ['', '', '', ''], correctAnswer: 'A', points: 100, timeLimit: 30, mediaUrl: '', questionCueStart: null, questionCueEnd: null, revealCueStart: null, revealCueEnd: null });
        setAudioDuration(0);
        if (selectedEvent) loadEventDetails(selectedEvent.id);
      }
    } catch (err) {
      console.error('Create question error:', err);
    }
  };

  const updateQuestion = async () => {
    if (!editingQuestion) return;
    try {
      const res = await apiCall(`/api/questions/${editingQuestion.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...questionForm,
          mediaUrl: questionForm.mediaUrl || null,
          questionCueStart: questionForm.questionCueStart,
          questionCueEnd: questionForm.questionCueEnd,
          revealCueStart: questionForm.revealCueStart,
          revealCueEnd: questionForm.revealCueEnd,
        }),
      });
      if (res.ok) {
        setShowQuestionModal(false);
        setEditingQuestion(null);
        setQuestionForm({ text: '', type: 'MCQ', options: ['', '', '', ''], correctAnswer: 'A', points: 100, timeLimit: 30, mediaUrl: '', questionCueStart: null, questionCueEnd: null, revealCueStart: null, revealCueEnd: null });
        setAudioDuration(0);
        if (selectedEvent) loadEventDetails(selectedEvent.id);
      }
    } catch (err) {
      console.error('Update question error:', err);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Delete this question?')) return;
    try {
      const res = await apiCall(`/api/questions/${questionId}`, { method: 'DELETE' });
      if (res.ok && selectedEvent) {
        loadEventDetails(selectedEvent.id);
      }
    } catch (err) {
      console.error('Delete question error:', err);
    }
  };

  const createSession = async (eventId: string) => {
    try {
      const res = await apiCall('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ eventId }),
      });
      if (res.ok) {
        setShowSessionModal(false);
        loadSessions();
      }
    } catch (err) {
      console.error('Create session error:', err);
    }
  };

  const openEditEvent = (event: Event) => {
    setEditingEvent(event);
    const defaultTheme = { primaryColor: '#4f46e5', secondaryColor: '#9333ea', backgroundColor: '#ec4899' };
    setEventForm({
      name: event.name,
      description: event.description || '',
      logo: event.logo || '',
      theme: {
        primaryColor: event.theme?.primaryColor || defaultTheme.primaryColor,
        secondaryColor: event.theme?.secondaryColor || defaultTheme.secondaryColor,
        backgroundColor: event.theme?.backgroundColor || defaultTheme.backgroundColor
      }
    });
    setShowEventModal(true);
  };

  const openAddQuestion = (roundId: string) => {
    setSelectedRoundId(roundId);
    setEditingQuestion(null);
    setQuestionForm({ text: '', type: 'MCQ', options: ['', '', '', ''], correctAnswer: 'A', points: 100, timeLimit: 30, mediaUrl: '', questionCueStart: null, questionCueEnd: null, revealCueStart: null, revealCueEnd: null });
    setAudioDuration(0);
    setShowQuestionModal(true);
  };

  const openEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setQuestionForm({
      text: question.text,
      type: question.type,
      options: question.options || ['', '', '', ''],
      correctAnswer: question.correctAnswer,
      points: question.points,
      timeLimit: question.timeLimit,
      mediaUrl: question.mediaUrl || '',
      questionCueStart: question.questionCueStart ?? null,
      questionCueEnd: question.questionCueEnd ?? null,
      revealCueStart: question.revealCueStart ?? null,
      revealCueEnd: question.revealCueEnd ?? null,
    });
    setAudioDuration(0);
    setShowQuestionModal(true);
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAudio(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const res = await fetch(`${API_URL}/api/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            data: base64,
            type: 'audio'
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setQuestionForm(prev => ({ ...prev, mediaUrl: data.url }));
        } else {
          alert('Upload failed: ' + (data.error || 'Unknown error'));
        }
        setUploadingAudio(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadingAudio(false);
    }
  };

  // LOGIN PAGE
  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 w-full max-w-md border border-white/20">
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
              <label className="block text-sm font-medium text-purple-200 mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="admin@arena-event.com" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-purple-200 mb-2">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="********" required />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="mt-6 text-center text-sm text-purple-300/70">Demo: admin@arena-event.com / admin123</p>
        </div>
      </main>
    );
  }

  // MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-6 flex items-center space-x-3">
          <span className="text-3xl">🎮</span>
          <div>
            <h1 className="text-xl font-bold text-white">Arena Event</h1>
            <p className="text-xs text-gray-400">Admin Panel</p>
          </div>
        </div>
        <nav className="flex-1 px-3">
          {(['dashboard', 'events', 'sessions', 'users'] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => { setActiveTab(tab); setSelectedEvent(null); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition mt-1 ${activeTab === tab ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
              <span>{tab === 'dashboard' ? '📊' : tab === 'events' ? '🎯' : tab === 'sessions' ? '📡' : '👥'}</span>
              <span className="capitalize">{tab}</span>
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-gray-400">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-400 text-xs">Exit</button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white">Dashboard</h2>
            <div className="grid grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6">
                <p className="text-blue-100 text-sm">Total Events</p>
                <p className="text-4xl font-bold text-white">{events.length}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6">
                <p className="text-green-100 text-sm">Active Sessions</p>
                <p className="text-4xl font-bold text-white">{sessions.filter(s => s.status !== 'COMPLETED').length}</p>
              </div>
              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-6">
                <p className="text-yellow-100 text-sm">Total Sessions</p>
                <p className="text-4xl font-bold text-white">{sessions.length}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl p-6">
                <p className="text-purple-100 text-sm">Total Questions</p>
                <p className="text-4xl font-bold text-white">{events.reduce((acc, e) => acc + (e._count?.rounds || 0), 0)}</p>
              </div>
            </div>
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Quick Links</h3>
              <div className="grid grid-cols-3 gap-4">
                <a href="http://91.134.135.247:3002" target="_blank" className="bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl text-center font-semibold transition">🎮 Studio</a>
                <a href="http://91.134.135.247:3003" target="_blank" className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl text-center font-semibold transition">📱 Player</a>
                <a href="http://91.134.135.247:3004" target="_blank" className="bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl text-center font-semibold transition">📺 Screen</a>
              </div>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && !selectedEvent && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-bold text-white">Events</h2>
              <button onClick={() => { setEditingEvent(null); setEventForm({ name: '', description: '', logo: '', theme: { primaryColor: '#4f46e5', secondaryColor: '#9333ea', backgroundColor: '#ec4899' } }); setShowEventModal(true); }}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-semibold transition">
                + Create Event
              </button>
            </div>
            {events.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center">
                <p className="text-6xl mb-4">🎯</p>
                <p className="text-gray-400 text-lg">No events yet. Create your first event!</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-6">
                {events.map((event) => (
                  <div key={event.id} className="bg-gray-800 rounded-xl p-6 hover:bg-gray-750 transition">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-xl font-semibold text-white">{event.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs ${event.status === 'ACTIVE' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {event.status}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">{event.description || 'No description'}</p>
                    <div className="flex justify-between text-sm text-gray-500 mb-4">
                      <span>{event._count?.rounds || 0} rounds</span>
                      <span>{event._count?.sessions || 0} sessions</span>
                    </div>
                    <div className="flex space-x-2">
                      <button onClick={() => openEditEvent(event)} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm transition">
                        Edit
                      </button>
                      <button onClick={() => loadEventDetails(event.id)} className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition" title="Manage rounds & questions">
                        📝
                      </button>
                      <button onClick={() => deleteEvent(event.id)} className="bg-red-600/20 hover:bg-red-600/40 text-red-400 px-3 py-2 rounded-lg transition">
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Event Details */}
        {activeTab === 'events' && selectedEvent && (
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <button onClick={() => setSelectedEvent(null)} className="text-gray-400 hover:text-white transition">
                ← Back
              </button>
              <h2 className="text-3xl font-bold text-white">{selectedEvent.name}</h2>
            </div>

            <div className="flex space-x-4">
              <button onClick={() => createRound(selectedEvent.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition">
                + Add Round
              </button>
              <button onClick={() => setShowSessionModal(true)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition">
                🚀 Start Session
              </button>
            </div>

            {selectedEvent.rounds?.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center">
                <p className="text-gray-400">No rounds yet. Add your first round!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {selectedEvent.rounds?.map((round, roundIndex) => (
                  <div key={round.id} className="bg-gray-800 rounded-xl p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold text-white">{round.name}</h3>
                      <button onClick={() => openAddQuestion(round.id)} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition">
                        + Add Question
                      </button>
                    </div>
                    {round.questions?.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No questions in this round</p>
                    ) : (
                      <div className="space-y-3">
                        {round.questions?.map((question, qIndex) => (
                          <div key={question.id} className="bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                                question.type === 'BLIND_TEST' ? 'bg-purple-600' :
                                question.type === 'BUZZER' ? 'bg-red-600' :
                                question.type === 'IMAGE' ? 'bg-blue-600' :
                                question.type === 'TRUE_FALSE' ? 'bg-yellow-600' :
                                'bg-green-600'
                              } text-white`}>
                                {question.type === 'BLIND_TEST' ? '🎵' :
                                 question.type === 'BUZZER' ? '🔔' :
                                 question.type === 'IMAGE' ? '🖼️' :
                                 question.type === 'TRUE_FALSE' ? '⚖️' :
                                 qIndex + 1}
                              </span>
                              <div>
                                <p className="text-white font-medium flex items-center gap-2">
                                  {question.text}
                                  {question.mediaUrl && <span className="text-purple-400 text-xs bg-purple-500/20 px-2 py-0.5 rounded">📎 media</span>}
                                </p>
                                <p className="text-gray-400 text-sm">
                                  {question.type === 'BLIND_TEST' ? 'Blindtest' :
                                   question.type === 'TRUE_FALSE' ? 'Vrai/Faux' :
                                   question.type === 'IMAGE' ? 'Image' :
                                   question.type === 'BUZZER' ? 'Buzzer' : 'QCM'} • {question.points} pts • {question.timeLimit}s
                                </p>
                              </div>
                            </div>
                            <div className="flex space-x-2">
                              <button onClick={() => openEditQuestion(question)} className="text-gray-400 hover:text-white transition">✏️</button>
                              <button onClick={() => deleteQuestion(question.id)} className="text-gray-400 hover:text-red-400 transition">🗑️</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white">Sessions</h2>
            {sessions.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-12 text-center">
                <p className="text-6xl mb-4">📡</p>
                <p className="text-gray-400 text-lg">No sessions yet. Start one from an event!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="bg-gray-800 rounded-xl p-6 flex items-center justify-between">
                    <div className="flex items-center space-x-6">
                      <div className="bg-gradient-to-br from-purple-600 to-pink-600 text-white px-6 py-4 rounded-xl font-mono text-2xl font-bold tracking-widest">
                        {session.code}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{session.event?.name || 'Unknown Event'}</p>
                        <p className="text-gray-400 text-sm">{session._count?.teams || 0} teams</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                        session.status === 'IN_PROGRESS' ? 'bg-green-500/20 text-green-400' :
                        session.status === 'LOBBY' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {session.status}
                      </span>
                      <a href={`http://91.134.135.247:3002?session=${session.id}`} target="_blank"
                        className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition">
                        Open Studio
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white">Users</h2>
            <div className="bg-gray-800 rounded-xl p-6 space-y-3">
              <div className="bg-gray-700/50 rounded-lg p-4 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">AU</div>
                  <div>
                    <p className="text-white font-medium">Admin User</p>
                    <p className="text-gray-400 text-sm">admin@arena-event.com</p>
                  </div>
                </div>
                <span className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded-full text-sm">SUPER_ADMIN</span>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4 flex justify-between items-center">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">OU</div>
                  <div>
                    <p className="text-white font-medium">Organizer User</p>
                    <p className="text-gray-400 text-sm">organizer@arena-event.com</p>
                  </div>
                </div>
                <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm">ORGANIZER</span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-lg max-h-[90vh] overflow-auto">
            <h3 className="text-2xl font-bold text-white mb-6">{editingEvent ? 'Edit Event' : 'Create Event'}</h3>
            {modalError && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                <p className="text-red-200 text-sm">{modalError}</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Event Name</label>
                <input type="text" value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="My Quiz Event" />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-2">Description</label>
                <textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 h-24"
                  placeholder="Describe your event..." />
              </div>

            </div>
            <div className="flex space-x-4 mt-6">
              <button onClick={() => { setShowEventModal(false); setEditingEvent(null); setModalError(''); }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition" disabled={modalLoading}>Cancel</button>
              <button onClick={editingEvent ? updateEvent : createEvent}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl transition disabled:opacity-50" disabled={modalLoading}>
                {modalLoading ? 'Saving...' : (editingEvent ? 'Save Changes' : 'Create Event')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-auto">
            <h3 className="text-2xl font-bold text-white mb-6">{editingQuestion ? 'Edit Question' : 'Add Question'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-2">Question Text</label>
                <textarea value={questionForm.text} onChange={(e) => setQuestionForm({ ...questionForm, text: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 h-24" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Type</label>
                  <select value={questionForm.type} onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white">
                    <option value="MCQ">Multiple Choice</option>
                    <option value="TRUE_FALSE">True/False</option>
                    <option value="BUZZER">Buzzer</option>
                    <option value="BLIND_TEST">Blindtest Musical</option>
                    <option value="IMAGE">Image</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Points</label>
                  <input type="number" value={questionForm.points} onChange={(e) => setQuestionForm({ ...questionForm, points: parseInt(e.target.value) || 100 })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Time (sec)</label>
                  <input type="number" value={questionForm.timeLimit} onChange={(e) => setQuestionForm({ ...questionForm, timeLimit: parseInt(e.target.value) || 30 })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white" />
                </div>
              </div>

              {/* Optional background music for non-blindtest questions */}
              {questionForm.type !== 'BLIND_TEST' && questionForm.type !== 'IMAGE' && (
                <div className="p-4 bg-gray-700/30 rounded-xl border border-gray-600">
                  <label className="block text-sm text-gray-300 mb-2">Background Music (optional)</label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-xl text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:cursor-pointer file:text-xs"
                    />
                    {uploadingAudio && <span className="text-purple-400 text-sm">Uploading...</span>}
                  </div>
                  {questionForm.mediaUrl && (
                    <div className="mt-3 p-3 bg-gray-700/50 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-green-400 text-sm">Audio uploaded!</p>
                        <button
                          type="button"
                          onClick={() => setQuestionForm({ ...questionForm, mediaUrl: '', questionCueStart: null, questionCueEnd: null })}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >Remove</button>
                      </div>
                      <audio
                        id="bgMusicAudio"
                        controls
                        src={questionForm.mediaUrl}
                        className="w-full"
                        onLoadedMetadata={(e) => setAudioDuration((e.target as HTMLAudioElement).duration)}
                      />
                      {audioDuration > 0 && (
                        <div className="space-y-2 pt-2 border-t border-gray-600">
                          <p className="text-purple-300 text-xs font-semibold">Question Cue Point (when to play during question)</p>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Start (sec)</label>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max={audioDuration}
                                  value={questionForm.questionCueStart ?? ''}
                                  onChange={(e) => setQuestionForm({ ...questionForm, questionCueStart: e.target.value ? parseFloat(e.target.value) : null })}
                                  className="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs"
                                  placeholder="0"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const audio = document.getElementById('bgMusicAudio') as HTMLAudioElement;
                                    if (audio) setQuestionForm({ ...questionForm, questionCueStart: Math.round(audio.currentTime * 10) / 10 });
                                  }}
                                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
                                >Now</button>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">End (sec)</label>
                              <div className="flex items-center space-x-2">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max={audioDuration}
                                  value={questionForm.questionCueEnd ?? ''}
                                  onChange={(e) => setQuestionForm({ ...questionForm, questionCueEnd: e.target.value ? parseFloat(e.target.value) : null })}
                                  className="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs"
                                  placeholder={audioDuration.toFixed(1)}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const audio = document.getElementById('bgMusicAudio') as HTMLAudioElement;
                                    if (audio) setQuestionForm({ ...questionForm, questionCueEnd: Math.round(audio.currentTime * 10) / 10 });
                                  }}
                                  className="px-2 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs"
                                >Now</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {questionForm.type === 'MCQ' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {['A', 'B', 'C', 'D'].map((letter, i) => (
                      <div key={letter}>
                        <label className="block text-sm text-gray-300 mb-2">Option {letter}</label>
                        <input type="text" value={questionForm.options[i]}
                          onChange={(e) => {
                            const newOptions = [...questionForm.options];
                            newOptions[i] = e.target.value;
                            setQuestionForm({ ...questionForm, options: newOptions });
                          }}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Correct Answer</label>
                    <select value={questionForm.correctAnswer} onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white">
                      {['A', 'B', 'C', 'D'].map((letter) => (
                        <option key={letter} value={letter}>{letter}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              {questionForm.type === 'TRUE_FALSE' && (
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Correct Answer</label>
                  <select value={questionForm.correctAnswer} onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white">
                    <option value="TRUE">True</option>
                    <option value="FALSE">False</option>
                  </select>
                </div>
              )}
              {questionForm.type === 'BLIND_TEST' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Audio File</label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="file"
                        accept="audio/*"
                        onChange={handleAudioUpload}
                        className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:cursor-pointer"
                      />
                      {uploadingAudio && <span className="text-purple-400">Uploading...</span>}
                    </div>
                    {questionForm.mediaUrl && (
                      <div className="mt-2 p-3 bg-gray-700/50 rounded-lg space-y-3">
                        <p className="text-green-400 text-sm">Audio uploaded!</p>
                        <audio
                          id="cuePointAudio"
                          controls
                          src={questionForm.mediaUrl}
                          className="w-full"
                          onLoadedMetadata={(e) => setAudioDuration((e.target as HTMLAudioElement).duration)}
                        />
                        {audioDuration > 0 && (
                          <div className="space-y-3 pt-2 border-t border-gray-600">
                            <p className="text-purple-300 text-sm font-semibold">Cue Points (seconds)</p>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Question Start</label>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max={audioDuration}
                                    value={questionForm.questionCueStart ?? ''}
                                    onChange={(e) => setQuestionForm({ ...questionForm, questionCueStart: e.target.value ? parseFloat(e.target.value) : null })}
                                    className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm"
                                    placeholder="0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const audio = document.getElementById('cuePointAudio') as HTMLAudioElement;
                                      if (audio) setQuestionForm({ ...questionForm, questionCueStart: Math.round(audio.currentTime * 10) / 10 });
                                    }}
                                    className="px-2 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs"
                                    title="Set to current time"
                                  >Now</button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Question End</label>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max={audioDuration}
                                    value={questionForm.questionCueEnd ?? ''}
                                    onChange={(e) => setQuestionForm({ ...questionForm, questionCueEnd: e.target.value ? parseFloat(e.target.value) : null })}
                                    className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm"
                                    placeholder={audioDuration.toFixed(1)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const audio = document.getElementById('cuePointAudio') as HTMLAudioElement;
                                      if (audio) setQuestionForm({ ...questionForm, questionCueEnd: Math.round(audio.currentTime * 10) / 10 });
                                    }}
                                    className="px-2 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-xs"
                                    title="Set to current time"
                                  >Now</button>
                                </div>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Reveal Start (refrain)</label>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max={audioDuration}
                                    value={questionForm.revealCueStart ?? ''}
                                    onChange={(e) => setQuestionForm({ ...questionForm, revealCueStart: e.target.value ? parseFloat(e.target.value) : null })}
                                    className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm"
                                    placeholder="0"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const audio = document.getElementById('cuePointAudio') as HTMLAudioElement;
                                      if (audio) setQuestionForm({ ...questionForm, revealCueStart: Math.round(audio.currentTime * 10) / 10 });
                                    }}
                                    className="px-2 py-2 bg-pink-600 hover:bg-pink-700 rounded-lg text-xs"
                                    title="Set to current time"
                                  >Now</button>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Reveal End</label>
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max={audioDuration}
                                    value={questionForm.revealCueEnd ?? ''}
                                    onChange={(e) => setQuestionForm({ ...questionForm, revealCueEnd: e.target.value ? parseFloat(e.target.value) : null })}
                                    className="flex-1 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm"
                                    placeholder={audioDuration.toFixed(1)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const audio = document.getElementById('cuePointAudio') as HTMLAudioElement;
                                      if (audio) setQuestionForm({ ...questionForm, revealCueEnd: Math.round(audio.currentTime * 10) / 10 });
                                    }}
                                    className="px-2 py-2 bg-pink-600 hover:bg-pink-700 rounded-lg text-xs"
                                    title="Set to current time"
                                  >Now</button>
                                </div>
                              </div>
                            </div>
                            <p className="text-gray-500 text-xs">Duration: {audioDuration.toFixed(1)}s - Use audio player to seek, then click "Now" to set cue points</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Correct Answer (Artist - Song Title)</label>
                    <input
                      type="text"
                      value={questionForm.correctAnswer}
                      onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white"
                      placeholder="A-ha - Take On Me"
                    />
                  </div>
                </div>
              )}
              {questionForm.type === 'BUZZER' && (
                <div>
                  <label className="block text-sm text-gray-300 mb-2">Correct Answer</label>
                  <input
                    type="text"
                    value={questionForm.correctAnswer}
                    onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white"
                    placeholder="The expected answer..."
                  />
                </div>
              )}
              {questionForm.type === 'IMAGE' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Image File</label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingAudio(true);
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const base64 = reader.result as string;
                            const res = await fetch(`${API_URL}/api/upload`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ filename: file.name, data: base64, type: 'images' }),
                            });
                            const data = await res.json();
                            if (res.ok) setQuestionForm(prev => ({ ...prev, mediaUrl: data.url }));
                            setUploadingAudio(false);
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer"
                      />
                      {uploadingAudio && <span className="text-blue-400">Uploading...</span>}
                    </div>
                    {questionForm.mediaUrl && (
                      <div className="mt-2 p-3 bg-gray-700/50 rounded-lg">
                        <p className="text-green-400 text-sm mb-2">Image uploaded!</p>
                        <img src={questionForm.mediaUrl} alt="Preview" className="max-h-48 rounded-lg" />
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {['A', 'B', 'C', 'D'].map((letter, i) => (
                      <div key={letter}>
                        <label className="block text-sm text-gray-300 mb-2">Option {letter}</label>
                        <input type="text" value={questionForm.options[i]}
                          onChange={(e) => {
                            const newOptions = [...questionForm.options];
                            newOptions[i] = e.target.value;
                            setQuestionForm({ ...questionForm, options: newOptions });
                          }}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white" />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Correct Answer</label>
                    <select value={questionForm.correctAnswer} onChange={(e) => setQuestionForm({ ...questionForm, correctAnswer: e.target.value })}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-xl text-white">
                      {['A', 'B', 'C', 'D'].map((letter) => (
                        <option key={letter} value={letter}>{letter}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="flex space-x-4 mt-6">
              <button onClick={() => { setShowQuestionModal(false); setEditingQuestion(null); }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition">Cancel</button>
              <button onClick={editingQuestion ? updateQuestion : createQuestion}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl transition">
                {editingQuestion ? 'Save Changes' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {showSessionModal && selectedEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-8 w-full max-w-md">
            <h3 className="text-2xl font-bold text-white mb-6">Start Session</h3>
            <p className="text-gray-400 mb-6">Create a new game session for "{selectedEvent.name}"?</p>
            <div className="flex space-x-4">
              <button onClick={() => setShowSessionModal(false)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition">Cancel</button>
              <button onClick={() => createSession(selectedEvent.id)}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl transition">Start Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
