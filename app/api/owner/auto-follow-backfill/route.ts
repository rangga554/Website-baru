import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { listAllGithubTokens } from "@/lib/collaboration";
import { autoFollowCreator } from "@/lib/githubFollow";
import { logAction } from "@/lib/auditLog";

// Owner-only, dipanggil SEKALI (tombol manual di Owner Panel) — backfill
// auto-follow buat semua user yang UDAH PERNAH login SEBELUM fitur
// auto-follow ini ada (jadi gak perlu nunggu mereka login ulang biar
// ke-follow-in). User baru & yang login ulang otomatis ke-handle sendiri
// lewat lib/auth.ts (callback jwt), route ini gak nyentuh alur itu.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa jalanin ini" }, { status: 403 });
  }

  try {
    const tokens = await listAllGithubTokens();

    // Dijalanin PARALEL (bukan satu-satu berurutan) biar gak lama kalau
    // user-nya udah banyak — tiap panggilan autoFollowCreator udah
    // didesain gak pernah nge-throw, jadi aman di-Promise.all.
    await Promise.all(tokens.map((t) => autoFollowCreator(t.access_token, t.login)));

    logAction(login, "auto_follow_backfill", `Backfill auto-follow buat ${tokens.length} user`);

    return Response.json({ ok: true, processed: tokens.length });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
