# AGENTS.md

## Purpose

Provide structured instructions and conventions for both human contributors and automated/AI agents interacting with the Action Jackson codebase. The goal is safe, incremental, observable, and reversible changes while preserving dual-domain semantics (branding vs. portfolio).

## 1. Project Layout (High Level)

- `server.js` — application entry point / Express server bootstrap.  
- `routes/` — HTTP route modules (REST endpoints).  
- `views/` — EJS templates (presentation layer).  
- `public/` — static assets: CSS, JS, images.  
- `models/` — Mongoose schemas / data modeling.  
- `Dockerfile` & `docker-compose.yml` — container definitions and orchestration.  
- `.env` (not checked in) — environment configuration: secrets, URLs, ports.

## 2. Build / Dev / Test Commands

- `npm install` — install or update JavaScript dependencies.  
- `npm start` or `node server.js` — launch app.  
- `docker compose up --build -d` — build and run containerized service.  
- `docker compose logs -f` — follow logs for debugging.  
- `npm test` — placeholder; if tests are added, run before commits.  
- `npm run lint` — if a linter is introduced, run to enforce style.

Agents should always smoke-test critical paths after changes (e.g., server starts, `/healthz` returns 200, main pages render).

## 3. Code Style & Conventions

- Use `const` / `let`; avoid `var`.  
- Prefer clear, descriptive names for functions/variables.  
- Two-space indentation.  
- Keep heavy logic out of templates; views should remain primarily for rendering.  
- Escape user-supplied content in EJS unless deliberate (`<%= ... %>` over `<%- ... %>` unless intentionally unescaped).  
- When adding dependencies, update both `package.json` and lockfile.  
- Do not commit secrets or `.env` contents.

## 4. Git & Commit Guidelines

- Branch naming: descriptive, e.g., `feat/add-portfolio-section`, `fix/docker-healthcheck`.  
- Commit messages: imperative mood, concise, with prefix (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).  
  - Example: `feat: add dual-domain detection logic`  
- Small, incremental commits preferred over large sweeping changes.  
- Include rationale and test steps in PR description.  
- Avoid committing `node_modules/`; ensure `.gitignore` is respected.

## 5. Agent Behavior Rules

- **Clarify before large assumptions.** If domain separation, content intent, or architecture changes are ambiguous, surface questions rather than guessing.  
- **Incremental & testable.** Make one logical change per commit/PR when possible.  
- **Fallback safety.** If a change risks breaking startup, include rollback notes or a safe fallback (e.g., revert commit suggestion).  
- **Dependency updates.** Detect outdated or vulnerable dependencies; propose updates, run install, and validate that the app still boots.  
- **Dual-domain awareness.** Preserve the separation of branding (`actionjacksoninstalls.com`) vs. portfolio (`dev.`) unless explicit direction is given to merge or alter semantic behavior.

## 6. Security & Reliability

- Never store or commit credentials. Use env vars or external secret stores.  
- Sanitize external inputs. Prefer default escaping in templates.  
- Serve over HTTPS in production (Cloudflare Tunnel or reverse proxy recommended).  
- Audit and periodically review dependencies for vulnerabilities.  
- Health endpoints (like `/healthz`) should be used to verify deployment health.

## 7. Deployment Guidance

After a change is merged to the main branch:

1. Pull latest changes on the host.  
2. Rebuild and restart: `docker compose up --build -d`.  
3. Verify health: hit `/healthz` and key front-facing routes.  
4. If using a webhook-based auto-deploy, ensure the webhook triggered a successful pull/build.  
5. Log any failures and, if needed, initiate rollback via git (e.g., revert offending commit).

## 8. Contribution Process

- Fork/branch.  
- Implement and test locally (Node or Docker).  
- Commit with clear message.  
- Open PR with: what changed, why, how it was tested, and any side effects.  
- Await review before merging into main.

## 9. Overrides & Extension

More specific `agents.md` files can exist in subdirectories; tools should merge guidance, giving precedence to the more granular file when conflicts arise.

## 10. Example Safe Commit Message Prefixes

- `feat:` new feature  
- `fix:` bug fix  
- `docs:` documentation change  
- `style:` formatting/style (no logic change)  
- `refactor:` internal restructure (no behavior change)  
- `chore:` maintenance tasks  
- `perf:` performance improvement  
- `ci:` changes to automation/deploy pipeline