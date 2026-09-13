import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isOwnerOrAdmin } from "@/lib/admin";
import { getPlusSubmissionProofUrl } from "@/lib/plus";

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const login = (session as any).login as string;
  if (!(await isOwnerOrAdmin(login))) {
    return Response.json({ error: "Cuma owner/admin yang bisa lihat bukti transfer" }, { status: 403 });
  }

  try {
    const url = await getPlusSubmissionProofUrl(params.id);
    return Response.json({ url });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
