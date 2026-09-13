// Username GitHub pemilik resmi KRYNOS.
export const OWNER_LOGIN = "rangga554";

export function isOwner(login?: string | null): boolean {
  if (!login) return false;
  return login.toLowerCase() === OWNER_LOGIN.toLowerCase();
}
