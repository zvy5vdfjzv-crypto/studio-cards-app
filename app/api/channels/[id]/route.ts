import { handler, ok } from "@/lib/http";
import { requireUser, ownedChannel } from "@/lib/auth";
import { query, one } from "@/lib/db";

export const runtime = "nodejs";

export const PATCH = handler(async (req, { params }) => {
  const user = await requireUser();
  await ownedChannel(user.id, params.id);
  const { name } = await req.json();
  const nm = String(name || "").trim();
  if (!nm) throw new Error("Nome inválido.");
  const ch = await one("UPDATE channels SET name=$1 WHERE id=$2 RETURNING id, name, slug", [nm, params.id]);
  return ok({ channel: ch });
});

export const DELETE = handler(async (_req, { params }) => {
  const user = await requireUser();
  await ownedChannel(user.id, params.id);
  await query("DELETE FROM channels WHERE id=$1", [params.id]);
  return ok();
});
