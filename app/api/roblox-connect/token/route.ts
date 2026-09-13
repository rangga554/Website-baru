import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { saveConnection, validateRobloxCookie, encodeRobloxSecret } from "@/lib/thirdPartyApps";

// POST { cookie, apiKey? } — validasi cookie .ROBLOSECURITY LANGSUNG ke
// Roblox (endpoint /users/authenticated). Kalau gagal, DITOLAK di sini,
// cookie gak pernah disimpan ke database. apiKey opsional (buat fitur
// publish/save Place yang wajib pakai Open Cloud API Key, bukan cookie).
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return Response.json({ error: "Belum login" }, { status: 401 });

  const { cookie, apiKey } = await req.json();
  if (!cookie || typeof cookie !== "string" || !cookie.trim()) {
    return Response.json({ error: "Cookie gak boleh kosong" }, { status: 400 });
  }

  const result = await validateRobloxCookie(cookie.trim());
  if (result.ok === false) {
    return Response.json({ error: result.error }, { status: 400 });
  }

  await saveConnection(identity.id, "roblox", {
    access_token: encodeRobloxSecret({ cookie: cookie.trim(), apiKey: apiKey && typeof apiKey === "string" ? apiKey.trim() : undefined }),
    provider_account_id: String(result.user.id),
    account_email: null,
    account_name: result.user.displayName,
  });

  return Response.json({ ok: true, user: result.user });
}
