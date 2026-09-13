import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { listUsers } from "@/lib/userManagement";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa lihat daftar user" }, { status: 403 });
  }

  try {
    const data = await listUsers();
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
