/**
 * Headers sent with every page and API reply. The page may not be framed by any site, the browser
 * must not guess file types, addresses leak only the site name to other sites, and the camera and
 * location stay off (the microphone is allowed for this site's own voice features).
 */
export const securityHeaders: readonly { readonly key: string; readonly value: string }[] = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];
