# AGENTS.md

## Purpose

Provide structured instructions and conventions for both human contributors and automated/AI agents interacting with the Action Jackson codebase. The goal is safe, incremental, observable, and reversible changes while preserving dual-domain semantics (branding vs. portfolio).

## 1. Project Layout (High Level)

- `server.js` — application entry point / Express server bootstrap.  
- `routes/` — HTTP route modules (REST endpoints).  
- `views/` — EJS templates (presentation layer).  
- `public/` — static assets: CSS, JS, images.  
- `models/` — Mongoose schemas / data modeling.  
- `tests/` — comprehensive test suite (Jest, Supertest, MongoDB Memory Server).  
- `Dockerfile` & `docker-compose.yml` — container definitions and orchestration.  
- `.env` (not checked in) — environment configuration: secrets, URLs, ports.

## 2. Build / Dev / Test Commands

- `npm install` — install or update JavaScript dependencies.  
- `npm start` — launch app in production mode.  
- `npm run dev` — launch app with nodemon auto-restart for development.  
- `npm test` — run comprehensive test suite (32+ tests) - **REQUIRED before commits**.  
- `docker compose up --build -d` — build and run containerized service.  
- `docker compose logs -f` — follow logs for debugging.  
- `npm run lint` — if a linter is introduced, run to enforce style.

Agents should always test after changes:
1. **FIRST**: Run `npm test` to ensure all tests pass
2. **THEN**: Smoke-test critical paths (server starts, `/healthz` returns 200, main pages render)
3. Verify both domain variants work correctly (`business` and `portfolio`)

## 3. Code Style & Conventions

- Use `const` / `let`; avoid `var`.  
- Prefer clear, descriptive names for functions/variables.  
- Two-space indentation.  
- Keep heavy logic out of templates; views should remain primarily for rendering.  
- Escape user-supplied content in EJS unless deliberate (`<%= ... %>` over `<%- ... %>` unless intentionally unescaped).  
- When adding dependencies, update both `package.json` and lockfile.  
- Always write tests for new functionality (see `/tests/` for examples).  
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
- **Test-driven development.** Run `npm test` before and after changes. Write tests for new features.  
- **Incremental & testable.** Make one logical change per commit/PR when possible.  
- **Fallback safety.** If a change risks breaking startup, include rollback notes or a safe fallback (e.g., revert commit suggestion).  
- **Dependency updates.** Detect outdated or vulnerable dependencies; propose updates, run install, and validate that the app still boots AND tests pass.  
- **Dual-domain awareness.** Preserve the separation of branding (`actionjacksoninstalls.com`) vs. portfolio (`dev.`) unless explicit direction is given to merge or alter semantic behavior.

## 6. Security & Reliability

- Never store or commit credentials. Use env vars or external secret stores.  
- Sanitize external inputs. Prefer default escaping in templates.  
- Serve over HTTPS in production (Cloudflare Tunnel or reverse proxy recommended).  
- Audit and periodically review dependencies for vulnerabilities.  
- Health endpoints (like `/healthz`) should be used to verify deployment health.

## 7. Deployment Guidance

After a change is merged to the main branch:

1. **Pre-deploy**: Ensure `npm test` passed in CI/local testing.  
2. Pull latest changes on the host.  
3. Rebuild and restart: `docker compose up --build -d`.  
4. Verify health: hit `/healthz` and key front-facing routes.  
5. **Post-deploy testing**: Run a quick smoke test of both domain variants.  
6. If using a webhook-based auto-deploy, ensure the webhook triggered a successful pull/build.  
7. Log any failures and, if needed, initiate rollback via git (e.g., revert offending commit).

## 8. Contribution Process

- Fork/branch.  
- Implement and write tests for new functionality.  
- Test locally: `npm test` must pass, then test Node or Docker startup.  
- Commit with clear message.  
- Open PR with: what changed, why, how it was tested (including test coverage), and any side effects.  
- Await review before merging into main.

## 9. Overrides & Extension

More specific `agents.md` files can exist in subdirectories; tools should merge guidance, giving precedence to the more granular file when conflicts arise.

## 10. Example Safe Commit Message Prefixes

- `feat:` new feature  
- `fix:` bug fix  
- `docs:` documentation change  
- `style:` formatting/style (no logic change)  
- `refactor:` internal restructure (no behavior change)  
- `test:` adding or updating tests  
- `chore:` maintenance tasks  
- `perf:` performance improvement  
- `ci:` changes to automation/deploy pipeline