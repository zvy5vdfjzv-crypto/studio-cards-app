import { NextResponse } from "next/server";
import { fail } from "@/lib/http";
import { requireUser, ownedChannel, AuthError } from "@/lib/auth";
import { signState } from "@/lib/oauth";
import { driveAuthUrl } from "@/lib/drive";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const channelId = new URL(req.url).searchParams.get("channel") || "";
    await ownedChannel(user.id, channelId);
    const state = signState({ channelId, userId: user.id, kind: "drive" });
    return NextResponse.redirect(driveAuthUrl(state));
  } catch (e: any) {
    if (e instanceof AuthError) return fail("Não autenticado.", 401);
    return fail(e?.message || "Erro ao iniciar conexão.", 500);
  }
}
