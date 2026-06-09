import { handler, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { generateCards } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handler(async (req) => {
  await requireUser();
  const { content, n, webSearch, model } = await req.json();
  if (!content || !String(content).trim()) throw new Error("Escreva o conteúdo/assunto.");
  const cards = await generateCards({
    content: String(content),
    n: Number(n) || 10,
    webSearch: webSearch !== false,
    model: model ? String(model) : undefined,
  });
  return ok({ cards });
});
