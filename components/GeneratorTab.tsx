"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import { ensureCustomFont, loadImg, renderCard, canvasToBlob } from "./canvas";
import type { Channel, ImageResult, TemplateData, TemplateRecord } from "@/lib/types";

interface GenCard {
  id: number;
  texts: (string | undefined)[];
  query: string;
  credit: string;
  source: string;
  bgUrl: string | null;
  results: ImageResult[];
  state: "idle" | "busy" | "ok" | "warn";
  published: boolean;
  adjust: { zoom: number; fx: number; fy: number };
}

export default function GeneratorTab({
  channel,
  templates,
  prefill,
  desiredTemplate,
  runSignal,
}: {
  channel: Channel;
  templates: TemplateRecord[];
  prefill: string;
  desiredTemplate?: string | null;
  runSignal?: number;
}) {
  const [tplId, setTplId] = useState<string>(templates[0]?.id || "");
  const [input, setInput] = useState(prefill || "");
  const [maxN, setMaxN] = useState(10);
  const [cards, setCards] = useState<GenCard[]>([]);
  const [status, setStatus] = useState<{ k: string; t: string }>({ k: "", t: "" });
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const stopRef = useRef(false);

  const tpl = useMemo<TemplateData | null>(() => templates.find((t) => t.id === tplId)?.data || null, [templates, tplId]);
  const frameRef = useRef<HTMLImageElement | null>(null);
  const fontRef = useRef<string | null>(null);

  useEffect(() => {
    if (prefill) setInput(prefill);
  }, [prefill]);
  useEffect(() => {
    if (!templates.find((t) => t.id === tplId)) setTplId(templates[0]?.id || "");
  }, [templates, tplId]);

  // Auto-geração disparada pelo assistente IA (runSignal incrementa a cada pedido).
  useEffect(() => {
    if (!runSignal) return;
    const matched = desiredTemplate
      ? templates.find((t) => t.name.toLowerCase() === desiredTemplate.toLowerCase())
      : undefined;
    const useId = matched?.id || tplId || templates[0]?.id || "";
    if (useId && useId !== tplId) setTplId(useId);
    if (prefill) setInput(prefill);
    run(prefill, useId || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSignal]);

  // pré-carrega arte + fonte do template selecionado
  useEffect(() => {
    frameRef.current = null;
    fontRef.current = null;
    if (tpl) {
      loadImg(tpl.frame).then((im) => (frameRef.current = im)).catch(() => {});
      ensureCustomFont(tpl.fontData).then((f) => (fontRef.current = f));
    }
  }, [tpl]);

  const fields = tpl?.textZones.map((z) => z.key).join(" · ") || "";

  async function run(overrideText?: string, overrideTplId?: string) {
    const useTpl: TemplateData | null = overrideTplId
      ? templates.find((t) => t.id === overrideTplId)?.data || null
      : tpl;
    if (!useTpl) return setStatus({ k: "err", t: "Escolha um template." });
    const text = overrideText ?? input;
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const items = lines.slice(0, Math.max(1, Math.min(20, maxN)));
    if (!items.length) return setStatus({ k: "err", t: "Cole pelo menos uma linha." });

    // Override de template (assistente) força recarregar arte/fonte corretas.
    if (overrideTplId) {
      frameRef.current = await loadImg(useTpl.frame).catch(() => null);
      fontRef.current = await ensureCustomFont(useTpl.fontData);
    } else {
      if (!frameRef.current) frameRef.current = await loadImg(useTpl.frame).catch(() => null);
      if (!fontRef.current) fontRef.current = await ensureCustomFont(useTpl.fontData);
    }

    stopRef.current = false;
    setRunning(true);
    setProgress(0);

    const fresh: GenCard[] = items.map((line, i) => {
      const parts = line.split(";").map((s) => s.trim());
      const texts = useTpl.textZones.map((_, zi) => (zi === 0 ? parts[0] : parts[zi + 1]));
      return {
        id: i + 1,
        texts,
        query: parts[1] || parts[0],
        credit: "",
        source: parts[parts.length - 1] || "",
        bgUrl: null,
        results: [],
        state: "idle",
        published: false,
        adjust: { zoom: 1, fx: 0.5, fy: 0.5 },
      };
    });
    setCards(fresh);

    for (let i = 0; i < fresh.length; i++) {
      if (stopRef.current) break;
      setStatus({ k: "busy", t: `Buscando foto ${i + 1}/${fresh.length}…` });
      if (useTpl.photoZone) {
        try {
          const d = await api.get("/api/image/search?q=" + encodeURIComponent(fresh[i].query));
          const chosen: ImageResult | null = d.chosen;
          fresh[i].results = d.results || [];
          if (chosen) {
            fresh[i].bgUrl = chosen.url;
            fresh[i].credit = (chosen.author ? chosen.author + " / " : "") + chosen.lic;
            fresh[i].source = chosen.source;
            fresh[i].state = "ok";
          } else fresh[i].state = "warn";
        } catch {
          fresh[i].state = "warn";
        }
      } else fresh[i].state = "ok";
      setCards([...fresh]);
      setProgress(((i + 1) / fresh.length) * 100);
    }
    setRunning(false);
    setStatus({ k: "ok", t: fresh.filter((c) => !stopRef.current).length + " card(s) gerados." });
  }

  function patch(id: number, p: Partial<GenCard>) {
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));
  }

  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  async function zipAll() {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    let ok = 0,
      sk = 0;
    for (const c of cards) {
      const cv = canvasRefs.current.get(c.id);
      if (!cv) {
        sk++;
        continue;
      }
      const b = await canvasToBlob(cv);
      if (b) {
        zip.file("card_" + c.id + ".png", b);
        ok++;
      } else sk++;
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "cards_" + Date.now() + ".zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    setStatus({ k: "ok", t: `ZIP: ${ok} card(s)` + (sk ? ` (${sk} sem foto)` : "") + "." });
  }

  return (
    <>
      <div className="card">
        <div className="h">ESCOLHER TEMPLATE</div>
        <div className="b">
          <div className="ctl">
            modelo
            <select value={tplId} onChange={(e) => setTplId(e.target.value)}>
              {templates.length === 0 && <option value="">— salve um template primeiro —</option>}
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {tpl && (
            <div className="hint">
              Formato {tpl.w}×{tpl.h} · campos na ordem: {fields || "(nenhum)"} · a foto entra na zona marcada.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="h">
          ENTRADA EM MASSA <span className="mini">uma por linha · texto1 ; termo da foto ; texto2 ; …</span>
        </div>
        <div className="b">
          <textarea
            rows={6}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              "Pink decolou como Peter Pan na Broadway ; Pink singer ; Hollywood Reporter\nCadeira de Taylor Swift vira relíquia nos playoffs ; Taylor Swift ; E! News"
            }
          />
          <div className="gen-actions" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}>
            <div className="ctl" style={{ margin: 0 }}>
              qtd. máx.
              <input type="number" value={maxN} onChange={(e) => setMaxN(parseInt(e.target.value) || 10)} style={{ width: 80 }} />
            </div>
            <button className="btn solid" disabled={running || !tpl} onClick={() => run()}>
              {running ? <span className="spin" /> : "✦ GERAR LOTE"}
            </button>
            {running && (
              <button className="btn sm" onClick={() => (stopRef.current = true)}>
                parar
              </button>
            )}
          </div>
          {(running || progress > 0) && (
            <div className={"progress show"}>
              <i style={{ width: progress + "%" }} />
            </div>
          )}
          {status.t && <div className={"status " + status.k}>{status.t}</div>}
        </div>
      </div>

      <div className="card">
        <div className="h">
          FILA DE REVISÃO <span className="mini">{cards.length}</span>
          <button className="btn gold sm" disabled={!cards.length} onClick={zipAll}>
            ⬇ ZIP
          </button>
        </div>
        <div className="b">
          {cards.length === 0 ? (
            <div className="empty">Gere um lote aqui.</div>
          ) : (
            <div className="gallery">
              {tpl &&
                cards.map((c) => (
                  <CardItem
                    key={c.id}
                    card={c}
                    tpl={tpl}
                    channel={channel}
                    templateId={tplId}
                    frameRef={frameRef}
                    fontRef={fontRef}
                    registerCanvas={(el) => {
                      if (el) canvasRefs.current.set(c.id, el);
                      else canvasRefs.current.delete(c.id);
                    }}
                    patch={(p) => patch(c.id, p)}
                  />
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CardItem({
  card,
  tpl,
  channel,
  templateId,
  frameRef,
  fontRef,
  registerCanvas,
  patch,
}: {
  card: GenCard;
  tpl: TemplateData;
  channel: Channel;
  templateId: string;
  frameRef: React.MutableRefObject<HTMLImageElement | null>;
  fontRef: React.MutableRefObject<string | null>;
  registerCanvas: (el: HTMLCanvasElement | null) => void;
  patch: (p: Partial<GenCard>) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLImageElement | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [q, setQ] = useState(card.query);
  const [src, setSrc] = useState("wikipedia");
  const [thumbs, setThumbs] = useState<ImageResult[]>(card.results);
  const [pubBusy, setPubBusy] = useState(false);
  const [pubMsg, setPubMsg] = useState("");

  // (re)render quando textos / foto mudam
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (card.bgUrl) {
        try {
          bgRef.current = await loadImg(card.bgUrl);
        } catch {
          bgRef.current = null;
        }
      } else bgRef.current = null;
      if (cancelled || !canvasRef.current) return;
      renderCard(canvasRef.current, {
        tpl,
        frameImg: frameRef.current,
        bgImg: bgRef.current,
        texts: card.texts,
        customFontFamily: fontRef.current,
        photoAdjust: card.adjust,
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.bgUrl, card.texts.join(""), tpl, card.adjust.zoom, card.adjust.fx, card.adjust.fy]);

  useEffect(() => {
    registerCanvas(canvasRef.current);
    return () => registerCanvas(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search() {
    if (!q.trim()) return;
    setThumbs([]);
    try {
      const d = await api.get(`/api/image/search?q=${encodeURIComponent(q)}&source=${src}`);
      setThumbs(d.results || []);
    } catch {
      setThumbs([]);
    }
  }

  function pick(it: ImageResult) {
    patch({ bgUrl: it.url, credit: (it.author ? it.author + " / " : "") + it.lic, source: it.source, adjust: { zoom: 1, fx: 0.5, fy: 0.5 } });
  }

  function uploadOwn(file: File) {
    const url = URL.createObjectURL(file);
    patch({ bgUrl: url, credit: "foto própria", source: "upload", adjust: { zoom: 1, fx: 0.5, fy: 0.5 } });
  }

  function download() {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.toBlob((b) => {
      if (!b) return alert("Bloqueado. Troque a imagem.");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "card_" + card.id + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, "image/png");
  }

  async function publish() {
    const cv = canvasRef.current;
    if (!cv) return;
    setPubBusy(true);
    setPubMsg("");
    try {
      const blob = await canvasToBlob(cv);
      if (!blob) throw new Error("Não foi possível exportar o card.");
      const up = await api.upload(channel.id, "card", blob, "card_" + card.id + ".png");
      if (!up.persisted) throw new Error("Configure o Vercel Blob: o Instagram exige imagem em URL pública.");
      const caption =
        (card.texts.filter(Boolean).join(" ") || "").trim() + (card.credit ? `\n\nFoto: ${card.credit}` : "");
      const r = await api.post("/api/instagram/publish", {
        channelId: channel.id,
        imageUrl: up.url,
        caption,
      });
      patch({ published: true });
      setPubMsg(`Publicado! (${r.used}/${r.cap} em 24h)`);
    } catch (e: any) {
      setPubMsg(e.message);
    }
    setPubBusy(false);
  }

  const igReady = !!channel.ig_user_id;

  return (
    <div className="item">
      <div className="prev">
        <canvas ref={canvasRef} />
      </div>
      <div className="meta">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span className="lbl">Card {card.id}</span>
          <span className={"badge " + (card.published ? "pub" : card.state === "ok" ? "ok" : card.state === "warn" ? "warn" : "")}>
            {card.published ? "publicado" : card.state === "ok" ? "pronto" : card.state === "warn" ? (tpl.photoZone ? "sem foto" : "ok") : "…"}
          </span>
        </div>
        {tpl.textZones.map((z, i) => (
          <div key={i}>
            <span className="lbl">{z.key || "texto" + (i + 1)}</span>
            <textarea
              value={card.texts[i] ?? z.sample}
              onChange={(e) => {
                const texts = [...card.texts];
                texts[i] = e.target.value;
                patch({ texts });
              }}
            />
          </div>
        ))}
        <div className="credit">{card.credit ? "Foto: " + card.credit : ""}</div>
        {tpl.photoZone && card.bgUrl && (
          <div className="adjust">
            <div className="adjrow">
              <span className="lbl">zoom</span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.02}
                value={card.adjust.zoom}
                onChange={(e) => patch({ adjust: { ...card.adjust, zoom: parseFloat(e.target.value) } })}
              />
            </div>
            <div className="adjrow">
              <span className="lbl">↔ horizontal</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={card.adjust.fx}
                onChange={(e) => patch({ adjust: { ...card.adjust, fx: parseFloat(e.target.value) } })}
              />
            </div>
            <div className="adjrow">
              <span className="lbl">↕ vertical</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={card.adjust.fy}
                onChange={(e) => patch({ adjust: { ...card.adjust, fy: parseFloat(e.target.value) } })}
              />
            </div>
            {(card.adjust.zoom !== 1 || card.adjust.fx !== 0.5 || card.adjust.fy !== 0.5) && (
              <button
                className="btn sm"
                onClick={() => patch({ adjust: { zoom: 1, fx: 0.5, fy: 0.5 } })}
              >
                centralizar
              </button>
            )}
          </div>
        )}
        <div className="row">
          <button className="btn sm" onClick={() => { setShowSearch(!showSearch); setThumbs(card.results); }}>
            trocar foto
          </button>
          <label className="btn sm" style={{ cursor: "pointer" }}>
            subir foto
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && uploadOwn(e.target.files[0])} />
          </label>
          <button className="btn sm" onClick={download}>
            baixar
          </button>
        </div>
        {igReady && (
          <button className="btn sm ok" disabled={pubBusy || card.published} onClick={publish}>
            {pubBusy ? <span className="spin" /> : card.published ? "✓ publicado" : "publicar no Instagram"}
          </button>
        )}
        {pubMsg && <div className="hint" style={{ margin: 0 }}>{pubMsg}</div>}
        <div className={"imgsearch" + (showSearch ? " show" : "")}>
          <div style={{ display: "flex", gap: 5 }}>
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar foto" />
            <select value={src} onChange={(e) => setSrc(e.target.value)} style={{ maxWidth: 118, fontSize: 12 }}>
              <option value="wikipedia">Wikipedia</option>
              <option value="wikimedia">Wikimedia</option>
              <option value="openverse">Openverse</option>
              <option value="pexels">Pexels</option>
              <option value="unsplash">Unsplash</option>
            </select>
            <button className="btn sm" onClick={search}>
              ok
            </button>
          </div>
          <div className="thumbs">
            {thumbs.length === 0 ? (
              <span className="hint">nada ainda</span>
            ) : (
              thumbs.map((it, i) => (
                <div key={i} className="th" onClick={() => pick(it)}>
                  <img src={it.thumb} alt="" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
