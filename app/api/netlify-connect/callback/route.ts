import { NextRequest } from "next/server";
import {
  consumeOAuthState,
  exchangeNetlifyCode,
  getNetlifyUser,
  saveConnection,
} from "@/lib/thirdPartyApps";

function redirectToApp(status: "connected" | "error", message?: string) {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = new URL("/third-party-apps", base);
  url.searchParams.set("netlify", status);
  if (message) url.searchParams.set("msg", message);
  return Response.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) {
    return redirectToApp("error", "Parameter dari Netlify gak lengkap (code/state hilang)");
  }

  const identityKey = await consumeOAuthState(state, "netlify");
  if (!identityKey) {
    return redirectToApp("error", "Sesi koneksi udah kadaluarsa, coba connect ulang");
  }

  try {
    const token = await exchangeNetlifyCode(code);
    const user = await getNetlifyUser(token.access_token);

    await saveConnection(identityKey, "netlify", {
      access_token: token.access_token,
      refresh_token: token.refresh_token || null,
      token_type: token.token_type || "Bearer",
      provider_account_id: user?.id || null,
      account_email: user?.email || null,
      account_name: user?.name || null,
    });

    return redirectToApp("connected");
  } catch (err: any) {
    return redirectToApp("error", err?.message || "Gagal menghubungkan akun Netlify");
  }
}
