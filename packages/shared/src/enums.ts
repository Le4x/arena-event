/**
 * User Roles with RBAC permissions
 */
export enum Role {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ORGANIZER = 'ORGANIZER',
  GAME_MASTER = 'GAME_MASTER',
}

/**
 * Session lifecycle states
 */
export enum SessionStatus {
  LOBBY = 'LOBBY',           // Waiting for players
  ACTIVE = 'ACTIVE',         // Game in progress
  PAUSED = 'PAUSED',         // Temporarily paused
  FINISHED = 'FINISHED',     // Completed
}

/**
 * Game phases for UI state management
 */
export enum GamePhase {
  LOBBY = 'LOBBY',
  ROUND_INTRO = 'ROUND_INTRO',
  QUESTION_DISPLAY = 'QUESTION_DISPLAY',
  QUESTION_ACTIVE = 'QUESTION_ACTIVE',
  QUESTION_REVEAL = 'QUESTION_REVEAL',
  LEADERBOARD = 'LEADERBOARD',
  FINAL = 'FINAL',
}

/**
 * Question types supported by the platform
 */
export enum QuestionType {
  MCQ = 'MCQ',               // Multiple Choice Question
  TEXT = 'TEXT',             // Free text answer
  BUZZER = 'BUZZER',         // Buzzer only
  BLIND_TEST = 'BLIND_TEST', // Audio blind test
  IMAGE = 'IMAGE',           // Image-based question
  TRUE_FALSE = 'TRUE_FALSE', // True/False question
}

/**
 * Audio play mode for questions with media
 */
export enum AudioPlayMode {
  BLINDTEST = 'blindtest',     // Audio plays during the question phase (default)
  REVEAL_ONLY = 'reveal_only', // Audio only plays during reveal (for music quiz)
}

/**
 * WebSocket event types for real-time communication
 */
export enum GameEventType {
  // Session events
  SESSION_STARTED = 'SESSION_STARTED',
  SESSION_PAUSED = 'SESSION_PAUSED',
  SESSION_RESUMED = 'SESSION_RESUMED',
  SESSION_FINISHED = 'SESSION_FINISHED',

  // Round events
  ROUND_STARTED = 'ROUND_STARTED',
  ROUND_FINISHED = 'ROUND_FINISHED',

  // Question events
  QUESTION_STARTED = 'QUESTION_STARTED',
  QUESTION_ENDED = 'QUESTION_ENDED',
  QUESTION_REVEALED = 'QUESTION_REVEALED',

  // Player actions
  PLAYER_JOINED = 'PLAYER_JOINED',
  PLAYER_LEFT = 'PLAYER_LEFT',
  TEAM_CREATED = 'TEAM_CREATED',
  TEAM_UPDATED = 'TEAM_UPDATED',

  // Answer events
  ANSWER_SUBMITTED = 'ANSWER_SUBMITTED',
  BUZZ = 'BUZZ',
  BUZZER_RESET = 'BUZZER_RESET',

  // Score events
  SCORE_UPDATED = 'SCORE_UPDATED',
  LEADERBOARD_SHOWN = 'LEADERBOARD_SHOWN',

  // Connection events
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  RECONNECTED = 'RECONNECTED',

  // Error events
  ERROR = 'ERROR',
}
