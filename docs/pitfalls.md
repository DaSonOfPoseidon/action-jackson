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
