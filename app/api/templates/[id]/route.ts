import { handler, ok } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { query, one } from "@/lib/db";

export const runtime = "nodejs";

// Garante que o template pertence a um canal do usuário.
async function owned(userId: string, templateId: string) {
  const row = await one(
    `SELECT t.id FROM templates t JOIN channels c ON c.id=t.channel_id
     WHERE t.id=$1 AND c.user_id=$2`,
    [templateId, userId]
  );
  if (!row) throw new Error("Template não encontrado.");
}

export const DELETE = handler(async (_req, { params }) => {
  const user = await requireUser();
  await owned(user.id, params.id);
  await query("DELETE FROM templates WHERE id=$1", [params.id]);
  return ok();
});
