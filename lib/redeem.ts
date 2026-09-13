import { getSupabaseAdmin } from "./supabase";
import { getOctokitFromSession } from "./octokit";
import { grantPlusFree } from "./plus";

const CODE_TABLE = "redeem_codes";
const USE_TABLE = "redeem_code_uses";

export type RewardType = "plus" | "new_repo" | "custom";

function normalizeCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

// ---- Owner-only: kelola kode ----------------------------------------------
export async function createRedeemCode(params: {
  code: string;
  rewardType: RewardType;
  rewardDays?: number;
  rewardMessage?: string;
  maxUses: number;
  expiresAt?: string | null;
  createdBy: string;
}) {
  const code = normalizeCode(params.code);
  if (!code) throw new Error("Kode wajib diisi");
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
    throw new Error("Kode cuma boleh huruf/angka/-/_ , 3-40 karakter");
  }
  if (params.rewardType === "plus" && (!params.rewardDays || params.rewardDays <= 0)) {
    throw new Error("Reward Plus butuh jumlah hari yang valid");
  }
  if (!params.maxUses || params.maxUses <= 0) {
    throw new Error("Maksimal pemakaian wajib diisi (minimal 1)");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(CODE_TABLE)
    .insert({
      code,
      reward_type: params.rewardType,
      reward_days: params.rewardType === "plus" ? params.rewardDays : null,
      reward_message: params.rewardMessage?.trim() || null,
      max_uses: params.maxUses,
      expires_at: params.expiresAt || null,
      created_by: params.createdBy,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new Error(`Kode "${code}" udah dipakai, coba kode lain`);
    throw new Error(`Gagal membuat kode: ${error.message}`);
  }
  return data;
}

export async function listRedeemCodes() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(CODE_TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal ambil daftar kode: ${error.message}`);
  return data || [];
}

export async function deleteRedeemCode(id: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(CODE_TABLE).delete().eq("id", id);
  if (error) throw new Error(`Gagal menghapus kode: ${error.message}`);
}

// ---- User: redeem kode -----------------------------------------------------
export async function applyRedeemCode(params: {
  codeInput: string;
  login: string;
  avatarUrl: string | null;
}) {
  const code = normalizeCode(params.codeInput);
  if (!code) throw new Error("Kode wajib diisi");

  const supabase = getSupabaseAdmin();

  const { data: redeemCode, error: codeErr } = await supabase
    .from(CODE_TABLE)
    .select("*")
    .eq("code", code)
    .maybeSingle();
  if (codeErr) throw new Error(`Gagal cek kode: ${codeErr.message}`);
  if (!redeemCode) throw new Error("Kode gak ditemukan / gak valid");

  if (redeemCode.expires_at && new Date(redeemCode.expires_at).getTime() < Date.now()) {
    throw new Error("Kode ini udah kadaluarsa");
  }
  if (redeemCode.used_count >= redeemCode.max_uses) {
    throw new Error("Kode ini udah mencapai batas maksimal pemakaian");
  }

  const { data: alreadyUsed } = await supabase
    .from(USE_TABLE)
    .select("login")
    .eq("code_id", redeemCode.id)
    .eq("login", params.login)
    .maybeSingle();
  if (alreadyUsed) throw new Error("Kamu udah pernah redeem kode ini");

  // Catat pemakaian LEBIH DULU (sebelum ngasih reward) — kalau race condition
  // 2 request barengan, constraint primary key (code_id, login) bakal nolak
  // yang kedua, jadi gak dobel dikasih reward.
  const { error: useErr } = await supabase.from(USE_TABLE).insert({
    code_id: redeemCode.id,
    login: params.login,
  });
  if (useErr) {
    if (useErr.code === "23505") throw new Error("Kamu udah pernah redeem kode ini");
    throw new Error(`Gagal mencatat pemakaian kode: ${useErr.message}`);
  }

  let result: { rewardType: RewardType; message: string; extra?: Record<string, any> };

  try {
    if (redeemCode.reward_type === "plus") {
      const { expiresAt } = await grantPlusFree({
        login: params.login,
        days: redeemCode.reward_days,
        grantedBy: `CODE:${code}`,
      });
      result = {
        rewardType: "plus",
        message: `KRYNOS Plus ${redeemCode.reward_days} hari!`,
        extra: { expiresAt },
      };
    } else if (redeemCode.reward_type === "new_repo") {
      const octokit = await getOctokitFromSession();
      if (!octokit) throw new Error("Sesi login habis, coba refresh halaman lalu redeem lagi");

      const repoName = `hadiah-${code.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
      const { data: repo } = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        private: false,
        auto_init: true,
        description: `Repo hadiah dari kode redeem ${code}`,
      });

      if (redeemCode.reward_message) {
        // Tunggu bentar — GitHub butuh waktu sepersekian detik buat siapin
        // commit awal (README) dari auto_init sebelum bisa di-PUT lagi.
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const { data: readme } = await octokit.repos.getContent({
            owner: repo.owner.login,
            repo: repo.name,
            path: "README.md",
          });
          await octokit.repos.createOrUpdateFileContents({
            owner: repo.owner.login,
            repo: repo.name,
            path: "README.md",
            message: "Isi hadiah dari KRYNOS",
            content: Buffer.from(redeemCode.reward_message, "utf-8").toString("base64"),
            sha: (readme as any).sha,
          });
        } catch {
          // Kalau gagal isi README custom, gak fatal — repo-nya tetep jadi
          // punya user, cuma isinya default auto_init aja.
        }
      }

      result = {
        rewardType: "new_repo",
        message: `Repository baru "${repo.name}" berhasil dibuat di akun kamu!`,
        extra: { repoUrl: repo.html_url, repoName: repo.name },
      };
    } else {
      result = {
        rewardType: "custom",
        message: redeemCode.reward_message || "Selamat, kode berhasil di-redeem!",
      };
    }
  } catch (e: any) {
    // Reward gagal diproses -> batalin catatan pemakaian biar user bisa
    // coba redeem ulang (kodenya gak "kebakar" sia-sia).
    await supabase.from(USE_TABLE).delete().eq("code_id", redeemCode.id).eq("login", params.login);
    throw e;
  }

  await supabase
    .from(CODE_TABLE)
    .update({ used_count: redeemCode.used_count + 1 })
    .eq("id", redeemCode.id);

  return result;
}
