import { uuidV4 } from './uuid';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidV4', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is a version 4 UUID: the format, the version nibble and the variant bits', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(uuidV4()).toMatch(V4);
    }
  });

  it('is built from crypto.getRandomValues, with 16 bytes', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');
    uuidV4();
    expect(spy).toHaveBeenCalledTimes(1);
    expect((spy.mock.calls[0][0] as Uint8Array).length).toBe(16);
  });

  it('does not need crypto.randomUUID, which a page on plain http does not have', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    expect((globalThis.crypto as { randomUUID?: unknown }).randomUUID).toBeUndefined();
    expect(uuidV4()).toMatch(V4);
  });

  it('puts the version and variant over any random bytes, and writes the rest as they came', () => {
    const fill = (bytes: Uint8Array<ArrayBuffer>) => {
      bytes.fill(0xff);
      return bytes;
    };
    expect(uuidV4(fill)).toBe('ffffffff-ffff-4fff-bfff-ffffffffffff');
    const zeros = (bytes: Uint8Array<ArrayBuffer>) => bytes.fill(0);
    expect(uuidV4(zeros)).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('gives a different value each time', () => {
    expect(new Set(Array.from({ length: 50 }, () => uuidV4())).size).toBe(50);
  });
});
