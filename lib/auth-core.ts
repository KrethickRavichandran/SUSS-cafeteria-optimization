export const PASSWORD_ITERATIONS = 100000;
export const SESSION_SECONDS = 7 * 24 * 60 * 60;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
export function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && value.length <= 128;
}
export function randomHex(bytes = 32): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
function hexBytes(value: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array((value.match(/.{2}/g) || []).map(byte => parseInt(byte, 16)));
}
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function hashPassword(password: string, salt = randomHex(16), iterations = PASSWORD_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bytes = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: hexBytes(salt), iterations, hash: "SHA-256" }, key, 256);
  const hash = [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return { salt, hash, iterations };
}
export async function verifyPassword(password: string, salt: string, expected: string, iterations = PASSWORD_ITERATIONS) {
  const actual = (await hashPassword(password, salt, iterations)).hash;
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
export function cookieName(url: string, nonce = false) {
  return (new URL(url).protocol === "https:" ? "__Host-" : "") + (nonce ? "foodloop_google_nonce" : "foodloop_session");
}
export function cookieHeader(url: string, value: string, maxAge = SESSION_SECONDS, nonce = false) {
  return `${cookieName(url, nonce)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(url).protocol === "https:" ? "; Secure" : ""}`;
}
export function readCookie(request: Request, nonce = false) {
  const prefix = cookieName(request.url, nonce) + "=";
  const value = (request.headers.get("cookie") || "").split(";").map(part => part.trim()).find(part => part.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}
export function validMutation(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin && request.headers.get("x-foodloop-request") === "1" && (request.headers.get("content-type") || "").startsWith("application/json");
}
