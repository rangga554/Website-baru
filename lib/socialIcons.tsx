import {
  FaTiktok,
  FaWhatsapp,
  FaInstagram,
  FaYoutube,
  FaFacebookF,
  FaTelegram,
  FaDiscord,
  FaLinkedin,
  FaGithub,
  FaTwitter,
  FaEnvelope,
  FaGlobe,
} from "react-icons/fa";

// Cocokin domain -> {icon, warna brand, nama platform}. Urutan dicek dari
// atas ke bawah, pakai .includes() di hostname biar nangkep subdomain juga
// (misal "vt.tiktok.com", "web.whatsapp.com", dst).
const PLATFORM_MAP: {
  match: string[];
  icon: typeof FaGlobe;
  color: string;
  name: string;
}[] = [
  { match: ["tiktok.com"], icon: FaTiktok, color: "#000000", name: "TikTok" },
  { match: ["whatsapp.com", "wa.me"], icon: FaWhatsapp, color: "#25D366", name: "WhatsApp" },
  { match: ["instagram.com"], icon: FaInstagram, color: "#E1306C", name: "Instagram" },
  { match: ["youtube.com", "youtu.be"], icon: FaYoutube, color: "#FF0000", name: "YouTube" },
  { match: ["facebook.com", "fb.com"], icon: FaFacebookF, color: "#1877F2", name: "Facebook" },
  { match: ["t.me", "telegram.org", "telegram.me"], icon: FaTelegram, color: "#26A5E4", name: "Telegram" },
  { match: ["discord.gg", "discord.com"], icon: FaDiscord, color: "#5865F2", name: "Discord" },
  { match: ["linkedin.com"], icon: FaLinkedin, color: "#0A66C2", name: "LinkedIn" },
  { match: ["github.com"], icon: FaGithub, color: "#ffffff", name: "GitHub" },
  { match: ["twitter.com", "x.com"], icon: FaTwitter, color: "#1DA1F2", name: "Twitter / X" },
];

export function detectSocialPlatform(url: string): {
  Icon: typeof FaGlobe;
  color: string;
  name: string;
} {
  if (url.startsWith("mailto:")) {
    return { Icon: FaEnvelope, color: "#9CA3AF", name: "Email" };
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    for (const platform of PLATFORM_MAP) {
      if (platform.match.some((m) => hostname.includes(m))) {
        return { Icon: platform.icon, color: platform.color, name: platform.name };
      }
    }
  } catch {
    // URL gak valid -> fallback ke generic di bawah
  }

  return { Icon: FaGlobe, color: "#9CA3AF", name: "Link" };
}
