import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function ok(data: any = {}, init?: ResponseInit) {
  return NextResponse.json({ ok: true, ...data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// Embrulha um handler, traduzindo erros (incl. AuthError -> 401).
export function handler(fn: (req: Request, ctx: any) => Promise<Response>) {
  return async (req: Request, ctx: any) => {
    try {
      return await fn(req, ctx);
    } catch (e: any) {
      if (e instanceof AuthError) return fail("Não autenticado.", 401);
      console.error("[api]", e?.message || e);
      return fail(e?.message || "Erro interno.", 500);
    }
  };
}
