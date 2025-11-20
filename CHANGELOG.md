# 📝 Changelog

All notable changes to Arena Event will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2024-11-20

### 🎉 Initial Release

### Added

#### Backend (NestJS)
- **Authentication System**
  - JWT-based authentication
  - Role-based access control (RBAC)
  - SuperAdmin, Organizer, GameMaster roles
  - Password hashing with bcrypt

- **Core Modules**
  - Users management
  - Events CRUD operations
  - Sessions with unique code generation
  - Rounds and Questions management
  - Teams and player devices
  - Game logic service
  - Scoring service with auto-calculation
  - State manager for game phases

- **Real-Time Communication**
  - WebSocket Gateway with Socket.IO
  - Room-based session isolation
  - Connection management and reconnection
  - Real-time events for questions, answers, buzzers, scores

- **Database**
  - PostgreSQL with Prisma ORM
  - Complete schema with relations
  - Migrations system
  - Seed script with demo data

#### Frontend

- **Admin Dashboard (Next.js)**
  - Login and authentication
  - Event management interface
  - Session creation
  - User dashboard

- **Studio/Régie (Next.js)**
  - Game Master control panel
  - Question timeline navigation
  - Answer monitoring in real-time
  - Buzzer control
  - Score management (auto + manual)
  - Leaderboard display control
  - Connection status monitoring

- **Player PWA (Next.js)**
  - Mobile-optimized interface
  - Session joining via code
  - Team creation/selection
  - Multiple answer modes (MCQ, text, buzzer)
  - Real-time feedback
  - PWA manifest for installation

- **Screen Display (Next.js)**
  - Public display optimized for projection
  - Question display with timer
  - Buzzer highlights
  - Leaderboard views
  - Multiple layout modes

#### Shared Packages
- **@arena-event/shared**
  - TypeScript types and interfaces
  - DTOs with Zod validation
  - Enums for roles, statuses, question types
  - Event payloads for WebSocket
  - Constants and configuration

- **@arena-event/ui**
  - Reusable React components (Button, Card, Input, Timer, Badge, Modal)
  - Tailwind CSS styling
  - Responsive design

- **@arena-event/config**
  - Shared ESLint configuration
  - TypeScript config presets

#### Infrastructure
- **Monorepo Setup**
  - Turborepo for build orchestration
  - Workspace management with npm
  - Shared dependencies

- **Development Environment**
  - Docker Compose for PostgreSQL and Redis
  - Environment variable templates
  - Hot reload for all services

- **Documentation**
  - Comprehensive README
  - Architecture documentation
  - Deployment guide
  - Contributing guidelines
  - API documentation

### Features

#### Question Types
- Multiple Choice Questions (MCQ)
- True/False
- Buzzer-only
- Text input (ready for implementation)
- Blind Test audio (ready for implementation)
- Image-based (ready for implementation)

#### Game Mechanics
- Automatic scoring for MCQ and True/False
- Manual score override by GameMaster
- First-to-buzz buzzer system with locking
- Buzzer reset functionality
- Real-time leaderboard updates
- Speed bonus calculation (service ready)

#### Session Management
- Unique 6-character session codes
- Multi-session concurrent support
- Session status lifecycle (LOBBY, ACTIVE, PAUSED, FINISHED)
- Isolated WebSocket rooms per session
- Team score tracking

#### Security
- JWT token authentication
- Role-based authorization guards
- Input validation with class-validator
- CORS configuration
- Password hashing

---

## [Unreleased]

### Planned for V1.1
- [ ] PWA installation prompt
- [ ] QR Code generation for sessions
- [ ] Automatic reconnection handling
- [ ] Enhanced animations and transitions
- [ ] Basic analytics dashboard
- [ ] Session history and replay

### Planned for V1.2
- [ ] Text answer questions with manual grading
- [ ] Image-based questions
- [ ] Audio blind test with file upload
- [ ] Speed bonus points
- [ ] Question difficulty levels

### Planned for V1.3
- [ ] Drag & drop timeline editor
- [ ] Live question editing
- [ ] Jingles and sound effects
- [ ] Results export (PDF, CSV)
- [ ] Multi-GameMaster support

---

## Version History

| Version | Date       | Description              |
|---------|------------|--------------------------|
| 1.0.0   | 2024-11-20 | Initial release - MVP    |

---

**Latest Version:** 1.0.0
