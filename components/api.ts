// Cliente de API tipado (same-origin, cookie de sessão).

async function req(method: string, url: string, body?: any): Promise<any> {
  const opts: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    (opts.headers as any)["content-type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(url, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok || d.ok === false) throw new Error(d.error || `Erro ${r.status}`);
  return d;
}

export const api = {
  get: (url: string) => req("GET", url),
  post: (url: string, body?: any) => req("POST", url, body),
  patch: (url: string, body?: any) => req("PATCH", url, body),
  del: (url: string) => req("DELETE", url),
  async upload(channelId: string, kind: string, file: Blob, filename: string): Promise<{ url: string; persisted: boolean }> {
    const fd = new FormData();
    fd.append("file", file, filename);
    fd.append("channelId", channelId);
    fd.append("kind", kind);
    const r = await fetch("/api/assets", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.ok === false) throw new Error(d.error || "Falha no upload.");
    return { url: d.url, persisted: d.persisted };
  },
};
