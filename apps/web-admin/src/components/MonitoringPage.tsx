'use client';

import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.arena-event.fr';

interface LogEntry {
  timestamp: string;
  level: string;
  category: string;
  message: string;
  data: any;
  emoji: string;
  color: string;
  label: string;
}

interface Stats {
  uptime: number;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  activeSessions: number;
  totalConnectedTeams: number;
  activeTimers: number;
  buzzerStates: number;
  finaleStates: number;
  logCount: number;
  sessions: Array<{
    sessionId: string;
    connectedTeams: string[];
    teamCount: number;
  }>;
  timestamp: string;
}

interface MonitoringPageProps {
  token: string;
  user: { id: string; role: string };
}

export default function MonitoringPage({ token, user }: MonitoringPageProps) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Connect to monitoring WebSocket
  useEffect(() => {
    if (user.role !== 'SUPER_ADMIN') return;

    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Monitoring socket connected');
      setIsConnected(true);
      socket.emit('join-monitoring', { userId: user.id, role: user.role });
    });

    socket.on('disconnect', () => {
      console.log('❌ Monitoring socket disconnected');
      setIsConnected(false);
    });

    socket.on('monitoring-logs', (data) => {
      setLogs(data.logs);
    });

    socket.on('log-entry', (entry: LogEntry) => {
      setLogs((prev) => [...prev, entry].slice(-1000));
    });

    socket.on('monitoring-stats', (newStats: Stats) => {
      setStats(newStats);
    });

    socket.on('monitoring-error', (data) => {
      console.error('Monitoring error:', data.error);
    });

    // Fetch stats every 5 seconds
    const statsInterval = setInterval(() => {
      if (socket.connected) {
        fetch(`${API_URL}/api/monitoring/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((data) => setStats(data))
          .catch((err) => console.error('Failed to fetch stats:', err));
      }
    }, 5000);

    return () => {
      clearInterval(statsInterval);
      socket.disconnect();
    };
  }, [user, token]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
    if (filterCategory !== 'ALL' && log.category !== filterCategory) return false;
    return true;
  });

  // Format uptime
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours}h ${minutes}m ${secs}s`;
  };

  // Format memory
  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  // Get color for log level
  const getLevelColor = (level: string) => {
    const colors: Record<string, string> = {
      INFO: 'text-blue-400',
      SUCCESS: 'text-green-400',
      WARNING: 'text-yellow-400',
      ERROR: 'text-red-400',
      DEBUG: 'text-gray-400',
      WEBSOCKET: 'text-purple-400',
      TEAM: 'text-cyan-400',
      SESSION: 'text-magenta-400',
    };
    return colors[level] || 'text-white';
  };

  if (user.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
          <p className="text-gray-400">This page is only accessible to SUPER_ADMIN users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white">System Monitoring</h2>
          <p className="text-gray-400 mt-1">Real-time logs and system statistics</p>
        </div>
        <div className="flex items-center space-x-2">
          <div
            className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}
          />
          <span className="text-sm text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Uptime</div>
            <div className="text-2xl font-bold text-white">{formatUptime(stats.uptime)}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Memory Used</div>
            <div className="text-2xl font-bold text-white">{formatMemory(stats.memory.heapUsed)}</div>
            <div className="text-xs text-gray-500">of {formatMemory(stats.memory.heapTotal)}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Active Sessions</div>
            <div className="text-2xl font-bold text-white">{stats.activeSessions}</div>
          </div>
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <div className="text-sm text-gray-400 mb-1">Connected Teams</div>
            <div className="text-2xl font-bold text-white">{stats.totalConnectedTeams}</div>
          </div>
        </div>
      )}

      {/* Session Details */}
      {stats && stats.sessions.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <h3 className="text-lg font-bold text-white mb-3">Active Sessions</h3>
          <div className="space-y-2">
            {stats.sessions.map((session) => (
              <div
                key={session.sessionId}
                className="bg-gray-700 rounded-lg p-3 flex justify-between items-center"
              >
                <div>
                  <div className="text-sm font-medium text-white">Session {session.sessionId.slice(0, 8)}...</div>
                  <div className="text-xs text-gray-400">
                    {session.teamCount} team{session.teamCount !== 1 ? 's' : ''} connected
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  IDs: {session.connectedTeams.map((id) => id.slice(0, 4)).join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 flex items-center space-x-4">
        <div className="flex-1 flex items-center space-x-4">
          <label className="text-sm text-gray-400">Level:</label>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="bg-gray-700 text-white rounded px-3 py-1 text-sm border border-gray-600"
          >
            <option value="ALL">All</option>
            <option value="INFO">Info</option>
            <option value="SUCCESS">Success</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
            <option value="DEBUG">Debug</option>
            <option value="WEBSOCKET">WebSocket</option>
            <option value="TEAM">Team</option>
            <option value="SESSION">Session</option>
          </select>

          <label className="text-sm text-gray-400 ml-4">Category:</label>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="bg-gray-700 text-white rounded px-3 py-1 text-sm border border-gray-600"
          >
            <option value="ALL">All</option>
            <option value="GENERAL">General</option>
            <option value="REALTIME">Realtime</option>
            <option value="GAME">Game</option>
          </select>

          <button
            onClick={() => setLogs([])}
            className="ml-auto bg-red-600 hover:bg-red-700 text-white px-4 py-1 rounded text-sm"
          >
            Clear Logs
          </button>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-400">Auto-scroll</span>
          </label>
        </div>
      </div>

      {/* Logs */}
      <div className="flex-1 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
        <div className="bg-gray-800 px-4 py-2 border-b border-gray-700">
          <div className="text-sm font-medium text-gray-400">
            Logs ({filteredLogs.length} / {logs.length})
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 font-mono text-sm">
          {filteredLogs.map((log, index) => (
            <div
              key={index}
              className="py-1 px-2 hover:bg-gray-800 rounded border-l-2 border-transparent hover:border-purple-500 transition-colors"
            >
              <span className="text-gray-500 text-xs">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="ml-2">{log.emoji}</span>
              <span className={`ml-2 font-semibold ${getLevelColor(log.level)}`}>[{log.level}]</span>
              <span className="ml-2 text-white">{log.message}</span>
              {log.data && (
                <div className="ml-8 mt-1 text-xs text-gray-400 bg-gray-800 rounded p-2">
                  {JSON.stringify(log.data, null, 2)}
                </div>
              )}
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
