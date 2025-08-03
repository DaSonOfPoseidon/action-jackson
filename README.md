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
- **Containerization:** Docker & Docker Compose

## Features

- RESTful APIs for services, scheduling, quotes, invoices, and shared data
- EJS-rendered pages: home, portfolio, scheduling, quotes, about, etc.
- MongoDB persistence with flexible connection (remote or local)
- Subdomain/variant detection (business vs. portfolio)
- Security and utility middleware (Helmet, compression, cookie-parser)
- Quote submission with admin notification
- Health check endpoint (`/healthz`)
- Dockerized for consistent environments
- Easy content editing via templates

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
```

By default, the app listens on port 3000 unless overridden via the `PORT` environment variable.

For faster development iteration, you can use nodemon:

```bash
npx nodemon server.js
```

### Environment Variables

Create a `.env` file in the project root with the following variables:

```env
MONGO_URI=mongodb://<user>:<pass>@host:port/db
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password
ADMIN_EMAIL=admin@example.com
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

| Method | Endpoint                   | Description                                    |
|--------|----------------------------|------------------------------------------------|
| GET    | `/api/home`                | Fetch services, testimonials, and landing data |
| GET    | `/api/scheduling/slots`    | List available scheduling time slots          |
| POST   | `/api/scheduling/book`     | Book a time slot / create schedule entry      |
| POST   | `/api/quotes/create`       | Submit a quote and notify admin                |
| GET    | `/api/shared/services`     | Retrieve shared service definitions            |
| GET    | `/api/invoices`            | List all invoices                              |
| POST   | `/api/invoices`            | Create a new invoice                           |
| PUT    | `/api/invoices/:id`        | Update an existing invoice                     |
| DELETE | `/api/invoices/:id`        | Delete an invoice                              |
| GET    | `/healthz`                 | Health check endpoint                          |

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

## Future Enhancements

- Add a comprehensive test suite and integrate `npm test` for CI validation
- Introduce optional authentication/login system
- Dynamically surface recent work (e.g., GitHub activity integration)
- Improve accessibility and responsive design
- Add GitHub Actions for linting, testing, and automated deployments
- Enhance portfolio with interactive elements (live metrics, project filters)
- Implement caching strategies for better performance

## License

No license file is currently included. Consider adding a `LICENSE` file with MIT or another preferred open-source license to clarify usage terms.

## Contact

Maintained by **Jackson Keithley** / Action Jackson Installs & Builds Software.

- **Website:** [actionjacksoninstalls.com](https://actionjacksoninstalls.com)
- **Portfolio:** [dev.actionjacksoninstalls.com](https://dev.actionjacksoninstalls.com)
- **GitHub:** [DaSonOfPoseidon](https://github.com/DaSonOfPoseidon)

---

*Built with ❤️ and lots of ☕*