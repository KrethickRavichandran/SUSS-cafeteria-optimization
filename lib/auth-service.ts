import { createRemoteJWKSet, jwtVerify } from "jose";
import { cookieHeader, hashPassword, normalizeEmail, randomHex, readCookie, SESSION_SECONDS, sha256, validMutation, validPassword, verifyPassword } from "./auth-core";

type DB = D1Database;
type UserRow = { id: string; email: string; name: string; password_hash: string | null; password_salt: string | null; password_iterations: number; google_subject: string | null; email_verified: number; created_at: number };
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const SESSION_QUERY = "SELECT u.* FROM foodloop_sessions s JOIN foodloop_users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?";

export class AuthError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
function json(value: unknown, status = 200, cookies: string[] = []) {
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", "vary": "Cookie" });
  cookies.forEach(cookie => headers.append("set-cookie", cookie));
  return new Response(JSON.stringify(value), { status, headers });
}
function profile(user: UserRow) {
  return { id: user.id, email: user.email, name: user.name, emailVerified: !!user.email_verified, googleLinked: !!user.google_subject, hasPassword: !!user.password_hash };
}
async function currentUser(request: Request, db: DB): Promise<UserRow | null> {
  const token = readCookie(request);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare(SESSION_QUERY).bind(await sha256(token), Date.now()).first<UserRow>();
}
async function newSession(request: Request, db: DB, user: UserRow, nonce = false) {
  const token = randomHex(); const now = Date.now();
  await db.prepare("INSERT INTO foodloop_sessions (token_hash,user_id,created_at,expires_at) VALUES (?,?,?,?)").bind(await sha256(token), user.id, now, now + SESSION_SECONDS * 1000).run();
  await db.prepare("DELETE FROM foodloop_sessions WHERE expires_at < ?").bind(now).run();
  return json({ user: profile(user) }, 200, [cookieHeader(request.url, token), ...(nonce ? [cookieHeader(request.url, "", 0, true)] : [])]);
}
async function limit(request: Request, db: DB, action: string, email?: string) {
  const now = Date.now(), windowMs = action === "register" ? 3600000 : 600000, maximum = action === "register" ? 8 : 20;
  const identity = request.headers.get("cf-connecting-ip") || "local";
  for (const value of ["ip:" + identity, ...(email ? ["account:" + email] : [])]) {
    const key = await sha256(action + ":" + value);
    await db.prepare("INSERT INTO foodloop_auth_limits (key,attempts,resets_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts = CASE WHEN resets_at <= ? THEN 1 ELSE attempts + 1 END, resets_at = CASE WHEN resets_at <= ? THEN ? ELSE resets_at END").bind(key, now + windowMs, now, now, now + windowMs).run();
    const row = await db.prepare("SELECT attempts FROM foodloop_auth_limits WHERE key = ?").bind(key).first<{ attempts: number }>();
    if (row && row.attempts > maximum) throw new AuthError(429, "rate_limit", "Too many attempts. Please wait a while and try again.");
  }
  await db.prepare("DELETE FROM foodloop_auth_limits WHERE resets_at < ?").bind(now - 3600000).run();
}
async function body(request: Request) {
  if (!request.body) return {};
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break; size += value.byteLength;
    if (size > 8192) { await reader.cancel(); throw new AuthError(413, "too_large", "This request is too large."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch { throw new AuthError(400, "invalid_request", "Please check the form and try again."); }
}
async function googleIdentity(token: unknown, clientId: string, nonce: string | null) {
  if (!clientId) throw new AuthError(503, "google_not_configured", "Google sign-in is not connected yet. Please use email for now.");
  if (typeof token !== "string" || token.length > 6000 || !nonce || !/^[a-f0-9]{64}$/.test(nonce)) throw new AuthError(401, "invalid_google", "Please start Google sign-in again.");
  try {
    const { payload } = await jwtVerify(token, googleKeys, { audience: clientId, issuer: ["https://accounts.google.com", "accounts.google.com"], algorithms: ["RS256"], maxTokenAge: "1h", clockTolerance: 30 });
    const email = normalizeEmail(payload.email);
    if (payload.nonce !== nonce || payload.email_verified !== true || !email || typeof payload.sub !== "string" || !payload.sub) throw new Error();
    return { subject: payload.sub, email, name: typeof payload.name === "string" ? payload.name.trim().slice(0, 60) : email.split("@")[0] };
  } catch { throw new AuthError(401, "invalid_google", "Google sign-in could not be verified. Please try again."); }
}
export async function handleAuth(request: Request, action: string, db: DB, clientId = ""): Promise<Response> {
  try {
    if (request.method === "GET" && action === "config") return json({ googleClientId: clientId || null, emailAccounts: !!db });
    if (!db) throw new AuthError(503, "unavailable", "Accounts are temporarily unavailable. You can still explore FoodLoop as a guest.");
    if (request.method === "GET" && action === "session") { const user = await currentUser(request, db); return json({ user: user ? profile(user) : null }); }
    if (request.method !== "POST") throw new AuthError(405, "method", "This action requires a form submission.");
    if (!validMutation(request)) throw new AuthError(403, "origin", "Please open the FoodLoop website and try again.");
    const input = await body(request);
    if (action === "logout") {
      const token = readCookie(request);
      if (token && /^[a-f0-9]{64}$/.test(token)) await db.prepare("DELETE FROM foodloop_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
      return json({ user: null }, 200, [cookieHeader(request.url, "", 0)]);
    }
    if (action === "google-nonce") {
      if (!clientId) throw new AuthError(503, "google_not_configured", "Google sign-in is not connected yet. Please use email for now.");
      await limit(request, db, action);
      const nonce = randomHex(); return json({ nonce }, 200, [cookieHeader(request.url, nonce, 600, true)]);
    }
    if (action === "register" || action === "login") {
      const email = normalizeEmail(input.email);
      if (!email || !validPassword(input.password)) throw new AuthError(400, "invalid_credentials", "Enter a valid email and a password between 12 and 128 characters.");
      await limit(request, db, action, email);
      const existing = await db.prepare("SELECT * FROM foodloop_users WHERE email = ?").bind(email).first<UserRow>();
      if (action === "login") {
        const correct = await verifyPassword(input.password, existing?.password_salt || "00000000000000000000000000000000", existing?.password_hash || "0".repeat(64), existing?.password_iterations || 100000);
        if (!existing || !existing.password_hash || !correct) throw new AuthError(401, "invalid_credentials", "The email or password is incorrect.");
        return await newSession(request, db, existing);
      }
      const name = typeof input.name === "string" ? input.name.trim().slice(0, 60) : "";
      if (!name || /[\u0000-\u001f]/.test(name)) throw new AuthError(400, "invalid_name", "Please enter your name.");
      if (existing) throw new AuthError(409, "account_exists", "An account could not be created with this email. Try signing in instead.");
      const password = await hashPassword(input.password), id = crypto.randomUUID(), now = Date.now();
      try {
        await db.prepare("INSERT INTO foodloop_users (id,email,name,password_hash,password_salt,password_iterations,email_verified,created_at) VALUES (?,?,?,?,?,?,0,?)").bind(id,email,name,password.hash,password.salt,password.iterations,now).run();
      } catch { throw new AuthError(409, "account_exists", "An account could not be created with this email. Try signing in instead."); }
      const user = await db.prepare("SELECT * FROM foodloop_users WHERE id = ?").bind(id).first<UserRow>();
      if (!user) throw new Error("Account write failed");
      return await newSession(request, db, user);
    }
    if (action === "google" || action === "link-google") {
      await limit(request, db, action);
      const identity = await googleIdentity(input.credential, clientId, readCookie(request, true));
      if (action === "link-google") {
        const user = await currentUser(request, db);
        if (!user) throw new AuthError(401, "sign_in_required", "Sign in to your email account before linking Google.");
        if (user.email !== identity.email) throw new AuthError(409, "email_mismatch", "Choose the Google account with the same email as your FoodLoop account.");
        if (user.google_subject && user.google_subject !== identity.subject) throw new AuthError(409, "already_linked", "This account is already linked to another Google account.");
        await db.prepare("UPDATE foodloop_users SET google_subject = ?, email_verified = 1 WHERE id = ?").bind(identity.subject,user.id).run();
        return json({ user: profile({ ...user, google_subject: identity.subject, email_verified: 1 }) }, 200, [cookieHeader(request.url,"",0,true)]);
      }
      let user = await db.prepare("SELECT * FROM foodloop_users WHERE google_subject = ?").bind(identity.subject).first<UserRow>();
      if (!user) {
        const existing = await db.prepare("SELECT id FROM foodloop_users WHERE email = ?").bind(identity.email).first();
        if (existing) throw new AuthError(409, "link_required", "Sign in with your FoodLoop password first, then link your Google account from your account panel.");
        const id=crypto.randomUUID();
        await db.prepare("INSERT INTO foodloop_users (id,email,name,google_subject,email_verified,created_at) VALUES (?,?,?,?,1,?)").bind(id,identity.email,identity.name,identity.subject,Date.now()).run();
        user=await db.prepare("SELECT * FROM foodloop_users WHERE id = ?").bind(id).first<UserRow>();
      }
      if (!user) throw new Error("Google account write failed");
      return await newSession(request,db,user,true);
    }
    throw new AuthError(404,"not_found","This account action is unavailable.");
  } catch (error) {
    if (error instanceof AuthError) return json({error:error.message,code:error.code},error.status);
    return json({error:"Accounts are temporarily unavailable. Please try again later.",code:"unavailable"},503);
  }
}
