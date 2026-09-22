// Shared baseline security headers, applied to every response the app sends —
// the HTML shell, /api/* JSON, and static assets (server/serve.mjs). Analytics
// domains are only added to the CSP when GA_MEASUREMENT_ID is actually configured,
// so the default policy stays as tight as possible.
export function securityHeaders(env){
 const analytics=!!env.GA_MEASUREMENT_ID;
 const csp=[
  "default-src 'self'",
  "script-src 'self'"+(analytics?' https://www.googletagmanager.com':''),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:"+(analytics?' https://www.google-analytics.com':''),
  "connect-src 'self'"+(analytics?' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com':''),
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'"
 ].join('; ');
 return {
  'X-Content-Type-Options':'nosniff',
  'X-Frame-Options':'DENY',
  'Referrer-Policy':'strict-origin-when-cross-origin',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security':'max-age=63072000; includeSubDomains',
  'Content-Security-Policy':csp
 };
}
