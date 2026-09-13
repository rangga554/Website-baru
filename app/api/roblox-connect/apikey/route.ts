import { NextRequest } from "next/server";
import { requireRobloxConnection } from "../_shared";
import { updateRobloxApiKey } from "@/lib/thirdPartyApps";

// POST { apiKey } — simpan/update API Key Open Cloud. Cookie yang udah
// tersimpan TIDAK ikut berubah, cuma bagian apiKey-nya yang di-update.
export async function POST(req: NextRequest) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const { apiKey } = await req.json();
  if (typeof apiKey !== "string") return Response.json({ error: "apiKey wajib diisi" }, { status: 400 });

  await updateRobloxApiKey(auth.identity.id, auth.cookie, apiKey);
  return Response.json({ ok: true });
}
