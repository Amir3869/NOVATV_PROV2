import { describe, expect, it } from 'vitest';
import { isAndroidPhoneAgent } from './safeArea';

describe('isAndroidPhoneAgent', () => {
  it('détecte un Samsung Android', () => {
    expect(
      isAndroidPhoneAgent(
        'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      )
    ).toBe(true);
  });

  it('écarte un Fire TV Stick', () => {
    expect(
      isAndroidPhoneAgent(
        'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7233) AppleWebKit/537.36 (KHTML, like Gecko) Silk/44.1.54 like Chrome/44.0.2403.63 Safari/537.36'
      )
    ).toBe(false);
  });

  it('écarte Android TV', () => {
    expect(
      isAndroidPhoneAgent(
        'Mozilla/5.0 (Linux; Android 12; SHIELD Android TV) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
      )
    ).toBe(false);
  });

  it('écarte iPhone et ordinateur', () => {
    expect(
      isAndroidPhoneAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'
      )
    ).toBe(false);
    expect(
      isAndroidPhoneAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0'
      )
    ).toBe(false);
  });
});
