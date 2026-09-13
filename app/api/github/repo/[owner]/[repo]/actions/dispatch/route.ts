import { getOctokitForRepo, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// Body: { workflow_id, ref }
export async function POST(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRepo(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { workflow_id, ref } = await req.json();

  try {
    await octokit.actions.createWorkflowDispatch({
      owner: params.owner,
      repo: params.repo,
      workflow_id,
      ref,
    });
    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json(
      { error: e.message || "Gagal trigger workflow. Pastikan workflow punya trigger 'workflow_dispatch'." },
      { status: e.status || 500 }
    );
  }
}
