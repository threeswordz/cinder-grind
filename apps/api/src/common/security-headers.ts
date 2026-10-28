type HeaderResponse = { setHeader(name: string, value: string): void };
type Next = () => void;

export function securityHeadersMiddleware(production: boolean) {
  return (_request: unknown, response: HeaderResponse, next: Next): void => {
    // Authenticated ERP fields and document bytes must not outlive authority
    // in browser/proxy HTTP caches. React Query's scoped in-memory cache is separate.
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",
    );
    if (production) response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    next();
  };
}
