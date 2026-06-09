import { fail } from "@/lib/http";
import { verifyUrl, isBlockedHost } from "@/lib/images";

export const runtime = "nodejs";

// Baixa a imagem no servidor e serve same-origin -> canvas não fica "tainted",
// exporta PNG de qualquer fonte. Só baixa URLs assinadas pela nossa busca (anti-SSRF).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const u = searchParams.get("u") || "";
  const s = searchParams.get("s") || "";
  if (!u || !verifyUrl(u, s)) return fail("Assinatura inválida.", 403);

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return fail("URL inválida.", 400);
  }
  if (!/^https?:$/.test(target.protocol) || isBlockedHost(target.hostname)) {
    return fail("Host não permitido.", 403);
  }

  try {
    const r = await fetch(target.toString(), {
      headers: { "User-Agent": "estudio-cards/1.0 (+image-proxy)", Accept: "image/*" },
      redirect: "follow",
    });
    if (!r.ok || !r.body) return fail("Falha ao baixar imagem.", 502);
    const ct = r.headers.get("content-type") || "image/jpeg";
    if (!/^image\//i.test(ct)) return fail("O recurso não é uma imagem.", 415);
    return new Response(r.body, {
      headers: {
        "content-type": ct,
        "cache-control": "public, max-age=86400, immutable",
        "access-control-allow-origin": "*",
      },
    });
  } catch {
    return fail("Erro ao baixar imagem.", 502);
  }
}
