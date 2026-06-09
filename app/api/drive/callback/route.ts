import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { verifyState, appUrl } from "@/lib/oauth";
import { driveExchange } from "@/lib/drive";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const back = (s: string) => NextResponse.redirect(`${appUrl()}/?drive=${s}`);

  if (searchParams.get("error")) return back("erro");
  const code = searchParams.get("code") || "";
  const st = verifyState(searchParams.get("state") || "");
  if (!code || !st || st.kind !== "drive") return back("estado_invalido");

  try {
    const user = await requireUser();
    if (user.id !== st.userId) return back("usuario_diferente");
    const { refreshToken } = await driveExchange(code);
    await query("UPDATE channels SET drive_refresh_token=$1 WHERE id=$2 AND user_id=$3", [
      refreshToken,
      st.channelId,
      user.id,
    ]);
    return back("ok");
  } catch (e: any) {
    console.error("[drive callback]", e?.message);
    return back("falhou");
  }
}
