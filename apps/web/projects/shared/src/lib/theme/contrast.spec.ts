import { contrastRatio, meetsAaa, meetsRatio, relativeLuminance } from './contrast';

describe('contrast', () => {
  it('computes the WCAG relative luminance of black and white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });

  it('gives black on white 21:1 in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 10);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 10);
  });

  it('gives #777 on white about 4.48:1', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('accepts three-digit hex colours', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 10);
  });

  it('rejects anything that is not a hex colour', () => {
    expect(() => relativeLuminance('red')).toThrow(/hex colour/);
    expect(() => relativeLuminance('#12345')).toThrow(/hex colour/);
  });

  it('fails a pair that is only AA (5:1) and passes one that is AAA', () => {
    expect(meetsAaa({ text: '#6f6f6f', background: '#ffffff' })).toBe(false);
    expect(meetsAaa({ text: '#595959', background: '#ffffff' })).toBe(true);
  });

  it('pins the 7:1 boundary: 6.99 fails, 7.0 passes', () => {
    expect(meetsRatio(6.99, false)).toBe(false);
    expect(meetsRatio(7.0, false)).toBe(true);
    expect(meetsRatio(4.49, true)).toBe(false);
    expect(meetsRatio(4.5, true)).toBe(true);
    // Real colours either side of the line: #595959 on white is 7.0047:1, #5a5a5a is 6.897:1.
    expect(meetsAaa({ text: '#595959', background: '#ffffff' })).toBe(true);
    expect(meetsAaa({ text: '#5a5a5a', background: '#ffffff' })).toBe(false);
  });

  it('lets a large-text pair pass at 4.5:1 but not below', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeGreaterThanOrEqual(4.5);
    expect(meetsAaa({ text: '#767676', background: '#ffffff', large: true })).toBe(true);
    expect(meetsAaa({ text: '#767676', background: '#ffffff' })).toBe(false);
    expect(contrastRatio('#777777', '#ffffff')).toBeLessThan(4.5);
    expect(meetsAaa({ text: '#777777', background: '#ffffff', large: true })).toBe(false);
  });
});
