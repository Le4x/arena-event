import {
  Role,
  SessionStatus,
  GamePhase,
  QuestionType,
  GameEventType,
  JokerType,
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

// ============================================
// Final Mode Types
// ============================================

/**
 * Final mode configuration and state
 */
export interface FinalMode {
  id: string;
  gameStateId: string;
  isActive: boolean;
  finalistCount: number;  // 2, 4, 6, or 8
  currentQuestion: number;
  totalQuestions: number;
  startedAt?: Date;
  endedAt?: Date;
  finalists: Finalist[];
}

/**
 * Finalist entity - team in final mode
 */
export interface Finalist {
  id: string;
  finalModeId: string;
  teamId: string;
  teamName?: string;
  initialScore: number;
  finalScore: number;
  position?: number;
  isEliminated: boolean;
  eliminatedAt?: Date;
  jokers: TeamJoker[];
}

/**
 * Team joker for final mode
 */
export interface TeamJoker {
  id: string;
  finalistId: string;
  type: JokerType;
  isUsed: boolean;
  usedAt?: Date;
  questionId?: string;
  targetTeamId?: string;
  pointsEffect?: number;
}

/**
 * Active joker during a question
 */
export interface ActiveJoker {
  teamId: string;
  teamName: string;
  jokerType: JokerType;
  targetTeamId?: string;
  targetTeamName?: string;
}

/**
 * Final mode leaderboard entry
 */
export interface FinalLeaderboardEntry {
  teamId: string;
  teamName: string;
  initialScore: number;
  finalScore: number;
  totalScore: number;
  rank: number;
  isEliminated: boolean;
  availableJokers: JokerType[];
  usedJokers: JokerType[];
}

/**
 * Podium entry for final results
 */
export interface PodiumEntry {
  position: 1 | 2 | 3;
  teamId: string;
  teamName: string;
  totalScore: number;
  jokerBonus: number;
}

/**
 * Final mode start payload
 */
export interface StartFinalPayload {
  sessionId: string;
  finalistCount: 2 | 4 | 6 | 8;
  totalQuestions?: number;
}

/**
 * Joker activation payload
 */
export interface ActivateJokerPayload {
  sessionId: string;
  teamId: string;
  jokerType: JokerType;
  targetTeamId?: string;  // Required for STEAL joker
  questionId: string;
}
