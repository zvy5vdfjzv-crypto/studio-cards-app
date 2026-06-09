import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { one, query } from "./db";

const COOKIE = "ecsid";
const DAYS = 30;

export interface User {
  id: string;
  email: string;
  name: string;
}

export async function register(email: string, password: string, name: string): Promise<User> {
  const e = email.trim().toLowerCase();
  if (!e || !password || password.length < 6) throw new Error("E-mail e senha (mín. 6) obrigatórios.");
  const exists = await one("SELECT id FROM users WHERE email=$1", [e]);
  if (exists) throw new Error("E-mail já cadastrado.");
  const hash = await bcrypt.hash(password, 10);
  const u = await one<User>(
    "INSERT INTO users (email, name, pass_hash) VALUES ($1,$2,$3) RETURNING id, email, name",
    [e, name.trim() || e.split("@")[0], hash]
  );
  return u!;
}

export async function login(email: string, password: string): Promise<User> {
  const e = email.trim().toLowerCase();
  const row = await one<{ id: string; email: string; name: string; pass_hash: string }>(
    "SELECT id, email, name, pass_hash FROM users WHERE email=$1",
    [e]
  );
  if (!row || !(await bcrypt.compare(password, row.pass_hash))) throw new Error("Credenciais inválidas.");
  return { id: row.id, email: row.email, name: row.name };
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + DAYS * 86400_000);
  await query("INSERT INTO sessions (token, user_id, expires_at) VALUES ($1,$2,$3)", [token, userId, expires]);
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
  return token;
}

export async function destroySession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token=$1", [token]);
  cookies().delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const u = await one<User>(
    `SELECT u.id, u.email, u.name FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token=$1 AND s.expires_at > now()`,
    [token]
  );
  return u;
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new AuthError();
  return u;
}

export class AuthError extends Error {
  constructor() {
    super("Não autenticado.");
    this.name = "AuthError";
  }
}

// Garante que o canal pertence ao usuário; retorna o canal ou lança.
export async function ownedChannel(userId: string, channelId: string) {
  const ch = await one("SELECT * FROM channels WHERE id=$1 AND user_id=$2", [channelId, userId]);
  if (!ch) throw new Error("Canal não encontrado.");
  return ch as any;
}
