import { handler, ok } from "@/lib/http";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = handler(async () => {
  await destroySession();
  return ok();
});
