import dns from "dns";
const resolver = new dns.promises.Resolver();

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function analyzeDns(domain: string) {
  const [a, aaaa, mx, ns, txt, cname, soa, caa] = await Promise.all([
    safe(() => resolver.resolve4(domain)),
    safe(() => resolver.resolve6(domain)),
    safe(() => resolver.resolveMx(domain)),
    safe(() => resolver.resolveNs(domain)),
    safe(() => resolver.resolveTxt(domain)),
    safe(() => resolver.resolveCname(domain)),
    safe(() => resolver.resolveSoa(domain)),
    safe(() => (resolver as any).resolveCaa?.(domain)),
  ]);

  const txtFlat = (txt || []).map((t) => t.join(""));
  const spf = txtFlat.find((t) => t.toLowerCase().startsWith("v=spf1")) || null;
  const dmarcTxt = await safe(() => resolver.resolveTxt(`_dmarc.${domain}`));
  const dmarc = dmarcTxt ? dmarcTxt.map((t) => t.join("")).find((t) => t.toLowerCase().includes("v=dmarc1")) : null;

  // DKIM: try a few common selectors since the real selector isn't discoverable without more info
  const dkimSelectors = ["default", "google", "selector1", "selector2", "k1"];
  let dkim: string | null = null;
  for (const sel of dkimSelectors) {
    const rec = await safe(() => resolver.resolveTxt(`${sel}._domainkey.${domain}`));
    if (rec) {
      dkim = rec.map((t) => t.join("")).join(" ");
      break;
    }
  }

  let ptr: string[] | null = null;
  if (a && a[0]) {
    ptr = await safe(() => resolver.reverse(a[0]));
  }

  return {
    a: a || [],
    aaaa: aaaa || [],
    mx: (mx || []).map((m) => ({ exchange: m.exchange, priority: m.priority })),
    ns: ns || [],
    txt: txtFlat,
    spf,
    dkim,
    dmarc,
    cname: cname || [],
    ptr: ptr || [],
    soa: soa || null,
    caa: caa || [],
    dnssec: (ns && ns.length > 0) ? "unknown" : "unknown",
  };
}
