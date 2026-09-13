export async function analyzeWhois(domain: string) {
  try {
    const bootstrapRes = await fetch(`https://rdap.org/domain/${domain}`, {
      headers: { Accept: "application/rdap+json" },
    });
    if (!bootstrapRes.ok) {
      return { available: false, reason: `RDAP responded ${bootstrapRes.status}` };
    }
    const data = await bootstrapRes.json();

    const events: any[] = data.events || [];
    const findEvent = (action: string) => events.find((e) => e.eventAction === action)?.eventDate || null;

    const registrarEntity = (data.entities || []).find((e: any) => e.roles?.includes("registrar"));
    const registrantEntity = (data.entities || []).find((e: any) => e.roles?.includes("registrant"));
    const abuseEntity = (data.entities || [])
      .flatMap((e: any) => e.entities || [])
      .find((e: any) => e.roles?.includes("abuse"));

    const vcardValue = (vcard: any, key: string) => {
      if (!vcard) return null;
      const arr = vcard.find((v: any) => v[0] === key);
      return arr ? arr[3] : null;
    };

    return {
      available: true,
      domain: data.ldhName || domain,
      registrar: registrarEntity ? vcardValue(registrarEntity.vcardArray?.[1], "fn") : null,
      registrant: registrantEntity ? vcardValue(registrantEntity.vcardArray?.[1], "fn") : "Privasi terlindungi",
      createdDate: findEvent("registration"),
      updatedDate: findEvent("last changed"),
      expirationDate: findEvent("expiration"),
      status: data.status || [],
      nameServers: (data.nameservers || []).map((ns: any) => ns.ldhName),
      abuseContact: abuseEntity ? vcardValue(abuseEntity.vcardArray?.[1], "email") : null,
      registry: data.port43 || null,
    };
  } catch (e) {
    return { available: false, reason: "lookup failed" };
  }
}
