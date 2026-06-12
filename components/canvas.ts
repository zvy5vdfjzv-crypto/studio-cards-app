// Lógica de render do card — PORTADA FIELMENTE do protótipo (renderCard/wrapL/auto-fit).
// Mantém: foto na zona (clip + cover) -> arte por cima quando photoBehind -> textos com auto-fit.
import type { TemplateData } from "@/lib/types";

export const FONTS = ["Inter", "Archivo", "Anton", "Oswald", "Montserrat", "Bebas Neue", "Playfair Display"];

export function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = url;
  });
}

let customFontSeq = 0;
const fontCache = new Map<string, string>();

// Carrega fonte custom (url ou data url) e devolve o family name a usar.
export async function ensureCustomFont(src: string | null | undefined): Promise<string | null> {
  if (!src) return null;
  if (fontCache.has(src)) return fontCache.get(src)!;
  const family = "CustomTpl" + ++customFontSeq;
  try {
    const face = new FontFace(family, `url(${src})`);
    await face.load();
    (document as any).fonts.add(face);
    fontCache.set(src, family);
    return family;
  } catch {
    return null;
  }
}

export function preloadGoogleFonts() {
  return Promise.all(
    FONTS.map((f) => {
      try {
        return (document as any).fonts.load(`800 64px "${f}"`);
      } catch {
        return null;
      }
    })
  );
}

function wrapL(ctx: CanvasRenderingContext2D, t: string, mw: number): string[] {
  const ws = (t || "").split(/\s+/);
  let l = "";
  const o: string[] = [];
  ws.forEach((w) => {
    const x = l ? l + " " + w : w;
    if (ctx.measureText(x).width > mw && l) {
      o.push(l);
      l = w;
    } else l = x;
  });
  if (l) o.push(l);
  return o;
}

export interface RenderInput {
  tpl: TemplateData;
  frameImg: HTMLImageElement | null;
  bgImg: HTMLImageElement | null;
  texts: (string | undefined)[];
  customFontFamily?: string | null;
  // ajuste de foto por card: zoom (>=1) e foco normalizado 0–1 (0=topo/esquerda, 1=baixo/direita)
  photoAdjust?: { zoom: number; fx: number; fy: number };
}

export function renderCard(canvas: HTMLCanvasElement, input: RenderInput) {
  const t = input.tpl;
  canvas.width = t.w;
  canvas.height = t.h;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, t.w, t.h);

  const drawPhoto = () => {
    if (!t.photoZone || !input.bgImg) return;
    const z = t.photoZone,
      zx = z.x * t.w,
      zy = z.y * t.h,
      zw = z.w * t.w,
      zh = z.h * t.h;
    ctx.save();
    ctx.beginPath();
    ctx.rect(zx, zy, zw, zh);
    ctx.clip();
    const adj = input.photoAdjust;
    const zoom = adj && adj.zoom > 0 ? adj.zoom : 1;
    const fx = adj ? Math.min(1, Math.max(0, adj.fx)) : 0.5;
    const fy = adj ? Math.min(1, Math.max(0, adj.fy)) : 0.5;
    const iw = input.bgImg.width,
      ih = input.bgImg.height,
      s = Math.max(zw / iw, zh / ih) * zoom,
      drawW = iw * s,
      drawH = ih * s,
      dx = zx - (drawW - zw) * fx,
      dy = zy - (drawH - zh) * fy;
    if (t.gray) ctx.filter = "grayscale(1) contrast(1.05)";
    ctx.drawImage(input.bgImg, dx, dy, drawW, drawH);
    ctx.filter = "none";
    ctx.restore();
  };
  const drawFrame = () => {
    if (input.frameImg) ctx.drawImage(input.frameImg, 0, 0, t.w, t.h);
  };

  if (t.photoBehind) {
    drawPhoto();
    drawFrame();
  } else {
    drawFrame();
    drawPhoto();
  }

  t.textZones.forEach((z, i) => {
    const txt = input.texts[i] != null ? input.texts[i] : z.sample;
    const val = z.upper ? (txt || "").toUpperCase() : txt || "";
    const fontFamily = z.font === "CustomTpl" ? input.customFontFamily || "Inter" : z.font;
    const ff = '"' + fontFamily + '"';
    const zx = z.x * t.w,
      zy = z.y * t.h,
      zw = z.w * t.w,
      zh = z.h * t.h,
      usable = zh * 0.9;
    let size: number, lines: string[];
    if (z.sizeMode === "fixed") {
      size = z.sizePx || 40;
      ctx.font = z.weight + " " + size + "px " + ff;
      lines = wrapL(ctx, val, zw);
    } else {
      size = usable;
      for (let k = 0; k < 28; k++) {
        ctx.font = z.weight + " " + size + "px " + ff;
        lines = wrapL(ctx, val, zw);
        if (lines.length * size * z.lh <= usable || size < 10) break;
        size *= 0.93;
      }
      lines = wrapL(ctx, val, zw);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(zx, zy - size * 0.15, zw, zh + size * 0.3);
    ctx.clip();
    ctx.fillStyle = z.color;
    ctx.textBaseline = "top";
    ctx.textAlign = z.align as CanvasTextAlign;
    const ax = z.align === "center" ? zx + zw / 2 : z.align === "right" ? zx + zw : zx;
    lines.forEach((ln, li) => ctx.fillText(ln, ax, zy + li * size * z.lh));
    ctx.restore();
  });
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((res) => {
    try {
      canvas.toBlob((b) => res(b), "image/png");
    } catch {
      res(null);
    }
  });
}
