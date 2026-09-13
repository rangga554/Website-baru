import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMastercodeAiReply } from "@/lib/mastercodeAi";

export const runtime = "nodejs";
export const maxDuration = 60;

// Body: { history: [{role,content}], message: string, existingProject?: { name, files: [{path,content}] } | null }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "Pesan gak boleh kosong" }, { status: 400 });
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m: any) => ({ role: m.role, content: m.content.slice(0, 4000) }))
    : [];

  let existingProject: { name: string; files: { path: string; content: string }[] } | null = null;
  if (body.existingProject && typeof body.existingProject.name === "string" && Array.isArray(body.existingProject.files)) {
    existingProject = {
      name: body.existingProject.name,
      files: body.existingProject.files
        .filter((f: any) => f && typeof f.path === "string" && typeof f.content === "string")
        .map((f: any) => ({ path: f.path, content: f.content })),
    };
  }

  try {
    const result = await getMastercodeAiReply({
      history,
      message: body.message.slice(0, 2000),
      existingProject,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    const isRateLimit = /kebanjiran|rate.?limit|429/i.test(e.message || "");
    return NextResponse.json({ error: e.message || "Gagal menghubungi KRYNOS AI" }, { status: isRateLimit ? 429 : 500 });
  }
}
