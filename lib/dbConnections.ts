import { Client } from "pg";
import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// Tabel Supabase yang dibutuhkan (di database UTAMA/primary KRYNOS):
//
// create table db_connections (
//   id uuid primary key default gen_random_uuid(),
//   name text not null,
//   connection_string text not null,
//   created_at timestamptz not null default now()
// );
//
// ⚠️ CATATAN KEAMANAN — BACA INI:
// - Fitur ini ngasih akses SQL MENTAH (bisa CREATE/DROP/DELETE APAPUN) ke
//   database manapun yang connection string-nya kamu masukin. Ini setara
//   kasih akses "root" ke database itu. HANYA owner yang bisa akses (dicek
//   di setiap API route-nya), tapi tetap hati-hati connection string mana
//   yang kamu taruh di sini.
// - connection_string disimpan APA ADANYA (gak dienkripsi) di tabel di
//   atas — sama kayak GitHub token di user_github_tokens, keamanannya
//   bergantung ke seberapa aman Supabase service role key kamu.
// - PAKAI CONNECTION STRING "POOLER" (bukan direct), biar cocok buat
//   serverless function Vercel yang bikin banyak koneksi pendek-pendek.
//   Di Supabase: Project Settings -> Database -> Connection string ->
//   pilih mode "Transaction" (port 6543), BUKAN yang port 5432.
// ============================================================================

const TABLE = "db_connections";

export async function listConnections() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name, connection_string, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  // Mask password di connection string buat ditampilin ke UI (jangan
  // pernah kirim password asli balik ke client kalau gak perlu-perlu amat)
  return (data || []).map((c) => ({
    ...c,
    connection_string: maskConnectionString(c.connection_string),
  }));
}

function maskConnectionString(raw: string): string {
  try {
    const url = new URL(raw.replace("postgres://", "http://").replace("postgresql://", "http://"));
    return `${url.hostname}${url.pathname} (user: ${url.username})`;
  } catch {
    return "postgres://***";
  }
}

export async function addConnection(name: string, connectionString: string) {
  if (!name.trim()) throw new Error("Nama koneksi wajib diisi");
  if (!connectionString.trim().startsWith("postgres")) {
    throw new Error("Connection string harus diawali postgres:// atau postgresql://");
  }

  // Tes konek dulu sebelum disimpan, biar gak nyimpen connection string
  // yang ternyata salah/gak bisa dipakai.
  const client = new Client({ connectionString, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();
    await client.query("select 1");
  } catch (e: any) {
    throw new Error(`Gagal konek ke database: ${e.message}`);
  } finally {
    await client.end().catch(() => {});
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ name: name.trim(), connection_string: connectionString.trim() })
    .select("id, name, created_at")
    .single();
  if (error) throw new Error(`Gagal menyimpan koneksi: ${error.message}`);
  return data;
}

export async function removeConnection(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

async function getRawConnectionString(id: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(TABLE)
    .select("connection_string")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error("Koneksi tidak ditemukan");
  return data.connection_string;
}

export type SqlResult = {
  rows: any[];
  rowCount: number;
  fields: string[];
  command: string;
};

// Jalanin SQL APAPUN ke koneksi yang dipilih. Bisa nulis banyak statement
// dipisah ";" — pg.query() cuma balikin hasil statement TERAKHIR kalau
// multi-statement, jadi disarankan 1 statement per run biar hasilnya jelas.
export async function runSql(connectionId: string, sql: string): Promise<SqlResult> {
  if (!sql.trim()) throw new Error("Query kosong");

  const connectionString = await getRawConnectionString(connectionId);
  const client = new Client({ connectionString, connectionTimeoutMillis: 8000 });

  try {
    await client.connect();
    const result = await client.query(sql);
    return {
      rows: result.rows || [],
      rowCount: result.rowCount ?? 0,
      fields: (result.fields || []).map((f) => f.name),
      command: result.command || "",
    };
  } finally {
    await client.end().catch(() => {});
  }
}
