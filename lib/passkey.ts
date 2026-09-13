import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { getSupabaseAdmin } from "./supabase";
import { findById } from "./localAccounts";

// ============================================================================
// PASSKEY (WebAuthn) — login pakai sidik jari/Face ID/Windows Hello, cuma
// buat AKUN LOKAL (username/password), sifatnya OPSIONAL (nambah cara
// login, gak gantiin password — kalau HP/browser ganti, tetep bisa login
// pake password biasa).
// ============================================================================

const CHALLENGE_TABLE = "passkey_challenges";
const CREDENTIAL_TABLE = "passkey_credentials";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function rpID(): string {
  const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
  try {
    return new URL(url).hostname;
  } catch {
    return "localhost";
  }
}

function origin(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

async function saveChallenge(localAccountId: string, purpose: "register" | "authenticate", challenge: string) {
  const supabase = getSupabaseAdmin();
  await supabase.from(CHALLENGE_TABLE).upsert({
    local_account_id: localAccountId,
    purpose,
    challenge,
    created_at: new Date().toISOString(),
  });
}

async function consumeChallenge(localAccountId: string, purpose: "register" | "authenticate"): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from(CHALLENGE_TABLE)
    .select("*")
    .eq("local_account_id", localAccountId)
    .eq("purpose", purpose)
    .maybeSingle();

  await supabase.from(CHALLENGE_TABLE).delete().eq("local_account_id", localAccountId);

  if (!data) return null;
  if (Date.now() - new Date(data.created_at).getTime() > CHALLENGE_TTL_MS) return null;
  return data.challenge as string;
}

async function listCredentialsForAccount(localAccountId: string) {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase.from(CREDENTIAL_TABLE).select("*").eq("local_account_id", localAccountId);
  return data || [];
}

export async function listPasskeysForAccount(localAccountId: string) {
  const rows = await listCredentialsForAccount(localAccountId);
  // Cuma balikin info yang aman & berguna buat UI Settings (gak perlu
  // public key mentah ditampilin ke frontend).
  return rows.map((r: any) => ({
    id: r.id,
    deviceName: r.device_name || "Passkey tanpa nama",
    createdAt: r.created_at,
  }));
}

export async function deletePasskey(localAccountId: string, credentialId: string) {
  const supabase = getSupabaseAdmin();
  await supabase.from(CREDENTIAL_TABLE).delete().eq("id", credentialId).eq("local_account_id", localAccountId);
}

// ----------------------------------------------------------------------------
// REGISTRASI — user WAJIB udah login (akun lokal) buat nambahin passkey baru
// dari halaman Settings.
// ----------------------------------------------------------------------------
export async function buildRegistrationOptions(localAccountId: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const account = await findById(localAccountId);
  if (!account) throw new Error("Akun gak ketemu");

  const existing = await listCredentialsForAccount(localAccountId);

  const options = await generateRegistrationOptions({
    rpName: "KRYNOS",
    rpID: rpID(),
    userName: account.username,
    attestationType: "none",
    excludeCredentials: existing.map((c: any) => ({
      id: c.id,
      transports: c.transports ? c.transports.split(",") : undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await saveChallenge(localAccountId, "register", options.challenge);
  return options;
}

export async function finishRegistration(
  localAccountId: string,
  response: RegistrationResponseJSON,
  deviceName?: string
): Promise<{ verified: boolean }> {
  const expectedChallenge = await consumeChallenge(localAccountId, "register");
  if (!expectedChallenge) {
    throw new Error("Sesi pendaftaran passkey udah kadaluarsa, coba ulang dari awal.");
  }

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin(),
    expectedRPID: rpID(),
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from(CREDENTIAL_TABLE).insert({
    id: credential.id,
    local_account_id: localAccountId,
    public_key: Buffer.from(credential.publicKey).toString("base64"),
    webauthn_user_id: credential.id, // cukup dijadiin sama, gak dipakai buat lookup lain
    counter: credential.counter,
    device_type: credentialDeviceType,
    backed_up: credentialBackedUp,
    transports: credential.transports?.join(",") || null,
    device_name: deviceName || null,
  });
  if (error) throw new Error(`Gagal simpan passkey: ${error.message}`);

  return { verified: true };
}

// ----------------------------------------------------------------------------
// LOGIN — user belum login, tapi udah masukin username/email di form login
// (sama kayak alur login password biasa), baru abis itu browser diminta
// pilih passkey yang cocok.
// ----------------------------------------------------------------------------
export async function buildAuthenticationOptions(localAccountId: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const creds = await listCredentialsForAccount(localAccountId);
  if (creds.length === 0) {
    throw new Error("Akun ini belum punya passkey terdaftar.");
  }

  const options = await generateAuthenticationOptions({
    rpID: rpID(),
    userVerification: "preferred",
    allowCredentials: creds.map((c: any) => ({
      id: c.id,
      transports: c.transports ? c.transports.split(",") : undefined,
    })),
  });

  await saveChallenge(localAccountId, "authenticate", options.challenge);
  return options;
}

export async function verifyAuthentication(
  localAccountId: string,
  response: AuthenticationResponseJSON
): Promise<boolean> {
  const expectedChallenge = await consumeChallenge(localAccountId, "authenticate");
  if (!expectedChallenge) return false;

  const supabase = getSupabaseAdmin();
  const { data: cred } = await supabase
    .from(CREDENTIAL_TABLE)
    .select("*")
    .eq("id", response.id)
    .eq("local_account_id", localAccountId)
    .maybeSingle();
  if (!cred) return false;

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin(),
      expectedRPID: rpID(),
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(Buffer.from(cred.public_key, "base64")),
        counter: Number(cred.counter),
        transports: cred.transports ? cred.transports.split(",") : undefined,
      },
    });
  } catch {
    return false;
  }

  if (!verification.verified) return false;

  // Update counter (proteksi anti cloning authenticator)
  await supabase
    .from(CREDENTIAL_TABLE)
    .update({ counter: verification.authenticationInfo.newCounter })
    .eq("id", cred.id);

  return true;
}
