import { describe, expect, it } from 'vitest';
import { deviceFromUserAgent, isBrowserKey, isOsKey } from './device.ts';

const agents = {
  chromeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  headlessChromeLinux:
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36',
  edgeWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.2903.86',
  firefoxLinux: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
  firefoxMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0',
  safariMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
  safariIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
  chromeIpad:
    'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
  firefoxIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15',
  edgeIphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 EdgiOS/131.0.2903.92 Mobile/15E148 Safari/605.1.15',
  samsungAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
  chromebook:
    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  operaWindows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/115.0.0.0',
};

describe('deviceFromUserAgent', () => {
  it.each([
    [agents.chromeWindows, 'chrome', 'windows'],
    [agents.headlessChromeLinux, 'chrome', 'linux'],
    [agents.edgeWindows, 'edge', 'windows'],
    [agents.firefoxLinux, 'firefox', 'linux'],
    [agents.firefoxMac, 'firefox', 'macos'],
    [agents.safariMac, 'safari', 'macos'],
    [agents.safariIphone, 'safari', 'iphone'],
    [agents.chromeIpad, 'chrome', 'ipad'],
    [agents.firefoxIphone, 'firefox', 'iphone'],
    [agents.edgeIphone, 'edge', 'iphone'],
    [agents.samsungAndroid, 'samsung', 'android'],
    [agents.chromeAndroid, 'chrome', 'android'],
    [agents.chromebook, 'chrome', 'chromeos'],
    [agents.operaWindows, 'opera', 'windows'],
  ])('names the browser and system of %s', (agent, browser, os) => {
    expect(deviceFromUserAgent(agent)).toEqual({ browser, os });
  });

  it('says unknown for what it cannot tell, or when there is no user agent', () => {
    expect(deviceFromUserAgent('curl/8.4.0')).toEqual({ browser: 'unknown', os: 'unknown' });
    expect(deviceFromUserAgent('')).toEqual({ browser: 'unknown', os: 'unknown' });
    expect(deviceFromUserAgent(null)).toEqual({ browser: 'unknown', os: 'unknown' });
  });
});

describe('device keys', () => {
  it('recognises only the known browser and system keys', () => {
    expect(isBrowserKey('edge')).toBe(true);
    expect(isBrowserKey('netscape')).toBe(false);
    expect(isOsKey('chromeos')).toBe(true);
    expect(isOsKey('beos')).toBe(false);
  });
});
