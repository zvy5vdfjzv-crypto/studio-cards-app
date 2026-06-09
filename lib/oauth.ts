import { createHmac, timingSafeEqual } from "crypto";

const SECRET = () => process.env.SESSION_SECRET || "dev-secret-change-me";

// state assinado p/ OAuth: carrega o channelId e impede CSRF/adulteração.
export function signState(payload: Record<string, string>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET()).update(body).digest("base64url").slice(0, 24);
  return `${body}.${sig}`;
}

export function verifyState(state: string): Record<string, string> | null {
  const [body, sig] = (state || "").split(".");
  if (!body || !sig) return null;
  const good = createHmac("sha256", SECRET()).update(body).digest("base64url").slice(0, 24);
  const a = Buffer.from(good);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    return null;
  }
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}
