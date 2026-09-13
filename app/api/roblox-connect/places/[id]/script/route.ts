import { NextRequest } from "next/server";
import { requireRobloxConnection } from "../../../_shared";
import { downloadRobloxPlaceFile, uploadRobloxPlaceFile } from "@/lib/thirdPartyApps";
import { getScriptSource, patchScriptSource, createScript, deleteScript } from "@/lib/robloxPlaceFile";

// GET ?ref=123 — baca source 1 script (download place file fresh setiap
// kali biar selalu versi terbaru, bukan cache basi).
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const ref = Number(req.nextUrl.searchParams.get("ref"));
  if (!ref) return Response.json({ error: "ref wajib diisi" }, { status: 400 });

  try {
    const buf = await downloadRobloxPlaceFile(auth.cookie, Number(params.id));
    const source = getScriptSource(buf, ref);
    return Response.json({ source });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Gagal membaca script" }, { status: 400 });
  }
}

// PUT { universeId, ref, source, versionType } — edit source script yang
// SUDAH ADA. Operasi ini SELALU download ulang versi terbaru dari Roblox
// tepat sebelum patch (bukan pakai file lama di client), supaya gak
// menimpa perubahan lain yang mungkin dibuat lewat Studio di antara waktu
// buka explorer & klik simpan.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const { universeId, ref, source, versionType } = await req.json();
  if (!universeId || !ref || typeof source !== "string") {
    return Response.json({ error: "universeId, ref, dan source wajib diisi" }, { status: 400 });
  }
  const vType = versionType === "Published" ? "Published" : "Saved";

  try {
    const buf = await downloadRobloxPlaceFile(auth.cookie, Number(params.id));
    const patched = patchScriptSource(buf, Number(ref), source);
    const result = await uploadRobloxPlaceFile(auth.apiKey, Number(universeId), Number(params.id), patched, vType);
    if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({ ok: true, versionNumber: result.versionNumber, versionType: vType });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Gagal menyimpan script — file asli di Roblox tidak berubah." }, { status: 400 });
  }
}

// POST { universeId, parentReferent, className, name, source, versionType }
// — buat script baru. Eksperimental, lihat catatan risiko di
// lib/robloxPlaceFile.ts (createScript).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const { universeId, parentReferent, className, name, source, versionType } = await req.json();
  if (!universeId || parentReferent === undefined || !className || !name) {
    return Response.json({ error: "universeId, parentReferent, className, dan name wajib diisi" }, { status: 400 });
  }
  if (!["Script", "LocalScript", "ModuleScript"].includes(className)) {
    return Response.json({ error: "className harus Script, LocalScript, atau ModuleScript" }, { status: 400 });
  }
  const vType = versionType === "Published" ? "Published" : "Saved";

  try {
    const buf = await downloadRobloxPlaceFile(auth.cookie, Number(params.id));
    const patched = createScript(buf, Number(parentReferent), className, name, source || "-- script baru dari KRYNOS\n");
    const result = await uploadRobloxPlaceFile(auth.apiKey, Number(universeId), Number(params.id), patched, vType);
    if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({ ok: true, versionNumber: result.versionNumber, versionType: vType });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Gagal membuat script — file asli di Roblox tidak berubah." }, { status: 400 });
  }
}

// DELETE { universeId, ref, versionType } — hapus script.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRobloxConnection();
  if ("error" in auth) return auth.error;

  const { universeId, ref, versionType } = await req.json();
  if (!universeId || !ref) return Response.json({ error: "universeId dan ref wajib diisi" }, { status: 400 });
  const vType = versionType === "Published" ? "Published" : "Saved";

  try {
    const buf = await downloadRobloxPlaceFile(auth.cookie, Number(params.id));
    const patched = deleteScript(buf, Number(ref));
    const result = await uploadRobloxPlaceFile(auth.apiKey, Number(universeId), Number(params.id), patched, vType);
    if (result.ok === false) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({ ok: true, versionNumber: result.versionNumber, versionType: vType });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Gagal menghapus script — file asli di Roblox tidak berubah." }, { status: 400 });
  }
}
