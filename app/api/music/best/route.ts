import { NextRequest } from "next/server";
import { fetchBestJamendoTrack } from "@/lib/music/jamendo";

export async function GET(req: NextRequest) {
  const excludeId = req.nextUrl.searchParams.get("exclude") || undefined;
  const result = await fetchBestJamendoTrack(excludeId);
  if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ track: result.track });
}
