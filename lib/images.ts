import { createHmac, timingSafeEqual } from "crypto";
import type { ImageResult } from "./types";

const SECRET = () => process.env.SESSION_SECRET || "dev-secret-change-me";

// ---- Assinatura de URL: o proxy só baixa o que nossas buscas voucharam (anti-SSRF) ----
export function signUrl(url: string): string {
  return createHmac("sha256", SECRET()).update(url).digest("hex").slice(0, 32);
}
export function verifyUrl(url: string, sig: string): boolean {
  const good = signUrl(url);
  const a = Buffer.from(good);
  const b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}
// Caminho same-origin que o canvas usa como src (sem CORS, sem taint).
export function proxied(url: string): string {
  return `/api/image/proxy?u=${encodeURIComponent(url)}&s=${signUrl(url)}`;
}

// Defesa em profundidade: bloqueia hosts privados/loopback no proxy.
export function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h.endsWith(".local") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    h === "0.0.0.0" ||
    h === "[::1]"
  );
}

const BADPIC =
  /cleat|boot|chuteira|sapato|shoe|logo|signature|assinatura|coat of arms|bras[aã]o|\bflag\b|bandeira|\bmap\b|mapa|stadium|est[aá]dio|arena|jersey|\bkit\b|camisa|trophy|trof[eé]u|medal|medalha|stamp|\bselo\b|poster|cartaz|capa|cover|building|pr[eé]dio|street|rua|aerial|placa|sign|escudo|badge/i;

const strip = (s: string) => (s || "").replace(/<[^>]+>/g, "").trim();

// Retrato principal da Wikipedia (melhor p/ nomes de pessoas).
export async function wikiPortrait(term: string): Promise<ImageResult | null> {
  for (const lang of ["pt", "en"]) {
    try {
      const u = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageimages&piprop=original&titles=${encodeURIComponent(term)}`;
      const d = await (await fetch(u)).json();
      const pages = d.query?.pages ? Object.values<any>(d.query.pages) : [];
      for (const p of pages) {
        if (p.original?.source) {
          const src = p.original.source as string;
          let author = "", lic = "Wikimedia";
          try {
            const fn = decodeURIComponent(src.split("/").pop() || "");
            const cu = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=File:${encodeURIComponent(fn)}`;
            const cd = await (await fetch(cu)).json();
            const cp = cd.query?.pages ? Object.values<any>(cd.query.pages)[0] : null;
            const ex = cp?.imageinfo?.[0]?.extmetadata;
            if (ex) {
              author = strip(ex.Artist?.value || "");
              lic = ex.LicenseShortName?.value || "Wikimedia";
            }
          } catch {}
          return { url: src, thumb: src, author, lic, source: "wikipedia" };
        }
      }
    } catch {}
  }
  return null;
}

export async function commons(q: string, n = 12): Promise<ImageResult[]> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent("filetype:bitmap " + q)}&gsrnamespace=6&gsrlimit=${n}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320`;
  const d = await (await fetch(url)).json();
  const pg = d.query?.pages ? Object.values<any>(d.query.pages) : [];
  pg.sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = pg
    .map((p) => {
      const ii = p.imageinfo?.[0];
      if (!ii) return null;
      const ex = ii.extmetadata || {};
      const title = (p.title || "").replace(/^File:/, "");
      return {
        url: ii.url,
        thumb: ii.thumburl || ii.url,
        author: strip(ex.Artist?.value || ""),
        lic: ex.LicenseShortName?.value || "livre",
        source: "wikimedia",
        bad: BADPIC.test(title),
      } as ImageResult;
    })
    .filter(Boolean) as ImageResult[];
  return out.sort((a, b) => (a.bad ? 1 : 0) - (b.bad ? 1 : 0));
}

export async function openverse(q: string, n = 12): Promise<ImageResult[]> {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=${n}&license_type=all-cc`;
  const d = await (await fetch(url, { headers: { "User-Agent": "estudio-cards/1.0" } })).json();
  return (d.results || []).map((it: any) => ({
    url: it.url,
    thumb: it.thumbnail || it.url,
    author: it.creator || "",
    lic: ((it.license || "CC") + "").toUpperCase() + (it.license_version ? " " + it.license_version : ""),
    source: "openverse",
  }));
}

export async function pexels(q: string, n = 12): Promise<ImageResult[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=${n}&orientation=portrait`;
  const d = await (await fetch(url, { headers: { Authorization: key } })).json();
  return (d.photos || []).map((p: any) => ({
    url: p.src?.large2x || p.src?.large || p.src?.original,
    thumb: p.src?.medium || p.src?.small,
    author: p.photographer || "",
    lic: "Pexels License",
    source: "pexels",
  }));
}

export async function unsplash(q: string, n = 12): Promise<ImageResult[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${n}&orientation=portrait`;
  const d = await (await fetch(url, { headers: { Authorization: `Client-ID ${key}` } })).json();
  return (d.results || []).map((p: any) => ({
    url: p.urls?.full || p.urls?.regular,
    thumb: p.urls?.small || p.urls?.thumb,
    author: p.user?.name || "",
    lic: "Unsplash License",
    source: "unsplash",
  }));
}

const PROVIDERS: Record<string, (q: string, n?: number) => Promise<ImageResult[]>> = {
  wikimedia: commons,
  openverse,
  pexels,
  unsplash,
};

// Busca agregada por fonte específica (usado pelo "trocar foto").
export async function searchSource(source: string, q: string, n = 12): Promise<ImageResult[]> {
  if (source === "wikipedia") {
    const p = await wikiPortrait(q);
    return p ? [p] : [];
  }
  const fn = PROVIDERS[source];
  return fn ? fn(q, n) : [];
}

// Cascata da geração em lote: retrato Wikipedia -> Commons -> Openverse -> Pexels -> Unsplash.
export async function bestPhoto(q: string): Promise<{ chosen: ImageResult | null; results: ImageResult[] }> {
  const results: ImageResult[] = [];
  const wp = await wikiPortrait(q).catch(() => null);
  if (wp) results.push(wp);
  for (const src of ["wikimedia", "openverse", "pexels", "unsplash"] as const) {
    try {
      const r = await PROVIDERS[src](q, 8);
      results.push(...r);
    } catch {}
    if (results.length >= 4) break;
  }
  return { chosen: results[0] || null, results };
}
