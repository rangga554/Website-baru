import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { runWebStoreCheck } from "@/lib/webstore";

export const runtime = "nodejs";
export const maxDuration = 60;

const TABLE = "web_store_sites";
const COOLDOWN_MS = 60 * 60 * 1000; // 1 jam — cegah spam rescan (tiap rescan manggil AI)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const login = (session as any).login as string;

  const supabase = getSupabaseAdmin();
  const { data: site, error: fetchErr } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchErr || !site) return NextResponse.json({ error: "Website gak ketemu" }, { status: 404 });
  if (site.owner_login !== login) {
    return NextResponse.json({ error: "Cuma yang daftarin website ini yang bisa rescan" }, { status: 403 });
  }

  const lastChecked = site.last_checked_at ? new Date(site.last_checked_at).getTime() : 0;
  const remainingMs = COOLDOWN_MS - (Date.now() - lastChecked);
  if (remainingMs > 0) {
    return NextResponse.json(
      { error: `Tunggu ${Math.ceil(remainingMs / 60000)} menit lagi sebelum rescan ulang` },
      { status: 429 }
    );
  }

  let result;
  try {
    result = await runWebStoreCheck(site.url);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Gagal mengecek ulang website ini" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from(TABLE)
    .update({
      title: result.title,
      favicon: result.favicon,
      status: result.status,
      score: result.score,
      verdict: result.verdict,
      flags: result.flags,
      http_status: result.httpStatus,
      last_checked_at: new Date().toISOString(),
      check_count: (site.check_count || 0) + 1,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ site: updated });
}
