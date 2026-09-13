import { OWNER_LOGIN } from "./owner";

// ============================================================================
// Auto-follow akun GitHub PENCIPTA KRYNOS (OWNER_LOGIN) — dipanggil dari
// lib/auth.ts callback `jwt`, yang HANYA jalan pas ada `account` fresh dari
// GitHub OAuth (artinya PAS LOGIN, baik akun BARU pertama kali daftar
// MAUPUN akun LAMA yang login ulang) — bukan tiap kali token di-refresh.
// Jadi behaviour-nya persis kayak yang diminta: "akun sudah terdaftar
// maupun baru daftar otomatis ngefollow".
//
// SYARAT: OAuth App GitHub-nya (env GITHUB_ID/GITHUB_SECRET) scope-nya
// WAJIB ada "user" (lihat lib/auth.ts -> authorization.params.scope) —
// scope "user" itu SUPERSET yang otomatis nyakup "user:follow" juga, jadi
// gak perlu nambah scope terpisah kalau udah ada "user" di situ.
// ============================================================================

// Fire-and-forget, SENGAJA gak pernah nge-throw — gagal follow (misal token
// gak punya scope yang cukup, atau GitHub API lagi down) BUKAN alasan buat
// gagalin proses login. Silent by design.
export async function autoFollowCreator(accessToken: string | undefined, login: string) {
  if (!accessToken || !login) return;

  // Owner gak perlu (dan gak BISA) follow akun sendiri — GitHub API bakal
  // nolak request PUT /user/following/{diri-sendiri}.
  if (login.toLowerCase() === OWNER_LOGIN.toLowerCase()) return;

  try {
    await fetch(`https://api.github.com/user/following/${OWNER_LOGIN}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "KRYNOS-App",
        // GitHub API mewajibkan header Content-Length: 0 buat PUT tanpa body
        "Content-Length": "0",
      },
    });
    // Respons sukses = 204 No Content. Idempotent — kepanggil berkali-kali
    // (tiap login) gak masalah, gak akan error walau udah follow duluan.
  } catch {
    // diem-diem aja — lihat catatan di atas kenapa ini sengaja gak nge-throw
  }
}
