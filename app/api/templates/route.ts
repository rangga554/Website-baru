import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getSupabaseAdmin();
  // SENGAJA cuma select id & title -- repo_owner/repo_name TIDAK ikut
  // dikirim ke client sama sekali, biar user gak bisa lihat link sumbernya
  // walau buka Network tab devtools sekalipun.
  const { data, error } = await supabase
    .from("templates")
    .select("id, title, created_at")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data);
}
