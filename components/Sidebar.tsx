"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AppLogo from "@/components/AppLogo";
import { usePathname } from "next/navigation";
import {
  FaTimes,
  FaSearch,
  FaClipboardList,
  FaCog,
  FaUsers,
  FaInfoCircle,
  FaShareAlt,
  FaGift,
  FaUserShield,
  FaSignOutAlt,
  FaCrown,
  FaHeadset,
  FaShieldAlt,
  FaStore,
  FaKey,
  FaStar,
  FaComments,
  FaMobileAlt,
  FaPlug,
  FaRocket,
  FaMusic,
  FaLayerGroup,
  FaCode,
} from "react-icons/fa";
import { usePlusStatus } from "@/lib/usePlusStatus";
import PlusUpgradeModal from "@/components/PlusUpgradeModal";
import CustomerServiceModal from "@/components/CustomerServiceModal";
import InstallNavButton from "@/components/InstallNavButton";
import { useTranslation } from "@/lib/i18n/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import DailyRewardsFlame from "@/components/DailyRewardsFlame";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  login?: string | null;
  avatarUrl?: string | null;
  isOwnerUser?: boolean;
  isDeveloperUser?: boolean;
  panelLabel?: string;
  onSignOut: () => void;
};

// Urutan sengaja: Pengaturan KRYNOS paling atas (paling sering dicari user),
// baru Survey, Komunitas, Search di bawahnya. Announcement udah pindah ke
// dropdown notifikasi (NotificationBell) di header dashboard, jadi gak
// perlu lagi jadi menu terpisah di sini.
//
// CATATAN i18n: baru sebagian item yang punya terjemahan (lewat t()) —
// sisanya (Project Ponsel, Media Sosial, dst) masih hardcode Bahasa
// Indonesia, belum sempat ditambahin ke kamus (lib/i18n/dictionaries.ts).
// Nambahnya gampang: tinggal tambah key baru di kamus + ganti label di
// bawah ini jadi t("key.baru").
function getLinks(t: (key: string) => string) {
  return [
    { href: "/settings", label: t("sidebar.settings"), icon: FaCog },
    { href: "/project-ponsel", label: "Project Ponsel", icon: FaMobileAlt },
    { href: "/messages", label: t("sidebar.messages"), icon: FaComments },
    { href: "/musik", label: "Musik", icon: FaMusic },
    { href: "/template", label: "Template", icon: FaLayerGroup },
    { href: "/survey", label: t("sidebar.suggestions"), icon: FaClipboardList },
    { href: "/komunitas", label: t("sidebar.community"), icon: FaUsers },
    { href: "/media-sosial", label: "Media Sosial", icon: FaShareAlt },
    { href: "/code-redeem", label: "Code Redeem", icon: FaGift },
    { href: "/search", label: t("sidebar.search"), icon: FaSearch },
    { href: "/about", label: "About", icon: FaInfoCircle },
    { href: "/privacy", label: "Kebijakan Privasi", icon: FaShieldAlt },
  ];
}

// Sidebar navigasi global (off-canvas / drawer). Dipakai di semua halaman
// biar Search, Survey, Settings, Komunitas, Announcement, Profile, dst gak
// numpuk di header — cukup 1 tombol hamburger buat buka/tutup.
//
// Khusus dashboard: search TETAP di body dashboard (input "Cari repository..."),
// sidebar ini cuma buat navigasi antar-halaman, bukan fitur search itu sendiri.
export default function Sidebar({
  open,
  onClose,
  login,
  avatarUrl,
  isOwnerUser,
  isDeveloperUser,
  panelLabel = "Owner Panel",
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { status: plusStatus } = usePlusStatus();
  const [showPlusModal, setShowPlusModal] = useState(false);
  const [showCSModal, setShowCSModal] = useState(false);

  // Dipicu dari NotificationBell pas user tap notifikasi status Plus
  // (approved/rejected) — biar langsung kebuka modal detail Plus-nya tanpa
  // perlu cari-cari tombol lagi.
  useEffect(() => {
    function openPlusModal() {
      setShowPlusModal(true);
    }
    window.addEventListener("mc:open-plus-modal", openPlusModal);
    return () => window.removeEventListener("mc:open-plus-modal", openPlusModal);
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu navigasi"
        className={`fixed inset-y-0 left-0 z-50 flex h-dvh w-72 max-w-[82vw] flex-col
        bg-panel border-r border-border shadow-2xl transition-transform duration-300 ease-out
        ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <span className="font-bold text-base flex items-center gap-2">
            <AppLogo />
            Master <span className="text-accent">Code</span>
          </span>
          <div className="flex items-center gap-1">
            {login && <DailyRewardsFlame />}
            <button
              onClick={onClose}
              aria-label="Tutup menu"
              className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 active:scale-95"
            >
              <FaTimes size={16} />
            </button>
          </div>
        </div>

        {login ? (
          <Link
            href={`/users/${login}`}
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-4 border-b border-border hover:bg-white/5 active:bg-white/5"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-border shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{login}</p>
              <p className="text-xs text-gray-500">Profile — lihat profil publik</p>
            </div>
          </Link>
        ) : (
          <div className="px-4 py-4 border-b border-border">
            <p className="text-xs text-gray-500 mb-2">Kamu masih mode Guest — cuma bisa liat-liat.</p>
            <Link
              href="/login"
              onClick={onClose}
              className="flex items-center justify-center gap-2 bg-accent text-black font-medium text-sm py-2.5 rounded-lg active:scale-[0.98] transition"
            >
              <FaRocket size={13} /> Ayo Mulai Kembangkan Project
            </Link>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-2">
          {getLinks(t).map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors
                ${
                  active
                    ? "text-accent bg-accent/10 border-r-2 border-accent"
                    : "text-gray-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={14} className={active ? "text-accent" : "text-gray-500"} />
                {label}
              </Link>
            );
          })}

          {isDeveloperUser && !isOwnerUser && (
            <Link
              href="/dev"
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors
              ${
                pathname === "/dev"
                  ? "text-fuchsia-400 bg-fuchsia-400/10 border-r-2 border-fuchsia-400"
                  : "text-fuchsia-400/90 hover:bg-white/5"
              }`}
            >
              <FaCode size={14} />
              Dev Panel
            </Link>
          )}

          {isOwnerUser && (
            <Link
              href="/owner"
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors
              ${
                pathname === "/owner"
                  ? "text-yellow-400 bg-yellow-400/10 border-r-2 border-yellow-400"
                  : "text-yellow-400/90 hover:bg-white/5"
              }`}
            >
              <FaUserShield size={14} />
              {panelLabel}
            </Link>
          )}

          <Link
            href="/site-inspector"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-left"
          >
            <FaShieldAlt size={14} className="text-gray-500" />
            Site Inspector
          </Link>

          <Link
            href="/third-party-apps"
            onClick={onClose}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left
            ${
              pathname === "/third-party-apps"
                ? "text-accent bg-accent/10 border-r-2 border-accent"
                : "text-gray-300 hover:text-white hover:bg-white/5"
            }`}
          >
            <FaPlug size={14} className={pathname === "/third-party-apps" ? "text-accent" : "text-gray-500"} />
            Aplikasi Pihak Ketiga
          </Link>

          <Link
            href="/web-store"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-left"
          >
            <FaStore size={14} className="text-gray-500" />
            Web Store
          </Link>

          <Link
            href="/kode-unik"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-left"
          >
            <FaKey size={14} className="text-gray-500" />
            Kode Unik
          </Link>

          <a
            href="https://apkpure.com/id/reviews/com.mastercode"
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-left"
          >
            <FaStar size={14} className="text-gray-500" />
            {t("sidebar.rateUs")}
          </a>

          <InstallNavButton onNavigate={onClose} />

          <button
            onClick={() => setShowCSModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors text-left"
          >
            <FaHeadset size={14} className="text-gray-500" />
            Customer Service
          </button>

          <button
            onClick={() => setShowPlusModal(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-amber-400 hover:bg-white/5 transition-colors text-left"
          >
            <FaCrown size={14} />
            <span className="flex-1">
              {plusStatus?.active ? "Info Plus" : "Jadi Plus"}
            </span>
            {plusStatus?.active && !plusStatus.isOwnerAccount && (
              <span className="text-[10px] bg-amber-400/15 text-amber-400 px-1.5 py-0.5 rounded-full">
                Aktif
              </span>
            )}
          </button>
        </nav>

        <div className="border-t border-border p-4 flex items-center justify-between gap-3">
          <button
            onClick={onSignOut}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-400 transition-colors shrink-0"
          >
            <FaSignOutAlt size={12} />
            {t("sidebar.logout")}
          </button>
          <LanguageSwitcher compact />
        </div>
      </aside>

      {showPlusModal && (
        <PlusUpgradeModal onClose={() => setShowPlusModal(false)} />
      )}
      {showCSModal && <CustomerServiceModal onClose={() => setShowCSModal(false)} />}
    </>
  );
}
