import { handler, ok } from "@/lib/http";
import { requireUser, ownedChannel } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  const user = await requireUser();
  const { channelId } = await req.json();
  await ownedChannel(user.id, channelId);
  await query(
    "UPDATE channels SET ig_user_id=NULL, ig_username=NULL, ig_page_id=NULL, ig_access_token=NULL, ig_token_expires_at=NULL WHERE id=$1",
    [channelId]
  );
  return ok();
});
