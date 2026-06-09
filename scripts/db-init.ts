// Cria/atualiza o schema. Rode: npm run db:init  (precisa de DATABASE_URL no ambiente)
import { readFileSync } from "fs";
import { join } from "path";
import { Client } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida. Ex: DATABASE_URL=... npm run db:init");
  const sql = readFileSync(join(process.cwd(), "lib", "schema.sql"), "utf8");
  const client = new Client({
    connectionString: url,
    ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
  await client.query(sql);
  await client.end();
  console.log("✔ Schema aplicado com sucesso.");
}

main().catch((e) => {
  console.error("✖ Falha:", e.message);
  process.exit(1);
});
