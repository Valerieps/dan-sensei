import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './environment';

describe('parseUserAgent', () => {
  it('reads Safari on an iPad that presents itself as a Mac', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15';
    expect(parseUserAgent(ua, 5)).toEqual({ browser: 'Safari', version: '26.6', device: 'iPad' });
    expect(parseUserAgent(ua, 0).device).toBe('outro');
  });

  it('reads Chrome on an iPad', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Chrome', version: '140.0.7339.122', device: 'iPad' });
  });

  it('reads Safari on an iPhone', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Safari', version: '18.6', device: 'iPhone' });
  });

  it('falls back to the system version for the installed app, which has no Safari token', () => {
    const ua = 'Mozilla/5.0 (iPad; CPU OS 26_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
    expect(parseUserAgent(ua)).toEqual({ browser: 'Safari', version: '26.6', device: 'iPad' });
  });
});
