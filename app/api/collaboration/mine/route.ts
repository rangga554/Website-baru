import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listPendingInvitesForUser, listAcceptedCollaborations, respondToInvite } from "@/lib/collaboration";

export async function GET() {
  const session = await getServerSession(authOptions);
  const myLogin = (session as any)?.login as string | undefined;
  if (!myLogin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [pending, accepted] = await Promise.all([
      listPendingInvitesForUser(myLogin),
      listAcceptedCollaborations(myLogin),
    ]);
    return Response.json({ pending, accepted });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { inviteId, accept: boolean }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const myLogin = (session as any)?.login as string | undefined;
  if (!myLogin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { inviteId, accept } = await req.json();
    const result = await respondToInvite({ inviteId, login: myLogin, accept: !!accept });
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
