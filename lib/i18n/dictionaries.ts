// ============================================================================
// KAMUS TERJEMAHAN — Indonesia (default) & Inggris.
//
// CATATAN JUJUR: fitur multi-bahasa ini BARU nutup layar-layar paling
// sering dibuka (Sidebar, Login, Register, Dashboard, Pengaturan
// KRYNOS) — BUKAN seluruh halaman di app (ada puluhan halaman lain
// yang teksnya masih hardcode Bahasa Indonesia). Nambah halaman lain ke
// sistem ini gampang: tinggal tambah key baru di 2 objek di bawah (id +
// en, WAJIB DUA-DUANYA biar gak ada key yang "hilang" bahasa), terus
// pakai `useTranslation()` di komponennya — gak perlu ubah arsitektur
// apapun, tinggal ngikutin pola yang udah ada di Sidebar.tsx /
// app/login/page.tsx sebagai contoh.
// ============================================================================

export type Locale = "id" | "en";

export const dictionaries: Record<Locale, Record<string, string>> = {
  id: {
    // Umum
    "common.save": "Simpan",
    "common.saving": "Menyimpan...",
    "common.cancel": "Batal",
    "common.loading": "Memuat...",
    "common.back": "Kembali",

    // Sidebar
    "sidebar.settings": "Pengaturan KRYNOS",
    "sidebar.messages": "Message",
    "sidebar.suggestions": "Kotak Saran",
    "sidebar.customerService": "Customer Service",
    "sidebar.community": "Komunitas",
    "sidebar.search": "Search",
    "sidebar.siteInspector": "Site Inspector",
    "sidebar.webStore": "Web Store",
    "sidebar.uniqueCode": "Kode Unik",
    "sidebar.rateUs": "Beri Rating",
    "sidebar.logout": "Keluar",
    "sidebar.language": "Bahasa",

    // Login
    "login.title": "Masuk ke KRYNOS",
    "login.subtitle": "Edit, buat, dan kelola repo GitHub kamu langsung dari HP.",
    "login.tabGithub": "GitHub",
    "login.tabCredentials": "Username/Email",
    "login.continueGithub": "Lanjut dengan GitHub",
    "login.identifierPlaceholder": "Username atau email",
    "login.passwordPlaceholder": "Password",
    "login.submit": "Masuk",
    "login.submitting": "Masuk...",
    "login.forgotPassword": "Lupa password?",
    "login.noAccount": "Belum punya akun?",
    "login.register": "Daftar",
    "login.error": "Username/email atau password salah.",

    // Register
    "register.title": "Daftar Akun KRYNOS",
    "register.subtitle": "Bikin akun pakai username/email — gak wajib punya GitHub dulu.",
    "register.usernamePlaceholder": "Username",
    "register.emailPlaceholder": "Email",
    "register.passwordPlaceholder": "Password (min. 8 karakter)",
    "register.submit": "Daftar",
    "register.submitting": "Mendaftar...",
    "register.haveAccount": "Udah punya akun?",
    "register.login": "Masuk",

    // Dashboard
    "dashboard.searchPlaceholder": "Cari repository...",
    "dashboard.newRepo": "Repo Baru",
    "dashboard.filterAll": "Semua",
    "dashboard.filterOwn": "Milik Sendiri",
    "dashboard.filterCollab": "Collaboration",
    "dashboard.emptyRepos": "Tidak ada project ditemukan.",

    // Pengaturan KRYNOS
    "settings.title": "Pengaturan KRYNOS",
    "settings.subtitle":
      "Pusat pengaturan akun KRYNOS kamu — kelola tautan akun & ganti password di sini. Buat edit profil GitHub (nama, bio, dll), ada di halaman terpisah.",
    "settings.accountSecurity": "Akun & Keamanan",
    "settings.changePassword": "Ganti Password",
    "settings.githubProfile": "Profil GitHub",
  },
  en: {
    // Common
    "common.save": "Save",
    "common.saving": "Saving...",
    "common.cancel": "Cancel",
    "common.loading": "Loading...",
    "common.back": "Back",

    // Sidebar
    "sidebar.settings": "KRYNOS Settings",
    "sidebar.messages": "Message",
    "sidebar.suggestions": "Suggestion Box",
    "sidebar.customerService": "Customer Service",
    "sidebar.community": "Community",
    "sidebar.search": "Search",
    "sidebar.siteInspector": "Site Inspector",
    "sidebar.webStore": "Web Store",
    "sidebar.uniqueCode": "Unique Code",
    "sidebar.rateUs": "Rate Us",
    "sidebar.logout": "Log Out",
    "sidebar.language": "Language",

    // Login
    "login.title": "Sign in to KRYNOS",
    "login.subtitle": "Edit, create, and manage your GitHub repos right from your phone.",
    "login.tabGithub": "GitHub",
    "login.tabCredentials": "Username/Email",
    "login.continueGithub": "Continue with GitHub",
    "login.identifierPlaceholder": "Username or email",
    "login.passwordPlaceholder": "Password",
    "login.submit": "Sign In",
    "login.submitting": "Signing in...",
    "login.forgotPassword": "Forgot password?",
    "login.noAccount": "Don't have an account?",
    "login.register": "Sign up",
    "login.error": "Incorrect username/email or password.",

    // Register
    "register.title": "Create a KRYNOS Account",
    "register.subtitle": "Sign up with username/email — no GitHub account required.",
    "register.usernamePlaceholder": "Username",
    "register.emailPlaceholder": "Email",
    "register.passwordPlaceholder": "Password (min. 8 characters)",
    "register.submit": "Sign Up",
    "register.submitting": "Signing up...",
    "register.haveAccount": "Already have an account?",
    "register.login": "Sign in",

    // Dashboard
    "dashboard.searchPlaceholder": "Search repositories...",
    "dashboard.newRepo": "New Repo",
    "dashboard.filterAll": "All",
    "dashboard.filterOwn": "Own",
    "dashboard.filterCollab": "Collaboration",
    "dashboard.emptyRepos": "No projects found.",

    // KRYNOS Settings
    "settings.title": "KRYNOS Settings",
    "settings.subtitle":
      "Your KRYNOS account hub — manage linked accounts and change your password here. To edit your GitHub profile (name, bio, etc.), head to the separate page.",
    "settings.accountSecurity": "Account & Security",
    "settings.changePassword": "Change Password",
    "settings.githubProfile": "GitHub Profile",
  },
};
