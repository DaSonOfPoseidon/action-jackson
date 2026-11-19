# CLAUDE.md — Action Jackson

## Domain Separation

Domain routing is handled by Next.js middleware (`frontend/middleware.ts`):
- `actionjacksoninstalls.com` — business/branding site (route group: `(business)`)
- `dev.actionjacksoninstalls.com` — personal portfolio (route group: `portfolio`)
- The middleware detects `dev.` subdomain and rewrites requests to `/portfolio` paths transparently

## UI/UX Rules

- Checkboxes and labels must always be on the same line.

## Legacy Artifacts

- `/portfolio/` at project root is a legacy artifact, superseded by `/frontend/app/portfolio/`.
- `/public/` at root may contain legacy static assets from the EJS era.

@AGENTS.md
