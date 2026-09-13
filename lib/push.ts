import webpush from "web-push";
import { getSupabaseAdmin } from "./supabase";

// ============================================================================
// Tabel Supabase yang dibutuhkan (SQL Editor Supabase):
//
// create table push_subscriptions (
//   login text not null,
//   endpoint text primary key,
//   p256dh text not null,
//   auth text not null,
//   scope text not null default 'all', -- 'all' (owner: semua event) | 'announcement' (user biasa: cuma announcement)
//   created_at timestamptz not null default now()
// );
// create index push_subscriptions_login_idx on push_subscriptions (login);
//
// ENV VAR yang dibutuhkan (generate sekali, simpan baik-baik — private key
// gak boleh bocor, sama pentingnya kayak secret lain):
//   VAPID_PUBLIC_KEY=...
//   VAPID_PRIVATE_KEY=...
//   VAPID_SUBJECT=mailto:kamu@email.com   (kontak buat browser push service kalau ada masalah)
// ============================================================================

const TABLE = "push_subscriptions";

function ensureConfigured() {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@mastercode.my.id";
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  return true;
}

export async function saveSubscription(params: {
  login: string;
  scope: "all" | "announcement";
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
}) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(TABLE).upsert({
    login: params.login,
    endpoint: params.subscription.endpoint,
    p256dh: params.subscription.keys.p256dh,
    auth: params.subscription.keys.auth,
    scope: params.scope,
  });
  if (error) throw new Error(`Gagal simpan subscription push: ${error.message}`);
}

export async function removeSubscription(endpoint: string) {
  const supabase = getSupabaseAdmin();
  await supabase.from(TABLE).delete().eq("endpoint", endpoint);
}

type PushPayload = { title: string; body: string; url?: string };

async function sendToSubscription(sub: any, payload: PushPayload) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload)
    );
  } catch (err: any) {
    // Kode 410/404 = subscription expired/dicabut user -> bersihin dari DB
    // biar gak nyoba kirim ke situ lagi terus-terusan.
    if (err.statusCode === 404 || err.statusCode === 410) {
      await removeSubscription(sub.endpoint);
    }
  }
}

// Kirim ke SEMUA user yang subscribe scope tertentu ('announcement' dikirim
// ke SEMUA subscriber, 'all' cuma ke owner yang scope-nya 'all').
export async function broadcastPush(scope: "all" | "announcement", payload: PushPayload) {
  if (!ensureConfigured()) return; // belum di-setup -> diem-diem aja, gak kritis

  const supabase = getSupabaseAdmin();
  const { data: subs } = await supabase.from(TABLE).select("*").eq("scope", scope);
  if (!subs || subs.length === 0) return;

  await Promise.all(subs.map((sub) => sendToSubscription(sub, payload)));
}

// Kirim ke 1 login tertentu aja (misal: notif hasil review Plus ke user itu)
export async function sendPushToUser(login: string, payload: PushPayload) {
  if (!ensureConfigured()) return;

  const supabase = getSupabaseAdmin();
  const { data: subs } = await supabase.from(TABLE).select("*").eq("login", login);
  if (!subs || subs.length === 0) return;

  await Promise.all(subs.map((sub) => sendToSubscription(sub, payload)));
}
