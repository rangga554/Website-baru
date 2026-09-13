import { requireVercelConnection } from "../../../_shared";
import { getVercelProject, listVercelDeployments, redeployVercel } from "@/lib/thirdPartyApps";

// "Test"/redeploy — ambil deployment PALING TERAKHIR punya project ini,
// terus minta Vercel bikin deployment baru dari situ (persis tombol
// "Redeploy" di dashboard Vercel).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const { conn, error } = await requireVercelConnection();
  if (error) return error;

  const project = await getVercelProject(conn.access_token, params.id, conn.provider_team_id);
  if (project.ok === false) return Response.json({ error: project.error }, { status: project.status || 500 });

  const deployments = await listVercelDeployments(conn.access_token, params.id, conn.provider_team_id);
  if (deployments.ok === false) return Response.json({ error: deployments.error }, { status: deployments.status || 500 });

  const latest = (deployments.data.deployments || [])[0];
  if (!latest) {
    return Response.json({ error: "Belum ada deployment sama sekali di project ini — belum bisa di-redeploy." }, { status: 400 });
  }

  const result = await redeployVercel(conn.access_token, project.data.name, latest.uid, conn.provider_team_id);
  if (result.ok === false) return Response.json({ error: result.error }, { status: result.status || 500 });

  return Response.json({ ok: true, deployment: result.data });
}
