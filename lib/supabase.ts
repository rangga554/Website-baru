import { createClient } from "@supabase/supabase-js";

// PENTING: ini pakai Service Role Key, jadi cuma boleh dipanggil dari server
// (route handler / server component). JANGAN pernah import file ini dari
// komponen yang jalan di browser ("use client"), karena key-nya bisa
// bypass semua RLS policy di Supabase.
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum di-set di environment variable"
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
