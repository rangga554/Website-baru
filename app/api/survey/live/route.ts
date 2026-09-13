import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listSurveyResponses } from "@/lib/survey";

// Dipoll tiap 1 detik dari halaman /survey/live — cuma buat user yang
// login (sesuai middleware.ts), jadi tetap dicek session di sini juga
// biar API-nya sendiri gak bisa diakses langsung tanpa login.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { weekKey, responses } = await listSurveyResponses();

    return Response.json({
      weekKey,
      total: responses.length,
      responses,
    });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
