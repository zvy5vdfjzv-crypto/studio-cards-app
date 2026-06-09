import { handler, ok } from "@/lib/http";
import { requireUser, ownedChannel } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { isPublicUrl } from "@/lib/blob";
import { igPublish, igPublishingLimit } from "@/lib/instagram";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handler(async (req) => {
  const user = await requireUser();
  const { channelId, imageUrl, caption, historyId } = await req.json();
  const ch: any = await ownedChannel(user.id, channelId);

  if (!ch.ig_access_token || !ch.ig_user_id) throw new Error("Canal não está conectado ao Instagram.");
  if (ch.ig_token_expires_at && new Date(ch.ig_token_expires_at) < new Date())
    throw new Error("Token do Instagram expirou. Reconecte o canal.");
  if (!imageUrl || !isPublicUrl(imageUrl))
    throw new Error("A imagem precisa estar em URL pública (configure o Vercel Blob para publicar).");

  // Limite ~25–100/24h: checa nosso histórico e, se possível, o limite oficial da conta.
  const cap = Math.max(1, Math.min(100, Number(process.env.IG_DAILY_LIMIT) || 25));
  const recent = await one<{ c: string }>(
    "SELECT count(*)::int AS c FROM history WHERE channel_id=$1 AND ig_published=true AND created_at > now() - interval '24 hours'",
    [channelId]
  );
  const localCount = Number(recent?.c || 0);
  const apiUsage = await igPublishingLimit(ch.ig_user_id, ch.ig_access_token);
  const used = Math.max(localCount, apiUsage ?? 0);
  if (used >= cap) throw new Error(`Limite diário atingido (${used}/${cap} em 24h). Tente mais tarde.`);

  const mediaId = await igPublish({
    igUserId: ch.ig_user_id,
    token: ch.ig_access_token,
    imageUrl,
    caption: String(caption || ""),
  });

  if (historyId) {
    await query("UPDATE history SET ig_published=true, ig_media_id=$1 WHERE id=$2 AND channel_id=$3", [
      mediaId,
      historyId,
      channelId,
    ]);
  } else {
    await query(
      "INSERT INTO history (channel_id, title, image_url, ig_media_id, ig_published) VALUES ($1,$2,$3,$4,true)",
      [channelId, String(caption || "").slice(0, 200), imageUrl, mediaId]
    );
  }
  return ok({ mediaId, used: used + 1, cap });
});
