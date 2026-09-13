"use client";

import { useEffect, useState, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FaArrowLeft, FaCheckCircle, FaGithub, FaCheckCircle as FaVerified, FaLink, FaUnlink, FaLock, FaChevronRight, FaFingerprint, FaTrash, FaPlus, FaSpinner } from "react-icons/fa";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function ChangePasswordCard() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDone(false);
    if (newPassword !== confirm) {
      setError("Konfirmasi password baru gak sama.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal ganti password");
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setTimeout(() => setDone(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 bg-panel border border-border rounded-xl p-4">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <FaLock size={12} /> {t("settings.changePassword")}
      </h2>
      <form onSubmit={submit} className="space-y-2.5">
        {error && <p className="text-xs text-red-400 bg-red-950/40 rounded-lg p-2">{error}</p>}
        {done && (
          <p className="text-xs text-accent bg-accent/10 rounded-lg p-2 flex items-center gap-1.5">
            <FaCheckCircle size={11} /> Password berhasil diganti!
          </p>
        )}
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Password lama"
          required
          className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Password baru (min. 8 karakter)"
          required
          className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Ulangi password baru"
          required
          className="w-full bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-accent text-sm font-medium py-2.5 rounded-lg disabled:opacity-50"
        >
          {saving ? t("common.saving") : t("settings.changePassword")}
        </button>
      </form>
    </div>
  );
}

function AccountLinkCard() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const [unlinking, setUnlinking] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (searchParams.get("linked") === "1") setNotice("Akun GitHub berhasil ditautkan!");
    const err = searchParams.get("linkError");
    if (err) setNotice(`Gagal tautkan: ${err}`);
  }, [searchParams]);

  if (!session) return null;
  const accountType = (session as any).accountType;
  const emailVerified = (session as any).emailVerified;
  const email = (session as any).email;
  const linkedGithub = accountType === "local" ? (session as any).login : null;

  async function unlink() {
    if (!confirm("Lepas tautan akun GitHub dari akun ini?")) return;
    setUnlinking(true);
    const res = await fetch("/api/auth/link-github", { method: "DELETE" });
    setUnlinking(false);
    if (res.ok) window.location.reload();
  }

  return (
    <div className="mb-6 bg-panel border border-border rounded-xl p-4">
      <h2 className="text-sm font-semibold mb-3">{t("settings.accountSecurity")}</h2>

      {notice && (
        <p className="text-xs bg-accent/10 text-accent rounded-lg p-2 mb-3">{notice}</p>
      )}

      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-gray-400">Tipe login</span>
        <span className="font-medium">
          {accountType === "local" ? "Username/Email" : "GitHub"}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm mb-3">
        <span className="text-gray-400">Email</span>
        <span className="font-medium flex items-center gap-1.5">
          {email || "-"}
          {emailVerified && <FaVerified size={12} className="text-green-400" />}
        </span>
      </div>

      {accountType === "local" && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-gray-500 mb-2">
            Tautkan akun GitHub biar bisa pakai fitur editor/repo (KRYNOS
            aslinya) dari akun username/password kamu.
          </p>
          {linkedGithub ? (
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">
                <FaGithub /> @{linkedGithub}
              </span>
              <button
                onClick={unlink}
                disabled={unlinking}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-red-400 disabled:opacity-50"
              >
                <FaUnlink size={11} /> Lepas Tautan
              </button>
            </div>
          ) : (
            <a
              href="/api/auth/link-github/start"
              className="flex items-center justify-center gap-2 bg-white text-black text-sm font-medium py-2.5 rounded-xl active:scale-[0.98] transition"
            >
              <FaLink size={13} />
              Tautkan Akun GitHub
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// Kartu pintasan ke Profil GitHub — SENGAJA cuma link, bukan form-nya
// langsung ditaruh di sini. Profil GitHub (nama, bio, dll di GitHub) itu
// data yang beda konsepnya dari Pengaturan KRYNOS (login/password akun
// KRYNOS) — dipisah biar gak ketuker, lihat app/settings/github-profile.
function GithubProfileLinkCard() {
  const { data: session } = useSession();
  const { t } = useTranslation();
  const githubConnected = !!(session as any)?.githubConnected;

  return (
    <Link
      href="/settings/github-profile"
      className="mb-6 flex items-center justify-between gap-3 bg-panel border border-border rounded-xl p-4 hover:border-accent/50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0">
        <FaGithub size={18} className="shrink-0 text-gray-400" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("settings.githubProfile")}</p>
          <p className="text-xs text-gray-500 truncate">
            {githubConnected
              ? "Edit nama, bio, lokasi, dll di GitHub"
              : "Tautkan GitHub dulu buat bisa diedit"}
          </p>
        </div>
      </div>
      <FaChevronRight size={12} className="shrink-0 text-gray-500" />
    </Link>
  );
}

// Kartu Passkey — cuma muncul buat akun LOKAL (username/password). Login
// pake GitHub OAuth udah punya sistem passkey-nya sendiri di sisi GitHub,
// gak nyambung ke sini. Fitur OPSIONAL — gak nambahin passkey pun akun
// tetap bisa login normal pakai password.
function PasskeyCard() {
  const [passkeys, setPasskeys] = useState<{ id: string; deviceName: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceNamePrompt, setDeviceNamePrompt] = useState(false);
  const [deviceName, setDeviceName] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/passkey/list");
      const data = await res.json();
      setPasskeys(data.passkeys || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function register() {
    setError(null);
    setRegistering(true);
    try {
      // Dynamic import biar library WebAuthn browser gak ikut kebundle
      // di halaman lain yang gak butuh (cuma dipake di sini).
      const { startRegistration } = await import("@simplewebauthn/browser");

      const optionsRes = await fetch("/api/passkey/register/options");
      const options = await optionsRes.json();
      if (!optionsRes.ok) {
        setError(options.error || "Gagal mulai pendaftaran passkey");
        return;
      }

      const attResp = await startRegistration({ optionsJSON: options });

      const verifyRes = await fetch("/api/passkey/register/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response: attResp, deviceName: deviceName.trim() || undefined }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.error || "Gagal verifikasi passkey");
        return;
      }

      setDeviceName("");
      setDeviceNamePrompt(false);
      await load();
    } catch (e: any) {
      // User cancel prompt browser (misal batal pilih Face ID) juga masuk
      // ke sini — jangan ditampilin sebagai "error" yang menakutkan.
      if (e?.name !== "NotAllowedError") {
        setError(e?.message || "Gagal mendaftarkan passkey");
      }
    } finally {
      setRegistering(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus passkey ini? Perangkat itu gak akan bisa dipakai login lagi.")) return;
    await fetch(`/api/passkey/delete?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="mb-6 bg-panel border border-border rounded-xl p-4">
      <h2 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <FaFingerprint /> Passkey
      </h2>
      <p className="text-xs text-gray-500 mb-3">
        Login lebih cepat pakai sidik jari/Face ID/PIN perangkat — opsional,
        gak gantiin password (password tetap bisa dipakai kapan aja).
      </p>

      {loading ? (
        <div className="flex justify-center py-3">
          <FaSpinner className="animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="space-y-2 mb-3">
          {passkeys.length === 0 && <p className="text-xs text-gray-500">Belum ada passkey terdaftar.</p>}
          {passkeys.map((p) => (
            <div key={p.id} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2">
              <span className="text-sm">{p.deviceName}</span>
              <button onClick={() => remove(p.id)} className="text-gray-500 hover:text-red-400">
                <FaTrash size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {deviceNamePrompt ? (
        <div className="flex gap-2">
          <input
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            placeholder='Nama perangkat (mis. "HP Ridho")'
            className="flex-1 bg-black/30 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            onClick={register}
            disabled={registering}
            className="bg-accent text-white text-sm px-3 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            {registering ? <FaSpinner className="animate-spin" size={12} /> : null}
            Daftar
          </button>
        </div>
      ) : (
        <button
          onClick={() => setDeviceNamePrompt(true)}
          className="w-full flex items-center justify-center gap-2 border border-dashed border-border text-gray-300 text-sm py-2.5 rounded-xl active:scale-[0.98] transition"
        >
          <FaPlus size={12} /> Tambah Passkey
        </button>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { t } = useTranslation();

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <main className="min-h-dvh bg-base pb-10">
      <header className="sticky top-0 z-10 bg-base/90 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="p-1 text-gray-400">
          <FaArrowLeft />
        </Link>
        <h1 className="font-bold text-lg">{t("settings.title")}</h1>
      </header>

      <div className="px-4 mt-6 max-w-md">
        <p className="text-xs text-gray-500 mb-4 -mt-2">
          {t("settings.subtitle")}
        </p>

        <div className="mb-6 bg-panel border border-border rounded-xl p-4">
          <LanguageSwitcher />
        </div>

        <Suspense fallback={null}>
          <AccountLinkCard />
        </Suspense>

        {(session as any)?.accountType === "local" && <ChangePasswordCard />}
        {(session as any)?.accountType === "local" && <PasskeyCard />}

        <GithubProfileLinkCard />
      </div>
    </main>
  );
}
