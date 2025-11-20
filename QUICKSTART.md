# ⚡ Quick Start Guide - Arena Event

Get Arena Event running in 5 minutes!

---

## 🚀 Installation (First Time)

```bash
# 1. Install dependencies
npm install

# 2. Start databases
npm run docker:up

# 3. Create .env file for API
cp apps/api/.env.example apps/api/.env

# 4. Generate Prisma client and run migrations
npm run db:generate
npm run db:migrate

# 5. Seed database with demo data
npm run db:seed
```

---

## 🎬 Start Development

```bash
# Start all services at once
npm run dev
```

This will start:
- ✅ **API**: http://localhost:3001
- ✅ **Admin**: http://localhost:3000
- ✅ **Studio**: http://localhost:3002
- ✅ **Player**: http://localhost:3003
- ✅ **Screen**: http://localhost:3004

---

## 🎮 Try the Demo

### 1. Login to Admin
- Go to http://localhost:3000
- Email: `organizer@arena-event.com`
- Password: `organizer123`

### 2. Create a Session
- Navigate to Events
- Open the "Demo Blind Test" event
- Click "Create Session"
- Note the **Session Code** (e.g., `ABC123`)

### 3. Open Studio (Game Master)
- Go to http://localhost:3002
- Select your session
- Click "Start Question"

### 4. Join as Player
- Open http://localhost:3003 on your phone (or another browser)
- Enter the Session Code
- Create a team name
- Answer questions when they appear!

### 5. Display on Screen
- Open http://localhost:3004
- Show the Session Code for players to join
- Watch the game unfold in real-time!

---

## 🛠️ Useful Commands

```bash
# Database
npm run db:studio      # Open Prisma Studio GUI
npm run db:migrate     # Run migrations
npm run db:seed        # Seed demo data

# Docker
npm run docker:up      # Start databases
npm run docker:down    # Stop databases
npm run docker:logs    # View logs

# Development
npm run dev            # Start all services
npm run build          # Build all apps
npm run lint           # Lint code
npm run test           # Run tests

# Individual services
cd apps/api && npm run dev        # Backend only
cd apps/web-admin && npm run dev  # Admin only
cd apps/web-studio && npm run dev # Studio only
cd apps/web-player && npm run dev # Player only
cd apps/web-screen && npm run dev # Screen only
```

---

## 📝 Demo Credentials

**Organizer Account:**
- Email: `organizer@arena-event.com`
- Password: `organizer123`

**Admin Account:**
- Email: `admin@arena-event.com`
- Password: `admin123`

---

## 🐛 Troubleshooting

### Database connection error
```bash
npm run docker:up
```

### Port already in use
Change ports in package.json dev scripts or kill the process using the port.

### Prisma client errors
```bash
npm run db:generate
```

### Cannot connect to WebSocket
Check that the API is running on port 3001.

---

## 📚 Next Steps

- Read the [README.md](./README.md) for full documentation
- Check [ARCHITECTURE.md](./ARCHITECTURE.md) to understand the design
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment

---

**Happy Quizzing! 🎉**
