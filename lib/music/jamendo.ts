// Sumber musik: Jamendo (api.jamendo.com) — katalog musik independen berlisensi
// Creative Commons, GRATIS buat streaming, GAK ADA IKLAN nempel di audio-nya
// (beda sama YouTube/Spotify yang butuh OAuth atau nyempilin iklan). Butuh
// client_id gratis dari https://devportal.jamendo.com (daftar app sekali,
// gak ada biaya) — taruh di env var JAMENDO_CLIENT_ID.
//
// Semua request ke sini jalan di server (API route), BUKAN dari browser —
// jadi client_id gak ke-expose ke publik lewat network tab user.

const JAMENDO_BASE = "https://api.jamendo.com/v3.0";

export type MusicTrack = {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  audioUrl: string;
  duration: number; // detik
  license: string | null;
};

type JamendoRawTrack = {
  id: string;
  name: string;
  artist_name: string;
  album_image?: string;
  image?: string;
  audio: string;
  duration: number;
  license_ccurl?: string;
};

function mapTrack(raw: JamendoRawTrack): MusicTrack {
  return {
    id: raw.id,
    title: raw.name || "Tanpa Judul",
    artist: raw.artist_name || "Tidak Diketahui",
    cover: raw.album_image || raw.image || null,
    audioUrl: raw.audio,
    duration: Number(raw.duration) || 0,
    license: raw.license_ccurl || null,
  };
}

async function jamendoRequest(path: string, params: Record<string, string>) {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) {
    return {
      ok: false as const,
      error:
        "JAMENDO_CLIENT_ID belum di-set di environment variable. Daftar gratis di devportal.jamendo.com buat dapetin client_id-nya.",
    };
  }

  const qs = new URLSearchParams({
    client_id: clientId,
    format: "json",
    audioformat: "mp32",
    include: "musicinfo",
    ...params,
  });

  const res = await fetch(`${JAMENDO_BASE}${path}/?${qs.toString()}`, {
    // Katalog Jamendo gak sering berubah drastis dalam hitungan menit —
    // cache bentar biar gak nge-hit API tiap kali user buka halaman /musik.
    next: { revalidate: 300 },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data?.headers?.status !== "success") {
    return { ok: false as const, error: data?.headers?.error_message || `Gagal ambil data dari Jamendo (${res.status})` };
  }
  return { ok: true as const, results: (data.results || []) as JamendoRawTrack[] };
}

// order: "popularity_total" (paling sering diputer sepanjang masa di Jamendo),
// "popularity_month" (lagi hits bulan ini), "releasedate_desc" (rilis terbaru).
export async function fetchJamendoTracks(opts: {
  search?: string;
  tags?: string;
  order?: string;
  limit?: number;
  offset?: number;
}) {
  const params: Record<string, string> = {
    limit: String(opts.limit ?? 30),
    offset: String(opts.offset ?? 0),
    order: opts.order || "popularity_total",
  };
  if (opts.search) params.namesearch = opts.search;
  if (opts.tags) params.fuzzytags = opts.tags;

  const result = await jamendoRequest("/tracks", params);
  if (result.ok === false) return result;
  return { ok: true as const, tracks: result.results.map(mapTrack) };
}

// Dipake buat fitur auto-next pas lagu abis: ambil track paling populer,
// exclude track yang baru aja diputer biar gak looping ke lagu yang sama.
export async function fetchBestJamendoTrack(excludeId?: string) {
  const result = await fetchJamendoTracks({ order: "popularity_total", limit: 10 });
  if (result.ok === false) return result;
  const candidates = result.tracks.filter((t) => t.id !== excludeId);
  const pick = candidates[Math.floor(Math.random() * candidates.length)] || result.tracks[0];
  if (!pick) return { ok: false as const, error: "Gak ada lagu populer yang ketemu." };
  return { ok: true as const, track: pick };
}
