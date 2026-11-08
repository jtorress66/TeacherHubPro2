import { describe, expect, it } from 'vitest';
import { securityHeaders } from './security-headers.ts';

const header = (key: string) => securityHeaders.find((entry) => entry.key === key)?.value;

describe('securityHeaders', () => {
  it('forbids framing by other sites and file-type guessing', () => {
    expect(header('X-Frame-Options')).toBe('DENY');
    expect(header('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    expect(header('X-Content-Type-Options')).toBe('nosniff');
  });

  it('keeps HTTPS on and the camera and location off', () => {
    expect(header('Strict-Transport-Security')).toMatch(/^max-age=\d{8}/);
    expect(header('Permissions-Policy')).toContain('camera=()');
    expect(header('Permissions-Policy')).toContain('geolocation=()');
  });
});
