/**
 * Session code generation
 */
export const SESSION_CODE_LENGTH = 6;
export const SESSION_CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars

/**
 * Default game settings
 */
export const DEFAULT_QUESTION_TIME_LIMIT = 30; // seconds
export const DEFAULT_QUESTION_POINTS = 100;
export const SPEED_BONUS_MAX = 50; // Maximum bonus points for fast answers
export const BUZZER_LOCK_DURATION = 5000; // ms after first buzz

/**
 * Connection settings
 */
export const RECONNECTION_TIMEOUT = 30000; // 30 seconds
export const HEARTBEAT_INTERVAL = 10000; // 10 seconds
export const MAX_DEVICES_PER_TEAM = 5;

/**
 * Validation limits
 */
export const MAX_TEAM_NAME_LENGTH = 50;
export const MAX_QUESTION_CONTENT_LENGTH = 1000;
export const MAX_ANSWER_LENGTH = 500;
export const MAX_TEAMS_PER_SESSION = 100;
export const MAX_QUESTIONS_PER_ROUND = 50;

/**
 * WebSocket namespaces
 */
export const WS_NAMESPACE_GAME = '/game';
export const WS_NAMESPACE_ADMIN = '/admin';
