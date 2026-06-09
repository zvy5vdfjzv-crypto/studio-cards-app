import { handler, ok } from "@/lib/http";
import { requireUser, ownedChannel } from "@/lib/auth";
import { one } from "@/lib/db";
import { upload } from "@/lib/blob";

export const runtime = "nodejs";
export const maxDuration = 60;

// Upload de arte-base / fonte / logo / card final. Devolve URL pública (Blob) ou data URL (fallback).
export const POST = handler(async (req) => {
  const user = await requireUser();
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const channelId = String(form.get("channelId") || "");
  const kind = String(form.get("kind") || "frame");
  if (!file) throw new Error("Arquivo ausente.");
  await ownedChannel(user.id, channelId);

  const buf = Buffer.from(await file.arrayBuffer());
  const safe = (file.name || kind).replace(/[^a-zA-Z0-9._-]/g, "_");
  const { url, persisted } = await upload(`${channelId}/${kind}/${safe}`, buf, file.type || "application/octet-stream");

  const asset = await one(
    "INSERT INTO assets (channel_id, kind, filename, mime, url) VALUES ($1,$2,$3,$4,$5) RETURNING id, kind, filename, mime, url, created_at",
    [channelId, kind, file.name || "", file.type || "", url]
  );
  return ok({ asset, url, persisted });
});
