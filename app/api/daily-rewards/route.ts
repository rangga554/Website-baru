import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCheckinStatus, performCheckin } from "@/lib/dailyRewards";

export async function GET() {
  const session = await getServerSession(authOptions);
  const login = (session as any)?.login as string | undefined;
  if (!login) return Response.json({ error: "Belum login" }, { status: 401 });

  try {
    const status = await getCheckinStatus(login);
    return Response.json(status);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  const login = (session as any)?.login as string | undefined;
  if (!login) return Response.json({ error: "Belum login" }, { status: 401 });

  try {
    const result = await performCheckin(login);
    return Response.json(result);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
