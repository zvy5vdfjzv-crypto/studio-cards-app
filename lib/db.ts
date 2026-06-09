import { Pool } from "pg";

// Pool único reaproveitado entre invocações serverless.
// Use uma connection string COM POOLER (PgBouncer) — Neon pooled ou Supabase 6543.
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function makePool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL não configurada.");
  const needSsl = !/localhost|127\.0\.0\.1/.test(connectionString);
  return new Pool({
    connectionString,
    max: 3,
    ssl: needSsl ? { rejectUnauthorized: false } : undefined,
  });
}

export function pool(): Pool {
  if (!global._pgPool) global._pgPool = makePool();
  return global._pgPool;
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool().query(text, params);
  return res.rows as T[];
}

export async function one<T = any>(text: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
