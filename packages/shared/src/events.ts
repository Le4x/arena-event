import { GameEventType } from './enums';
import { GameEvent, Team, Question, LeaderboardEntry } from './types';

/**
 * Session Event Payloads
 */
export interface SessionStartedPayload {
  sessionId: string;
  eventName: string;
}

export interface SessionPausedPayload {
  sessionId: string;
}

export interface SessionResumedPayload {
  sessionId: string;
}

export interface SessionFinishedPayload {
  sessionId: string;
  winner?: LeaderboardEntry;
  leaderboard: LeaderboardEntry[];
}

/**
 * Round Event Payloads
 */
export interface RoundStartedPayload {
  roundId: string;
  roundName: string;
  questionCount: number;
}

export interface RoundFinishedPayload {
  roundId: string;
  leaderboard: LeaderboardEntry[];
}

/**
 * Question Event Payloads
 */
export interface QuestionStartedPayload {
  question: Question;
  endsAt: Date;
}

export interface QuestionEndedPayload {
  questionId: string;
}

export interface QuestionRevealedPayload {
  questionId: string;
  correctAnswer?: string;
  leaderboard: LeaderboardEntry[];
}

/**
 * Player Event Payloads
 */
export interface PlayerJoinedPayload {
  teamId: string;
  teamName: string;
  deviceCount: number;
}

export interface PlayerLeftPayload {
  teamId: string;
  deviceCount: number;
}

export interface TeamCreatedPayload {
  team: Team;
}

export interface TeamUpdatedPayload {
  team: Team;
}

/**
 * Answer Event Payloads
 */
export interface AnswerSubmittedPayload {
  teamId: string;
  questionId: string;
  timestamp: Date;
}

export interface BuzzPayload {
  teamId: string;
  teamName: string;
  rank: number;
  timestamp: Date;
}

export interface BuzzerResetPayload {
  questionId: string;
}

/**
 * Score Event Payloads
 */
export interface ScoreUpdatedPayload {
  teamId: string;
  teamName: string;
  oldScore: number;
  newScore: number;
  delta: number;
  reason?: string;
}

export interface LeaderboardShownPayload {
  leaderboard: LeaderboardEntry[];
  isIntermediate: boolean;
}

/**
 * Connection Event Payloads
 */
export interface ConnectedPayload {
  deviceId: string;
  teamId?: string;
}

export interface DisconnectedPayload {
  deviceId: string;
  teamId?: string;
}

export interface ReconnectedPayload {
  deviceId: string;
  teamId?: string;
}

/**
 * Error Event Payloads
 */
export interface ErrorPayload {
  code: string;
  message: string;
  details?: any;
}

/**
 * Type-safe event creators
 */
export const createGameEvent = <T>(
  type: GameEventType,
  sessionId: string,
  payload: T,
): GameEvent<T> => ({
  type,
  sessionId,
  timestamp: new Date(),
  payload,
});
