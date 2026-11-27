import { defineConfig, devices } from '@playwright/test';

// The e2e run goes through a real edge (server/src/ActionJackson.Edge) serving the built sites. EDGE_ORIGIN is where
// that edge listens (http://edge:8080 in scripts/web-e2e.sh, http://127.0.0.1:8080 in CI). Its API is down: it proxies to an
// address nothing listens on, so a call to /api/* gets the edge's 503. The pages are opened by their real Host names,
// http://<key>.localhost and http://localhost (main): Chromium is told to send those names to the edge's address, so the
// edge picks the site by Host exactly as it does in production.
//
// EDGE_API_ORIGIN is a second edge of the same build with the real API and a fresh database behind it. A browser maps the
// host names to one edge for its whole life, so the specs that need it (e2e/lan-forms.spec.ts) run as a project of their own
// with that edge in its mapping. Their tests are tagged: @down on the API-down edge, @up on the other.
const edgeOrigin = process.env['EDGE_ORIGIN'];
if (!edgeOrigin) {
  throw new Error('EDGE_ORIGIN is not set: scripts/web-e2e.sh sets it, and the CI web job does too');
}
const apiEdgeOrigin = process.env['EDGE_API_ORIGIN'];

const resolverArgs = (origin: string): string[] => {
  const hostPort = new URL(origin).host;
  return [`--host-resolver-rules=MAP *.localhost ${hostPort},MAP localhost ${hostPort}`];
};

const forms = /lan-forms\.spec\.ts$/;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { ...devices['Desktop Chrome'] },
  projects: [
    // Every spec but the forms', against the API-down edge.
    { name: 'chromium', testIgnore: forms, use: { launchOptions: { args: resolverArgs(edgeOrigin) } } },
    // The forms' specs that need the API to be down (the offline notice, and the checks that send nothing).
    { name: 'forms-api-down', testMatch: forms, grep: /@down/, use: { launchOptions: { args: resolverArgs(edgeOrigin) } } },
    // The forms' specs that submit to the real API. Only when there is a second edge to open them through.
    ...(apiEdgeOrigin
      ? [{ name: 'forms-api-up', testMatch: forms, grep: /@up/, use: { launchOptions: { args: resolverArgs(apiEdgeOrigin) } } }]
      : []),
  ],
});
