import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { runWebStoreCheck } from "@/lib/webstore";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";
export const maxDuration = 60; // batas Vercel Hobby plan, makanya diproses per-batch (lihat BATCH_SIZE)

const TABLE = "web_store_sites";

// Diproses per-batch (bukan semua sekaligus) biar gak kena timeout kalau
// website yang terdaftar udah banyak. Dipanggil sekali/hari, prioritasin
// yang PALING LAMA gak dicek duluan (least-recently-checked), jadi kalau
// misal ada 500 website & baru sanggup proses 20/hari, tetep gilirannya
// adil & semua kebagian dicek dalam waktu wajar.
// DIKURANGI dari 20 -> 10: batch 20 sekaligus (tanpa jeda antar request)
// gampang ngabisin jatah rate-limit Groq buat model yang SAMA dipake
// bareng CS Chat/Code Suggestion/Debug, bikin verdict AI Web Store gagal
// (fallback ke skor deterministik doang). Batch lebih kecil = beban lebih
// nyebar, resiko limit lebih kecil.
const BATCH_SIZE = 10;

export async function GET(req: NextRequest) {
  // Proteksi: cuma boleh dipanggil sama Vercel Cron (yang otomatis kirim
  // header ini) ATAU orang yang tau CRON_SECRET-nya. Tanpa ini, siapa aja
  // bisa nge-hit endpoint ini berkali-kali dan boros kuota AI/API pihak
  // ketiga punya kita.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data: sites, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sites || sites.length === 0) return NextResponse.json({ checked: 0 });

  let checked = 0;
  let failed = 0;

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    // Jeda kecil antar website (kecuali yang pertama) — biar request ke Groq
    // gak nembak beruntun dalam hitungan detik yang sama dan gampang kena
    // rate-limit model yang dipake bareng fitur lain (CS Chat/Code
    // Suggestion/Debug).
    if (i > 0) await new Promise((r) => setTimeout(r, 1500));

    try {
      const result = await runWebStoreCheck(site.url);
      const wasSafeBefore = site.status === "aman";
      const isRiskyNow = result.status === "berisiko";

      await supabase
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
        .eq("id", site.id);

      // Cuma notif kalau BARU jadi berisiko (bukan yang emang dari awal
      // udah berisiko), biar gak spam notif tiap hari buat kasus yang sama.
      if (isRiskyNow && wasSafeBefore) {
        sendPushToUser(site.owner_login, {
          title: "⚠️ Website kamu di Web Store perlu perhatian",
          body: `${site.url} sekarang dinilai berisiko: ${result.verdict}`.slice(0, 180),
          url: "/web-store",
        });
      }

      checked++;
    } catch (e: any) {
      // Website gagal diakses (down/expired/dll) -> tandain status khusus,
      // JANGAN dianggap "berisiko" (beda kasus: itu soal keamanan data,
      // ini soal website-nya gak bisa diakses).
      await supabase
        .from(TABLE)
        .update({
          status: "tidak_terjangkau",
          verdict: `Gagal diakses saat pengecekan terakhir: ${e.message || "unknown error"}`,
          last_checked_at: new Date().toISOString(),
          check_count: (site.check_count || 0) + 1,
        })
        .eq("id", site.id);
      failed++;
    }
  }

  return NextResponse.json({ checked, failed, total: sites.length });
}
