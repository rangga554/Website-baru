import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { listSocialLinks, createSocialLink } from "@/lib/socialLinks";
import { logAction } from "@/lib/auditLog";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await listSocialLinks();
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

// Body: { title, description?, url }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa nambah link media sosial" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) return Response.json({ error: "Body request tidak valid" }, { status: 400 });

  try {
    const data = await createSocialLink({
      title: body.title || "",
      description: body.description || null,
      url: body.url || "",
      createdBy: login,
    });
    logAction(login, "create_social_link", `Tambah link media sosial: ${data.title}`);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}
