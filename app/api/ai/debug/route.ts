import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDebugAnalysis } from "@/lib/groq";

// Body: { jobName, logs }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.logs) {
      return Response.json({ error: "logs wajib diisi" }, { status: 400 });
    }
    const analysis = await getDebugAnalysis(body);
    return Response.json({ analysis });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
