# 🏗️ Arena Event - Architecture Documentation

This document provides a comprehensive overview of the Arena Event platform architecture.

---

## 📐 System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Admin Dashboard]  [Studio/Régie]  [Player PWA]  [Screen]     │
│    (Next.js)          (Next.js)      (Next.js)    (Next.js)    │
│       :3000              :3002          :3003        :3004      │
│                                                                  │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ HTTP REST + WebSocket
             │
┌────────────▼────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    NestJS API (:3001)                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Auth  │  Events  │  Sessions  │  Game  │  Realtime    │  │
│  │  Users │  Rounds  │  Questions │  Teams │  WebSocket   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└────────────┬────────────────────────────────────────────────────┘
             │
             │ TCP/SQL + Redis Pub/Sub
             │
┌────────────▼────────────────────────────────────────────────────┐
│                       DATA LAYER                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐            │
│  │   PostgreSQL     │         │      Redis       │            │
│  │   :5432          │         │      :6379       │            │
│  │                  │         │                  │            │
│  │  - Users         │         │  - Session State │            │
│  │  - Events        │         │  - Pub/Sub       │            │
│  │  - Sessions      │         │  - Cache         │            │
│  │  - Questions     │         │                  │            │
│  │  - Teams/Answers │         │                  │            │
│  └──────────────────┘         └──────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Design Principles

### 1. **Separation of Concerns**
- Each frontend serves a specific role
- Backend modules are decoupled and focused
- Shared code is extracted to packages

### 2. **Real-Time First**
- WebSocket for live updates
- Optimistic UI updates
- Server as source of truth

### 3. **Scalability**
- Stateless API design
- Redis for distributed state
- Horizontal scaling ready

### 4. **Security**
- JWT authentication
- Role-based access control
- Input validation at all layers

### 5. **Developer Experience**
- TypeScript everywhere
- Shared types between frontend/backend
- Monorepo for easy development

---

## 🧩 Module Breakdown

### Backend Modules

#### **Auth Module**
- JWT token generation and validation
- Password hashing (bcrypt)
- Login/register/profile endpoints
- Guards and decorators for protected routes

**Key Files:**
- `auth.service.ts` - Authentication logic
- `jwt.strategy.ts` - Passport JWT strategy
- `roles.guard.ts` - RBAC authorization

#### **Users Module**
- User CRUD operations
- Profile management
- Role assignment

#### **Events Module**
- Event creation and management
- Ownership validation
- Nested rounds and sessions

#### **Sessions Module**
- Session lifecycle management
- Unique code generation (6-char alphanumeric)
- Status transitions (LOBBY → ACTIVE → FINISHED)

#### **Rounds Module**
- Question grouping
- Ordering management
- Cascade deletion

#### **Questions Module**
- Multiple question types support
- Media URL storage (for audio/images)
- Correct answer storage for auto-scoring

#### **Teams Module**
- Team creation and joining
- Score tracking
- Device management (multi-device per team)

#### **Game Module**
The core game logic module.

**Services:**
- `game.service.ts` - Question flow, answers, buzzers
- `scoring.service.ts` - Point calculation, speed bonus
- `state.manager.ts` - Game state transitions

**Key Functions:**
- `startQuestion()` - Initializes question timer
- `endQuestion()` - Locks answers
- `submitAnswer()` - Records answer + auto-score
- `pressBuzzer()` - Ranks buzz attempts
- `resetBuzzer()` - Clears buzzer state

#### **Realtime Module**
WebSocket Gateway for live communication.

**Socket Events:**
- Client → Server: `join_session`, `submit_answer`, `buzzer_press`
- Server → Client: `question_started`, `buzz`, `score_updated`

**Room Management:**
- Each session has its own Socket.IO room
- Players, GameMasters, and Screens join appropriate rooms
- Broadcast updates to room participants only

---

## 🔄 Data Flow Examples

### Starting a Question

```
1. GameMaster clicks "Start Question" in Studio
2. Studio sends WebSocket event: start_question
3. Backend GameService:
   - Updates GameState with questionStartedAt, questionEndsAt
   - Sets phase to QUESTION_ACTIVE
4. Backend broadcasts to session room: question_started
5. All clients receive event:
   - Player: Shows question + answer buttons + timer
   - Screen: Displays question + timer
   - Studio: Shows "Question Active" state
```

### Submitting an Answer

```
1. Player selects answer and clicks submit
2. Player app sends WebSocket event: submit_answer
3. Backend GameService:
   - Validates question is still active
   - Creates Answer record
   - Auto-scores if MCQ/TRUE_FALSE
   - Updates team score if correct
4. Backend emits to GameMaster: answer_submitted
5. Backend emits to Player: answer_received (confirmation)
6. If score changed, broadcast to room: score_updated
```

### Buzzer Press

```
1. Player presses buzzer button
2. Player app sends WebSocket event: buzzer_press
3. Backend GameService:
   - Checks if buzzer is locked
   - Records BuzzerPress with rank (1, 2, 3...)
   - If rank=1, locks buzzer and sets buzzerWinner
4. Backend broadcasts to room: buzz (with team name, rank)
5. All clients show buzzer result:
   - Screen: Big animation with team name
   - Studio: Shows who buzzed first
   - Other Players: Shows "Too late" if not first
```

---

## 💾 Database Schema Design

### Relational Model

```
User (1) ──── (*) Event
                │
                ├─── (*) Session
                │      │
                │      ├─── (*) Team
                │      │      │
                │      │      ├─── (*) PlayerDevice
                │      │      ├─── (*) Answer
                │      │      └─── (*) BuzzerPress
                │      │
                │      └─── (1) GameState
                │
                └─── (*) Round
                       │
                       └─── (*) Question
                              │
                              ├─── (*) Answer
                              └─── (*) BuzzerPress
```

### Key Design Decisions

**Session Codes:**
- Stored as unique string
- Generated using nanoid with custom alphabet
- No ambiguous characters (O/0, I/1/l)

**Answers:**
- `questionId + teamId` unique constraint (one answer per team per question)
- `isCorrect` nullable for manual grading
- `points` stored for historical tracking

**Buzzer Presses:**
- `questionId + teamId` unique constraint (one buzz per team per question)
- `questionId + rank` unique constraint (ensures rank uniqueness)
- `rank` determines order of buzzes

**Game State:**
- One-to-one with Session
- Stores current question, round, timers
- `buzzerLocked` prevents multiple buzzers
- `buzzerWinner` tracks first buzzer

---

## 🔌 API Design Patterns

### RESTful Endpoints

**Resource-based URLs:**
- `GET /events` - List
- `GET /events/:id` - Detail
- `POST /events` - Create
- `PUT /events/:id` - Update
- `DELETE /events/:id` - Delete

**Nested Resources:**
- `GET /sessions?eventId=xxx` - Filter by event
- `GET /questions?roundId=xxx` - Filter by round

**Action Endpoints:**
- `POST /game/question/start` - Start question
- `POST /game/buzzer/reset` - Reset buzzer

### WebSocket Events

**Event Naming:**
- Lowercase with underscores
- Verb_noun pattern: `submit_answer`, `start_question`

**Payload Structure:**
```typescript
{
  type: 'QUESTION_STARTED',
  sessionId: 'uuid',
  timestamp: Date,
  payload: { ... }
}
```

---

## 🚀 Performance Optimizations

### Backend

1. **Database Indexing**
   - Indexed foreign keys
   - Indexed frequently queried fields (session.code, user.email)

2. **Connection Pooling**
   - Prisma handles connection pooling
   - Configurable pool size

3. **Caching**
   - Redis for session state
   - In-memory caching for static data

### Frontend

1. **Code Splitting**
   - Next.js automatic code splitting
   - Dynamic imports for heavy components

2. **Image Optimization**
   - Next.js Image component
   - WebP format with fallbacks

3. **Optimistic Updates**
   - Update UI immediately
   - Rollback on error

---

## 🔐 Security Architecture

### Authentication Flow

```
1. User submits credentials
2. Backend validates against database
3. JWT token generated with payload: { sub: userId, email, role }
4. Token returned to client
5. Client stores token (localStorage/sessionStorage)
6. Client sends token in Authorization header
7. Backend validates token on each request
```

### Authorization (RBAC)

**Roles:**
- `SUPER_ADMIN` - Full platform access
- `ORGANIZER` - Manage own events
- `GAME_MASTER` - Control game sessions

**Guards:**
- `JwtAuthGuard` - Validates JWT token
- `RolesGuard` - Checks user role against required roles

**Usage:**
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER)
@Post('events')
createEvent() { ... }
```

### Input Validation

**Class Validator:**
```typescript
export class CreateEventDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;
}
```

### WebSocket Security

- Session validation before joining rooms
- Team ownership verification on answers/buzzers
- GameMaster role check for control actions

---

## 📊 State Management

### Backend State

**Database (Persistent):**
- Users, Events, Sessions, Questions, Answers, Scores

**Redis (Ephemeral):**
- Active WebSocket connections
- Real-time game state cache
- Pub/Sub for multi-instance coordination

### Frontend State

**React State:**
- Local component state (forms, UI)
- Context API for shared state (auth, session)

**Server State:**
- WebSocket events update UI in real-time
- Optimistic updates with rollback

---

## 🧪 Testing Strategy

### Unit Tests
- Service layer logic
- Utility functions
- Score calculation

### Integration Tests
- API endpoints
- Database operations
- WebSocket events

### E2E Tests
- Full user flows
- Multi-client scenarios
- Real-time synchronization

---

## 📈 Scalability Strategy

### Horizontal Scaling

**API Instances:**
- Stateless design allows multiple instances
- Load balancer distributes requests
- Redis Pub/Sub for WebSocket coordination

**Database:**
- Read replicas for queries
- Connection pooling (PgBouncer)
- Partitioning for large tables

### Vertical Scaling

- Increase instance resources (CPU, RAM)
- Database performance tuning
- Query optimization

---

## 🔮 Future Architecture Improvements

### Planned Enhancements

1. **Microservices Split**
   - Separate game logic service
   - Dedicated media service for uploads
   - Analytics service

2. **Event Sourcing**
   - Store all game events
   - Replay capability
   - Better audit trails

3. **CQRS Pattern**
   - Separate read/write models
   - Optimized query paths

4. **GraphQL API**
   - Flexible querying
   - Subscription for real-time

5. **Kubernetes Deployment**
   - Container orchestration
   - Auto-scaling
   - Health checks

---

## 📚 Additional Resources

- [NestJS Architecture](https://docs.nestjs.com/fundamentals/custom-providers)
- [Next.js Data Fetching](https://nextjs.org/docs/basic-features/data-fetching)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [Socket.IO Scalability](https://socket.io/docs/v4/using-multiple-nodes/)

---

**Last Updated:** 2024
