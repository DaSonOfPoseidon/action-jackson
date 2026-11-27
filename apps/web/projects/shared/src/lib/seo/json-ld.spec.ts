import { DOCUMENT } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { JsonLd, serializeJsonLd, useJsonLd } from './json-ld';

describe('serializeJsonLd', () => {
  it('writes every "<" as \\u003c, so no string can close the script or open a comment', () => {
    const text = serializeJsonLd({ name: '</script><script>alert(1)</script>', note: '<!-- x' });
    expect(text).not.toContain('<');
    expect(text).toContain('\\u003c/script>');
    expect(text).toContain('\\u003c!-- x');
  });

  it('reads back as the same data', () => {
    const data = { '@type': 'Question', name: 'a < b </script> & "c"', list: [1, 2, { x: '<' }] };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});

describe('JsonLd', () => {
  const blocks = (doc: Document) => [...doc.head.querySelectorAll('script[type="application/ld+json"]')];

  afterEach(() => {
    TestBed.inject(DOCUMENT).head.querySelectorAll('script[data-aj-jsonld]').forEach((s) => s.remove());
  });

  it('puts one block in <head> per key, and replaces it when set again', () => {
    const doc = TestBed.inject(DOCUMENT);
    const jsonLd = TestBed.inject(JsonLd);
    jsonLd.set('a', { n: 1 });
    jsonLd.set('b', { n: 2 });
    jsonLd.set('a', { n: 3 });
    expect(blocks(doc).map((s) => s.textContent)).toEqual(['{"n":2}', '{"n":3}']);
  });

  it('removes only the block with the key', () => {
    const doc = TestBed.inject(DOCUMENT);
    const jsonLd = TestBed.inject(JsonLd);
    jsonLd.set('a', { n: 1 });
    jsonLd.set('b', { n: 2 });
    jsonLd.remove('a');
    expect(blocks(doc).map((s) => s.textContent)).toEqual(['{"n":2}']);
  });

  it('keeps a component\'s block while it lives and removes it when it is destroyed', () => {
    @Component({ template: '' })
    class Page {
      constructor() {
        useJsonLd('page', { hello: '<b>' });
      }
    }
    const doc = TestBed.inject(DOCUMENT);
    const fixture = TestBed.createComponent(Page);
    expect(blocks(doc).map((s) => s.textContent)).toEqual(['{"hello":"\\u003cb>"}']);
    fixture.destroy();
    expect(blocks(doc)).toEqual([]);
  });
});
