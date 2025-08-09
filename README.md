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
- [API Overview](#api-overview)
- [Dual-Domain Semantics](#dual-domain-semantics)
- [Auto Deploy / Production](#auto-deploy--production)
- [Customization](#customization)
- [Contributing](#contributing)
- [Future Enhancements](#future-enhancements)
- [License](#license)
- [Contact](#contact)

## About

This repository powers the Action Jackson web presence: a combined business/branding site and personal portfolio. The codebase supports two related but distinct domains, separating "Installs" (business) from "Builds" (resume/portfolio) while sharing underlying infrastructure.

## Tech Stack

- **Runtime:** Node.js
- **Web Server:** Express
- **Templating:** EJS
- **Database:** MongoDB via Mongoose
- **Email:** Nodemailer (for quote submission notifications)
- **Styling & Assets:** Custom CSS/JS in `public/`
- **Testing:** Jest with Supertest and MongoDB Memory Server
- **Containerization:** Docker & Docker Compose

## Features

### Core Application
- **Dual-Domain Support**: Business site and developer portfolio with shared infrastructure
- **Professional Theming**: Dark theme with business-grade UI/UX design
- **MongoDB Persistence**: Flexible connection with authentication support
- **Comprehensive Testing**: 62+ tests covering security, functionality, and integrations
- **Docker Deployment**: Containerized for consistent development and production environments

### Advanced Quote System
- **Multi-Step Quote Process**: Package selection → Services → Equipment → Contact & Summary
- **Professional Equipment Catalog**: Detailed specifications, smart recommendations, filtering
- **Real-Time Pricing**: Instant calculations with comprehensive validation
- **Final Quote Summary**: Professional breakdown before submission
- **Enhanced Security**: Rate limiting, input validation, spam protection, audit trails

### Professional Scheduling System
- **Advanced Conflict Detection**: 1-hour buffers with real-time checking
- **Business Hours Enforcement**: Monday-Friday, 8 AM - 6 PM, 30-minute intervals
- **Automated Email Confirmations**: Customer and admin notifications
- **Comprehensive Validation**: Date constraints, duplicate prevention, business logic
- **Audit Trail System**: IP tracking, user agent logging, appointment history

### Invoice Management System
- **Quote Integration**: Seamless conversion from quotes to invoices
- **Auto-Generated Numbers**: Format INV-YYYY-NNNN with collision protection
- **API Security**: Optional API key authentication for external access
- **Complete CRUD Operations**: Create, read, update, delete with proper validation

### Enhanced Security Features
- **Multi-Layer Rate Limiting**: Different limits for quotes, calculations, scheduling
- **Comprehensive Input Validation**: Business logic constraints and sanitization
- **Email Security**: Domain validation, disposable email blocking
- **Anti-Spam Protection**: Honeypot fields, time-based restrictions
- **Request Security**: Size limits, user agent logging, IP tracking

## Prerequisites

- Git
- Node.js 18+ (LTS recommended)
- npm
- MongoDB instance (self-hosted, remote, or via Docker Compose)
- Docker & Docker Compose (if using containerized deployment)

## Getting Started

### Local Development

```bash
# Clone the repository
git clone https://github.com/DaSonOfPoseidon/action-jackson.git
cd action-jackson

# Install dependencies
npm install

# Create .env file (see Environment Variables section below)
# Then start the application
npm start
# or
node server.js

# For development with auto-restart
npm run dev
```

By default, the app listens on port 3000 unless overridden via the `PORT` environment variable.

### Testing

Run the comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage
```

The test suite includes:
- **Server Tests**: Middleware, routing, error handling, health checks
- **API Route Tests**: All endpoints with comprehensive database mocking
- **Model Tests**: Enhanced validation, scheduling constraints, quote integration
- **Security Tests**: XSS prevention, spam protection, rate limiting enforcement  
- **Business Logic Tests**: Appointment conflicts, service requirements, equipment limits
- **Integration Tests**: Email confirmations, quote-to-invoice conversion, audit logging

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database Configuration
MONGO_URI=mongodb://username:password@host:port/database?authSource=admin

# Email Configuration (for confirmations and notifications)
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password  # Use app-specific passwords, not account password
ADMIN_EMAIL=admin@actionjacksoninstalls.com

# Security Configuration
INVOICE_API_KEY=your-secure-api-key-for-invoices  # Optional but recommended

# Server Configuration  
PORT=3000  # optional, defaults to 3000
NODE_ENV=development
```

> **Security Note:** Never commit secrets to version control. The `.env` file should be included in `.gitignore`.

### Docker Deployment

For containerized deployment:

```bash
# Build and run with Docker Compose
docker compose up -d --build

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## API Overview

| Method | Endpoint                      | Description                                    |
|--------|-------------------------------|------------------------------------------------|
| GET    | `/api/home`                   | Fetch services, testimonials, and landing data |
| GET    | `/api/scheduling/slots`       | List available scheduling time slots with conflict checking |
| POST   | `/api/scheduling/book`        | Book appointment with validation and email confirmations |
| GET    | `/api/scheduling/appointment/:id` | Get appointment details for verification |
| DELETE | `/api/scheduling/appointment/:id` | Cancel/delete an appointment |
| GET    | `/api/quotes/calculate`       | Real-time quote calculation with equipment pricing |
| POST   | `/api/quotes/create`          | Submit comprehensive quote with equipment and validation |
| GET    | `/api/shared/services`        | Retrieve shared service definitions |
| GET    | `/api/invoices`               | List invoices with pagination and optional authentication |
| POST   | `/api/invoices`               | Create new invoice with validation |
| POST   | `/api/invoices/from-quote/:quoteId` | Convert quote to invoice seamlessly |
| PUT    | `/api/invoices/:id`           | Update existing invoice |
| DELETE | `/api/invoices/:id`           | Delete invoice |
| GET    | `/healthz`                    | Health check with database connectivity test |

## Dual-Domain Semantics

The application surfaces content differences based on the requesting domain:

- **`actionjacksoninstalls.com`** — Primary business/branding site emphasizing professional services
- **`dev.actionjacksoninstalls.com`** — Personal portfolio and resume view showcasing development work

Contributors and automation should preserve this separation unless a deliberate change is requested.

## Auto Deploy / Production

Typical production deployment workflow for self-hosted environments:

```bash
#!/bin/sh
cd /path/to/action-jackson
git pull origin main
docker compose pull
docker compose up -d --build
```

This can be automated via webhooks or CI/CD pipelines triggered by repository updates.

## Customization

The application is designed for easy content customization:

- **Templates:** Modify EJS files in `views/` for page structure
- **Styles:** Update CSS files in `public/css/`
- **Content:** Edit template data or add database records for dynamic content
- **Services:** Update service definitions via the API or database

## Contributing

1. Fork the repository
2. Create a descriptive feature/fix branch (e.g., `feat/resume-update`, `fix/docker-health`)
3. Implement changes and test locally (Node.js or Docker)
4. Commit with clear, imperative messages: `feat: add new project section to resume`
5. Open a pull request with rationale, test steps, and potential impacts
6. After merge, deployment hooks should rebuild and refresh the live site

## Recent Major Updates

### ✅ Enhanced Services System (Latest)
- Updated service options with client device setup and host/server device setup
- Improved pricing structure for different device types
- Enhanced final quote summary with detailed service breakdowns

### ✅ Advanced Equipment Catalog System  
- Comprehensive equipment database with detailed specifications
- Smart recommendations based on speed tier selection
- Professional categorization and filtering capabilities
- Enhanced equipment cards with features and pricing

### ✅ Professional Scheduling System
- Advanced conflict detection with 1-hour buffers
- Business hours enforcement and validation
- Automated email confirmations for customers and admins
- Comprehensive audit trail system

### ✅ Enhanced Security & Validation
- Multi-layer rate limiting across all endpoints
- Comprehensive input validation and sanitization
- Business logic protection against abuse
- Professional audit logging and IP tracking

## Future Enhancements

- **Database Optimizations**: Connection pooling and query optimization
- **Advanced Filtering**: Equipment filtering UI with dynamic criteria
- **Enhanced Monitoring**: Comprehensive logging and error tracking
- **Performance Improvements**: Caching strategies and CDN integration
- **Mobile App**: React Native app for appointment scheduling
- **Analytics Dashboard**: Business intelligence and reporting features
- **Advanced Authentication**: Role-based access control system
- **API Versioning**: Support for multiple API versions

## License

No license file is currently included. Consider adding a `LICENSE` file with MIT or another preferred open-source license to clarify usage terms.

## Contact

Maintained by **Jackson Keithley** / Action Jackson Installs & Builds Software.

- **Website:** [actionjacksoninstalls.com](https://actionjacksoninstalls.com)
- **Portfolio:** [dev.actionjacksoninstalls.com](https://dev.actionjacksoninstalls.com)
- **GitHub:** [DaSonOfPoseidon](https://github.com/DaSonOfPoseidon)

---

*Built with ❤️ and lots of ☕*