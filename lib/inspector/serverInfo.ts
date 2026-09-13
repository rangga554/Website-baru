export function analyzeServer(headers: Record<string, string>) {
  const server = headers["server"] || null;
  const poweredBy = headers["x-powered-by"] || null;
  const via = headers["via"] || null;
  const cfRay = headers["cf-ray"];
  const cdn =
    (cfRay && "Cloudflare") ||
    (headers["x-vercel-id"] && "Vercel") ||
    (headers["x-amz-cf-id"] && "Amazon CloudFront") ||
    (headers["x-fastly-request-id"] && "Fastly") ||
    (server && /cloudflare/i.test(server) && "Cloudflare") ||
    null;

  const waf =
    (headers["cf-ray"] && "Cloudflare WAF (kemungkinan)") ||
    (headers["x-sucuri-id"] && "Sucuri WAF") ||
    (headers["x-akamai-transformed"] && "Akamai") ||
    null;

  return {
    server,
    poweredBy,
    reverseProxy: via,
    cdn,
    waf,
    http2: null, // fetch API tidak mengekspos versi protokol secara langsung di Node runtime
    http3: headers["alt-svc"]?.includes("h3") || false,
    compression: headers["content-encoding"] || null,
    keepAlive: headers["connection"] || null,
  };
}
