-- Arena Event Database Schema

-- Create enums
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ORGANIZER', 'GAME_MASTER');
CREATE TYPE "SessionStatus" AS ENUM ('LOBBY', 'ACTIVE', 'PAUSED', 'FINISHED');
CREATE TYPE "GamePhase" AS ENUM ('LOBBY', 'ROUND_INTRO', 'QUESTION_DISPLAY', 'QUESTION_ACTIVE', 'QUESTION_REVEAL', 'LEADERBOARD', 'FINAL');
CREATE TYPE "QuestionType" AS ENUM ('MCQ', 'TEXT', 'BUZZER', 'BLIND_TEST', 'IMAGE', 'TRUE_FALSE');

-- Users table
CREATE TABLE "users" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "email" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ORGANIZER',
    "firstName" TEXT,
    "lastName" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Events table
CREATE TABLE "events" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sessions table
CREATE TABLE "sessions" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "code" TEXT UNIQUE NOT NULL,
    "eventId" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
    "gameMasterId" TEXT REFERENCES "users"("id"),
    "status" "SessionStatus" NOT NULL DEFAULT 'LOBBY',
    "startedAt" TIMESTAMP,
    "endedAt" TIMESTAMP,
    "currentRoundId" TEXT,
    "currentQuestionId" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Game states table
CREATE TABLE "game_states" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "sessionId" TEXT UNIQUE NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
    "currentRoundId" TEXT,
    "currentQuestionId" TEXT,
    "questionStartedAt" TIMESTAMP,
    "questionEndsAt" TIMESTAMP,
    "buzzerLocked" BOOLEAN NOT NULL DEFAULT false,
    "buzzerWinner" TEXT,
    "phase" "GamePhase" NOT NULL DEFAULT 'LOBBY',
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Rounds table
CREATE TABLE "rounds" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "eventId" TEXT NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE ("eventId", "order")
);

-- Questions table
CREATE TABLE "questions" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "roundId" TEXT NOT NULL REFERENCES "rounds"("id") ON DELETE CASCADE,
    "type" "QuestionType" NOT NULL,
    "content" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "questionCueStart" DOUBLE PRECISION,
    "questionCueEnd" DOUBLE PRECISION,
    "revealCueStart" DOUBLE PRECISION,
    "revealCueEnd" DOUBLE PRECISION,
    "timeLimit" INTEGER NOT NULL DEFAULT 30,
    "points" INTEGER NOT NULL DEFAULT 100,
    "order" INTEGER NOT NULL,
    "choices" JSONB,
    "correctAnswer" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE ("roundId", "order")
);

-- Teams table
CREATE TABLE "teams" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "sessionId" TEXT NOT NULL REFERENCES "sessions"("id") ON DELETE CASCADE,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE ("sessionId", "name")
);

-- Player devices table
CREATE TABLE "player_devices" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
    "socketId" TEXT,
    "lastSeen" TIMESTAMP NOT NULL DEFAULT NOW(),
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Answers table
CREATE TABLE "answers" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "questionId" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
    "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
    "content" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "points" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE ("questionId", "teamId")
);

-- Buzzer presses table
CREATE TABLE "buzzer_presses" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "questionId" TEXT NOT NULL REFERENCES "questions"("id") ON DELETE CASCADE,
    "teamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
    "rank" INTEGER NOT NULL,
    "pressedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE ("questionId", "teamId"),
    UNIQUE ("questionId", "rank")
);

-- Create indexes
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "events_ownerId_idx" ON "events"("ownerId");
CREATE INDEX "sessions_code_idx" ON "sessions"("code");
CREATE INDEX "sessions_eventId_idx" ON "sessions"("eventId");
CREATE INDEX "sessions_status_idx" ON "sessions"("status");
CREATE INDEX "rounds_eventId_idx" ON "rounds"("eventId");
CREATE INDEX "questions_roundId_idx" ON "questions"("roundId");
CREATE INDEX "teams_sessionId_idx" ON "teams"("sessionId");
CREATE INDEX "player_devices_teamId_idx" ON "player_devices"("teamId");
CREATE INDEX "player_devices_socketId_idx" ON "player_devices"("socketId");
CREATE INDEX "answers_questionId_idx" ON "answers"("questionId");
CREATE INDEX "answers_teamId_idx" ON "answers"("teamId");
CREATE INDEX "buzzer_presses_questionId_idx" ON "buzzer_presses"("questionId");
CREATE INDEX "buzzer_presses_teamId_idx" ON "buzzer_presses"("teamId");

-- Create Prisma migrations table (for compatibility)
CREATE TABLE "_prisma_migrations" (
    "id" TEXT PRIMARY KEY,
    "checksum" TEXT NOT NULL,
    "finished_at" TIMESTAMP,
    "migration_name" TEXT NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMP,
    "started_at" TIMESTAMP NOT NULL DEFAULT NOW(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);
