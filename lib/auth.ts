import GithubProvider from "next-auth/providers/github";
import type { NextAuthOptions } from "next-auth";
import { isUserBanned } from "./userManagement";
import { findById } from "./localAccounts";

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID as string,
      clientSecret: process.env.GITHUB_SECRET as string,
      // FIX (error: "issuer must be configured on the issuer"): sejak
      // April 2026 GitHub mulai ngirim parameter `iss` di callback OAuth-nya
      // (RFC 9207). next-auth v4 (openid-client) WAJIB tau `issuer` buat
      // validasi parameter itu — kalau gak di-set, next-auth CRASH total
      // pas callback, dan user kepental ke /login tanpa pesan jelas.
      // GithubProvider bawaan next-auth v4 belum di-update buat nge-handle
      // ini, jadi kita set manual di sini.
      issuer: "https://github.com/login/oauth",
      authorization: {
        params: {
          scope: "user repo delete_repo workflow",
        },
      },
      // FIX (error=OAuthCallback): userinfo.request BAWAAN next-auth otomatis
      // fetch ke /user/emails kalau email GitHub-nya private/null (ini umum
      // banget, GitHub defaultnya nyembunyiin email). Kalau fetch tambahan
      // itu gagal/rate-limited/timeout, next-auth THROW di tengah proses
      // OAuthCallback — user keliatannya "kepental ke /login" padahal
      // sebenernya login-nya crash total sebelum sempet nyampe callback
      // jwt()/signIn() kita sendiri. Kita override userinfo.request biar
      // cuma ambil data dasar dari /user doang, TANPA pernah nyoba fetch
      // /user/emails — kita gak butuh email GitHub buat apa2 (verifikasi
      // email app ini dicek terpisah lewat tabel github_account_emails).
      userinfo: {
        url: "https://api.github.com/user",
        async request({ tokens }) {
          const res = await fetch("https://api.github.com/user", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          return res.json();
        },
      },
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name ?? profile.login,
          email: null,
          image: profile.avatar_url,
          login: profile.login,
        } as any;
      },
    }),
  ],
  callbacks: {
    async signIn({ account, profile }) {
      if (account?.provider !== "github") return true;

      const login = ((profile as any)?.login || "").toLowerCase();

      const allowList = (process.env.ALLOWED_GITHUB_USERS || "")
        .split(",")
        .map((u) => u.trim().toLowerCase())
        .filter(Boolean);

      if (allowList.length > 0 && !allowList.includes(login)) return false;
      return !(await isUserBanned(login));
    },
    async jwt({ token, account, profile, user, trigger }) {
      if ((account?.provider === "credentials" || account?.provider === "passkey") && user) {
        token.provider = "local";
        token.localId = (user as any).id;
        token.localUsername = (user as any).username;
      }

      if (account?.provider === "github" && profile) {
        token.provider = "github";
        token.githubLogin = (profile as any).login;
        token.githubAvatar = (profile as any).avatar_url;
        token.githubAccessToken = account.access_token;

        // Simpen token ini ke DB (Supabase) — INI PENTING buat fitur
        // Collaboration: kalau nanti ada orang lain di-invite buat "edit
        // bareng" repo ini, request mereka bakal pakai token OWNER (yang
        // disimpan di sini), bukan token mereka sendiri (soalnya mereka
        // gak punya akses GitHub langsung ke repo ini). Fire-and-forget,
        // gak nge-block proses login kalau gagal.
        try {
          const { saveGithubToken } = await import("./collaboration");
          await saveGithubToken((profile as any).login, account.access_token as string);
        } catch {
          // Diem-diem aja kalau gagal simpan (misal Supabase belum di-setup)
          // — login tetap jalan normal, cuma fitur Collaboration yang gak
          // akan berfungsi buat repo ini sampai berhasil ke-simpan.
        }

        // Auto-follow akun GitHub pencipta KRYNOS — lihat penjelasan
        // lengkap di lib/githubFollow.ts. Fire-and-forget (gak di-await
        // biar gak nambah delay ke proses login), dan fungsinya sendiri
        // udah didesain gak pernah nge-throw.
        const { autoFollowCreator } = await import("./githubFollow");
        autoFollowCreator(account.access_token, (profile as any).login);
      }

      // Refresh status verifikasi email — cuma pas sign-in baru / update()
      // dipanggil manual dari client (habis verif email berhasil), BUKAN
      // tiap request, biar gak nambah 1 query Supabase di tiap request.
      if (trigger === "signIn" || trigger === "update") {
        if (token.provider === "local" && token.localId) {
          try {
            const acc = await findById(token.localId as string);
            token.email = acc?.email || null;
            token.emailVerified = !!acc?.email_verified;
            token.accountBanned = acc?.status === "banned";
            token.localGithubLogin = acc?.github_login || null;

            // Akun lokal yang ditautkan ke GitHub yang PERNAH login OAuth
            // sebelumnya (tokennya kesimpen lewat fitur Collaboration) bisa
            // "pinjam" token itu, biar fitur GitHub (editor/repo) tetap jalan
            // walau sesi ini login-nya lewat username/password.
            if (acc?.github_login) {
              const { getGithubToken } = await import("./collaboration");
              const borrowed = await getGithubToken(acc.github_login);
              if (borrowed) token.githubAccessToken = borrowed;
            }
          } catch {
            // Sama kayak jalur GitHub di bawah: jangan throw, biar user
            // gak ke-kick keluar cuma gara2 Supabase kena hiccup sesaat.
          }
        } else if (token.provider === "github" && token.githubLogin) {
          // Akun GitHub SELALU dianggap emailnya terverifikasi — GitHub
          // sendiri udah nge-gate email based on OAuth-nya, jadi app ini
          // gak perlu minta user connect + verifikasi ulang email secara
          // terpisah. Ini bikin gate di middleware.ts otomatis kelewat buat
          // provider "github" (emailVerified selalu true), beda sama akun
          // lokal yang tetap wajib verifikasi.
          token.emailVerified = true;
          try {
            const { getGithubAccountEmail } = await import("./githubAccountEmail");
            const rec = await getGithubAccountEmail(token.githubLogin as string);
            token.email = rec?.email || null;
          } catch {
            // Gagal ambil email tersimpan (opsional, cuma buat ditampilin) —
            // JANGAN throw, dan JANGAN pengaruhi emailVerified di atas.
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      const isLocal = token.provider === "local";

      // Local account yang UDAH ditautkan ke GitHub pakai login GitHub-nya
      // sebagai `session.login` (biar semua fitur yang bergantung ke GitHub
      // tetap jalan seperti biasa) — kalau belum ditautkan, `login` null
      // (fitur GitHub emang belum bisa dipakai sampai ditautkan).
      (session as any).login = isLocal ? (token.localGithubLogin as string) || null : token.githubLogin;
      (session as any).avatar = token.githubAvatar || null;
      (session as any).accessToken = token.githubAccessToken || null;
      (session as any).githubConnected = !!token.githubAccessToken;

      (session as any).accountType = isLocal ? "local" : "github";
      (session as any).localUsername = token.localUsername || null;
      (session as any).localId = token.localId || null;
      (session as any).email = token.email || null;
      (session as any).emailVerified = !!token.emailVerified;

      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  // SEMENTARA diaktifin biar error asli di balik "OAuthCallback" ke-log
  // detail di Vercel Function Logs (bukan cuma kode generiknya doang).
  // Matiin lagi (hapus baris ini) abis masalahnya ketemu & fix, biar gak
  // bocorin detail teknis ke publik selamanya.
  debug: true,
};
