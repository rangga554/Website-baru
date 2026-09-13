export async function analyzeHttp(inputUrl: string) {
  const redirectChain: { url: string; status: number }[] = [];
  let currentUrl = inputUrl;
  let finalRes: Response | null = null;
  const t0 = Date.now();
  let dnsTime = 0;
  let ttfb = 0;

  for (let i = 0; i < 10; i++) {
    const stepStart = Date.now();
    const res = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; SiteInspector/2.0; +https://site-inspector.app)",
      },
    });
    ttfb = Date.now() - stepStart;
    redirectChain.push({ url: currentUrl, status: res.status });

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) {
        finalRes = res;
        break;
      }
      currentUrl = new URL(loc, currentUrl).toString();
      continue;
    }
    finalRes = res;
    break;
  }

  if (!finalRes) throw new Error("Failed to fetch URL");

  const html = await finalRes.text();
  const responseTime = Date.now() - t0;

  const headers: Record<string, string> = {};
  finalRes.headers.forEach((v, k) => (headers[k] = v));

  return {
    finalUrl: currentUrl,
    httpStatus: finalRes.status,
    httpVersion: headers["x-http-version"] || "HTTP/1.1 or 2 (not exposed by fetch)",
    contentType: headers["content-type"] || null,
    contentLength: headers["content-length"] ? Number(headers["content-length"]) : html.length,
    encoding: headers["content-encoding"] || "identity",
    lastModified: headers["last-modified"] || null,
    redirectChain,
    responseTime,
    ttfb,
    headers,
    html,
  };
}
