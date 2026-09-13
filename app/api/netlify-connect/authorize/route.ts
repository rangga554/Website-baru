import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getIdentity } from "@/lib/identity";
import { buildNetlifyAuthorizeUrl, createOAuthState } from "@/lib/thirdPartyApps";

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  const identity = getIdentity(session);
  if (!identity) {
    return Response.redirect(new URL("/", process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }

  const state = await createOAuthState(identity.id, "netlify");
  return Response.redirect(buildNetlifyAuthorizeUrl(state));
}
