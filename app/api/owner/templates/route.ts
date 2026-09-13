import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwner } from "@/lib/owner";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseGithubRepoUrl } from "@/lib/templates";
import { logAction } from "@/lib/auditLog";

// Route ini KHUSUS owner -- nampilin repo_owner/repo_name asli (buat owner
// ngedit/hapus), beda sama /api/templates (publik) yang sengaja nyembunyiin
// itu dari user biasa.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa buka panel Template" }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}

// Body: { title: string, repoUrl: string }
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!isOwner(login)) {
    return Response.json({ error: "Cuma owner yang bisa nambah Template" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const title = (body?.title || "").trim();
  const repoUrl = (body?.repoUrl || "").trim();

  if (!title || !repoUrl) {
    return Response.json({ error: "Judul dan link repo wajib diisi" }, { status: 400 });
  }

  const parsed = parseGithubRepoUrl(repoUrl);
  if (!parsed) {
    return Response.json({ error: "Link repo GitHub gak valid" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("templates")
    .insert({
      title,
      repo_owner: parsed.owner,
      repo_name: parsed.repo,
      created_by: login,
    })
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });

  logAction(login, "template.create", `${title} -> ${parsed.owner}/${parsed.repo}`);
  return Response.json(data);
}
