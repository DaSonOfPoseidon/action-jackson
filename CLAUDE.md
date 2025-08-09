# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm install` - Install dependencies
- `npm start` - Start the application (runs `node server.js`)
- `npm run dev` - Development with auto-restart (uses nodemon)
- `npm test` - Run the comprehensive test suite
- `node server.js` - Direct server startup
- `docker compose up --build -d` - Containerized deployment
- `docker compose logs -f` - View container logs
- `docker compose down` - Stop containers

## UI/UX Guidelines

- Checkboxes and labels should always be on the same line

## Architecture Overview

This is a dual-domain Express.js application serving both business and portfolio content for Action Jackson Installs & Builds Software.

### Core Components

**Application Entry**: `server.js` - Main Express server with middleware, domain detection, and route mounting

**Domain Separation**: The application serves different content based on subdomain:
- `actionjacksoninstalls.com` - Business/branding site (variant: 'business')
- `dev.actionjacksoninstalls.com` - Personal portfolio (variant: 'portfolio')

**Route Structure**: Routes are organized in `/routes/` as separate modules:
- `home.js` - Services, testimonials, landing data API
- `scheduling.js` - Advanced booking system with comprehensive validation, conflict detection, and email confirmations
- `quotes.js` - Quote submission with comprehensive security validation and equipment catalog
- `shared.js` - Shared service definitions
- `invoices.js` - Invoice CRUD operations with quote integration and API key authentication

**Data Models**: MongoDB schemas in `/models/` using Mongoose:
- `Service.js` - Service offerings
- `Schedule.js` - Enhanced booking/appointment data with validation, audit trails, and business hours enforcement
- `Quote.js` - Quote requests with equipment integration and comprehensive validation
- `Testimonial.js` - Customer testimonials
- `Invoice.js` - Billing/invoice records with quote integration and auto-generated invoice numbers

**Frontend**: EJS templating with static assets in `/public/`
- Views in `/views/` with shared partials and professional dark theme
- CSS/JS organized by business vs software themes
- **Enhanced Quote System**: Multi-step quote process with equipment catalog, filtering, recommendations, and final quote summary
- **Advanced Scheduling**: Real-time conflict detection, business hours validation, and email confirmations
- Client-side scripts for quotes, scheduling, home page with comprehensive form validation

**Testing Infrastructure**: Comprehensive test suite in `/tests/`
- Jest test runner with 62+ tests covering all endpoints, security, and new functionality
- Supertest for HTTP testing
- MongoDB Memory Server for isolated database testing
- Nodemailer mocking for email testing
- **Enhanced Model Testing**: Validation for scheduling constraints, quote integration, and invoice generation
- **Security Validation Tests**: XSS prevention, spam protection, rate limiting, input sanitization
- **Business Logic Validation**: Appointment conflicts, service requirements, equipment limits
- **API Integration Tests**: Invoice creation, quote-to-invoice conversion, scheduling confirmations

### Key Middleware & Features

- Helmet CSP with specific allowlists for FontAwesome and Google Fonts
- Compression and cookie parsing
- Trust proxy configuration for subdomain detection
- Health check endpoint at `/healthz` with database ping
- Error handling with custom error pages
- **Enhanced Security Features**:
  - **Multi-layer Rate Limiting**: 3 quotes/15min, 30 calculations/min, 5 scheduling requests/15min per IP
  - **Comprehensive Input Validation**: express-validator with business logic constraints
  - **Email Security**: Domain validation, disposable email blocking, duplicate prevention
  - **Anti-Spam Protection**: Honeypot fields, time-based restrictions, IP tracking
  - **Request Security**: Size limits (10MB), sanitization, user agent logging
  - **Business Logic Protection**: Service minimums, appointment conflicts, equipment limits
  - **Audit Trails**: IP tracking, user agent logging, scheduling history
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

### Environment Configuration

Required `.env` variables:
- `MONGO_URI` - MongoDB connection string with authentication
- `EMAIL_USER`, `EMAIL_PASS` - Nodemailer SMTP credentials for confirmations
- `ADMIN_EMAIL` - Quote and appointment notification recipient
- `INVOICE_API_KEY` - Optional API key for invoice system security
- `PORT` - Server port (defaults to 3000)
- `NODE_ENV` - Environment mode (development/production/test)

**Security Notes**:
- MongoDB should use authentication with strong passwords (12+ characters)
- Email passwords should be app-specific passwords, not account passwords  
- Invoice API key is optional but recommended for production
- See `.env.example` for complete configuration template

### Testing & Verification

Always run tests after making changes:
- `npm test` - Run comprehensive test suite (62+ tests with full security and functionality coverage)
- Server starts without errors
- `/healthz` returns 200 OK
- Main pages render correctly for both domains
- Database connection is established
- All API endpoints function correctly
- **Enhanced Validations**:
  - **Model Validation**: Scheduling constraints, quote integration, invoice generation
  - **Security Testing**: XSS prevention, input sanitization, rate limiting enforcement
  - **Business Logic**: Appointment conflicts, service minimums, equipment limits
  - **Integration Testing**: Email confirmations, quote-to-invoice conversion
  - **API Security**: Authentication, authorization, audit logging
  - **User Experience**: Multi-step forms, real-time validation, professional theming

### Deployment Notes

Production deployment via Docker Compose with automatic rebuild. The application includes webhook-ready auto-deploy capability with health verification.

## Recent Major Updates

### Enhanced Services System (Latest)
- **Updated Service Options**:
  - **Device mounting** ($10/device) - Physical mounting of equipment
  - **Client device setup** ($10/device) - Configuration of end-user devices (computers, tablets, phones)
  - **Host/server device setup** ($50/device) - Configuration of servers, NAS, network appliances
  - **Media panel install** ($50/device) - Installation of media distribution panels

### Advanced Equipment Catalog System
- **Comprehensive Equipment Database** with detailed specifications and metadata
- **Smart Recommendations** based on speed tier selection
- **Professional Categorization** (Gateways, Switches, Access Points, Cameras)
- **Feature-Based Filtering** capabilities with tags and specifications
- **Enhanced Equipment Cards** with detailed descriptions, features, and pricing
- **Speed Tier Compatibility** matching for optimal performance

### Professional Scheduling System
- **Advanced Conflict Detection** with 1-hour buffers between appointments
- **Business Hours Enforcement** (Monday-Friday, 8 AM - 6 PM, 30-minute intervals)
- **Automated Email Confirmations** for customers and admin notifications
- **Comprehensive Validation** including date/time constraints and duplicate prevention
- **Audit Trail System** with IP tracking and appointment history

### Enhanced Quote System
- **Multi-Step Quote Process** with package selection, service configuration, equipment selection
- **Professional Final Quote Summary** showing all selections and pricing breakdowns
- **Real-Time Price Calculations** with instant updates as selections change
- **Equipment Integration** with smart recommendations and detailed specifications
- **Comprehensive Validation** preventing abuse and ensuring data integrity

### Professional UI/UX Updates
- **Dark Theme Integration** matching the website's professional aesthetic
- **Responsive Design** optimized for all device sizes
- **Enhanced Visual Hierarchy** with proper color coding and typography
- **Interactive Elements** with smooth animations and hover effects
- **Professional Forms** with real-time validation and user feedback