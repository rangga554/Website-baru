import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { runWebStoreCheck, normalizeWebStoreUrl } from "@/lib/webstore";

export const runtime = "nodejs";
export const maxDuration = 60;

const TABLE = "web_store_sites";

// GET -> daftar semua website yang udah terdaftar (publik, gak perlu login,
// biar kayak "App Store" yang bisa dilihat siapa aja).
export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, url, owner_login, title, favicon, status, score, verdict, flags, last_checked_at, created_at")
    .order("last_checked_at", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sites: data || [] });
}

// POST -> daftarin website baru. Body: { url: string }
// Langsung dicek real-time sekali (biar user gak nunggu sampe cron besok),
// abis itu bakal dicek ulang otomatis tiap hari lewat cron.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const login = (session as any).login as string;

  const body = await req.json().catch(() => ({}));
  const rawUrl = (body.url || "").trim();
  if (!rawUrl) return NextResponse.json({ error: "URL wajib diisi" }, { status: 400 });

  const normalizedUrl = normalizeWebStoreUrl(rawUrl);
  let domain: string;
  try {
    domain = new URL(normalizedUrl).hostname;
  } catch {
    return NextResponse.json({ error: "URL tidak valid" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Cek duplikat berdasarkan domain (biar gak ada 2 entri buat domain yang
  // sama persis, walau ditulis beda-beda misal http vs https / trailing slash).
  const { data: existing } = await supabase
    .from(TABLE)
    .select("id")
    .ilike("url", `%${domain}%`)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Website ini udah pernah didaftarin" }, { status: 409 });
  }

  let result;
  try {
    result = await runWebStoreCheck(normalizedUrl);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Gagal mengecek website ini, pastikan URL bisa diakses" },
      { status: 400 }
    );
  }

  const { data: inserted, error } = await supabase
    .from(TABLE)
    .insert({
      url: result.finalUrl,
      owner_login: login,
      title: result.title,
      favicon: result.favicon,
      status: result.status,
      score: result.score,
      verdict: result.verdict,
      flags: result.flags,
      http_status: result.httpStatus,
      last_checked_at: new Date().toISOString(),
      check_count: 1,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: inserted });
}
