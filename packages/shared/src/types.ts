import {
  Role,
  SessionStatus,
  GamePhase,
  QuestionType,
  GameEventType,
} from './enums';

/**
 * User entity
 */
export interface User {
  id: string;
  email: string;
  role: Role;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
}

/**
 * Event entity
 */
export interface Event {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session entity
 */
export interface Session {
  id: string;
  code: string;
  eventId: string;
  gameMasterId?: string;
  status: SessionStatus;
  startedAt?: Date;
  endedAt?: Date;
  currentRoundId?: string;
  currentQuestionId?: string;
}

/**
 * Round entity
 */
export interface Round {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  order: number;
  questions: Question[];
}

/**
 * Question entity
 */
export interface Question {
  id: string;
  roundId: string;
  type: QuestionType;
  content: string;
  mediaUrl?: string;
  timeLimit: number;
  points: number;
  order: number;
  choices?: string[];
  correctAnswer?: string;
  // Deezer integration
  deezerTrackId?: string;
  deezerPreviewUrl?: string;
  deezerArtist?: string;
  deezerTitle?: string;
  deezerCover?: string;
  // Audio play mode: 'blindtest' = play during question, 'reveal_only' = play only at reveal
  audioPlayMode?: 'blindtest' | 'reveal_only';
}

/**
 * Deezer track search result
 */
export interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  preview: string;
  artist: {
    id: number;
    name: string;
  };
  album: {
    id: number;
    title: string;
    cover: string;
    cover_medium: string;
    cover_big: string;
  };
}

/**
 * Team entity
 */
export interface Team {
  id: string;
  sessionId: string;
  name: string;
  score: number;
  createdAt: Date;
  deviceCount?: number;
}

/**
 * Player device entity
 */
export interface PlayerDevice {
  id: string;
  teamId: string;
  socketId?: string;
  lastSeen: Date;
}

/**
 * Answer entity
 */
export interface Answer {
  id: string;
  questionId: string;
  teamId: string;
  content: string;
  isCorrect?: boolean;
  points: number;
  submittedAt: Date;
}

/**
 * Buzzer press entity
 */
export interface BuzzerPress {
  id: string;
  questionId: string;
  teamId: string;
  rank: number;
  pressedAt: Date;
}

/**
 * Game state entity
 */
export interface GameState {
  id: string;
  sessionId: string;
  currentRoundId?: string;
  currentQuestionId?: string;
  questionStartedAt?: Date;
  questionEndsAt?: Date;
  buzzerLocked: boolean;
  buzzerWinner?: string;
  phase: GamePhase;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  teamId: string;
  teamName: string;
  score: number;
  rank: number;
}

/**
 * WebSocket Game Event
 */
export interface GameEvent<T = any> {
  type: GameEventType;
  sessionId: string;
  timestamp: Date;
  payload: T;
}

/**
 * Connection metadata
 */
export interface ConnectionMetadata {
  deviceId?: string;
  teamId?: string;
  role?: 'player' | 'gamemaster' | 'screen';
}
