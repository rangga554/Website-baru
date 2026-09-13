export function analyzeSecurity(headers: Record<string, string>, html: string, isHttps: boolean, ssl: any) {
  const securityHeaders = {
    "content-security-policy": headers["content-security-policy"] || null,
    "strict-transport-security": headers["strict-transport-security"] || null,
    "x-frame-options": headers["x-frame-options"] || null,
    "x-content-type-options": headers["x-content-type-options"] || null,
    "referrer-policy": headers["referrer-policy"] || null,
    "permissions-policy": headers["permissions-policy"] || null,
    "cache-control": headers["cache-control"] || null,
    etag: headers["etag"] || null,
  };

  const mixedContent = isHttps && /src=["']http:\/\/(?!localhost)/i.test(html);

  const checks = {
    https: isHttps,
    sslValid: ssl?.available && !ssl?.expired,
    hsts: !!securityHeaders["strict-transport-security"],
    csp: !!securityHeaders["content-security-policy"],
    clickjackingProtection: !!securityHeaders["x-frame-options"] || /frame-ancestors/i.test(securityHeaders["content-security-policy"] || ""),
    mimeSniffingProtection: securityHeaders["x-content-type-options"] === "nosniff",
    mixedContent,
  };

  return { headers: securityHeaders, checks };
}

export function calculateScores(input: {
  security: ReturnType<typeof analyzeSecurity>;
  ssl: any;
  performance: { responseTime: number; ttfb: number };
  seo: any;
  server: any;
}) {
  // Security score
  let sec = 0;
  const c = input.security.checks;
  if (c.https) sec += 25;
  if (c.sslValid) sec += 20;
  if (c.hsts) sec += 15;
  if (c.csp) sec += 15;
  if (c.clickjackingProtection) sec += 10;
  if (c.mimeSniffingProtection) sec += 10;
  if (!c.mixedContent) sec += 5;
  const securityScore = Math.min(100, sec);

  // Performance score (based on response time, lower is better)
  const rt = input.performance.responseTime;
  let perf = 100;
  if (rt > 300) perf -= 10;
  if (rt > 800) perf -= 20;
  if (rt > 1500) perf -= 25;
  if (rt > 3000) perf -= 25;
  if (rt > 5000) perf -= 20;
  const performanceScore = Math.max(0, perf);

  // SEO score
  let seo = 0;
  const s = input.seo;
  if (s.title && s.titleLength > 10 && s.titleLength < 65) seo += 20;
  else if (s.title) seo += 10;
  if (s.metaDescription && s.metaDescriptionLength > 50 && s.metaDescriptionLength < 165) seo += 20;
  else if (s.metaDescription) seo += 10;
  if (s.h1Count === 1) seo += 15;
  else if (s.h1Count > 0) seo += 5;
  if (s.canonical) seo += 10;
  if (s.robotsTxt) seo += 10;
  if (s.sitemapXml) seo += 10;
  if (Object.keys(s.openGraph || {}).length > 0) seo += 10;
  if (s.imagesTotal === 0 || s.imagesWithoutAlt / Math.max(s.imagesTotal, 1) < 0.2) seo += 5;
  const seoScore = Math.min(100, seo);

  // Server score
  let srv = 60;
  if (input.server.cdn) srv += 15;
  if (input.server.waf) srv += 10;
  if (input.server.http3) srv += 5;
  if (input.server.compression) srv += 10;
  const serverScore = Math.min(100, srv);

  const overall = Math.round((securityScore + performanceScore + seoScore + serverScore) / 4);

  return { securityScore, performanceScore, seoScore, serverScore, overall };
}
