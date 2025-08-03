# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm install` - Install dependencies
- `npm start` - Start the application (runs `node server.js`)
- `node server.js` - Direct server startup
- `npx nodemon server.js` - Development with auto-restart
- `docker compose up --build -d` - Containerized deployment
- `docker compose logs -f` - View container logs
- `docker compose down` - Stop containers

## Architecture Overview

This is a dual-domain Express.js application serving both business and portfolio content for Action Jackson Installs & Builds Software.

### Core Components

**Application Entry**: `server.js` - Main Express server with middleware, domain detection, and route mounting

**Domain Separation**: The application serves different content based on subdomain:
- `actionjacksoninstalls.com` - Business/branding site (variant: 'business')
- `dev.actionjacksoninstalls.com` - Personal portfolio (variant: 'portfolio')

**Route Structure**: Routes are organized in `/routes/` as separate modules:
- `home.js` - Services, testimonials, landing data API
- `scheduling.js` - Booking system and time slot management
- `quotes.js` - Quote submission with email notifications
- `shared.js` - Shared service definitions
- `invoices.js` - Invoice CRUD operations

**Data Models**: MongoDB schemas in `/models/` using Mongoose:
- `Service.js` - Service offerings
- `Schedule.js` - Booking/appointment data
- `Quote.js` - Quote requests
- `Testimonial.js` - Customer testimonials
- `Invoice.js` - Billing/invoice records

**Frontend**: EJS templating with static assets in `/public/`
- Views in `/views/` with shared partials
- CSS/JS organized by business vs software themes
- Client-side scripts for quotes, scheduling, home page

### Key Middleware & Features

- Helmet CSP with specific allowlists for FontAwesome and Google Fonts
- Compression and cookie parsing
- Trust proxy configuration for subdomain detection
- Health check endpoint at `/healthz` with database ping
- Error handling with custom error pages

### Environment Configuration

Required `.env` variables:
- `MONGO_URI` - MongoDB connection string
- `EMAIL_USER`, `EMAIL_PASS` - Nodemailer SMTP credentials
- `ADMIN_EMAIL` - Quote notification recipient
- `PORT` - Server port (defaults to 3000)
- `NODE_ENV` - Environment mode

### Testing & Verification

Always verify critical paths after changes:
- Server starts without errors
- `/healthz` returns 200 OK
- Main pages render correctly for both domains
- Database connection is established

### Deployment Notes

Production deployment via Docker Compose with automatic rebuild. The application includes webhook-ready auto-deploy capability with health verification.