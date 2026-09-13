import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { voteCommunityPoll } from "@/lib/community";

// Body: { pollId, optionId }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const result = await voteCommunityPoll({
      pollId: body.pollId,
      optionId: body.optionId,
      login: identity.id,
    });
    return Response.json(result);
  } catch (e: any) {
    if (e.message === "POLL_ENDED") {
      return Response.json({ error: "Polling ini udah ditutup" }, { status: 400 });
    }
    return Response.json({ error: e.message }, { status: 400 });
  }
}
