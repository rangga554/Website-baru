import { NextRequest } from "next/server";
import { requireVercelConnection } from "../../../_shared";
import { addVercelDomain, getVercelDomainConfig, listVercelDomains, splitDomainHost } from "@/lib/thirdPartyApps";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const result = await listVercelDomains(conn.access_token, params.id, conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });

  const domains = result.data.domains || [];

  // Cek status verifikasi DNS masing-masing domain SEKALIGUS (paralel) —
  // ditampilin apa adanya (Verified/Misconfigured), bukan cuma "domain
  // ke-daftar" doang. Kalau gagal cek 1 domain, jangan gagalin semuanya —
  // tandain aja domain itu statusnya "unknown".
  //
  // Buat domain yang MISCONFIGURED, sekalian sertain rekomendasi DNS yang
  // beneran perlu di-setting (A/CNAME dari Vercel sendiri, apa adanya —
  // bukan nilai hardcode), plus TXT verification kalau domainnya lagi
  // butuh pembuktian kepemilikan (ini muncul kalau domainnya pernah/lagi
  // dipake di akun Vercel lain).
  const withStatus = await Promise.all(
    domains.map(async (d: any) => {
      const cfg = await getVercelDomainConfig(conn.access_token, d.name, conn.provider_team_id);
      if (cfg.ok === false) return { ...d, verification: "unknown", verificationDetail: cfg.error };

      // PENTING: pakai `apexName` yang dikasih LANGSUNG sama Vercel API,
      // bukan nebak dari jumlah titik — nebak dari jumlah titik SALAH buat
      // domain ber-TLD 2-level kayak ".co.id" ("toko.co.id" bakal ke-anggep
      // subdomain padahal itu apex/root, jadinya disaranin CNAME padahal
      // harusnya A record). Fallback ke splitDomainHost cuma kalau Vercel
      // gak nyertain apexName-nya (jarang, tapi jaga-jaga).
      const apexName = d.apexName || splitDomainHost(d.name).apex;
      const isApex = d.name === apexName;
      const host = isApex ? "@" : d.name.slice(0, d.name.length - apexName.length - 1);
      return {
        ...d,
        verification: cfg.data.misconfigured ? "misconfigured" : "verified",
        dnsGuide: cfg.data.misconfigured
          ? {
              recordType: isApex ? "A" : "CNAME",
              host,
              value: isApex
                ? cfg.data.recommendedIPv4?.[0]?.value?.[0] || "76.76.21.21"
                : cfg.data.recommendedCNAME?.[0]?.value || "cname.vercel-dns.com",
              // TXT verification (ownership proof) — cuma ada kalau memang
              // lagi dibutuhin, biasanya karena domainnya kepake di akun
              // Vercel lain juga.
              verificationTxt: (d.verification || []).map((v: any) => ({
                type: v.type,
                host: v.domain || d.name,
                value: v.value,
              })),
            }
          : null,
      };
    })
  );

  return Response.json({ domains: withStatus });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const { domain } = await req.json();
  if (!domain || typeof domain !== "string" || !domain.trim()) {
    return Response.json({ error: "Domain wajib diisi" }, { status: 400 });
  }

  const result = await addVercelDomain(conn.access_token, params.id, domain.trim(), conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });

  return Response.json({ ok: true, domain: result.data });
}
