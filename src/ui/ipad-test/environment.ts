// Reads the browser, the system version and the device from the userAgent (pure, so it is tested).

export interface Environment {
  readonly browser: string;
  readonly version: string;
  readonly device: string;
}

/** `touchPoints` tells an iPad that presents itself as a Mac (iPadOS 13 and later). */
export function parseUserAgent(ua: string, touchPoints = 0): Environment {
  const device = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1) ? 'iPad' : 'outro';
  const pick = (pattern: RegExp) => pattern.exec(ua)?.[1];
  const chrome = pick(/CriOS\/([\d.]+)/);
  if (chrome) return { browser: 'Chrome', version: chrome, device };
  const firefox = pick(/FxiOS\/([\d.]+)/);
  if (firefox) return { browser: 'Firefox', version: firefox, device };
  const edge = pick(/EdgiOS\/([\d.]+)/);
  if (edge) return { browser: 'Edge', version: edge, device };
  const safari = pick(/Version\/([\d.]+)/);
  if (safari && /Safari/.test(ua)) return { browser: 'Safari', version: safari, device };
  const system = pick(/OS (\d+[_\d]*)/)?.replace(/_/g, '.');
  return { browser: /AppleWebKit/.test(ua) ? 'Safari' : 'outro', version: system ?? '', device };
}
