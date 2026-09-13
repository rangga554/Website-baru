import { requireRobloxConnection } from "../../../_shared";
import { downloadRobloxPlaceFile } from "@/lib/thirdPartyApps";
import { parsePlaceFile, inspectPlaceFile } from "@/lib/robloxPlaceFile";

// GET — download file .rbxl place ini & parse tree service/script-nya.
// File ASLI di Roblox TIDAK PERNAH tersentuh operasi ini (baca doang).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  let buf: Buffer;
  try {
    buf = await downloadRobloxPlaceFile(auth.cookie, Number(params.id));
  } catch (e: any) {
    return Response.json({ error: e?.message || "Gagal download file Place" }, { status: 400 });
  }

  try {
    const parsed = parsePlaceFile(buf);
    const payload: any = { services: parsed.services, sizeBytes: buf.length };
    // Kalau hasil "services" (yang udah difilter ke service target) kosong,
    // sertain juga topLevel MENTAH + full chunk-level inspect — biar
    // kelihatan apa file-nya beneran gak punya ServerScriptService dkk,
    // atau ada bug di parsing chunk-nya.
    if (parsed.services.length === 0) {
      payload.debugTopLevel = parsed.topLevel.map((n) => ({ name: n.name, className: n.className, childCount: n.children.length }));
      payload.debugClassCount = Object.keys(parsed.classes).length;
      payload.debug = inspectPlaceFile(buf);
    }
    return Response.json(payload);
  } catch (e: any) {
    return Response.json({ error: e?.message || "Gagal membaca format file Place (mungkin file terlalu besar/kompleks, atau format berubah).", debug: inspectPlaceFile(buf) }, { status: 400 });
  }
}

