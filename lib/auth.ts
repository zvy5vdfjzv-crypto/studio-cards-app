import { one } from "./db";

export interface User {
  id: string;
  email: string;
  name: string;
}

// App sem login: um único "dono" auto-criado no banco.
// Todas as rotas continuam escopadas por user.id, mas é sempre o mesmo.
const OWNER_EMAIL = "owner@local";

let cachedOwner: User | null = null;

async function getOwner(): Promise<User> {
  if (cachedOwner) return cachedOwner;
  let u = await one<User>("SELECT id, email, name FROM users WHERE email=$1", [OWNER_EMAIL]);
  if (!u) {
    u = await one<User>(
      "INSERT INTO users (email, name, pass_hash) VALUES ($1,$2,$3) RETURNING id, email, name",
      [OWNER_EMAIL, "Estúdio", "-"]
    );
  }
  cachedOwner = u!;
  return cachedOwner;
}

export async function currentUser(): Promise<User | null> {
  return getOwner();
}

export async function requireUser(): Promise<User> {
  return getOwner();
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
