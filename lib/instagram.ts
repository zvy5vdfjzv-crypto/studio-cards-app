import { appUrl } from "./oauth";

const GRAPH = "https://graph.facebook.com/v21.0";
export const IG_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
].join(",");

export function igRedirectUri() {
  return `${appUrl()}/api/instagram/callback`;
}

export function igAuthUrl(state: string) {
  const id = process.env.FACEBOOK_APP_ID;
  if (!id) throw new Error("FACEBOOK_APP_ID não configurado.");
  const p = new URLSearchParams({
    client_id: id,
    redirect_uri: igRedirectUri(),
    state,
    scope: IG_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${p}`;
}

async function gget(path: string, params: Record<string, string>) {
  const u = new URL(GRAPH + path);
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
  const r = await fetch(u.toString());
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || "Erro Graph API.");
  return d;
}

// code -> token longo + descobre a conta IG Business ligada a uma Página.
export async function igExchange(code: string) {
  const id = process.env.FACEBOOK_APP_ID!;
  const secret = process.env.FACEBOOK_APP_SECRET!;
  if (!id || !secret) throw new Error("Credenciais do Facebook ausentes.");

  const short = await gget("/oauth/access_token", {
    client_id: id,
    client_secret: secret,
    redirect_uri: igRedirectUri(),
    code,
  });
  const longLived = await gget("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: id,
    client_secret: secret,
    fb_exchange_token: short.access_token,
  });
  const userToken = longLived.access_token as string;
  const expiresIn = Number(longLived.expires_in || 5184000); // ~60d

  const pages = await gget("/me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    access_token: userToken,
  });
  const withIg = (pages.data || []).find((p: any) => p.instagram_business_account);
  if (!withIg) {
    throw new Error(
      "Nenhuma conta Instagram Business/Creator vinculada a uma Página do Facebook foi encontrada."
    );
  }
  return {
    igUserId: withIg.instagram_business_account.id as string,
    igUsername: (withIg.instagram_business_account.username as string) || "",
    pageId: withIg.id as string,
    pageAccessToken: withIg.access_token as string, // token longo da Página (publica)
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

// Quanto já foi publicado nas últimas 24h (limite oficial da conta).
export async function igPublishingLimit(igUserId: string, token: string): Promise<number | null> {
  try {
    const d = await gget(`/${igUserId}/content_publishing_limit`, {
      fields: "quota_usage,config",
      access_token: token,
    });
    return d.data?.[0]?.quota_usage ?? null;
  } catch {
    return null;
  }
}

// Cria container + publica. image_url precisa ser HTTPS público.
export async function igPublish(opts: {
  igUserId: string;
  token: string;
  imageUrl: string;
  caption: string;
}): Promise<string> {
  const create = await fetch(`${GRAPH}/${opts.igUserId}/media`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ image_url: opts.imageUrl, caption: opts.caption, access_token: opts.token }),
  }).then((r) => r.json());
  if (create.error) throw new Error(create.error.message || "Falha ao criar mídia.");

  const publish = await fetch(`${GRAPH}/${opts.igUserId}/media_publish`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ creation_id: create.id, access_token: opts.token }),
  }).then((r) => r.json());
  if (publish.error) throw new Error(publish.error.message || "Falha ao publicar.");
  return publish.id as string;
}
