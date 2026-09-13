import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { signLinkState } from "@/lib/linkState";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const localId = (session as any)?.localId as string | undefined;

  if (!localId) {
    return Response.json({ error: "Cuma akun lokal yang bisa nautkan GitHub." }, { status: 401 });
  }

  const clientId = process.env.GITHUB_ID;
  if (!clientId) {
    return Response.json({ error: "GITHUB_ID belum di-set di server." }, { status: 500 });
  }

  const base = process.env.NEXTAUTH_URL || new URL(req.url).origin;
  const redirectUri = `${base}/api/auth/link-github/callback`;
  const state = signLinkState(localId);

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", "user repo delete_repo workflow");
  authUrl.searchParams.set("state", state);

  return Response.redirect(authUrl.toString());
}
