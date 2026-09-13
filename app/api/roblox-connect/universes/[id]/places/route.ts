import { NextRequest } from "next/server";
import { requireRobloxConnection } from "../../../_shared";
import { listRobloxPlaces, createRobloxPlace } from "@/lib/thirdPartyApps";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const result = await listRobloxPlaces(auth.cookie, Number(params.id));
  if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ places: result.places });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const { name } = await req.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Nama Place gak boleh kosong" }, { status: 400 });
  }

  const result = await createRobloxPlace(auth.cookie, Number(params.id), name.trim());
  if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true, placeId: result.placeId });
}
