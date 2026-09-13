// Identitas user — sekarang bisa dari 2 sumber: GitHub (login OAuth, atau
// akun lokal yang udah ditautkan ke GitHub) ATAU akun lokal yang BELUM
// ditautkan (dipakein prefix "local:" biar gak kolisi sama login GitHub).
// Helper ini dipakai fitur yang butuh identitas generik (Komunitas,
// Announcement, notifikasi push, dsb) biar gak perlu ulang-ulang cek
// session.login / session.localUsername satu-satu.

export type Identity = {
  id: string; // key unik dipakai buat login-based lookup (login DB, dsb)
  displayName: string;
  avatarUrl: string | null;
  source: "github" | "local";
};

export function getIdentity(session: any): Identity | null {
  if (session?.login) {
    return {
      id: session.login,
      displayName: session.login,
      avatarUrl: session.avatar || null,
      source: "github",
    };
  }
  if (session?.localUsername) {
    return {
      id: `local:${session.localUsername}`,
      displayName: session.localUsername,
      avatarUrl: null,
      source: "local",
    };
  }
  return null;
}
