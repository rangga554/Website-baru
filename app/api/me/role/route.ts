import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { isAdmin } from "@/lib/admin";
import { isDeveloper } from "@/lib/developer";

export async function GET() {
  const session = await getServerSession(authOptions);
  const login = (session as any)?.login as string | undefined;
  const owner = isOwner(login);
  const admin = owner ? false : await isAdmin(login);
  const developer = owner || admin ? false : await isDeveloper(login);
  return Response.json({ isOwner: owner, isAdmin: admin, isDeveloper: developer, isPrivileged: owner || admin || developer });
}
