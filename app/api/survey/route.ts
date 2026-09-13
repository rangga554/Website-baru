import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getMySurveyStatus, submitSurvey } from "@/lib/survey";

// GET -> cek apakah user yang login udah isi survey minggu ini
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;

  try {
    const status = await getMySurveyStatus(login);
    return Response.json(status);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// POST -> submit jawaban survey (cuma boleh 1x per akun per minggu)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  const avatar = ((session as any).avatar as string) || null;

  const body = await req.json().catch(() => null);
  if (!body) {
    return Response.json({ error: "Body request tidak valid" }, { status: 400 });
  }

  const reason = String(body.reason || "").trim();

  if (!reason) {
    return Response.json({ error: "Saran wajib diisi" }, { status: 400 });
  }

  try {
    const result = await submitSurvey(login, avatar, { reason });
    return Response.json({ ok: true, weekKey: result.weekKey });
  } catch (e: any) {
    if (e.message === "ALREADY_ANSWERED") {
      return Response.json(
        { error: "Kamu sudah mengisi survey minggu ini. Sampai jumpa minggu depan!" },
        { status: 409 }
      );
    }
    return Response.json({ error: e.message }, { status: 500 });
  }
}
