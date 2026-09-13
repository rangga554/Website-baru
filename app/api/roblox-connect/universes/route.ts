import { NextRequest } from "next/server";
import { requireRobloxConnection } from "../_shared";
import { createRobloxUniverse } from "@/lib/thirdPartyApps";

export async function POST(req: NextRequest) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Nama Universe gak boleh kosong" }, { status: 400 });
  }

  const result = await createRobloxUniverse(auth.cookie, name.trim());
  if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true, universeId: result.universeId, rootPlaceId: result.rootPlaceId });
}
