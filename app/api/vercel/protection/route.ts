import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProtectionBypassSecret, setProtectionBypassSecret } from "@/lib/vercel";

// GET ?owner=&repo= -> ambil token yang udah kesimpen buat repo ini (kalau ada)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) {
    return Response.json({ error: "owner, repo wajib diisi" }, { status: 400 });
  }

  try {
    const bypassSecret = await getProtectionBypassSecret(owner, repo);
    return Response.json({ bypassSecret: bypassSecret || "" });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// PUT { owner, repo, bypassSecret } -> simpan token. bypassSecret kosong = hapus.
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body request tidak valid" }, { status: 400 });

  const { owner, repo, bypassSecret } = body;
  if (!owner || !repo) {
    return Response.json({ error: "owner, repo wajib diisi" }, { status: 400 });
  }

  try {
    const result = await setProtectionBypassSecret(owner, repo, String(bypassSecret || ""));
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
