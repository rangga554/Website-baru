import { requireRobloxConnection } from "../../../_shared";
import { downloadRobloxPlaceFile } from "@/lib/thirdPartyApps";

// GET — stream file .rbxl APA ADANYA langsung ke browser user sebagai
// attachment (download), TIDAK melewati/tersimpan di database KRYNOS
// sama sekali — biar gak makan kuota storage.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  try {
    const buf = await downloadRobloxPlaceFile(auth.cookie, Number(params.id));
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="backup-place-${params.id}-${Date.now()}.rbxl"`,
      },
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Gagal download backup" }, { status: 400 });
  }
}
