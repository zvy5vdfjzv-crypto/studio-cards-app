import { handler, ok } from "@/lib/http";
import { requireUser, ownedChannel } from "@/lib/auth";
import { query } from "@/lib/db";
import { chatAssistant, type AssistantTurn } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = handler(async (req) => {
  const user = await requireUser();
  const { messages, channelId } = await req.json();

  let templates: string[] = [];
  if (channelId) {
    await ownedChannel(user.id, channelId);
    const rows = await query<{ name: string }>(
      "SELECT name FROM templates WHERE channel_id=$1 ORDER BY updated_at DESC",
      [channelId]
    );
    templates = rows.map((r) => r.name);
  }

  const turns: AssistantTurn[] = (Array.isArray(messages) ? messages : [])
    .map(
      (m: any): AssistantTurn => ({
        role: m?.role === "assistant" ? "assistant" : "user",
        content: String(m?.content || ""),
      })
    )
    .slice(-20);

  if (!turns.length) throw new Error("Mensagem vazia.");
  const result = await chatAssistant({ messages: turns, templates });
  return ok({ result });
});
