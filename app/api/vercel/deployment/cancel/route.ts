import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { cancelDeployment } from "@/lib/vercel";

// Body: { deploymentId }
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { deploymentId } = await req.json();
  if (!deploymentId) {
    return Response.json({ error: "deploymentId wajib diisi" }, { status: 400 });
  }

  try {
    const data = await cancelDeployment(deploymentId);
    return Response.json(data);
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
