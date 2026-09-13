import { getSupabaseAdmin } from "@/lib/supabase";
export async function GET() { try { const { data, error } = await getSupabaseAdmin().from("app_developers").select("login"); if (error) throw error; return Response.json({ logins: (data || []).map((d) => d.login.toLowerCase()) }); } catch { return Response.json({ logins: [] }); } }
