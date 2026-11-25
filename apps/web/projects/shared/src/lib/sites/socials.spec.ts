import { SOCIALS } from './socials';

describe('SOCIALS', () => {
  it('lists GitHub, LinkedIn and email, in that order', () => {
    expect(SOCIALS.map((social) => social.key)).toEqual(['github', 'linkedin', 'email']);
  });

  it('gives every entry a label and an https or mailto URL', () => {
    for (const social of SOCIALS) {
      expect(social.label.trim(), social.key).not.toBe('');
      const url = new URL(social.href);
      expect(['https:', 'mailto:'], social.key).toContain(url.protocol);
    }
  });

  it('has the real profile URLs and a plain mailto address', () => {
    const byKey = Object.fromEntries(SOCIALS.map((social) => [social.key, social]));
    expect(byKey['github'].href).toBe('https://github.com/DaSonOfPoseidon');
    expect(byKey['linkedin'].href).toBe('https://www.linkedin.com/in/jackson-keithley-115582213/');
    expect(byKey['email'].href).toBe('mailto:jackson@actionjacksoninstalls.com');
    expect(byKey['email'].label).toBe('jackson@actionjacksoninstalls.com');
  });

  it('has no duplicate keys or URLs', () => {
    expect(new Set(SOCIALS.map((social) => social.key)).size).toBe(SOCIALS.length);
    expect(new Set(SOCIALS.map((social) => social.href)).size).toBe(SOCIALS.length);
  });
});
