import { handler, ok } from "@/lib/http";
import { currentUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const features = {
    ai: !!process.env.ANTHROPIC_API_KEY,
    assistant: !!process.env.GEMINI_API_KEY,
    instagram: !!process.env.FACEBOOK_APP_ID,
    drive: !!process.env.GOOGLE_CLIENT_ID,
  };
  const user = await currentUser();
  if (!user) return ok({ user: null, channels: [], features });
  const channels = await query(
    `SELECT id, user_id, name, slug, ig_user_id, ig_username, ig_page_id, ig_token_expires_at,
            drive_folder_id, (drive_refresh_token IS NOT NULL) AS drive_connected, created_at
     FROM channels WHERE user_id=$1 ORDER BY created_at`,
    [user.id]
  );
  return ok({ user, channels, features });
});
