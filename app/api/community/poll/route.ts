import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { createCommunityPoll } from "@/lib/community";

// Body: { question, options: string[], durationSeconds }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa buat Global Polling" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const poll = await createCommunityPoll({
      question: body.question,
      options: body.options,
      durationSeconds: Number(body.durationSeconds),
      createdBy: login,
    });
    return Response.json(poll);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
