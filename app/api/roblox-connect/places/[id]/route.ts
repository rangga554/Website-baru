import { NextRequest } from "next/server";
import { requireRobloxConnection } from "../../_shared";
import { removeRobloxPlace, updateRobloxPlace } from "@/lib/thirdPartyApps";

// DELETE ?universeId=...&isRoot=true|false
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const universeId = Number(req.nextUrl.searchParams.get("universeId"));
  const isRoot = req.nextUrl.searchParams.get("isRoot") === "true";
  if (!universeId) return Response.json({ error: "universeId wajib diisi" }, { status: 400 });

  const result = await removeRobloxPlace(auth.cookie, universeId, Number(params.id), isRoot);
  if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}

// PATCH { name?, description? } — edit nama/deskripsi Place ini.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const { name, description } = await req.json();
  if (name === undefined && description === undefined) {
    return Response.json({ error: "Gak ada yang diubah (isi name atau description)" }, { status: 400 });
  }
  const result = await updateRobloxPlace(auth.cookie, Number(params.id), { name, description });
  if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}
