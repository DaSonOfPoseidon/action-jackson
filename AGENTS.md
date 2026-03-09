# AGENTS.md

## Purpose

Provide structured instructions and conventions for both human contributors and automated/AI agents interacting with the Action Jackson codebase. The goal is safe, incremental, observable, and reversible changes while preserving dual-domain semantics (branding vs. portfolio).

## 1. Project Layout (High Level)

```
server.js              — Express API server (port 3001)
routes/                — HTTP route modules (10 files):
  home.js              — Services/testimonials API
  auth.js              — Admin login/logout, JWT management, CSRF
  admin-api.js         — Admin dashboard API (JWT-protected)
  scheduling.js        — Appointment booking with conflict detection
  quotes.js            — Quote creation with equipment catalog
  invoices.js          — Invoice CRUD with quote integration
  files.js             — File management with MinIO/S3
  estimates.js         — Cost items lookup with labor rates
  consultations.js     — Consultation request handling
  shared.js            — Shared service definitions
models/                — Mongoose schemas (10 models):
  Service.js           — Service offerings
  Schedule.js          — Appointments with business hours validation
  Quote.js             — Quotes with equipment and pricing
  Invoice.js           — Invoices with auto-generated numbers
  Testimonial.js       — Customer testimonials
  Attachment.js        — File metadata with S3 integration
  Admin.js             — Admin accounts with bcrypt and lockout
  CostItem.js          — Equipment/service catalog with BOM
  ConsultationRequest.js — Consultation inquiries
  Setting.js           — Global settings singleton (labor rate)
middleware/            — Auth and file access control:
  auth.js              — JWT/session auth, CSRF, role-based access
  fileAuth.js          — File access permissions and size limits
services/              — Business logic:
  fileStorage.js       — MinIO/S3 file storage service
config/                — Configuration:
  storage.js           — MinIO client setup
frontend/              — Next.js 14 application:
  middleware.ts         — Domain routing + admin JWT auth
  app/(business)/      — Business site pages
  app/portfolio/       — Portfolio pages
  app/admin/           — Admin dashboard pages
  components/          — React components (admin, portfolio, sections, ui, icons, layout)
  lib/                 — API clients, types, validation, auth context
  data/                — Static JSON (projects, resume, skills)
  __tests__/           — Vitest + React Testing Library tests
tests/                 — Backend Jest + Supertest tests (10 files)
docker-compose.yml     — 3-service orchestration (mongo, api, frontend)
.env                   — Environment configuration (not checked in)
```

## 2. Build / Dev / Test Commands

### Backend (root directory)
- `npm install` — install backend dependencies
- `npm start` — launch API server (port 3001)
- `npm run dev` — launch with nodemon auto-restart
- `npm test` — run backend test suite (10 test files) - **REQUIRED before commits**

### Frontend (`/frontend/`)
- `cd frontend && npm install` — install frontend dependencies
- `cd frontend && npm run dev` — Next.js dev server (port 3000)
- `cd frontend && npm run build` — production build
- `cd frontend && npm run lint` — ESLint
- `cd frontend && npm test` — Vitest test suite (5 test files)

### Docker
- `docker compose up --build -d` — build and start all 3 services
- `docker compose ps` — verify health status
- `docker compose logs -f` — follow logs

Agents should always test after changes:
1. **FIRST**: Run `npm test` (backend) and `cd frontend && npm test` (frontend) to ensure all tests pass
2. **THEN**: Smoke-test critical paths:
   - Backend: `/healthz` returns 200 with `{app: 'ok', db: 'ok'}`
   - Frontend: `npm run build` succeeds
   - Docker: `docker compose ps` shows all services healthy
3. Verify both domain variants work correctly (`business` and `portfolio`)

## 3. Code Style & Conventions

### Backend (JavaScript/Node.js)
- Use `const` / `let`; avoid `var`
- Prefer clear, descriptive names for functions/variables
- Two-space indentation
- All API responses are JSON (no HTML rendering from the backend)
- When adding dependencies, update both `package.json` and lockfile
- Always write tests for new functionality (see `/tests/` for examples)
- Do not commit secrets or `.env` contents

### Frontend (TypeScript/React/Next.js)
- TypeScript with strict mode
- Next.js App Router conventions (page.tsx, layout.tsx, route groups)
- Tailwind CSS for styling (no inline styles or CSS modules)
- React components use functional style with hooks
- Path aliases via `@/*` (maps to frontend root)
- Framer Motion for animations
- API calls through `lib/api.ts` (public) or `lib/admin/api.ts` (admin)

## 4. Git & Commit Guidelines

- Branch naming: descriptive, e.g., `feat/add-portfolio-section`, `fix/docker-healthcheck`
- Commit messages: imperative mood, concise, with prefix (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`)
  - Example: `feat: add consultation intake form`
- Small, incremental commits preferred over large sweeping changes
- Include rationale and test steps in PR description
- Avoid committing `node_modules/`; ensure `.gitignore` is respected

## 5. Agent Behavior Rules

- **Clarify before large assumptions.** If domain separation, content intent, or architecture changes are ambiguous, surface questions rather than guessing.
- **Test-driven development.** Run `npm test` (backend) and `cd frontend && npm test` (frontend) before and after changes. Write tests for new features.
- **Incremental & testable.** Make one logical change per commit/PR when possible.
- **Fallback safety.** If a change risks breaking startup, include rollback notes or a safe fallback.
- **Dependency updates.** Detect outdated or vulnerable dependencies; propose updates, run install, and validate that the app still boots AND tests pass.
- **Dual-domain awareness.** Domain routing is handled by Next.js middleware (`frontend/middleware.ts`). The `dev.` subdomain is rewritten to `/portfolio` paths. The Express backend is domain-agnostic. Preserve this separation unless explicit direction is given to alter it.
- **Backend is JSON-only.** The Express API returns JSON responses exclusively. No HTML rendering.

## 6. Security & Reliability

### Admin Authentication
- JWT access tokens (15-minute expiry) + refresh tokens (7-day expiry)
- bcrypt password hashing with account lockout (5 failed attempts, 30-minute lock)
- Role-based access: admin/superadmin hierarchy
- CSRF protection on state-changing requests
- Frontend admin routes protected by Next.js middleware JWT verification (via jose)

### Rate Limiting
- Quotes: 3/15min, Calculations: 30/min, Scheduling: 5/15min
- File uploads: 20/15min, Admin API: 100/15min
- Consultations: 3/15min

### Core Security Practices
- Never store or commit credentials. Use env vars or external secret stores
- Sanitize external inputs. All user input is validated and escaped
- Serve over HTTPS in production (Cloudflare Tunnel)
- Audit and periodically review dependencies for vulnerabilities
- Health endpoint `/healthz` includes database connectivity verification
- MongoDB authentication required with strong passwords (12+ characters)
- Email uses app-specific passwords, never account passwords

## 7. Deployment Guidance

After a change is merged to the main branch:

1. **Pre-deploy**: Ensure `npm test` and `cd frontend && npm test` passed
2. Pull latest changes on the host
3. Rebuild and restart: `docker compose up --build -d`
4. Verify health: `docker compose ps` (all services healthy), `/healthz` returns 200
5. **Post-deploy testing**: Smoke test both domain variants
6. If using a webhook-based auto-deploy, ensure the webhook triggered a successful pull/build
7. Log any failures and, if needed, initiate rollback via git

**Docker architecture** (3 services):
- **mongo** (arm64v8/mongo:4.4.18) — port 27017, persistent volume
- **api** (custom Dockerfile) — port 3001 (internal), depends on mongo
- **frontend** (custom Dockerfile in ./frontend) — port 3000, depends on api, Cloudflare Tunnel labels

## 8. Contribution Process

- Fork/branch
- Implement and write tests for new functionality
- Test locally: `npm test` (backend) and `cd frontend && npm test` (frontend), then Docker build verification
- Commit with clear message
- Open PR with: what changed, why, how it was tested, and any side effects
- Await review before merging into main

## 9. Current System Status & Capabilities

### Implemented Features
- **Next.js Frontend**: React 18 + TypeScript + Tailwind CSS with App Router, domain-based routing via middleware
- **Admin Dashboard**: JWT-authenticated management for quotes, schedules, invoices, consultations, cost items, and settings
- **Consultation System**: Intake form with property details, service interests, status tracking, and admin notes
- **Cost Item Management**: Equipment/service catalog with categories, bill of materials, and configurable labor rates
- **Advanced Quote System**: Multi-step process with equipment catalog, real-time pricing, final summary
- **Professional Scheduling**: Conflict detection, business hours validation, email confirmations
- **Invoice Management**: Quote integration, auto-generated numbers, API security
- **File Storage**: MinIO/S3 integration with comprehensive security and audit trails
- **Enhanced Security**: JWT auth, rate limiting, input validation, spam protection, audit trails

### Available Services
- **Device mounting** ($10/device) - Physical equipment mounting
- **Client device setup** ($10/device) - End-user device configuration
- **Host/server device setup** ($50/device) - Server and network appliance setup
- **Media panel install** ($50/device) - Media distribution panel installation

### Equipment Catalog
- **Categories**: Gateways, Switches, Access Points, Cameras
- **Speed Tiers**: 1 Gig, 2.5 Gig, 5 Gig, 10 Gig compatibility matching
- **Smart Recommendations**: Automatic suggestions based on speed tier

### Domain Routing
- Next.js middleware (`frontend/middleware.ts`) handles domain detection
- `actionjacksoninstalls.com` → `app/(business)/` route group
- `dev.actionjacksoninstalls.com` → `app/portfolio/` (transparent rewrite)
- Express backend is domain-agnostic (JSON API only)

## 10. Overrides & Extension

More specific `agents.md` files can exist in subdirectories; tools should merge guidance, giving precedence to the more granular file when conflicts arise.

## 11. Example Safe Commit Message Prefixes

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation change
- `style:` formatting/style (no logic change)
- `refactor:` internal restructure (no behavior change)
- `test:` adding or updating tests
- `chore:` maintenance tasks
- `perf:` performance improvement
- `ci:` changes to automation/deploy pipeline
