// Waits until the edge answers the way a client reaches it, before any spec runs: its own /healthz, and then a real
// page of every site. /healthz alone is not enough (docs/pitfalls.md, "A readiness probe that passes before the real
// service is up"): it is the edge's own answer, so it says nothing about the files being served.
import { request } from 'node:http';
import { SITES, edgeOrigin } from './sites';

const DEADLINE_MS = 60_000;

// A GET with a chosen Host header. fetch cannot set Host (it sends the URL's), and an edge that gets the wrong Host
// falls back to the main site, which would make every probe look fine.
function get(path: string, host: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(edgeOrigin() + path, { headers: { Host: host }, timeout: 3_000 }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

async function answers(path: string, host: string, expected: string): Promise<boolean> {
  try {
    const { status, body } = await get(path, host);
    return status === 200 && body.includes(expected);
  } catch {
    return false;
  }
}

export default async function globalSetup(): Promise<void> {
  const probes: [string, string, string][] = [['/healthz', 'localhost', '"status":"ok"']];
  for (const site of SITES) {
    probes.push(['/', site.host, `<h1>${site.h1.replace(/&/g, '&amp;')}</h1>`]);
  }
  probes.push(['/', 'admin.localhost', '<aj-root>']);

  const started = Date.now();
  for (const [path, host, expected] of probes) {
    while (!(await answers(path, host, expected))) {
      if (Date.now() - started > DEADLINE_MS) {
        throw new Error(`the edge at ${edgeOrigin()} did not serve ${path} for Host ${host} within ${DEADLINE_MS / 1000}s`);
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}
