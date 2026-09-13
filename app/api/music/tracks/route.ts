import { NextRequest } from "next/server";
import { fetchJamendoTracks } from "@/lib/music/jamendo";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const search = sp.get("q") || undefined;
  const tags = sp.get("tags") || undefined;
  const order = sp.get("order") || undefined;
  const offset = sp.get("offset") ? Number(sp.get("offset")) : undefined;
  const limit = sp.get("limit") ? Number(sp.get("limit")) : undefined;

  const result = await fetchJamendoTracks({ search, tags, order, offset, limit });
  if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ tracks: result.tracks });
}
