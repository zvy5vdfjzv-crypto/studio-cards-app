import { handler, ok } from "@/lib/http";
import { requireUser, ownedChannel } from "@/lib/auth";
import { query, one } from "@/lib/db";

export const runtime = "nodejs";

export const GET = handler(async (req) => {
  const user = await requireUser();
  const channelId = new URL(req.url).searchParams.get("channel") || "";
  await ownedChannel(user.id, channelId);
  const items = await query(
    `SELECT id, template_id, title, photo_credit, photo_source, image_url, ig_media_id, ig_published, created_at
     FROM history WHERE channel_id=$1 ORDER BY created_at DESC LIMIT 200`,
    [channelId]
  );
  return ok({ history: items });
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const { channelId, templateId, title, credit, source, imageUrl } = await req.json();
  await ownedChannel(user.id, channelId);
  const row = await one(
    `INSERT INTO history (channel_id, template_id, title, photo_credit, photo_source, image_url)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING id, title, photo_credit, photo_source, image_url, ig_published, created_at`,
    [channelId, templateId || null, String(title || ""), String(credit || ""), String(source || ""), imageUrl || null]
  );
  return ok({ item: row });
});
