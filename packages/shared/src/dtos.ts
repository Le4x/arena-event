import { z } from 'zod';
import { Role, SessionStatus, QuestionType, GamePhase } from './enums';

/**
 * Authentication DTOs
 */
export const LoginDto = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const RegisterDto = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.nativeEnum(Role).default(Role.ORGANIZER),
});

export type LoginDto = z.infer<typeof LoginDto>;
export type RegisterDto = z.infer<typeof RegisterDto>;

/**
 * Event DTOs
 */
export const CreateEventDto = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export const UpdateEventDto = CreateEventDto.partial();

export type CreateEventDto = z.infer<typeof CreateEventDto>;
export type UpdateEventDto = z.infer<typeof UpdateEventDto>;

/**
 * Session DTOs
 */
export const CreateSessionDto = z.object({
  eventId: z.string().uuid(),
  gameMasterId: z.string().uuid().optional(),
});

export const UpdateSessionDto = z.object({
  status: z.nativeEnum(SessionStatus).optional(),
  gameMasterId: z.string().uuid().optional(),
});

export const JoinSessionDto = z.object({
  code: z.string().length(6),
  teamName: z.string().min(1).max(50).optional(),
  teamId: z.string().uuid().optional(),
});

export type CreateSessionDto = z.infer<typeof CreateSessionDto>;
export type UpdateSessionDto = z.infer<typeof UpdateSessionDto>;
export type JoinSessionDto = z.infer<typeof JoinSessionDto>;

/**
 * Round DTOs
 */
export const CreateRoundDto = z.object({
  eventId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().min(0),
});

export const UpdateRoundDto = CreateRoundDto.partial().omit({ eventId: true });

export type CreateRoundDto = z.infer<typeof CreateRoundDto>;
export type UpdateRoundDto = z.infer<typeof UpdateRoundDto>;

/**
 * Question DTOs
 */
export const CreateQuestionDto = z.object({
  roundId: z.string().uuid(),
  type: z.nativeEnum(QuestionType),
  content: z.string().min(1),
  mediaUrl: z.string().url().optional(),
  timeLimit: z.number().int().min(5).max(300),
  points: z.number().int().min(0).default(100),
  order: z.number().int().min(0),
  choices: z.array(z.string()).optional(),
  correctAnswer: z.string().optional(),
});

export const UpdateQuestionDto = CreateQuestionDto.partial().omit({ roundId: true });

export type CreateQuestionDto = z.infer<typeof CreateQuestionDto>;
export type UpdateQuestionDto = z.infer<typeof UpdateQuestionDto>;

/**
 * Team DTOs
 */
export const CreateTeamDto = z.object({
  sessionId: z.string().uuid(),
  name: z.string().min(1).max(50),
});

export const UpdateTeamDto = z.object({
  name: z.string().min(1).max(50).optional(),
  score: z.number().int().optional(),
});

export type CreateTeamDto = z.infer<typeof CreateTeamDto>;
export type UpdateTeamDto = z.infer<typeof UpdateTeamDto>;

/**
 * Answer DTOs
 */
export const SubmitAnswerDto = z.object({
  questionId: z.string().uuid(),
  teamId: z.string().uuid(),
  content: z.string(),
});

export type SubmitAnswerDto = z.infer<typeof SubmitAnswerDto>;

/**
 * Buzzer DTOs
 */
export const BuzzerPressDto = z.object({
  questionId: z.string().uuid(),
  teamId: z.string().uuid(),
});

export type BuzzerPressDto = z.infer<typeof BuzzerPressDto>;

/**
 * Game Control DTOs
 */
export const StartQuestionDto = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
});

export const EndQuestionDto = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
});

export const UpdateScoreDto = z.object({
  teamId: z.string().uuid(),
  delta: z.number().int(),
  reason: z.string().optional(),
});

export type StartQuestionDto = z.infer<typeof StartQuestionDto>;
export type EndQuestionDto = z.infer<typeof EndQuestionDto>;
export type UpdateScoreDto = z.infer<typeof UpdateScoreDto>;
