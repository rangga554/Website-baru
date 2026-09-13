import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getOctokitFromSession, unauthorized } from "@/lib/octokit";
import { getSupabaseAdmin } from "@/lib/supabase";
import { starRepoSilently, copyRepoContents } from "@/lib/templates";
import { logAction } from "@/lib/auditLog";

// Body: { newRepoName: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  const login = (session as any).login as string;
  const octokit = await getOctokitFromSession();
  if (!octokit) return unauthorized();

  const body = await req.json().catch(() => null);
  const newRepoName = (body?.newRepoName || "").trim();

  if (!newRepoName) {
    return Response.json({ error: "Nama repo baru wajib diisi" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(newRepoName)) {
    return Response.json(
      { error: "Nama repo cuma boleh huruf, angka, titik, strip, underscore" },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const { data: template, error } = await supabase
    .from("templates")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error || !template) {
    return Response.json({ error: "Template gak ditemukan" }, { status: 404 });
  }

  // KEPUTUSAN: kalau user udah punya repo dengan nama itu, TOLAK & suruh
  // ganti nama manual -- gak auto-rename/tambah angka.
  try {
    await octokit.repos.get({ owner: login, repo: newRepoName });
    return Response.json(
      { error: `Kamu udah punya repo bernama "${newRepoName}". Pakai nama lain.` },
      { status: 409 }
    );
  } catch (e: any) {
    if (e?.status !== 404) {
      return Response.json({ error: "Gagal cek nama repo" }, { status: 500 });
    }
    // 404 = nama belum kepake, lanjut
  }

  // Star dulu (silent, gak boleh gagalin proses copy walau ini error)
  await starRepoSilently(octokit, template.repo_owner, template.repo_name);

  try {
    const newRepo = await copyRepoContents(
      octokit,
      { owner: template.repo_owner, repo: template.repo_name },
      { owner: login, repo: newRepoName }
    );

    logAction(login, "template.get", `${template.title} -> ${newRepoName}`);

    return Response.json({ ok: true, repo: newRepo.full_name, url: newRepo.html_url });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Gagal copy isi template" }, { status: 500 });
  }
}
