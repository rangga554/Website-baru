import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPlusStatus } from "@/lib/plus";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;

  try {
    const status = await getPlusStatus(login);
    return Response.json(status);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
