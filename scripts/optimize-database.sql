-- Arena Event - Database Optimization Script
-- Adds indexes for frequently queried columns to improve performance

-- Session lookups by code (most frequent operation)
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(code);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_event_id ON sessions("eventId");

-- Team lookups by session
CREATE INDEX IF NOT EXISTS idx_teams_session_id ON teams("sessionId");
CREATE INDEX IF NOT EXISTS idx_teams_session_name ON teams("sessionId", name);

-- Player devices by team
CREATE INDEX IF NOT EXISTS idx_player_devices_team_id ON player_devices("teamId");
CREATE INDEX IF NOT EXISTS idx_player_devices_socket_id ON player_devices("socketId");

-- Answers by question and team
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers("questionId");
CREATE INDEX IF NOT EXISTS idx_answers_team_id ON answers("teamId");
CREATE INDEX IF NOT EXISTS idx_answers_question_team ON answers("questionId", "teamId");

-- Buzzer presses by question
CREATE INDEX IF NOT EXISTS idx_buzzer_presses_question_id ON buzzer_presses("questionId");
CREATE INDEX IF NOT EXISTS idx_buzzer_presses_team_id ON buzzer_presses("teamId");
CREATE INDEX IF NOT EXISTS idx_buzzer_presses_question_rank ON buzzer_presses("questionId", rank);

-- Questions by round (for loading round data)
CREATE INDEX IF NOT EXISTS idx_questions_round_id ON questions("roundId");
CREATE INDEX IF NOT EXISTS idx_questions_round_order ON questions("roundId", "order");

-- Rounds by event
CREATE INDEX IF NOT EXISTS idx_rounds_event_id ON rounds("eventId");
CREATE INDEX IF NOT EXISTS idx_rounds_event_order ON rounds("eventId", "order");

-- Game state by session
CREATE INDEX IF NOT EXISTS idx_game_states_session_id ON game_states("sessionId");

-- User lookups by email (auth)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Events by owner
CREATE INDEX IF NOT EXISTS idx_events_owner_id ON events("ownerId");

-- Analyze tables for query planner optimization
ANALYZE users;
ANALYZE events;
ANALYZE sessions;
ANALYZE teams;
ANALYZE player_devices;
ANALYZE rounds;
ANALYZE questions;
ANALYZE answers;
ANALYZE buzzer_presses;
ANALYZE game_states;

-- Display index sizes
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(indexrelid) DESC;

-- Display table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
