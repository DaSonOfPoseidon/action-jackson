# Pitfalls

Classes of bug that reviews have caught here. Check every change against them, and add an entry when a review finds a new class.

## Read-max-then-insert numbering

The next number comes from the highest existing one, so two concurrent requests get the same number. Check that numbers come from a sequence or a unique constraint with retry. Bit: `models/Invoice.js:85-105` (the comment says atomic, but the code isn't).

## Status lists that disagree

The model enum and the admin update use different spellings or case, and the update skips validation, so invalid values get stored. Check one enum per entity and a validated write. Bit: `models/Schedule.js:86-90` vs `routes/admin-api.js:380`; `models/Invoice.js:29-33` vs `routes/admin-api.js:513`.

## Duplicated business calculations

Two implementations of the same price drift apart. Check that pricing has one implementation, called from every path. Bit: `routes/quotes.js:183-211` vs `routes/admin-api.js:974-1024`.

## A read endpoint with no auth

A listing route that skipped the auth middleware leaks every record's file URLs. Check every new route's auth policy, especially reads. Bit: `routes/files.js:329-331`.

## Trusting the client's file type

The MIME allowlist checks the declared type, which the client controls. Check that content is sniffed by magic bytes. Bit: `routes/files.js:19-27`.

## UI copy promising what the backend doesn't do

The form says "check your inbox for a confirmation", but no customer email is sent. Check that success and error copy matches what the API actually does. Bit: `frontend/app/(business)/get-started/page.tsx:190` vs `routes/consultations.js:286-291`.

## Derived amounts that default to zero

Converting a whole-home quote makes a $0 invoice, and the description reads "undefined Package Installation", because the source fields don't exist for that type. Check every branch of a conversion with each source variant. Bit: `models/Invoice.js:131-156`.

## A readiness probe that passes before the real service is up

A wait loop or healthcheck asks the service in a way that a start-up phase also answers, so it reports ready too early and the next step fails. The postgres image runs a temporary init server that listens only on its unix socket, so `pg_isready` over the socket passes before the real server accepts TCP connections. Check that the probe uses the same path the clients use (TCP, the published port, a real query or request), and that nothing else can answer it earlier. Compose healthchecks and CI service `--health-cmd` options are the usual places. Bit: `scripts/test-db.sh:19` and the CI postgres service in `.github/workflows/ci.yml` (PR #8).

## Reading an .env file with a hand-written parser

A script reads `.env` with `sed`/`grep`, so quotes, `export`, spaces and trailing comments stay in the value, while Docker Compose strips them. The script then checks or imports a value (`"abc"`) that differs from the one the containers get (`abc`), and a quoted empty value (`""`) passes an emptiness check. Check that scripts read variables through Compose (`deploy/pc/env-lib.sh`), not their own parser. Bit: `deploy/pc/garage-init.sh` and `scripts/deploy.sh` (PR #11).

## A shared failure charged to one queued item

A background worker counts a retry against whichever queued item it was handling when the shared dependency failed (the SMTP login, the sender address, the database), and gives up on the item after N tries. A long outage or one wrong setting then permanently fails the oldest items, which depends only on queue position, and fixing the setting cannot bring them back. Check that a failure true of every item (connection, login, sender, configuration) stops the batch, never moves an item to its terminal failed state and never counts against its retry budget (an outage that burns the oldest item's tries leaves it one ordinary error from failing), and that only item-specific failures (a refused recipient, an unbuildable message) do. Bit: `server/src/ActionJackson.Api/Email/EmailSenderService.cs` (PR for unit 6, found by the review gate).

## A time bound that is assumed, not enforced

Code or a setting is validated against "the longest one operation can take" (a claim lease against a send), but that figure comes from a library's per-step timeout (MailKit's 30 s applies to each network operation, not to connect, login and send together), so the real duration is unbounded. A slow dependency then outlives the lease or lock, and a second worker repeats the work (a duplicate customer email). Check that every bound another setting relies on is enforced by a deadline of its own (a linked `CancellationTokenSource` with `CancelAfter`), that the setting is validated against that deadline plus the time to record the result, and that a test cuts off a send that never returns. Bit: `server/src/ActionJackson.Api/Email/EmailSenderService.cs` (PR #18, found by Codex and the review gate).
