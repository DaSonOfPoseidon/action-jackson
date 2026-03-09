# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend (root directory, port 3001)
- `npm install` - Install dependencies
- `npm start` - Start the API server (runs `node server.js`)
- `npm run dev` - Development with auto-restart (uses nodemon)
- `npm test` - Run the backend test suite (10 test files)
- `node server.js` - Direct server startup

### Frontend (`/frontend/`, port 3000)
- `cd frontend && npm install` - Install frontend dependencies
- `cd frontend && npm run dev` - Next.js dev server
- `cd frontend && npm run build` - Production build
- `cd frontend && npm run lint` - ESLint
- `cd frontend && npm test` - Vitest test suite

### Docker (3-service architecture)
- `docker compose up --build -d` - Build and start all services (mongo, api, frontend)
- `docker compose logs -f` - View container logs
- `docker compose down` - Stop containers
- `docker compose ps` - Check service health

## UI/UX Guidelines

- Checkboxes and labels should always be on the same line

## Architecture Overview

This is a separated Next.js 14 frontend + Express API backend serving both business and portfolio content for Action Jackson Installs & Builds Software.

### Core Components

**Application Entry**: `server.js` - Express API server with CORS, session management (MongoStore), JSON-only responses, and route mounting. Default port 3001.

**Domain Separation**: Domain routing is handled by the Next.js middleware (`frontend/middleware.ts`):
- `actionjacksoninstalls.com` - Business/branding site (route group: `(business)`)
- `dev.actionjacksoninstalls.com` - Personal portfolio (route group: `portfolio`)
- The middleware detects `dev.` subdomain and rewrites requests to `/portfolio` paths transparently

**Route Structure**: Routes are organized in `/routes/` as separate modules (all prefixed with `/api/` or `/auth/`):
- `home.js` - Services, testimonials, landing data API
- `scheduling.js` - Advanced booking system with conflict detection, business hours validation, and email confirmations
- `quotes.js` - Quote submission with comprehensive security validation and equipment catalog
- `shared.js` - Shared service definitions
- `invoices.js` - Invoice CRUD operations with quote integration and API key authentication
- `files.js` - File management API with S3-compatible storage operations and comprehensive security
- `auth.js` - Admin authentication endpoints (login, logout, JWT token management, password reset, CSRF protection)
- `admin-api.js` - Admin dashboard API (JWT-protected via `requireAuth` middleware): dashboard metrics, quote/schedule/invoice/consultation management, cost item CRUD, settings management
- `estimates.js` - Cost items lookup API with labor rate calculations
- `consultations.js` - Consultation request handling with validation, email notifications, and unique request numbers

**Data Models**: MongoDB schemas in `/models/` using Mongoose (10 models):
- `Service.js` - Service offerings
- `Schedule.js` - Booking/appointment data with validation, audit trails, and business hours enforcement
- `Quote.js` - Quote requests with equipment integration, comprehensive validation, and file attachments
- `Testimonial.js` - Customer testimonials
- `Invoice.js` - Billing/invoice records with quote integration, auto-generated invoice numbers (INV-YYYY-NNNN), and file attachments
- `Attachment.js` - File metadata storage with S3 integration, security controls, and audit trails
- `Admin.js` - Admin user accounts with bcrypt password hashing, role-based access (admin/superadmin), account lockout after failed attempts
- `CostItem.js` - Equipment/service catalog with pricing, bill of materials, categories (Cable Runs/Services/Centralization/Equipment/Deposits), and labor rate calculations
- `ConsultationRequest.js` - Consultation inquiries with unique request numbers, property details, status tracking
- `Setting.js` - Global settings singleton (labor rate configuration)

**Frontend**: Next.js 14 application in `/frontend/`
- **Framework**: App Router, React 18, TypeScript, Tailwind CSS
- **Route Groups**:
  - `(business)` - Business site pages (home, about, get-started, services/networking|cameras|smart-home|wiring)
  - `portfolio` - Portfolio pages (landing, about, projects, resume with PDF download)
  - `admin` - Admin dashboard (login, dashboard, quotes, schedules, invoices, consultations, cost-items)
- **Component Library**:
  - `components/admin/` - Sidebar, DataTable, StatsCard, StatusBadge, PageHeader
  - `components/portfolio/` - ProjectCard, Timeline, SkillGrid, ResumePDF, AnimateIn
  - `components/sections/` - Hero, ServiceCard, PackageCard, FAQAccordion, NetworkDiagram, CTABand, etc.
  - `components/ui/` - Button, Card, Input, Select, Textarea, Badge
  - `components/icons/` - Service-specific visual icons
  - `components/layout/` - Header, Footer (business theme)
- **Static Data**: `data/projects.json`, `data/resume.json`, `data/skills.json`
- **API Client**: `lib/api.ts` (public endpoints), `lib/admin/api.ts` (admin endpoints with auto-refresh on 401)
- **Auth Context**: `lib/admin/auth-context.tsx` - React context for admin authentication state
- **Types**: `lib/admin/types.ts`, `lib/portfolio-types.ts`, `lib/services.ts`
- **Validation**: `lib/validation.ts` - Email, phone, name validation with disposable email blocking
- **Middleware**: `middleware.ts` handles domain-based rewriting and admin JWT authentication (via `jose` library)
- **Config**: `next.config.mjs` with standalone output and API/auth proxy rewrites to backend
- **Styling**: Tailwind CSS with custom dark theme, accent color system (green, purple, orange, cyan, pink), glow effects, mesh gradients, and custom animations
- **Fonts**: Syne (headings), Figtree (body), IBM Plex Mono (monospace)

**Middleware** (`/middleware/`):
- `auth.js` - TokenManager class (JWT generation/verification), requireAuth, requireRole, requireSession, csrfProtection, adminPageAuth, adminSecurityHeaders
- `fileAuth.js` - File access control (checkFileAccess, checkUploadPermission, validateFileOperation, checkFileSizeLimits)

**Services** (`/services/`):
- `fileStorage.js` - FileStorageService class for MinIO/S3-compatible object storage with file validation

**Config** (`/config/`):
- `storage.js` - MinIO client configuration and public URL generation

**Testing Infrastructure**:
- Backend: Jest + Supertest + MongoDB Memory Server (10 test files in `/tests/`): admin, auth-middleware, consultations, cost-items, files, models, routes, server tests
- Frontend: Vitest + React Testing Library (5 test files in `/frontend/__tests__/`): validation, page rendering, component tests
- Nodemailer mocking for email tests
- MinIO mocking for file storage tests

### Key Middleware & Features

- CORS configured for Next.js frontend (`localhost:3000`, `actionjacksoninstalls.com`, `www.actionjacksoninstalls.com`)
- Session management with MongoStore (`admin-session` cookie, 1-hour maxAge, rolling, HttpOnly, secure in production)
- Helmet CSP with allowlists for FontAwesome, Google Fonts, and Cloudflare Insights
- Compression enabled
- Trust proxy: 1 (Cloudflare)
- Health check endpoint at `/healthz` with database ping
- Error handling returns JSON responses (not HTML)
- **Admin Authentication System**:
  - JWT access tokens (15-minute expiry) + refresh tokens (7-day expiry)
  - bcrypt password hashing with account lockout (5 failed attempts, 30-minute lock)
  - Role hierarchy (admin/superadmin)
  - CSRF protection on state-changing requests
  - Session activity tracking with 60-minute timeout
- **Enhanced Security Features**:
  - **Multi-layer Rate Limiting**: 3 quotes/15min, 30 calculations/min, 5 scheduling/15min, 20 file uploads/15min, 100 admin requests/15min per IP
  - **Comprehensive Input Validation**: express-validator with business logic constraints
  - **Email Security**: Domain validation, disposable email blocking, duplicate prevention
  - **Anti-Spam Protection**: Honeypot fields, time-based restrictions, IP tracking
  - **Request Security**: Size limits (10MB), sanitization, user agent logging
  - **Business Logic Protection**: Service minimums, appointment conflicts, equipment limits
  - **File Security**: Type validation, size limits, checksum verification, access control, malicious file detection
  - **Audit Trails**: IP tracking, user agent logging, scheduling history, file operation logging
- **Advanced Scheduling System**:
  - **Conflict Detection**: 1-hour buffer between appointments with real-time checking
  - **Business Hours Validation**: Monday-Friday, 8 AM - 6 PM, 30-minute intervals only
  - **Email Confirmations**: Automated customer and admin notifications
  - **Duplicate Prevention**: 24-hour cooldown per email address
- **Professional Invoice System**:
  - **Quote Integration**: Seamless conversion from quotes to invoices
  - **Auto-Generated Numbers**: Format INV-YYYY-NNNN with collision protection
  - **API Security**: Optional API key authentication for external access
  - **Audit Logging**: Complete trail of invoice operations
  - **File Attachments**: Support for invoice documents, receipts, and supporting materials
- **S3-Compatible File Storage System**:
  - **MinIO Integration**: Scalable object storage with S3-compatible API
  - **Multi-Environment Support**: Separate buckets for dev, production, and test environments
  - **Comprehensive File Management**: Upload, download, delete, presigned URLs, and file statistics
  - **Security Controls**: File type validation, size limits, access permissions, and audit trails
  - **Metadata Storage**: MongoDB integration for file metadata, ownership, and lifecycle management

### Environment Configuration

Required `.env` variables:

**Database**:
- `MONGO_URI` - MongoDB connection string with authentication
- `MONGO_ROOT_PASSWORD` - MongoDB root password (Docker)
- `MONGO_DEV_PASSWORD` - MongoDB dev user password (Docker)

**Email**:
- `EMAIL_USER`, `EMAIL_PASS` - Nodemailer SMTP credentials for confirmations
- `ADMIN_EMAIL` - Quote and appointment notification recipient

**Security & Auth**:
- `ADMIN_JWT_SECRET` - Secret for JWT token signing (64+ chars recommended)
- `ADMIN_SESSION_SECRET` - Secret for session management (64+ chars recommended)
- `INVOICE_API_KEY` - Optional API key for invoice system security

**Admin Defaults**:
- `ADMIN_DEFAULT_USERNAME` - Default admin username for initial setup
- `ADMIN_DEFAULT_PASSWORD` - Default admin password for initial setup

**Auth Timeouts**:
- `MAX_LOGIN_ATTEMPTS` - Failed login attempts before lockout (default: 5)
- `ACCOUNT_LOCK_TIME` - Lockout duration in ms (default: 1800000 / 30 min)
- `JWT_EXPIRE` - Access token expiry in seconds (default: 900 / 15 min)
- `REFRESH_TOKEN_EXPIRE` - Refresh token expiry in seconds (default: 604800 / 7 days)

**MinIO S3 Storage**:
- `MINIO_ENDPOINT` - MinIO server endpoint
- `MINIO_PORT` - MinIO server port (default 9000)
- `MINIO_ACCESS_KEY` - MinIO access key for authentication
- `MINIO_SECRET_KEY` - MinIO secret key for authentication
- `MINIO_USE_SSL` - Whether to use SSL for MinIO connections (true/false)
- `MINIO_BUCKET_NAME` - Base bucket name for file storage (defaults to actionjackson-files)

**Server**:
- `PORT` - Backend API port (defaults to 3001)
- `NODE_ENV` - Environment mode (development/production/test)

**Frontend** (set in Docker or `.env.local`):
- `API_URL` - Backend API URL (defaults to `http://localhost:3001`, Docker uses `http://api:3001`)

**Security Notes**:
- MongoDB should use authentication with strong passwords (12+ characters)
- Email passwords should be app-specific passwords, not account passwords
- JWT and session secrets should be cryptographically random, 64+ characters
- See `.env.example` for complete configuration template

### Testing & Verification

Always run tests after making changes:
- `npm test` - Backend test suite (10 test files covering security, business logic, and API integration)
- `cd frontend && npm test` - Frontend test suite (validation, rendering, components)
- `/healthz` returns 200 OK with `{app: 'ok', db: 'ok'}`
- API endpoints return JSON responses
- Admin dashboard accessible at `/admin` with valid JWT

### Deployment Notes

Production deployment via Docker Compose with 3 services:
- **mongo** (`arm64v8/mongo:4.4.18`) - Port 27017, persistent volume, init script for auth setup
- **api** (custom Dockerfile) - Port 3001 (internal), depends on mongo
- **frontend** (custom Dockerfile in `./frontend`) - Port 3000, depends on api, standalone Next.js build

Cloudflare Tunnel labels are on the **frontend** service:
- `cloudflare-tunnel.enable: "true"`
- `cloudflare-tunnel.subdomain: "www"`
- `cloudflare-tunnel.port: "3000"`

All services have healthchecks and are on a shared `app-network` bridge network.

**MinIO Deployment Requirements**:
- Dedicated storage server with MinIO installed and configured
- Network connectivity between application servers and storage server
- Proper firewall rules for MinIO port (default 9000)

## Recent Major Updates

### Next.js Frontend Migration (Latest)
- **Complete frontend rewrite** from EJS server-side templating to Next.js 14 with App Router
- **React 18 + TypeScript + Tailwind CSS** with custom dark theme and accent color system
- **Domain routing via middleware** replacing Express subdomain detection
- **Admin dashboard** with JWT authentication, full CRUD for quotes/schedules/invoices/consultations/cost-items
- **Portfolio section** with resume PDF generation (@react-pdf/renderer), project showcase, skill grid
- **Business pages** with service-specific pages, consultation intake form, package cards
- **Framer Motion animations** throughout the site
- **API proxy** via Next.js rewrites to backend on port 3001

### Admin Authentication & Dashboard
- JWT + bcrypt authentication with account lockout
- Role-based access control (admin/superadmin)
- Dashboard with metrics, recent activity, and management tools
- Consultation request tracking with status workflow
- Cost item/equipment catalog management with labor rate settings

### S3-Compatible File Storage System
- MinIO integration with comprehensive file management API
- File type validation, size limits, checksum verification, access control
- MongoDB metadata storage with audit trails

### Professional Scheduling System
- Advanced conflict detection with 1-hour buffers
- Business hours enforcement and automated email confirmations

### Advanced Equipment Catalog & Quote System
- Multi-step quote process with equipment catalog and real-time pricing
- Cost item database with bill of materials and labor rate calculations

## Legacy Notes

The `/portfolio/` directory at the project root appears to be a legacy artifact, superseded by `/frontend/app/portfolio/`. The `/public/` directory at the root may contain legacy static assets from the EJS era.
