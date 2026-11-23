# Split subdomains: design spec (issue #1)

## Intent

Today `actionjacksoninstalls.com` is one Next.js 14 app with an Express and Mongo backend, all on the Pi. It splits
into a family of sites that share one backend and one admin:

| Host | Site | Content |
|---|---|---|
| apex (and `www` → 301 to apex) | main | landing hub linking to every site; general about me, a Markdown blog with RSS, socials |
| `lan.` | lan | home networking installs (today's business pages): booking, consultation form, quote builder, invoices with file uploads |
| `car.` | car | car audio and remote start installs: the same features as lan, plus vehicle details |
| `dev.` | dev | developer portfolio: projects, resume (with a PDF), about. Same URLs as today |
| `admin.` | admin | one admin for every site: appointments, consultations, quotes, invoices, settings, site visits, errors, performance |

Each site has its own about page. Adding a site means: a registry entry, an Angular app and a tunnel hostname.

## Goals

- The public sites stay loadable when the home-server PC (192.168.1.195) is off. While it is down they show an
  offline notice, and the Pi queues writes until it comes back.
- One backend, with a database schema per site, designed up front. The aim is to avoid frequent schema migrations.
- A stack with resume value: Angular, ASP.NET Core and PostgreSQL 18.
- All text meets WCAG AAA contrast. Each site's look comes from the frontend-design skill, refined on Jackson's
  feedback.

## Non-goals

- React or Express anywhere.
- Migrating the old Mongo records, apart from the catalog (21 cost items) and the labor rate ($50). The rest is
  test data.
- Online payments. Payments are recorded by hand in the admin.

## Anti-goals

- **A page that needs the PC to render.** Every public page is prerendered and served from the Pi.
- **Trusting browser-supplied identity headers**, or client-declared file types.
- **Business rules that drift between the UI and the API.** Form option lists live in one `contracts/` file that
  both sides read.

## Approaches considered

- **Frontend:**
  - Angular (picked, for resume value).
  - Astro: lighter, but no resume value.
  - Plain HTML with a small TS layer: no framework, so it lacks the resume value too.
- **Backend:**
  - ASP.NET Core (picked: a robust, typed stack that is also on the resume).
  - NestJS: still Node.
  - Go: a smaller ecosystem for the admin features.
- **Hosting:**
  - Web tier on the Pi and data tier on the PC (picked: it keeps pages up with the PC off).
  - Everything on the PC: simpler, but the site goes down whenever the PC does.
  - Everything on the Pi: it can't comfortably run Postgres, Garage and Redis next to its current load.

## Architecture

```
Cloudflare tunnel (cloudflared on the Pi): apex · www · lan · car · dev · admin
        │
   Pi :8180  edge (ASP.NET Core)
        - picks the site from the Host header (contracts/sites.json), serves its prerendered files
        - www → apex 301; legacy apex /services/*, /get-started → lan. 301; /admin → admin. 301
        - /api/* → YARP → PC API, adding X-Edge-Key and X-Client-IP; any inbound X-Edge-Key, X-Client-IP,
          X-Forwarded-* and Forwarded are dropped. With the API unreachable it answers 503 (problem+json,
          Retry-After: 30), so the forms can show their offline notice
        - two listeners: the LAN port (:8180 on the Pi) takes the connection's address as the client IP;
          the tunnel port (127.0.0.1:8181, cloudflared's) takes cf-connecting-ip when it is one valid address
        - SQLite snapshot + outbox while the PC is off
        │  LAN
   PC 192.168.1.195:8110  api (ASP.NET Core) ── postgres · redis · garage (internal network only)
```

### Frontend: `apps/web/` (Angular workspace)

- **Applications:** `main`, `lan`, `car`, `dev`, `admin`.
- **Library `shared`:** site registry, cross-site switcher, layout primitives, theme tokens, api client, the
  analytics/error/vitals beacon, the offline banner, and SEO helpers (canonical, sitemap, robots, OG).
- **Rendering:** public apps are prerendered (static output) with incremental hydration, so only the forms ship
  meaningful JavaScript. The admin is client-rendered.
- **Dependencies:** Angular and Angular CDK only, plus CSS custom-property tokens per site. No component library.
  Versions are pinned exactly, installed with `npm ci --ignore-scripts`, and checked with `npm audit signatures`.

### Backend: `server/ActionJackson.slnx`

- **Api:** public and admin endpoints.
- **Edge:** the Pi web tier.
- **Core:** domain, pricing, validation lists.
- **Data:** EF Core with Npgsql, and migrations.
- **Tests:** xUnit, `WebApplicationFactory`, and a throwaway Postgres from `scripts/test-db.sh`.
- **Tooling:** the .NET SDK runs in a container (`scripts/dotnet.sh`), following TechAvailFeed.

**Cross-cutting rules:**
- **Client IP:** the API trusts `X-Client-IP` only on a request with a valid `X-Edge-Key`. The edge strips both
  headers from inbound requests and sets its own. Rate limits are partitioned by that IP and kept in memory,
  since there is one API instance.
- **HybridCache** (memory L1, Redis L2) for the catalog, settings and availability.
- **Email:** an `email_outbox` row is written in the same transaction as the domain change. A background MailKit
  sender delivers it, with retries.
- **Attachments** stream through the API to and from Garage, which is never published. The file type is checked
  by magic bytes.
- **Errors:** ProblemDetails responses. Server errors are recorded with a fingerprint.

## Data model (one database, a schema per site)

- **`core`:**
  - Identity: users, lockout, roles `admin` and `superadmin`
  - `settings` (jsonb, per site)
  - `page_views`, `client_errors`, `server_errors` (fingerprint, count, last_seen), `web_vitals`, `request_metrics`
  - `audit_log`, `email_outbox`, `edge_receipts` (idempotency keys)
  - data-protection keys
- **`lan` and `car`:** the same tables from one schema-parameterized `BusinessDbContext`:
  - `customers`, `service_packages`, `catalog_items` (with bill of materials), `availability_rules`, `blackout_dates`
  - `appointments` and `appointment_history`
  - `consultation_requests`
  - `quotes` and `quote_lines`
  - `invoices`, `invoice_lines` and `payments`
  - `attachments`, `testimonials`
- **Flexible fields:** each customer-facing table has a validated jsonb `details` column for site-specific fields,
  so new fields don't need a migration. For car these are vehicle year/make/model and remote start type; for lan,
  property details.
- **No double bookings:** a Postgres exclusion constraint on each schema's appointment time range (a plain range
  `&&`, which needs no `btree_gist`), covering active statuses.
- **Invoice numbers:** `INV-YYYY-NNNN`, from a per-schema sequence.
- **`dev` and `main`:** `contact_messages`. Portfolio data, resume and blog posts stay as files in the repo.
- **Status values:** one PascalCase string enum per entity, shared by the API and the admin.
  - Appointment: Scheduled, Confirmed, InProgress, Completed, Cancelled, NoShow, NeedsReview
  - Quote: Pending, Reviewed, Approved, Rejected, Completed
  - Invoice: Draft, Sent, Paid, Overdue, Cancelled
- **Seed:** the lan catalog (21 items, exported read-only from the Pi's Mongo) and labor rate 50. The seed is
  idempotent.

## Business rules carried over from the legacy code

- **Consultation:**
  - Fields and option lists come verbatim from `routes/consultations.js:124-174`:
    - square footage (5 values)
    - current issues (8 values, at most 8 chosen)
    - services (4 values, 1–4 chosen)
    - package (6 values)
  - Validation: name 2–100 characters, letters, spaces, `'` and `-`; email must pass `isEmail` and must not be a
    disposable domain; phone optional, `^[\d\s()+-]{7,20}$`; a honeypot field.
  - 8-digit random request number.
  - Rate limit: 3 requests per 15 min, and a 10-minute cooldown per email.
  - The admin gets an email, and so does the customer (an acknowledgment: new, because the UI already promised
    one).
- **Booking:**
  - Time zone: `America/Chicago`. Requests carry a local date and time (`2026-11-24`, `09:00`), appointments
    store instants, and every "which day" rule (today, the 90 days, a whole-home day) uses the Chicago date. A
    local time that does not exist or happens twice (a daylight-saving change) is refused.
  - Start times on the hour, from 08:00 to 18:00: the lan opening rules, seeded for every weekday and edited by
    the admin.
  - Duration: survey 120 min; drops-only 60–720 min, rounded up to the hour, default 120; whole-home blocks the
    day, and any booking that day blocks a whole-home booking. A whole-home install starts only when its day opens
    (08:00 with the seeded rules); any other start is refused.
  - Dates: none in the past, at most 90 days ahead.
  - One booking per email per 24 h, and one appointment per quote.
  - A retried booking is safe: an optional `Idempotency-Key` header (a UUID) makes a repeat of the same request
    return the first answer (`Idempotent-Replayed: true`) instead of booking twice.
  - A quote number is required, and the email must match the quote's.
  - Rate limit: 5 per 15 min.
  - The customer gets a confirmation email and the admin gets a notice.
- **Quote pricing**, one calculator in Core used by both the public API and the admin:
  - Drops-only:
    - subtotal = runs × the catalog per-run price, plus AP mount and ethernet relocation, plus centralization
      (media panel unless there's an existing panel, patch panel, loose termination)
    - total = `round(subtotal × (1 − discount/100), 2)`, rounded away from zero
    - a deposit is required when the total exceeds a threshold (defaults: threshold 100, deposit 20)
  - Whole-home: a flat deposit (default 200). The admin builds the lines.
  - Customer prices are catalog prices. The labor rate drives the admin's cost/margin column
    (material + hours × rate) and custom labor lines.
  - Rate limits: create 3 per 15 min, calculate 30 per min.
- **Invoices:** created only from an Approved quote, one per quote, with the quote's lines copied over.
- **Files:**
  - Allowed types: PDF, JPEG, PNG, GIF, plain text, DOC, DOCX, decided by magic bytes.
  - Limits: 50 MB per file, 5 per request.
  - Attached to a quote, invoice or appointment. Admin only.
- **Admin:**
  - Lockout after 5 failed attempts, for 30 min.
  - Cookie auth with antiforgery. Cloudflare Access is defense in depth.
  - The first admin is created from the command line.

## Admin features

- **Appointments:** one calendar and list across lan and car, with site badges, a status workflow, reschedule,
  notes and history.
- **Business records:** consultations, quotes (catalog plus labor lines), invoices from quotes with payments and
  Garage attachments.
- **Per-site settings:** catalog, labor rate, business hours, blackout dates, deposit thresholds.
- **Site visits:** cookieless page views per site: top pages, referrers, country (from the CF header), device
  class.
- **Errors:** API, edge and browser errors, grouped by fingerprint.
- **Performance:** web vitals p75 per page, API latency p50/p95 per endpoint, and PC, Pi and edge status with the
  outbox depth.

## Offline mode (PC down)

- **Snapshot:** the edge keeps a SQLite snapshot of availability, booked slots, the catalog, labor rate, hours and
  settings. It refreshes the snapshot on a timer and after every write it forwards.
- **Detection:** a circuit breaker on the API's `/healthz`.
- **While offline:**
  - Public reads answer from the snapshot, with `X-Data-As-Of`.
  - The UI shows the offline banner, with phone and email.
  - Bookings, consultations, quote requests and beacons go into an outbox, each with an idempotency key.
  - A booking is checked against the snapshot plus already-queued bookings. Every write goes through the edge, so
    that is the whole picture while the PC is down.
  - The customer gets a reference and a "pending confirmation" notice.
- **On reconnect:**
  - The edge replays the outbox in order, and the API de-duplicates by key.
  - A queued booking that now conflicts becomes `NeedsReview` in the admin.
  - Confirmation emails go out at that point.

## Deployment

- **PC (`deploy/pc/compose.yml`):** api, postgres, redis, garage. Per the /srv conventions:
  - `restart: unless-stopped`
  - memory caps
  - monitoring labels, and WUD `wud.tag.include` for versioned images (`wud.watch: "false"` for local builds)
  - healthchecks from tools in the image (the .NET binaries have a `--healthcheck` mode)
  - secrets in a gitignored `.env`
  - Only the API is published, on the LAN (`192.168.1.195:8110`).
  - Object storage is Garage (an S3-compatible store), not MinIO: MinIO's community edition was archived in
    2026-04 and its images are gone.
  - Postgres is 18 (`postgres:18-alpine`), the same major as the tests (`scripts/test-db.sh` and CI).
- **Pi (`deploy/pi/compose.yml`):** the edge on `:8180`. It is cross-published for `linux-arm64` with the Angular
  `dist` on .195 and rsynced over. The Pi only copies the files onto the aspnet base image.
- **Cutover:**
  - Tunnel hostnames lan/car/admin are added, and apex/www/dev move to the edge.
  - Cloudflare Access goes on admin.
  - `mongodump` backup, then the old stack stops (its volumes are kept).
  - Legacy code is removed afterwards.

## Verification

- **.NET:**
  - migrations on a real Postgres
  - edge trust and rate-limit partitioning
  - the double-booking race (2 parallel bookings → one 201, one 409)
  - invoice-number concurrency
  - site isolation (a lan write never shows in car)
  - golden tests against the legacy pricing formulas
- **Web:**
  - a token contrast test (≥ 7:1 for text, ≥ 4.5:1 for large text)
  - Playwright per Host through the edge: status, title, canonical, cross-site links, form submit, and axe
    `wcag2aaa` with no `color-contrast-enhanced` violations
  - Lighthouse performance ≥ 90 on the main, lan and dev homes
- **Offline e2e:** stop the api; pages load, the banner shows and a booking queues; start the api; the booking
  appears in the admin and its email is sent.

## Left to the builder

Exact library and image versions (current stable, from the official docs), the visual design of each site (through
the design checkpoints), component structure, and test layout.
