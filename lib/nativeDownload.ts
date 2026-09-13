"use client";

// ============================================================================
// BUG: di dalam APK native (Capacitor WebView), <a download="...">/a.click()
// gak pernah nyimpen file apa-apa — Android System WebView TIDAK nangkep
// attribute "download" ke Download Manager kayak browser Chrome biasa,
// jadi klik "Download" di app kelihatan gak ngapa-ngapain (link blob:/data:
// cuma nyoba dibuka in-place, bukan disave).
//
// Fix-nya: kalau lagi jalan di dalam app native, tulis file-nya ke storage
// app pakai plugin @capacitor/filesystem, terus buka share sheet Android
// (@capacitor/share) biar user bisa "Simpan ke Download" / share ke app
// lain. Kalau bukan di app native (browser/PWA biasa), tetap pakai cara
// lama (<a download> + blob URL) yang emang udah jalan normal di sana.
// ============================================================================

function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor;
  return !!cap?.isNativePlatform?.();
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // data:<mime>;base64,XXXX -> ambil bagian base64-nya doang
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function triggerBrowserDownload(url: string, fileName: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Download sebuah Blob. Aman dipakai di browser/PWA (pakai <a download>
 * seperti biasa) MAUPUN di dalam APK native (nulis ke Filesystem app lalu
 * buka share sheet Android, karena <a download> gak jalan di WebView).
 */
export async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  if (!isNativeApp()) {
    const url = URL.createObjectURL(blob);
    try {
      triggerBrowserDownload(url, fileName);
    } finally {
      // Dikasih delay dikit biar a.click() sempet ke-proses browser
      // sebelum object URL-nya di-revoke.
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    return;
  }

  // Lazy-import plugin Capacitor: file ini juga ke-bundle di build web
  // biasa (bukan cuma APK), jadi package-nya jangan dipaksa ke-load kalau
  // gak lagi di app native (biar gak nambah bundle size sia-sia & gak
  // error di environment yang gak ada plugin native-nya).
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);

  const base64 = await blobToBase64(blob);
  const safeName = fileName.replace(/[\\/:*?"<>|]/g, "_");

  const written = await Filesystem.writeFile({
    path: safeName,
    data: base64,
    directory: Directory.Cache,
  });

  await Share.share({
    title: safeName,
    url: written.uri,
    dialogTitle: `Simpan ${safeName}`,
  });
}

/**
 * Download dari sebuah URL (remote http(s):// atau data:). Di app native
 * kontennya di-fetch dulu jadi Blob, baru dilempar ke downloadBlob().
 */
export async function downloadFromUrl(url: string, fileName: string): Promise<void> {
  if (!isNativeApp()) {
    triggerBrowserDownload(url, fileName);
    return;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal ambil file (${res.status})`);
  const blob = await res.blob();
  await downloadBlob(blob, fileName);
}
