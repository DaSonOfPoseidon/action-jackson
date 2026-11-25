import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';

// JSON-LD structured data, written into <head> as <script type="application/ld+json"> so it is in the prerendered HTML.
// Angular's template compiler drops <script> elements, so the element is made through the DOM here.
//
// The text sits inside a <script>, where the HTML parser ends the element at "</script" and enters an escaped state at
// "<!--", whatever the JSON says. A string in the data (a name, an FAQ answer) must not be able to do either, so every
// "<" is written as the JSON escape <, which JSON.parse reads back as the same "<". csp.mjs leaves such a block
// alone: it is a data block (not executable), so it needs no hash and the policy does not apply to it.
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

const KEY_ATTRIBUTE = 'data-aj-jsonld';

@Injectable({ providedIn: 'root' })
export class JsonLd {
  private readonly doc = inject(DOCUMENT);

  // Writes (or replaces) the block with this key.
  set(key: string, data: unknown): void {
    this.remove(key);
    const script = this.doc.createElement('script');
    script.setAttribute('type', 'application/ld+json');
    script.setAttribute(KEY_ATTRIBUTE, key);
    script.textContent = serializeJsonLd(data);
    this.doc.head.appendChild(script);
  }

  remove(key: string): void {
    this.doc.head.querySelectorAll(`script[${KEY_ATTRIBUTE}]`).forEach((script) => {
      if (script.getAttribute(KEY_ATTRIBUTE) === key) {
        script.remove();
      }
    });
  }
}

// For a page component: its block is in <head> while the component lives. Call it in the constructor. Use a key of
// its own (the page's path, say) so a page that is created before the previous one is destroyed cannot remove it.
export function useJsonLd(key: string, data: unknown): void {
  const jsonLd = inject(JsonLd);
  jsonLd.set(key, data);
  inject(DestroyRef).onDestroy(() => jsonLd.remove(key));
}
