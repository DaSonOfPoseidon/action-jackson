import { provideHttpClient, withFetch } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { SITE_KEY } from '../sites/site-key';
import { OFFLINE_COPY, OfflineBanner } from './offline-banner';

async function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(withFetch()), provideHttpClientTesting(), { provide: SITE_KEY, useValue: 'lan' }],
  });
  const fixture = TestBed.createComponent(OfflineBanner);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const api = TestBed.inject(ApiClient);
  const http = TestBed.inject(HttpTestingController);
  const call = async (status: number | 'ok') => {
    const result = firstValueFrom(api.get('quotes/pricing')).catch(() => undefined);
    const req = http.expectOne('/api/lan/quotes/pricing');
    if (status === 'ok') {
      req.flush({});
    } else {
      req.flush({ title: 'x' }, { status, statusText: 'x' });
    }
    await result;
    await fixture.whenStable();
  };
  return { fixture, root, call };
}

describe('OfflineBanner', () => {
  it('shows nothing by default, but the polite live region is already in the page', async () => {
    const { root } = await setup();
    const region = root.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region!.getAttribute('aria-live')).toBe('polite');
    expect(region!.textContent!.trim()).toBe('');
  });

  it('shows the notice after a 503 problem', async () => {
    const { root, call } = await setup();
    await call(503);
    expect(root.querySelector('[role="status"]')!.textContent!.trim()).toBe(OFFLINE_COPY);
  });

  it('says only what the code does: you can browse, and you should try again later', () => {
    expect(OFFLINE_COPY).toBe(
      "We can't reach our booking system right now. You can still browse; please try again later.",
    );
  });

  it('hides the notice again after a later success', async () => {
    const { root, call } = await setup();
    await call(503);
    await call('ok');
    expect(root.querySelector('[role="status"]')!.textContent!.trim()).toBe('');
  });

  it('stays hidden after a 409, because the API did answer', async () => {
    const { root, call } = await setup();
    await call(409);
    expect(root.querySelector('[role="status"]')!.textContent!.trim()).toBe('');
  });
});
