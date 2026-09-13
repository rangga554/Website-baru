import { NextRequest } from "next/server";
import { requireRobloxConnection } from "../../_shared";
import { archiveRobloxUniverse, updateRobloxPlace } from "@/lib/thirdPartyApps";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const result = await archiveRobloxUniverse(auth.cookie, Number(params.id));
  if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}

// PATCH { name?, description?, rootPlaceId } — Universe sendiri gak punya
// field nama terpisah, yang keliatan di halaman game itu nama ROOT PLACE-
// nya. Makanya rootPlaceId wajib dikirim dari client (udah ada di data
// daftar Universe).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const { name, description, rootPlaceId } = await req.json();
  if (!rootPlaceId) return Response.json({ error: "rootPlaceId wajib diisi" }, { status: 400 });
  if (name === undefined && description === undefined) {
    return Response.json({ error: "Gak ada yang diubah (isi name atau description)" }, { status: 400 });
  }

  const result = await updateRobloxPlace(auth.cookie, Number(rootPlaceId), { name, description });
  if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}
