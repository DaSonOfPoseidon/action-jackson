import { defineConfig, devices } from '@playwright/test';

// The e2e run goes through a real edge (server/src/ActionJackson.Edge) serving the built sites. EDGE_ORIGIN is where
// that edge listens (http://edge:8080 in scripts/web-e2e.sh, http://127.0.0.1:8080 in CI). The pages are opened by
// their real Host names, http://<key>.localhost and http://localhost (main): Chromium is told to send those names
// to the edge's address, so the edge picks the site by Host exactly as it does in production.
const edgeOrigin = process.env['EDGE_ORIGIN'];
if (!edgeOrigin) {
  throw new Error('EDGE_ORIGIN is not set: scripts/web-e2e.sh sets it, and the CI web job does too');
}
const edgeHostPort = new URL(edgeOrigin).host;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    launchOptions: {
      args: [`--host-resolver-rules=MAP *.localhost ${edgeHostPort},MAP localhost ${edgeHostPort}`],
    },
  },
  projects: [{ name: 'chromium' }],
});
