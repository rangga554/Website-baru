import dns from "dns";
const resolver = new dns.promises.Resolver();

export async function analyzeGeo(domain: string) {
  let ip: string | null = null;
  let ipv6: string | null = null;
  try {
    const a = await resolver.resolve4(domain);
    ip = a[0] || null;
  } catch {}
  try {
    const aaaa = await resolver.resolve6(domain);
    ipv6 = aaaa[0] || null;
  } catch {}

  if (!ip) return { ip: null, ipv6, error: "IP tidak ditemukan" };

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    const data = await res.json();
    if (data.error) return { ip, ipv6, error: data.reason || "geo lookup failed" };

    return {
      ip,
      ipv6,
      country: data.country_name,
      countryCode: data.country_code,
      city: data.city,
      region: data.region,
      isp: data.org,
      asn: data.asn,
      timezone: data.timezone,
      latitude: data.latitude,
      longitude: data.longitude,
    };
  } catch {
    return { ip, ipv6, error: "geo lookup failed" };
  }
}
