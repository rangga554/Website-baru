// Endpoint kecil yang balikin "identitas" deployment yang lagi jalan sekarang.
// Vercel otomatis nge-set VERCEL_GIT_COMMIT_SHA tiap kali deploy dari Git,
// jadi nilainya PASTI beda tiap kali ada deployment baru — cocok dipakai
// buat deteksi "ada update baru" di sisi client (lihat components/UpdateChecker.tsx).
//
// force-dynamic penting: tanpa ini, Next.js bisa nge-cache response route ini
// secara statis, jadi client gak akan pernah lihat nilai versi yang baru walau
// sudah ada deployment baru.
export const dynamic = "force-dynamic";

export async function GET() {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    "dev";

  return Response.json({ version });
}
