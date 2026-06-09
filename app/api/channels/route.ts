import { handler, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const user = await requireUser();
  const channels = await query(
    `SELECT id, user_id, name, slug, ig_user_id, ig_username, ig_page_id, ig_token_expires_at,
            drive_folder_id, (drive_refresh_token IS NOT NULL) AS drive_connected, created_at
     FROM channels WHERE user_id=$1 ORDER BY created_at`,
    [user.id]
  );
  return ok({ channels });
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const { name } = await req.json();
  const nm = String(name || "").trim();
  if (!nm) throw new Error("Dê um nome ao canal.");
  let slug = slugify(nm);
  // garante slug único por usuário
  const taken = await query("SELECT slug FROM channels WHERE user_id=$1 AND slug LIKE $2", [user.id, slug + "%"]);
  if (taken.some((t: any) => t.slug === slug)) slug = `${slug}-${taken.length + 1}`;
  const ch = await one(
    `INSERT INTO channels (user_id, name, slug) VALUES ($1,$2,$3)
     RETURNING id, user_id, name, slug, ig_user_id, ig_username, ig_page_id, ig_token_expires_at,
               drive_folder_id, false AS drive_connected, created_at`,
    [user.id, nm, slug]
  );
  return ok({ channel: ch });
});
