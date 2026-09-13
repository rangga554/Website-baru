import { requireNetlifyConnection } from "../../../_shared";
import { triggerNetlifyBuild } from "@/lib/thirdPartyApps";

// "Test" — trigger build baru. Kalau site-nya BUKAN hasil link repo (misal
// upload manual/drag-drop doang), Netlify bakal nolak ini dengan pesan
// error sendiri — ditampilin apa adanya ke user, jangan disamarin.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { conn, error } = await requireNetlifyConnection();
  if (error) return error;

  const result = await triggerNetlifyBuild(conn.access_token, params.id);
  if (result.ok === false) {
    return Response.json(
      { error: result.error || "Site ini kemungkinan gak ke-link ke repo (upload manual), jadi gak bisa di-trigger build ulang." },
      { status: result.status || 500 }
    );
  }
  return Response.json({ ok: true, build: result.data });
}
