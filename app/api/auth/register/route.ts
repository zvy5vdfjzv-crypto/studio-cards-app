import { handler, ok } from "@/lib/http";
import { register, createSession } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  const { email, password, name } = await req.json();
  const user = await register(String(email || ""), String(password || ""), String(name || ""));
  await createSession(user.id);
  return ok({ user });
});
