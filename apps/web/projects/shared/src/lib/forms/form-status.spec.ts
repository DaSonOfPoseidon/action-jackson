import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OFFLINE_COPY } from '../layout/offline-banner';
import { FormStatus, type FormStatusState, retryText } from './form-status';

// The component under test sits in a host, as it does in a page: the page sets the state and projects the "sent" content.
@Component({
  selector: 'aj-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormStatus],
  template: `
    <input id="first" />
    <input id="second" />
    <aj-form-status [state]="state()" contact="Email us at hello@example.com.">
      <h2 id="done" tabindex="-1">Request received</h2>
    </aj-form-status>
  `,
})
class Host {
  readonly state = signal<FormStatusState>({ kind: 'idle' });
}

async function setup(initial: FormStatusState = { kind: 'idle' }) {
  const fixture = TestBed.createComponent(Host);
  fixture.componentInstance.state.set(initial);
  document.body.appendChild(fixture.nativeElement);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const set = async (state: FormStatusState) => {
    fixture.componentInstance.state.set(state);
    await fixture.whenStable();
  };
  return { fixture, root, set };
}

const polite = (root: HTMLElement) => root.querySelector('[role="status"]') as HTMLElement;
const alert = (root: HTMLElement) => root.querySelector('[role="alert"]') as HTMLElement;
const text = (element: Element) => element.textContent!.replace(/\s+/g, ' ').trim();

describe('FormStatus', () => {
  afterEach(() => document.body.replaceChildren());

  it('has both live regions in the page from the start, empty', async () => {
    const { root } = await setup();
    expect(polite(root).getAttribute('aria-live')).toBe('polite');
    expect(text(polite(root))).toBe('');
    expect(text(alert(root))).toBe('');
  });

  it('says it is sending, in the polite region', async () => {
    const { root } = await setup({ kind: 'sending' });
    expect(text(polite(root))).toBe('Sending…');
    expect(text(alert(root))).toBe('');
  });

  it('shows the projected content when sent, in the polite region, and not before', async () => {
    const { root, set } = await setup();
    expect(root.querySelector('#done')).toBeNull();
    await set({ kind: 'sent' });
    expect(polite(root).querySelector('#done')).not.toBeNull();
    expect(text(alert(root))).toBe('');
    await set({ kind: 'idle' });
    expect(root.querySelector('#done')).toBeNull();
  });

  it('lists the field errors in the alert region, as links to the fields', async () => {
    const { root } = await setup({
      kind: 'invalid',
      errors: [
        { fieldId: 'first', label: 'Name', message: 'Enter your name.' },
        { fieldId: 'second', label: 'Email', message: 'Enter a valid email address.' },
      ],
      other: [],
    });
    const links = Array.from(alert(root).querySelectorAll('a'));
    expect(links.map((a) => text(a))).toEqual(['Name: Enter your name.', 'Email: Enter a valid email address.']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#first', '#second']);
    expect(text(alert(root))).toContain('2 problems');
    expect(text(polite(root))).toBe('');
  });

  it('says "1 problem" for one', async () => {
    const { root } = await setup({ kind: 'invalid', errors: [{ fieldId: 'first', label: 'Name', message: 'x' }], other: [] });
    expect(text(alert(root))).toContain('1 problem');
    expect(text(alert(root))).not.toContain('1 problems');
  });

  it('focuses the field when its link is followed, and does not navigate', async () => {
    const { root } = await setup({ kind: 'invalid', errors: [{ fieldId: 'second', label: 'Email', message: 'x' }], other: [] });
    const link = alert(root).querySelector('a')!;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(root.querySelector('#second'));
  });

  it('does not fail when the field is gone', async () => {
    const { root } = await setup({ kind: 'invalid', errors: [{ fieldId: 'nowhere', label: 'X', message: 'y' }], other: [] });
    expect(() => alert(root).querySelector('a')!.click()).not.toThrow();
  });

  it('moves focus to the summary when the errors arrive, and again when they come back', async () => {
    const { root, set } = await setup();
    const invalid: FormStatusState = { kind: 'invalid', errors: [{ fieldId: 'first', label: 'Name', message: 'x' }], other: [] };
    await set(invalid);
    const summary = alert(root).querySelector('.summary') as HTMLElement;
    expect(summary.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(summary);
    (root.querySelector('#first') as HTMLElement).focus();
    await set({ ...invalid });
    expect(document.activeElement).toBe(alert(root).querySelector('.summary'));
  });

  it('keeps the generic messages of errors that belong to no field in the summary, with no link', async () => {
    const { root } = await setup({ kind: 'invalid', errors: [], other: ['Something could not be accepted.'] });
    expect(text(alert(root))).toContain('Something could not be accepted.');
    expect(alert(root).querySelectorAll('a').length).toBe(0);
    expect(text(alert(root))).toContain('1 problem');
  });

  it('does not take focus for a notice', async () => {
    const { root, set } = await setup();
    (root.querySelector('#first') as HTMLElement).focus();
    await set({ kind: 'failed' });
    expect(document.activeElement).toBe(root.querySelector('#first'));
  });

  it('shows the rate limit detail and how long to wait, in minutes, rounded up', async () => {
    const { root, set } = await setup({ kind: 'rate-limited', detail: 'Too many requests. Please try again later.', retryAfter: 61 });
    expect(text(alert(root))).toContain('Too many requests. Please try again later.');
    expect(text(alert(root))).toContain('try again in 2 minutes');
    await set({ kind: 'rate-limited', detail: 'Please wait 10 minutes between requests.' });
    expect(text(alert(root))).toContain('Please wait 10 minutes between requests.');
    expect(text(alert(root))).not.toContain('try again in');
  });

  it('has a sentence of its own for a rate limit with no detail', async () => {
    const { root } = await setup({ kind: 'rate-limited' });
    expect(text(alert(root))).toContain('Too many requests');
  });

  it('shows the offline copy for offline', async () => {
    const { root } = await setup({ kind: 'offline' });
    expect(text(alert(root))).toContain(OFFLINE_COPY);
  });

  it('shows a generic failure with the contact line the page passed in', async () => {
    const { root } = await setup({ kind: 'failed' });
    expect(text(alert(root))).toContain('Your request could not be sent');
    expect(text(alert(root))).toContain('Email us at hello@example.com.');
  });

  it('leaves both regions in the page when the state goes back to idle, and empties them', async () => {
    const { root, set } = await setup({ kind: 'failed' });
    await set({ kind: 'idle' });
    expect(polite(root)).not.toBeNull();
    expect(text(alert(root))).toBe('');
  });
});

describe('retryText', () => {
  it('says nothing without a wait', () => {
    expect(retryText(undefined)).toBe('');
    expect(retryText(0)).toBe('');
  });

  it('says "in about a minute" up to 60 seconds, then minutes rounded up', () => {
    expect(retryText(1)).toBe('try again in about a minute');
    expect(retryText(60)).toBe('try again in about a minute');
    expect(retryText(61)).toBe('try again in 2 minutes');
    expect(retryText(600)).toBe('try again in 10 minutes');
    expect(retryText(601)).toBe('try again in 11 minutes');
  });
});
