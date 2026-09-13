import { NextRequest } from "next/server";
import { requireRobloxConnection } from "../../_shared";
import { checkRobloxApiKeyAccess } from "@/lib/thirdPartyApps";

// GET ?universeId=... — cek apakah API Key yang tersimpan punya akses ke
// Universe ini lewat Open Cloud. Dipanggil satu-satu per Universe dari
// sisi client (bukan Open Cloud yang gak punya endpoint list semuanya).
export async function GET(req: NextRequest) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const universeId = Number(req.nextUrl.searchParams.get("universeId"));
  if (!universeId) return Response.json({ error: "universeId wajib diisi" }, { status: 400 });
  if (!auth.apiKey) return Response.json({ error: "Belum ada API Key tersimpan" }, { status: 400 });

  const result = await checkRobloxApiKeyAccess(auth.apiKey, universeId);
  if (result.ok === false) return Response.json({ ok: false, error: result.error });
  return Response.json({ ok: true });
}
