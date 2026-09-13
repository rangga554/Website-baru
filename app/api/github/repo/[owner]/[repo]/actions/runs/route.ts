import { getOctokitForRead, unauthorized } from "@/lib/octokit";
import { NextRequest } from "next/server";

// GET ?ref=main -> daftar run terbaru
// GET ?run_id=xxx -> detail job & step 1 run
// GET ?job_id=xxx -> raw text log 1 job (dipakai LogDebugger)
export async function GET(
  req: NextRequest,
  { params }: { params: { owner: string; repo: string } }
) {
  const octokit = await getOctokitForRead(params.owner, params.repo);
  if (!octokit) return unauthorized();

  const { searchParams } = new URL(req.url);
  const ref = searchParams.get("ref") || undefined;
  const runId = searchParams.get("run_id");
  const jobId = searchParams.get("job_id");

  try {
    if (jobId) {
      // Endpoint ini redirect ke file log mentah (text/plain) di blob storage
      // GitHub — octokit otomatis ikutin redirect-nya dan balikin isinya
      // sebagai string di .data.
      const { data } = await octokit.actions.downloadJobLogsForWorkflowRun({
        owner: params.owner,
        repo: params.repo,
        job_id: Number(jobId),
      });
      return Response.json({ logs: data as unknown as string });
    }

    if (runId) {
      const { data } = await octokit.actions.listJobsForWorkflowRun({
        owner: params.owner,
        repo: params.repo,
        run_id: Number(runId),
      });
      return Response.json(data.jobs);
    }

    const { data } = await octokit.actions.listWorkflowRunsForRepo({
      owner: params.owner,
      repo: params.repo,
      branch: ref,
      per_page: 15,
    });
    return Response.json(data.workflow_runs);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: e.status || 500 });
  }
}
