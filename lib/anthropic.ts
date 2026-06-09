import type { AiCard } from "./types";

const API = "https://api.anthropic.com/v1/messages";

// Proxy server-side: a chave nunca chega ao browser. Texto sempre ORIGINAL.
export async function generateCards(opts: {
  content: string;
  n: number;
  webSearch: boolean;
  model?: string;
}): Promise<AiCard[]> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");
  const model = opts.model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
  const n = Math.max(1, Math.min(20, opts.n || 10));
  const today = new Date().toLocaleDateString("pt-BR");

  const prompt =
    `Pedido/tema:\n"""${opts.content}"""\n\n` +
    `Hoje é ${today}. Pesquise as notícias MAIS RECENTES (de hoje ou desta semana) sobre esse tema, ` +
    `priorizando portais de notícia/fofoca confiáveis. Com base nos fatos mais frescos que encontrar, gere ${n} ` +
    `cards de rede social. Cada manchete deve ser ESCRITA COM SUAS PRÓPRIAS PALAVRAS, resumindo o fato — ` +
    `NÃO copie nem reproduza frases, trechos ou títulos das matérias. Prefira fatos novos a assuntos genéricos. ` +
    `Responda SOMENTE com um array JSON, sem markdown: ` +
    `[{"title":"manchete original em até 14 palavras","source":"nome curto do veículo","photo_query":"nome simples da pessoa/assunto p/ foto"}]`;

  const body: any = { model, max_tokens: 2000, messages: [{ role: "user", content: prompt }] };
  if (opts.webSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];

  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  if (data.error) throw new Error(data.error.message || "Erro da API Anthropic.");

  const txt = (data.content || [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();
  const m = txt.match(/\[[\s\S]*\]/);
  const arr = JSON.parse(m ? m[0] : txt);
  return (Array.isArray(arr) ? arr : []).map((c: any) => ({
    title: String(c.title || ""),
    source: String(c.source || ""),
    photo_query: String(c.photo_query || ""),
  }));
}
