# Vitalis

Fitness tracking with AI coaching — workout logging, nutrition and food scanning,
sleep tracking, plans, community, messaging, and analytics in one monorepo.

## Features

* Auth with email verification, password reset OTP, Google OAuth, session revocation
* Dashboard, daily check-ins, goals, activity and workout logs
* Meal tracker with camera food scan and macro coaching
* Camera workout with pose tracking and rep counting
* Activity map with GPS routes, community posts, kudos, comments
* Personal plans, onboarding, analytics, notifications, preferences
* AI coach and insights with daily quota, model fallback, and cache

## Stack

* Backend: Express 5, MySQL 8, Socket.io, Zod, JWT cookies, Nodemailer
* Frontend: Vite 8, React 19, React Router 7, Tailwind 4, PWA, Leaflet, Chart.js
* Tests: Node test runner, ESLint, syntax check

## Structure

* `backend/` — API, migrations 001 to 032, middleware, sockets, tests (see `backend/README.md`)
* `frontend/` — PWA app with feature folders per domain (see `frontend/README.md`)
* `.github/workflows/` — CI for backend and frontend
* `LICENSE`, `.nvmrc`, `.editorconfig`, `.prettierrc.json`, `.gitattributes`

## Prerequisites

* Node 20 or higher
* MySQL 8 with a `fitnessapp` database
* Two terminals, one for backend and one for frontend

## Setup — backend

```powershell
Copy-Item backend/.env.example backend/.env
# Edit backend/.env: set DB_HOST, DB_USER, DB_PASS, DB_NAME, JWT_SECRET
Set-Location backend
npm install
npm run db:migrate:dry
npm run db:migrate
npm run dev
```

## Setup — frontend

```powershell
Copy-Item frontend/.env.example frontend/.env
Set-Location frontend
npm install
npm run dev
```

Leave the backend terminal running while starting the frontend. The frontend
dev proxy forwards API and Socket.io traffic to the backend automatically.

## Scripts

Backend:

* `npm run dev` — watch mode for development
* `npm start` / `npm run start:prod` — production boot
* `npm run lint` — syntax check across source files
* `npm run test:unit` / `test:integration` / `test` — test suites
* `npm run db:migrate` / `db:migrate:dry` / `db:status` — apply or preview migrations
* `npm run db:create -- <slug>` — scaffold the next migration file

Frontend:

* `npm run dev` — development server with proxy
* `npm run build` / `npm run preview` — production build and local preview
* `npm run lint` — ESLint
* `npm run test:unit` / `npm test` — unit tests, with lint in full test

## Environment

Backend `.env` is required. Copy from `backend/.env.example`:

| Variable | Required | Notes |
|---|---|---|
| `DB_HOST`, `DB_USER`, `DB_NAME` | yes | MySQL 8 connection target |
| `DB_PASS` | prod-only | Must be non-empty when `NODE_ENV=production` |
| `DB_PORT`, `DB_POOL_MAX`, `DB_QUEUE_LIMIT` | no | Defaults 3306 / 25 / 200 |
| `JWT_SECRET` | yes | Min 32 chars, not the example value — enforced even in dev |
| `ALLOWED_ORIGINS` | prod-only | Comma-separated; `*` with credentials is refused at boot |
| `ALLOWED_ORIGIN_REGEX` | no | Must be anchored `^…$`; overly broad patterns refuse to start |
| `FRONTEND_URL` | prod-only | One of `FRONTEND_URL`/`ALLOWED_ORIGINS` required in prod; must be https |
| `EMAIL_USER`, `EMAIL_PASS` | for mail flows | Verification + OTP emails fail gracefully without them |
| `RECEIVER_EMAIL` | for `/api/feedback` | Public rate-limited inbox |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | for Google login | Must match frontend `VITE_GOOGLE_CLIENT_ID` |
| `GEMINI_API_KEY`, `GROQ_API_KEY` | no | Static fallback when unset; overrides via `GEMINI_TEXT/VISION_MODELS` |
| `AI_DAILY_LIMIT` | no | Default 50/user/day (UTC), 429 + `Retry-After` past it |
| `ALLOW_DEV_LINKS` | never in prod | `=1` exposes verify links in API responses; boot-refused in prod |
| `TZ` | recommended `UTC` | Quota + daily boundaries use `UTC_DATE()`; warned when unset |
| `SOCKET_REVERIFY_MS` | no | Socket session re-check interval, clamped 10s–10min (default 90s) |
| `DEBUG` | no | Enables debug logs + verbose request logging |

Frontend `.env` is optional for local development (empty values use the
dev proxy). Production static builds need absolute backend values set
before building:

| Variable | Notes |
|---|---|
| `VITE_API_URL` | Absolute backend URL for prod builds; empty = same-origin/proxy |
| `VITE_SOCKET_URL` | Socket.io target; empty = same-origin |
| `VITE_GOOGLE_CLIENT_ID` | Disables Google button when unset |

Only `.env.example` files are tracked. Never commit real `.env` files.

## Testing

Backend (97 tests, 25 suites): activity accuracy, AI stability, plan
engine, validation schemas, migrations count and idempotency, auth flows
(verify-email hashing, Google signup), auth and community/settings
guards, per-device session revocation, env fail-fast guards, and
friends-only socket relay. Frontend (36 tests, 14 suites): avatar helpers
plus pure utils (`sleepScore`, `metrics`, `dateKey`). Both suites run in
CI (`.github/workflows/ci.yml`) on Node 20 and 24, together with ESLint
(`npm run lint`).

## Architecture

* Request flow: Vite dev proxy (or prod static host) → Express 5 API
  (`/api/*`, Zod-validated, `verifyUser` cookie sessions) → MySQL 8.
* Auth: httpOnly JWT cookies (`tv` = `token_version`); logout, password
  change, and reset bump the version to revoke all sessions; per-device
  revoke deletes the session row and bumps the version (fail closed).
* Realtime: Socket.io rooms named by user id; cookie + DB verified at
  connect and every 90s. Chat persists via REST, then relays `send-chat`
  → `receive-chat` to friends only (30/min per socket).
* AI: all AI POSTs behind per-user daily quota (UTC); Gemini model
  rotation → Groq → static fallback; insight cache keyed by data
  signature. Application logs go through `backend/src/utils/logger.js`
  (debug/info hidden in production unless `DEBUG` is set).
* PWA: precached shell + map tiles; API is `NetworkOnly` (shared-device
  safety); the 3.9 MB icon font is runtime-cached on first use.

## Screenshots

Capture from a running build before release (light + dark):

* Landing hero, login, onboarding profile step
* Dashboard (calories ring + week strip), meal tracker scan result
* Camera workout session, activity map with a recorded run
* Community feed, messenger thread, analytics sleep scatter

## Docs

* Backend layout, debugging, route guide, and DB commands: `backend/README.md`
* Migration rules and history: `backend/docs/MIGRATIONS.md`
* Frontend architecture and conventions: `frontend/README.md` and `frontend/docs/architecture.md`

## License

MIT — see `LICENSE`.
