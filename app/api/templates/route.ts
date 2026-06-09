import { handler, ok } from "@/lib/http";
import { requireUser, ownedChannel } from "@/lib/auth";
import { query, one } from "@/lib/db";

export const runtime = "nodejs";

export const GET = handler(async (req) => {
  const user = await requireUser();
  const channelId = new URL(req.url).searchParams.get("channel") || "";
  await ownedChannel(user.id, channelId);
  const templates = await query(
    "SELECT id, channel_id, name, data, created_at, updated_at FROM templates WHERE channel_id=$1 ORDER BY updated_at DESC",
    [channelId]
  );
  return ok({ templates });
});

// Cria ou atualiza (upsert por nome dentro do canal).
export const POST = handler(async (req) => {
  const user = await requireUser();
  const { channelId, id, name, data } = await req.json();
  await ownedChannel(user.id, channelId);
  const nm = String(name || "").trim();
  if (!nm) throw new Error("Dê um nome ao template.");
  if (!data || !data.frame) throw new Error("Template sem arte-base.");

  if (id) {
    const tpl = await one(
      "UPDATE templates SET name=$1, data=$2, updated_at=now() WHERE id=$3 AND channel_id=$4 RETURNING id, channel_id, name, data, created_at, updated_at",
      [nm, data, id, channelId]
    );
    if (!tpl) throw new Error("Template não encontrado.");
    return ok({ template: tpl });
  }
  const existing = await one("SELECT id FROM templates WHERE channel_id=$1 AND name=$2", [channelId, nm]);
  if (existing) {
    const tpl = await one(
      "UPDATE templates SET data=$1, updated_at=now() WHERE id=$2 RETURNING id, channel_id, name, data, created_at, updated_at",
      [data, (existing as any).id]
    );
    return ok({ template: tpl });
  }
  const tpl = await one(
    "INSERT INTO templates (channel_id, name, data) VALUES ($1,$2,$3) RETURNING id, channel_id, name, data, created_at, updated_at",
    [channelId, nm, data]
  );
  return ok({ template: tpl });
});
