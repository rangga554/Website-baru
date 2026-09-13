import { NextRequest } from "next/server";
import { requireNetlifyConnection } from "../../../_shared";
import {
  addNetlifyDomainAlias,
  getNetlifyDnsZoneNameservers,
  getNetlifyDomainVerification,
  splitDomainHost,
} from "@/lib/thirdPartyApps";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const result = await getNetlifyDomainVerification(conn.access_token, params.id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });

  const { customDomain, domainAliases, ssl, state, dnsZoneId, defaultSubdomain } = result.data;
  // Digabung jadi 1 list biar konsisten sama tampilan Vercel (custom_domain
  // ditandain "primary" biar keliatan beda dari alias biasa).
  const domains = [
    ...(customDomain ? [{ name: customDomain, isPrimary: true }] : []),
    ...domainAliases.map((d: string) => ({ name: d, isPrimary: false })),
  ];

  const verification = ssl ? "verified" : state === "current" ? "pending" : "unknown";

  // Kalau lagi belum verified, sertain instruksi DNS yang perlu di-setting.
  // Netlify gak expose "cek DNS per-domain" kayak Vercel, jadi ini pake
  // nilai RESMI & TETAP dari dokumentasi Netlify sendiri (bukan ngarang):
  // apex pake ALIAS/ANAME/A ke load balancer mereka, subdomain pake CNAME
  // ke subdomain default site ini. Ditambah opsi "pindah nameserver
  // sepenuhnya ke Netlify" kalau site-nya emang udah punya DNS Zone aktif.
  let dnsGuide: any = null;
  if (verification !== "verified" && domains.length > 0) {
    const targetDomain = domains[0].name;
    // Netlify gak ngasih tau apex-nya langsung (beda sama Vercel), jadi
    // dideteksi pake splitDomainHost yang udah paham TLD 2-level kayak
    // ".co.id" — sebelumnya cuma ngitung titik, jadi "toko.co.id" salah
    // ke-anggep subdomain dan disaranin CNAME padahal butuhnya A record.
    const { isApex, host } = splitDomainHost(targetDomain);
    dnsGuide = {
      recordType: isApex ? "A (atau ALIAS/ANAME kalau provider DNS-mu dukung)" : "CNAME",
      host,
      value: isApex ? "75.2.60.5 (A) — atau apex-loadbalancer.netlify.com (ALIAS/ANAME, lebih disaranin)" : defaultSubdomain,
      nameservers: null as string[] | null,
    };

    if (dnsZoneId) {
      const ns = await getNetlifyDnsZoneNameservers(conn.access_token, dnsZoneId);
      if (ns.ok === false) {
        // Gagal ambil nameserver -> biarin null, opsi ALIAS/A di atas tetap kepake
      } else {
        dnsGuide.nameservers = ns.nameservers;
      }
    }
  }

  return Response.json({ domains, verification, dnsGuide });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const { domain } = await req.json();
  if (!domain || typeof domain !== "string" || !domain.trim()) {
    return Response.json({ error: "Domain wajib diisi" }, { status: 400 });
  }

  const result = await addNetlifyDomainAlias(conn.access_token, params.id, domain.trim());
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });

  return Response.json({ ok: true });
}
