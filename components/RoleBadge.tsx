"use client";

import { isOwner } from "@/lib/owner";
import { useAdminLogins } from "@/lib/useAdminLogins";
import { useDeveloperLogins } from "@/lib/useDeveloperLogins";

// ============================================================================
// Label role di samping nama user, dipakai di semua tempat yang nampilin
// username orang lain (chat Komunitas, Announcement + komentar, Survey
// Live, halaman profil /users/[username]).
//
// - User biasa   -> [USER]
// - Admin        -> [ADMIN🛡️]
// - Owner        -> [Developer🧑‍💻][OWNER] + centang biru di samping OWNER
//
// isOwner() itu SINKRON (cuma compare string ke konstanta OWNER_LOGIN),
// jadi bisa langsung dipake buat SIAPA AJA tanpa fetch. isAdmin butuh
// query ke Supabase (tabel app_admins) — makanya lewat hook
// useAdminLogins() yang fetch & cache SEKALI buat semua badge di halaman
// yang sama (bukan 1 fetch per badge).
// ============================================================================

export default function RoleBadge({
  login,
  size = "sm",
}: {
  login?: string | null;
  size?: "sm" | "md";
}) {
  const adminLogins = useAdminLogins();
  const developerLogins = useDeveloperLogins();
  if (!login) return null;

  const textSize = size === "md" ? "text-xs" : "text-[10px]";
  const checkSize = size === "md" ? 14 : 11;

  if (isOwner(login)) {
    return (
      <span className={`inline-flex items-center gap-1 ${textSize} font-semibold whitespace-nowrap`}>
        <span className="text-fuchsia-400">[Developer🧑‍💻]</span>
        <span className="text-sky-400 inline-flex items-center gap-0.5">
          [OWNER]
          <img
            src="/badges/verified.png"
            alt="Verified"
            width={checkSize}
            height={checkSize}
            className="inline-block"
          />
        </span>
      </span>
    );
  }

  if (developerLogins.has(login.toLowerCase())) {
    return (
      <span className={`${textSize} font-semibold text-fuchsia-400 whitespace-nowrap`}>
        [DEV🧑‍💻]
      </span>
    );
  }

  if (adminLogins.has(login.toLowerCase())) {
    return (
      <span className={`${textSize} font-semibold text-emerald-400 whitespace-nowrap`}>
        [ADMIN🛡️]
      </span>
    );
  }

  return <span className={`${textSize} font-medium text-gray-500 whitespace-nowrap`}>[USER]</span>;
}
