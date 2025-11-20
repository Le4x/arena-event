# 🎮 Arena Event

**Professional Live Quiz & Blind Test Platform**

A complete, production-ready event management platform for hosting interactive quiz and blind test sessions. Inspired by Kahoot, This Is BlindTest, and Quiz Room, Arena Event enables event organizers to create engaging live experiences with real-time interaction.

---

## 🌟 Features

### ✨ Core Capabilities

- **Multi-Session Concurrent Support**: Host multiple quiz sessions simultaneously on the same infrastructure
- **Real-Time Communication**: WebSocket-powered instant synchronization across all devices
- **Multi-Device Architecture**: Separate optimized interfaces for different roles
- **RBAC Authentication**: Role-based access control (SuperAdmin, Organizer, GameMaster)
- **Mobile-First PWA**: Installable progressive web app for players
- **Professional Studio Interface**: Full control panel for game masters

### 🎯 Session Management

- **Event Organization**: Create events with multiple sessions and rounds
- **Dynamic Session Codes**: Auto-generated 6-character join codes
- **Team Management**: Players can create or join teams
- **Live Leaderboard**: Real-time score tracking and rankings
- **Buzzer System**: First-to-buzz mechanics with locking
- **Multiple Question Types**: MCQ, True/False, Text, Buzzer, Blind Test (audio), Image

### 🎬 Game Master Control (Studio)

- **Timeline View**: Navigate through rounds and questions
- **Question Control**: Start/stop questions with timers
- **Answer Monitoring**: Real-time answer submission tracking
- **Score Management**: Auto-scoring + manual override
- **Buzzer Control**: Lock/unlock and reset buzzers
- **Connection Status**: Monitor connected teams and devices

### 📱 Player Experience

- **Simple Join Flow**: Enter session code to join
- **Team Creation/Selection**: Create new team or join existing
- **Multiple Answer Modes**: Buttons (MCQ), text input, buzzer
- **Visual Feedback**: Confirmation of answers and status
- **Automatic Reconnection**: Maintains state on disconnect

### 📺 Public Screen Display

- **Question Display**: Large, readable question presentation
- **Live Timer**: Countdown visible to all
- **Buzzer Highlights**: Visual effects for first buzzer
- **Leaderboard Views**: Intermediate and final rankings
- **Multiple Layouts**: Question, Leaderboard, Pause, Final

---

## 🏗️ Architecture

### Technology Stack

```
┌─────────────────────────────────────────┐
│         TURBOREPO MONOREPO              │
├─────────────────────────────────────────┤
│                                         │
│  📦 Backend                             │
│    ├─ NestJS (TypeScript)              │
│    ├─ Prisma ORM                       │
│    ├─ PostgreSQL                       │
│    ├─ Redis (Pub/Sub)                  │
│    └─ Socket.IO (WebSocket)            │
│                                         │
│  📦 Frontends (Next.js 14)             │
│    ├─ Admin Dashboard                  │
│    ├─ Studio (Game Master)             │
│    ├─ Player (PWA)                     │
│    └─ Screen (Public Display)          │
│                                         │
│  📦 Shared Packages                     │
│    ├─ Types & DTOs                     │
│    ├─ UI Components                    │
│    └─ Config                           │
│                                         │
└─────────────────────────────────────────┘
```

### Project Structure

```
arena-event/
├── apps/
│   ├── api/                    # NestJS Backend
│   │   ├── src/
│   │   │   ├── auth/          # JWT Authentication
│   │   │   ├── users/         # User Management
│   │   │   ├── events/        # Event CRUD
│   │   │   ├── sessions/      # Session Management
│   │   │   ├── rounds/        # Round CRUD
│   │   │   ├── questions/     # Question CRUD
│   │   │   ├── teams/         # Team Management
│   │   │   ├── game/          # Game Logic
│   │   │   │   ├── game.service.ts
│   │   │   │   ├── scoring.service.ts
│   │   │   │   └── state.manager.ts
│   │   │   └── realtime/      # WebSocket Gateway
│   │   └── prisma/
│   │       ├── schema.prisma  # Database Schema
│   │       └── seed.ts        # Demo Data
│   │
│   ├── web-admin/             # Admin Dashboard (Next.js)
│   ├── web-studio/            # Game Master Studio (Next.js)
│   ├── web-player/            # Player PWA (Next.js)
│   └── web-screen/            # Public Display (Next.js)
│
├── packages/
│   ├── shared/                # Shared Types, DTOs, Events
│   ├── ui/                    # Reusable React Components
│   └── config/                # ESLint, TypeScript configs
│
├── docker-compose.yml         # PostgreSQL + Redis
├── turbo.json                 # Turborepo config
└── package.json               # Root workspace
```

### Database Schema

**Main Entities:**
- `User` - Authentication and roles
- `Event` - Top-level event container
- `Session` - Individual game session
- `Round` - Question grouping
- `Question` - Quiz questions with multiple types
- `Team` - Player groups with scores
- `PlayerDevice` - Connected devices
- `Answer` - Submitted answers
- `BuzzerPress` - Buzzer timestamps
- `GameState` - Real-time game state

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Docker** and **Docker Compose** (for local databases)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd arena-event
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start databases with Docker**
   ```bash
   npm run docker:up
   ```

   This starts:
   - PostgreSQL on `localhost:5432`
   - Redis on `localhost:6379`

4. **Configure environment**
   ```bash
   cd apps/api
   cp .env.example .env
   ```

   Edit `.env` if needed (defaults work for local dev)

5. **Generate Prisma Client & Run Migrations**
   ```bash
   npm run db:generate
   npm run db:migrate
   ```

6. **Seed the database** (optional - creates demo data)
   ```bash
   npm run db:seed
   ```

   This creates:
   - Admin user: `admin@arena-event.com` / `admin123`
   - Organizer user: `organizer@arena-event.com` / `organizer123`
   - Demo event with sample questions

---

## 🎬 Development

### Start All Services

Run everything in development mode:

```bash
npm run dev
```

This starts:
- **API** (Backend): http://localhost:3001
- **Admin**: http://localhost:3000
- **Studio**: http://localhost:3002
- **Player**: http://localhost:3003
- **Screen**: http://localhost:3004

### Individual Services

Start services separately:

```bash
# Backend only
cd apps/api && npm run dev

# Admin only
cd apps/web-admin && npm run dev

# Studio only
cd apps/web-studio && npm run dev

# Player only
cd apps/web-player && npm run dev

# Screen only
cd apps/web-screen && npm run dev
```

### Database Management

```bash
# Open Prisma Studio (GUI)
npm run db:studio

# Create new migration
cd apps/api
npx prisma migrate dev --name your_migration_name

# Reset database (CAUTION: deletes all data)
cd apps/api
npx prisma migrate reset
```

---

## 📖 Usage Guide

### 1. Create an Event (Admin)

1. Go to http://localhost:3000
2. Login with `organizer@arena-event.com` / `organizer123`
3. Create a new Event
4. Add Rounds and Questions

### 2. Start a Session (Admin)

1. Select your Event
2. Click "Create Session"
3. Copy the generated **Session Code** (e.g., `ABC123`)

### 3. Control the Game (Studio)

1. Go to http://localhost:3002
2. Select your Session
3. Use the control panel to:
   - Start questions
   - Monitor answers
   - Control buzzer
   - Update scores
   - Show leaderboard

### 4. Display on Screen (Public)

1. Open http://localhost:3004 on your projector/TV
2. Connect to the session
3. Display updates automatically via WebSocket

### 5. Join as Player (Mobile)

1. Open http://localhost:3003 on your phone
2. Enter the **Session Code**
3. Create or join a team
4. Answer questions when they appear

---

## 🔌 API Documentation

### Authentication

**POST** `/auth/register`
```json
{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**POST** `/auth/login`
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "accessToken": "jwt-token-here",
  "user": { ... }
}
```

**GET** `/auth/me` (requires JWT)

### Events

**GET** `/events` - List all events (for current user)
**GET** `/events/:id` - Get event details
**POST** `/events` - Create event
**PUT** `/events/:id` - Update event
**DELETE** `/events/:id` - Delete event

### Sessions

**GET** `/sessions?eventId=xxx` - List sessions
**GET** `/sessions/:id` - Get session details
**GET** `/sessions/code/:code` - Find by session code
**POST** `/sessions` - Create session
**PUT** `/sessions/:id/status` - Update status
**DELETE** `/sessions/:id` - Delete session

### Game Actions

**POST** `/game/question/start` - Start a question
**POST** `/game/question/end` - End a question
**POST** `/game/answer` - Submit answer
**POST** `/game/buzzer` - Press buzzer
**POST** `/game/buzzer/reset` - Reset buzzer
**GET** `/game/leaderboard/:sessionId` - Get leaderboard
**POST** `/game/score/:teamId` - Update team score manually

---

## 🔌 WebSocket Events

### Client → Server

- `join_session` - Join a game session
- `leave_session` - Leave session
- `submit_answer` - Submit an answer
- `buzzer_press` - Press the buzzer
- `start_question` - (GameMaster) Start question
- `end_question` - (GameMaster) End question
- `show_leaderboard` - (GameMaster) Display leaderboard
- `update_score` - (GameMaster) Manual score update
- `reset_buzzer` - (GameMaster) Reset buzzer

### Server → Client

- `joined_session` - Confirm join
- `player_joined` - New player joined
- `player_left` - Player left
- `question_started` - Question started with timer
- `question_ended` - Question ended
- `answer_submitted` - Answer received confirmation
- `buzz` - Buzzer pressed (with rank)
- `buzzer_reset` - Buzzer reset
- `score_updated` - Team score changed
- `leaderboard_shown` - Leaderboard data
- `error` - Error message

---

## 🧪 Testing

### Run Tests

```bash
npm run test
```

### Run Tests with Coverage

```bash
npm run test:cov
```

### E2E Tests (API)

```bash
cd apps/api
npm run test:e2e
```

---

## 🏗️ Building for Production

### Build All Apps

```bash
npm run build
```

### Build Individual Apps

```bash
cd apps/api && npm run build
cd apps/web-admin && npm run build
cd apps/web-studio && npm run build
cd apps/web-player && npm run build
cd apps/web-screen && npm run build
```

### Run Production Build

```bash
# API
cd apps/api && npm run start:prod

# Frontends
cd apps/web-admin && npm run start
cd apps/web-studio && npm run start
cd apps/web-player && npm run start
cd apps/web-screen && npm run start
```

---

## 🔒 Environment Variables

### Backend (apps/api/.env)

```bash
# Database
DATABASE_URL="postgresql://arena:arena123@localhost:5432/arena_event?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="7d"

# Redis
REDIS_HOST="localhost"
REDIS_PORT=6379

# Server
PORT=3001
NODE_ENV="development"

# CORS
CORS_ORIGINS="http://localhost:3000,http://localhost:3002,http://localhost:3003,http://localhost:3004"
```

---

## 📋 Roadmap

### V1.0 (MVP) ✅
- [x] Multi-session concurrent support
- [x] Authentication & RBAC
- [x] WebSocket real-time communication
- [x] 4 separate interfaces (Admin, Studio, Player, Screen)
- [x] QCM, True/False, Buzzer question types
- [x] Auto-scoring + manual override
- [x] Session codes & team management

### V1.1 (Planned)
- [ ] PWA installation prompt
- [ ] QR Code generation for sessions
- [ ] Automatic reconnection on disconnect
- [ ] Better animations and transitions
- [ ] Basic analytics dashboard

### V1.2 (Planned)
- [ ] Text answer questions
- [ ] Image-based questions
- [ ] Audio blind test (file upload + playback)
- [ ] Speed bonus scoring
- [ ] Question time-based difficulty

### V1.3 (Planned)
- [ ] Drag & drop timeline editor
- [ ] Duplicate/edit questions in live
- [ ] Jingles and ambient sounds
- [ ] Export results (PDF, CSV)
- [ ] Multi-GameMaster support

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is proprietary software. All rights reserved.

---

## 🆘 Support

For issues and questions, please open an issue on GitHub.

---

## 👥 Authors

Built with ❤️ as a professional event management platform.

---

## 🎉 Demo Credentials

After running `npm run db:seed`, you can use:

- **Admin**: `admin@arena-event.com` / `admin123`
- **Organizer**: `organizer@arena-event.com` / `organizer123`

---

**Happy Quizzing! 🎮🎉**
