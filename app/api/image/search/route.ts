import { handler, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { searchSource, bestPhoto, proxied } from "@/lib/images";
import type { ImageResult } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// Reescreve url/thumb para o caminho same-origin assinado (canvas sem CORS).
function serialize(r: ImageResult) {
  return { ...r, url: proxied(r.url), thumb: proxied(r.thumb) };
}

export const GET = handler(async (req) => {
  await requireUser();
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const source = searchParams.get("source") || "";
  if (!q) throw new Error("Informe um termo de busca.");

  // Sem fonte explícita = cascata da geração em lote (escolhe a melhor + retorna lista).
  if (!source) {
    const { chosen, results } = await bestPhoto(q);
    return ok({ chosen: chosen ? serialize(chosen) : null, results: results.map(serialize) });
  }
  const results = await searchSource(source, q, 12);
  return ok({ results: results.map(serialize) });
});
