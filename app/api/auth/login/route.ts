import { handler, ok } from "@/lib/http";
import { login, createSession } from "@/lib/auth";

export const runtime = "nodejs";

export const POST = handler(async (req) => {
  const { email, password } = await req.json();
  const user = await login(String(email || ""), String(password || ""));
  await createSession(user.id);
  return ok({ user });
});
