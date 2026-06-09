import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { verifyState, appUrl } from "@/lib/oauth";
import { igExchange } from "@/lib/instagram";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const back = (ok: string) => NextResponse.redirect(`${appUrl()}/?ig=${ok}`);

  const error = searchParams.get("error");
  if (error) return back("erro");
  const code = searchParams.get("code") || "";
  const st = verifyState(searchParams.get("state") || "");
  if (!code || !st || st.kind !== "ig") return back("estado_invalido");

  try {
    const user = await requireUser();
    if (user.id !== st.userId) return back("usuario_diferente");
    const r = await igExchange(code);
    await query(
      `UPDATE channels SET ig_user_id=$1, ig_username=$2, ig_page_id=$3, ig_access_token=$4, ig_token_expires_at=$5
       WHERE id=$6 AND user_id=$7`,
      [r.igUserId, r.igUsername, r.pageId, r.pageAccessToken, r.expiresAt, st.channelId, user.id]
    );
    return back("ok");
  } catch (e: any) {
    console.error("[ig callback]", e?.message);
    return back("falhou");
  }
}
