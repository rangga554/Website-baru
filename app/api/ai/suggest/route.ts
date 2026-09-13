import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCodeSuggestion } from "@/lib/groq";

// Body: { filename, language, codeBefore, codeAfter }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const suggestion = await getCodeSuggestion(body);
    return Response.json({ suggestion });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
