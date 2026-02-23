# Ward Task Orchestration System — MVP

A nurse-centric ward task orchestration system for tier 2/3 Indian hospitals. Reduces cognitive load during medication rounds by consolidating time-sensitive care tasks into a single glanceable dashboard.

---

## Architecture

```
ward-task-orchestrator/
├── apps/
│   ├── api/          # Express + Prisma + PostgreSQL
│   └── web/          # React 18 + TypeScript + Tailwind + Zustand
└── docker-compose.yml
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, Tailwind CSS, Zustand, React Query |
| Backend | Node.js, Express, TypeScript, Zod |
| Database | PostgreSQL 16, Prisma ORM |
| AI | OpenAI GPT-4o (handover summary) |
| Dev | Vite, Docker Compose |

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- Docker Desktop
- OpenAI API key (for handover summaries)

### Step 1: Clone and install

```bash
cd ward-task-orchestrator

# Install API deps
cd apps/api && npm install

# Install web deps
cd ../web && npm install
```

### Step 2: Start PostgreSQL

```bash
# From project root
docker compose up db -d

# Wait for it to be healthy
docker compose logs db --follow
```

### Step 3: Set up API environment

```bash
cd apps/api
cp .env.example .env
# Edit .env — add your OpenAI key
```

`.env` contents:
```
DATABASE_URL="postgresql://ward_user:ward_pass@localhost:5432/ward_db"
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
OPENAI_API_KEY=sk-...your-key...
```

### Step 4: Initialize database and seed

```bash
cd apps/api
npm run db:push       # Push Prisma schema
npm run db:seed       # Seed Indian hospital mock data
```

### Step 5: Run the API

```bash
cd apps/api
npm run dev
# → http://localhost:3001
# → http://localhost:3001/api/health
```

### Step 6: Run the Web app

```bash
cd apps/web
npm run dev
# → http://localhost:5173
```

---

## Production Deployment (Docker)

```bash
# From project root
cp apps/api/.env.example .env
# Edit .env with your OpenAI key

docker compose up --build -d
```

Services:
- Web: `http://localhost:5173`
- API: `http://localhost:3001`
- DB: `localhost:5432`

---

## Seed Data Summary

The seed includes 8 Indian nurses, 8 patients, and 22 tasks:

**Nurses**: Priya Sharma (Head Nurse), Rekha Nair (RN), Sunita Yadav (RN), Meena Pillai (LPN), Anita Joshi (CNA), Deepa Patel (RN), Kavitha Menon (LPN), Rohini Desai (CNA)

**Patients**: Arjun Mehta (Bed 104 - Diabetes + HTN), Savitri Bai (Bed 106 - Post hip replacement), Ramesh Gupta (Bed 108 - Post appendectomy), Lalitha Krishnan (Bed 110 - COPD), Vikram Singh (Bed 112 - Dengue), Nalini Reddy (Bed 114 - Post MI), Suresh Iyer (Bed 116 - Pneumonia), Padmavathi Rao (Bed 118 - Pre-op cholecystitis)

---

## API Reference

```
GET    /api/nurses                     # List all active nurses
GET    /api/shifts/active?nurse_id=    # Get or create active shift
PATCH  /api/shifts/:id                 # Archive shift
GET    /api/assignments?shift_id=      # Get patient assignments for shift
POST   /api/assignments                # Assign patient to nurse/shift
GET    /api/tasks?shift_id=&nurse_id=  # Get enriched tasks with urgency
POST   /api/tasks                      # Create new task
PATCH  /api/tasks/:id                  # Discontinue task
POST   /api/task-log                   # Complete or skip a task
DELETE /api/task-log/:id/undo          # Undo within 15s window
POST   /api/notes                      # Add clinical note
POST   /api/shift-summary             # Generate AI handover summary
PATCH  /api/shifts/:id                 # Archive (logout)
```

---

## Key Design Decisions

1. **No EMR integration** — Paper case sheet remains legal record
2. **Kiosk-style session** — Nurse taps avatar to sign in, auto-locks after 5min inactivity
3. **Server timestamps only** — All `completedAt` values generated server-side
4. **Urgency computed at query time** — Not stored; `next_due = anchor + (freq × n)`
5. **15-second undo window** — Backend enforced, not just UI
6. **AI handover is descriptive only** — No recommendations, no clinical advice
7. **Missed intervals collapse** — Shown as counter, not infinite rows
