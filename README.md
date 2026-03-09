# Action Jackson Installs & Builds Software

> Powers the dual web presence:
> - `actionjacksoninstalls.com` — public-facing branding/business site ("Installs & Builds Software")
> - `dev.actionjacksoninstalls.com` — personal/resume portfolio ("Builds" half)

[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com) [![Node.js](https://img.shields.io/badge/node.js-supported-green)](https://nodejs.org)

## Table of Contents

- [About](#about)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Local Development](#local-development)
  - [Environment Variables](#environment-variables)
  - [Docker Deployment](#docker-deployment)
- [Testing](#testing)
- [API Overview](#api-overview)
- [Dual-Domain Semantics](#dual-domain-semantics)
- [Auto Deploy / Production](#auto-deploy--production)
- [Customization](#customization)
- [Contributing](#contributing)
- [Recent Major Updates](#recent-major-updates)
- [Future Enhancements](#future-enhancements)
- [License](#license)
- [Contact](#contact)

## About

This repository powers the Action Jackson web presence: a combined business/branding site and personal portfolio. A separated Next.js frontend and Express API backend support two related but distinct domains, separating "Installs" (business) from "Builds" (resume/portfolio) while sharing underlying infrastructure.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express
- **Database:** MongoDB via Mongoose
- **File Storage:** MinIO (S3-compatible object storage)
- **Authentication:** JWT (jsonwebtoken/jose), bcrypt, express-session with MongoStore
- **Email:** Nodemailer (for confirmations and notifications)
- **Animations:** Framer Motion
- **PDF Generation:** @react-pdf/renderer (resume downloads)
- **Testing:** Jest + Supertest + MongoDB Memory Server (backend), Vitest + React Testing Library (frontend)
- **Containerization:** Docker & Docker Compose (3-service architecture)

## Features

### Core Application
- **Dual-Domain Support**: Business site and developer portfolio via Next.js middleware routing
- **Admin Dashboard**: JWT-authenticated management interface for quotes, schedules, invoices, consultations, and cost items
- **Professional Theming**: Custom dark theme with accent color system, glow effects, and mesh gradients
- **MongoDB Persistence**: Flexible connection with authentication support
- **S3-Compatible File Storage**: MinIO integration with comprehensive file management
- **Consultation System**: Intake form with property details, service interests, and admin tracking
- **Comprehensive Testing**: Backend (10 test files) and frontend (5 test files) coverage
- **Docker Deployment**: 3-service architecture (mongo, api, frontend) for consistent environments

### Advanced Quote System
- **Multi-Step Quote Process**: Package selection, services, equipment, contact & summary
- **Professional Equipment Catalog**: Detailed specifications, smart recommendations, filtering
- **Real-Time Pricing**: Instant calculations with comprehensive validation
- **Cost Item Management**: Admin-configurable pricing with labor rates and bill of materials

### Professional Scheduling System
- **Advanced Conflict Detection**: 1-hour buffers with real-time checking
- **Business Hours Enforcement**: Monday-Friday, 8 AM - 6 PM, 30-minute intervals
- **Automated Email Confirmations**: Customer and admin notifications
- **Comprehensive Validation**: Date constraints, duplicate prevention, business logic

### Invoice Management System
- **Quote Integration**: Seamless conversion from quotes to invoices
- **Auto-Generated Numbers**: Format INV-YYYY-NNNN with collision protection
- **API Security**: Optional API key authentication for external access
- **File Attachments**: Support for invoice documents, receipts, and supporting materials

### Enhanced Security Features
- **Admin Auth**: JWT access/refresh tokens, bcrypt, account lockout, role-based access
- **Multi-Layer Rate Limiting**: Different limits for quotes, calculations, scheduling, file operations, admin
- **Comprehensive Input Validation**: Business logic constraints and sanitization
- **Email Security**: Domain validation, disposable email blocking
- **Anti-Spam Protection**: Honeypot fields, time-based restrictions
- **File Security**: Type validation, malicious file detection, checksum verification, access control

## Prerequisites

- Git
- Node.js 18+ (LTS recommended)
- npm
- MongoDB instance (self-hosted, remote, or via Docker Compose)
- MinIO server (for file storage, optional)
- Docker & Docker Compose (if using containerized deployment)

## Getting Started

### Local Development

**Backend** (Express API, port 3001):
```bash
git clone https://github.com/DaSonOfPoseidon/action-jackson.git
cd action-jackson
npm install
cp .env.example .env  # Edit with your configuration
npm run dev            # Starts on port 3001
```

**Frontend** (Next.js, port 3000):
```bash
cd frontend
npm install
npm run dev            # Starts on port 3000, proxies /api and /auth to :3001
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Database
MONGO_URI=mongodb://username:password@host:27017/action_jackson?authSource=admin
MONGO_ROOT_PASSWORD=strong-root-password        # Docker only
MONGO_DEV_PASSWORD=dev-password                  # Docker only

# Email (Nodemailer)
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password                     # Use app-specific passwords
ADMIN_EMAIL=admin@actionjacksoninstalls.com

# Security & Auth
ADMIN_JWT_SECRET=64-char-random-jwt-secret
ADMIN_SESSION_SECRET=64-char-random-session-secret
INVOICE_API_KEY=your-secure-api-key              # Optional

# Admin Defaults
ADMIN_DEFAULT_USERNAME=admin
ADMIN_DEFAULT_PASSWORD=ChangeThisSecurePassword123!

# Auth Timeouts
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_TIME=1800000                        # 30 min in ms
JWT_EXPIRE=900                                   # 15 min in seconds
REFRESH_TOKEN_EXPIRE=604800                      # 7 days in seconds

# MinIO S3 Storage (optional)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio-access-key
MINIO_SECRET_KEY=minio-secret-key
MINIO_USE_SSL=false
MINIO_BUCKET_NAME=actionjackson-files

# Server
PORT=3001                                        # Backend API port
NODE_ENV=development
```

Frontend environment (set via Docker or `frontend/.env.local`):
```env
API_URL=http://localhost:3001                     # Docker uses http://api:3001
```

### Docker Deployment

The application runs as 3 services:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| **mongo** | `arm64v8/mongo:4.4.18` | 27017 | MongoDB with auth |
| **api** | Custom (Dockerfile) | 3001 (internal) | Express backend |
| **frontend** | Custom (./frontend) | 3000 | Next.js frontend |

```bash
docker compose up --build -d    # Build and start all services
docker compose ps               # Verify health status
docker compose logs -f           # Follow logs
docker compose down              # Stop services
```

Cloudflare Tunnel labels are on the frontend service for automatic routing.

## Testing

**Backend** (from project root):
```bash
npm test                         # Jest + Supertest (10 test files)
```

**Frontend** (from /frontend):
```bash
cd frontend && npm test          # Vitest + React Testing Library (5 test files)
```

Test coverage includes:
- **Backend**: Admin API, auth middleware, consultations, cost items, files, models, routes, server health
- **Frontend**: Validation utilities, page rendering, component behavior
- **Infrastructure**: MongoDB Memory Server for isolated DB, Nodemailer mocking, MinIO mocking

## API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/home` | Services, testimonials, and landing data |
| GET | `/api/shared/services` | Shared service definitions |
| GET | `/api/scheduling/slots` | Available time slots with conflict checking |
| POST | `/api/scheduling/book` | Book appointment with validation and email |
| GET | `/api/quotes/calculate` | Real-time quote calculation |
| POST | `/api/quotes/create` | Submit quote with equipment and validation |
| GET/POST | `/api/invoices` | Invoice listing and creation |
| POST | `/api/invoices/from-quote/:quoteId` | Convert quote to invoice |
| PUT/DELETE | `/api/invoices/:id` | Update or delete invoice |
| POST | `/api/files/upload` | Upload files with security validation |
| GET | `/api/files/download/:fileId` | Download with access control |
| GET | `/api/files/presigned/:fileId` | Generate presigned URLs |
| DELETE | `/api/files/:fileId` | Delete files (soft delete) |
| GET | `/api/estimates/cost-items` | Active cost items by category |
| POST | `/api/consultations` | Submit consultation request |
| POST | `/auth/login` | Admin login (returns JWT) |
| POST | `/auth/logout` | Admin logout |
| POST | `/auth/refresh` | Refresh JWT access token |
| GET | `/api/admin/dashboard` | Admin dashboard metrics (JWT-protected) |
| GET/PUT | `/api/admin/quotes/*` | Quote management (JWT-protected) |
| GET/PUT | `/api/admin/schedules/*` | Schedule management (JWT-protected) |
| GET/POST/PUT/DELETE | `/api/admin/cost-items/*` | Cost item CRUD (JWT-protected) |
| GET/PUT | `/api/admin/consultations/*` | Consultation management (JWT-protected) |
| GET/PUT | `/api/admin/settings/*` | Settings management (JWT-protected) |
| GET | `/healthz` | Health check with database ping |

## Dual-Domain Semantics

Domain routing is handled by Next.js middleware (`frontend/middleware.ts`):

- **`actionjacksoninstalls.com`** — Business site served from `app/(business)/` route group
- **`dev.actionjacksoninstalls.com`** — Portfolio served from `app/portfolio/` (middleware transparently rewrites requests when the `dev.` subdomain is detected)

The Express backend is domain-agnostic and serves JSON APIs to both variants.

Contributors and automation should preserve this separation unless a deliberate change is requested.

## Auto Deploy / Production

```bash
#!/bin/sh
cd /path/to/action-jackson
git pull origin main
docker compose up -d --build
```

This can be automated via webhooks or CI/CD pipelines triggered by repository updates.

## Customization

- **Business Pages**: Edit React components in `frontend/app/(business)/`
- **Portfolio Pages**: Edit React components in `frontend/app/portfolio/`
- **Admin Dashboard**: Edit components in `frontend/app/admin/` and `frontend/components/admin/`
- **Styling**: Tailwind CSS configuration in `frontend/tailwind.config.ts` (colors, shadows, animations)
- **Reusable Components**: `frontend/components/ui/`, `frontend/components/sections/`
- **Static Data**: `frontend/data/projects.json`, `frontend/data/resume.json`, `frontend/data/skills.json`
- **Services**: Update service definitions via the admin dashboard or database

## Contributing

1. Fork the repository
2. Create a descriptive feature/fix branch (e.g., `feat/resume-update`, `fix/docker-health`)
3. Implement changes and test locally (`npm test` for backend, `cd frontend && npm test` for frontend)
4. Commit with clear, imperative messages: `feat: add new project section to resume`
5. Open a pull request with rationale, test steps, and potential impacts
6. After merge, deployment hooks should rebuild and refresh the live site

## Recent Major Updates

### Next.js Frontend Migration (Latest)
- Complete frontend rewrite from EJS server-side templating to Next.js 14 with App Router
- React 18 + TypeScript + Tailwind CSS with custom dark theme
- Domain routing via Next.js middleware replacing Express subdomain detection
- Admin dashboard with JWT authentication and full management capabilities
- Portfolio with resume PDF generation and project showcase
- Framer Motion animations throughout the site

### Admin Authentication & Dashboard
- JWT + bcrypt authentication with account lockout and role-based access
- Consultation request tracking and cost item management
- Global settings with configurable labor rates

### S3-Compatible File Storage System
- MinIO integration with comprehensive file management, security, and audit trails

### Professional Scheduling System
- Advanced conflict detection, business hours enforcement, automated email confirmations

### Advanced Equipment Catalog & Quote System
- Multi-step quote process with equipment catalog and real-time pricing
- Cost item database with bill of materials and labor rate calculations

## Future Enhancements

- **Database Optimizations**: Connection pooling and query optimization
- **Advanced Filtering**: Equipment filtering UI with dynamic criteria
- **Enhanced Monitoring**: Comprehensive logging and error tracking
- **Performance Improvements**: Caching strategies and CDN integration
- **Advanced File Features**: File versioning, thumbnail generation, and metadata extraction
- **Mobile App**: React Native app for appointment scheduling
- **Cloud Integration**: Support for additional S3-compatible providers (AWS S3, DigitalOcean Spaces)

## License

No license file is currently included. Consider adding a `LICENSE` file to clarify usage terms.

## Contact

Maintained by **Jackson Keithley** / Action Jackson Installs & Software.

- **Website:** [actionjacksoninstalls.com](https://actionjacksoninstalls.com)
- **Portfolio:** [dev.actionjacksoninstalls.com](https://dev.actionjacksoninstalls.com)
- **GitHub:** [DaSonOfPoseidon](https://github.com/DaSonOfPoseidon)
