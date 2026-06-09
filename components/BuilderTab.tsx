"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { FONTS, ensureCustomFont } from "./canvas";
import type { Channel, TemplateData, TemplateRecord, TextZone } from "@/lib/types";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

type Sel = { type: "photo" | "text"; idx: number } | null;
type Drag = {
  type: "photo" | "text";
  idx: number;
  mode: "move" | "rs";
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  ow: number;
  oh: number;
  rw: number;
  rh: number;
} | null;

export default function BuilderTab({
  channel,
  templates,
  reloadTemplates,
}: {
  channel: Channel;
  templates: TemplateRecord[];
  reloadTemplates: () => void;
}) {
  const [editing, setEditing] = useState<TemplateData | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel>(null);
  const [name, setName] = useState("");
  const [customFontFamily, setCustomFontFamily] = useState<string | null>(null);
  const [status, setStatus] = useState<{ k: string; t: string }>({ k: "", t: "" });
  const [busy, setBusy] = useState(false);
  const [driveFolder, setDriveFolder] = useState("");

  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag>(null);

  // listeners de arrasto (uma vez)
  useEffect(() => {
    const move = (ev: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setEditing((prev) => {
        if (!prev) return prev;
        const next: TemplateData = JSON.parse(JSON.stringify(prev));
        const z = d.type === "photo" ? next.photoZone : next.textZones[d.idx];
        if (!z) return prev;
        if (d.mode === "move") {
          z.x = clamp(d.ox + (ev.clientX - d.sx) / d.rw, 0, 1 - z.w);
          z.y = clamp(d.oy + (ev.clientY - d.sy) / d.rh, 0, 1 - z.h);
        } else {
          z.w = clamp(d.ow + (ev.clientX - d.sx) / d.rw, 0.05, 1 - z.x);
          z.h = clamp(d.oh + (ev.clientY - d.sy) / d.rh, 0.04, 1 - z.y);
        }
        return next;
      });
    };
    const up = () => (dragRef.current = null);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, []);

  async function onFrameFile(file: File) {
    setBusy(true);
    setStatus({ k: "busy", t: "Processando arte…" });
    try {
      const dataUrl = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res(r.result as string);
        r.readAsDataURL(file);
      });
      const im = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = dataUrl;
      });
      const cap = 1300,
        sc = Math.min(1, cap / Math.max(im.width, im.height));
      const cN = document.createElement("canvas");
      cN.width = Math.round(im.width * sc);
      cN.height = Math.round(im.height * sc);
      cN.getContext("2d")!.drawImage(im, 0, 0, cN.width, cN.height);
      const blob = await new Promise<Blob | null>((r) => cN.toBlob(r, "image/png"));
      if (!blob) throw new Error("Falha ao processar a imagem.");
      const { url } = await api.upload(channel.id, "frame", blob, file.name || "arte.png");
      setEditing((prev) => ({
        name: prev?.name || "",
        frame: url,
        w: cN.width,
        h: cN.height,
        photoBehind: prev?.photoBehind ?? true,
        gray: prev?.gray ?? true,
        fontData: prev?.fontData || null,
        fontName: prev?.fontName || null,
        logo: prev?.logo || null,
        photoZone: prev?.photoZone || null,
        textZones: prev?.textZones || [],
      }));
      setStatus({ k: "ok", t: cN.width + "×" + cN.height });
    } catch (e: any) {
      setStatus({ k: "err", t: e.message });
    }
    setBusy(false);
  }

  async function onFontFile(file: File) {
    try {
      const { url } = await api.upload(channel.id, "font", file, file.name);
      const fam = await ensureCustomFont(url);
      setCustomFontFamily(fam);
      setEditing((prev) => (prev ? { ...prev, fontData: url, fontName: file.name } : prev));
      setStatus({ k: "ok", t: "Fonte " + file.name + " carregada." });
    } catch (e: any) {
      setStatus({ k: "err", t: e.message });
    }
  }

  function updateZone(mut: (z: any) => void) {
    if (!sel) return;
    setEditing((prev) => {
      if (!prev) return prev;
      const next: TemplateData = JSON.parse(JSON.stringify(prev));
      const z = sel.type === "photo" ? next.photoZone : next.textZones[sel.idx];
      if (z) mut(z);
      return next;
    });
  }

  function addPhoto() {
    setEditing((prev) => (prev ? { ...prev, photoZone: { x: 0, y: 0.38, w: 1, h: 0.62 } } : prev));
    setSel({ type: "photo", idx: -1 });
  }
  function addText() {
    setEditing((prev) => {
      if (!prev) return prev;
      const z: TextZone = {
        key: "texto" + (prev.textZones.length + 1),
        sample: "Texto de exemplo",
        font: "Inter",
        weight: 800,
        color: "#ffffff",
        align: "left",
        lh: 1.05,
        upper: false,
        sizeMode: "auto",
        sizePx: Math.round(prev.h * 0.03),
        x: 0.07,
        y: 0.06,
        w: 0.82,
        h: 0.22,
      };
      const next = { ...prev, textZones: [...prev.textZones, z] };
      setSel({ type: "text", idx: next.textZones.length - 1 });
      return next;
    });
  }

  function startDrag(e: React.PointerEvent, type: "photo" | "text", idx: number, mode: "move" | "rs") {
    e.preventDefault();
    if (mode === "rs") e.stopPropagation();
    const z = type === "photo" ? editing!.photoZone! : editing!.textZones[idx];
    const rect = stageRef.current!.getBoundingClientRect();
    setSel({ type, idx });
    dragRef.current = {
      type,
      idx,
      mode,
      sx: e.clientX,
      sy: e.clientY,
      ox: z.x,
      oy: z.y,
      ow: z.w,
      oh: z.h,
      rw: rect.width,
      rh: rect.height,
    };
  }

  async function save() {
    if (!editing) return;
    if (!name.trim()) return setStatus({ k: "err", t: "Dê um nome ao template." });
    setBusy(true);
    try {
      const data: TemplateData = { ...editing, name: name.trim() };
      await api.post("/api/templates", { channelId: channel.id, id: editingId, name: name.trim(), data });
      setStatus({ k: "ok", t: 'Template "' + name.trim() + '" salvo.' });
      reloadTemplates();
    } catch (e: any) {
      setStatus({ k: "err", t: e.message });
    }
    setBusy(false);
  }

  async function loadForEdit(rec: TemplateRecord) {
    setEditing(rec.data);
    setEditingId(rec.id);
    setName(rec.name);
    setSel(null);
    if (rec.data.fontData) setCustomFontFamily(await ensureCustomFont(rec.data.fontData));
  }

  async function importFromDrive() {
    if (!editing) return setStatus({ k: "err", t: "Envie a arte primeiro." });
    if (!channel.drive_connected) return setStatus({ k: "err", t: "Conecte o Google Drive no topo." });
    if (!driveFolder.trim()) return setStatus({ k: "err", t: "Informe o ID da pasta do Drive." });
    setBusy(true);
    setStatus({ k: "busy", t: "Importando do Drive…" });
    try {
      const d = await api.post("/api/drive/assets", { channelId: channel.id, folderId: driveFolder.trim() });
      let fam: string | null = customFontFamily;
      if (d.fontUrl) fam = await ensureCustomFont(d.fontUrl);
      setCustomFontFamily(fam);
      setEditing((prev) =>
        prev
          ? { ...prev, fontData: d.fontUrl || prev.fontData, fontName: d.fontName || prev.fontName, logo: d.logoUrl || prev.logo }
          : prev
      );
      setStatus({ k: "ok", t: "Importado: " + (d.files?.length || 0) + " arquivo(s) na pasta." });
    } catch (e: any) {
      setStatus({ k: "err", t: e.message });
    }
    setBusy(false);
  }

  const selZone = sel ? (sel.type === "photo" ? editing?.photoZone : editing?.textZones[sel.idx]) : null;

  return (
    <div className="cols">
      <div className="card">
        <div className="h">
          PRANCHETA <span className="mini">{editing ? editing.w + "×" + editing.h : "envie a arte do template"}</span>
        </div>
        <div className="b">
          {!editing ? (
            <label className="upl" style={{ display: "block" }}>
              📐 envie a <b>arte do template</b> (PNG)
              <br />
              <span style={{ fontSize: 11 }}>de preferência com a área da foto vazia/transparente</span>
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && onFrameFile(e.target.files[0])}
              />
            </label>
          ) : (
            <>
              <div className="stage" ref={stageRef}>
                <img src={editing.frame} alt="" />
                {editing.photoZone && (
                  <Zone
                    z={editing.photoZone}
                    type="photo"
                    label="FOTO"
                    selected={sel?.type === "photo"}
                    onDown={(e) => startDrag(e, "photo", -1, "move")}
                    onResize={(e) => startDrag(e, "photo", -1, "rs")}
                  />
                )}
                {editing.textZones.map((z, i) => (
                  <Zone
                    key={i}
                    z={z}
                    type="text"
                    label={z.key || "texto" + (i + 1)}
                    selected={sel?.type === "text" && sel.idx === i}
                    onDown={(e) => startDrag(e, "text", i, "move")}
                    onResize={(e) => startDrag(e, "text", i, "rs")}
                  />
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                <button className="btn gold sm" onClick={addPhoto}>
                  + zona de foto
                </button>
                <button className="btn blue sm" onClick={addText}>
                  + zona de texto
                </button>
                <label className="upl" style={{ padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>
                  trocar arte
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => e.target.files?.[0] && onFrameFile(e.target.files[0])}
                  />
                </label>
              </div>
              <div className="hint">
                Arraste as zonas pra posicionar; use a bolinha pra redimensionar. A{" "}
                <b style={{ color: "var(--gold)" }}>amarela</b> é a foto, as{" "}
                <b style={{ color: "var(--blue)" }}>azuis</b> são textos.
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <div className="card">
          <div className="h">PROPRIEDADES</div>
          <div className="b">
            {!sel || !selZone ? (
              <div className="empty">Selecione uma zona.</div>
            ) : sel.type === "photo" ? (
              <>
                <div className="ctl">Zona da FOTO</div>
                <div className="hint">A foto buscada entra aqui (preenchendo o retângulo).</div>
                <button
                  className="btn sm"
                  style={{ marginTop: 10, width: "100%" }}
                  onClick={() => {
                    setEditing((p) => (p ? { ...p, photoZone: null } : p));
                    setSel(null);
                  }}
                >
                  remover zona de foto
                </button>
              </>
            ) : (
              <TextProps z={selZone as TextZone} customFontFamily={customFontFamily} update={updateZone} onDelete={() => {
                setEditing((p) => (p ? { ...p, textZones: p.textZones.filter((_, j) => j !== sel.idx) } : p));
                setSel(null);
              }} />
            )}
          </div>
        </div>

        <div className="card">
          <div className="h">FONTE & OPÇÕES</div>
          <div className="b">
            <div className="ctl">
              fonte real (.ttf/.otf)
              <label className="upl" style={{ padding: 9, cursor: "pointer" }}>
                {editing?.fontName ? editing.fontName + " ✓" : "enviar fonte"}
                <input
                  type="file"
                  accept=".ttf,.otf,.woff,.woff2"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && onFontFile(e.target.files[0])}
                />
              </label>
            </div>
            <label className="chk" style={{ marginBottom: 8 }}>
              <input
                type="checkbox"
                checked={editing?.photoBehind ?? true}
                onChange={(e) => setEditing((p) => (p ? { ...p, photoBehind: e.target.checked } : p))}
              />{" "}
              foto atrás da arte (arte com janela transparente)
            </label>
            <label className="chk">
              <input
                type="checkbox"
                checked={editing?.gray ?? true}
                onChange={(e) => setEditing((p) => (p ? { ...p, gray: e.target.checked } : p))}
              />{" "}
              foto em preto e branco
            </label>
            {channel.drive_connected && (
              <div style={{ marginTop: 12 }}>
                <div className="ctl">
                  importar ativos do Drive (ID da pasta)
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="text" value={driveFolder} onChange={(e) => setDriveFolder(e.target.value)} placeholder="ID da pasta" />
                    <button className="btn sm" onClick={importFromDrive}>
                      importar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="h">SALVAR TEMPLATE</div>
          <div className="b">
            <div className="ctl">
              nome
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: BSP rosa / Política / Esporte"
              />
            </div>
            <button className="btn solid" style={{ width: "100%" }} disabled={busy || !editing} onClick={save}>
              {busy ? <span className="spin" /> : "💾 salvar este modelo"}
            </button>
            {status.t && <div className={"status " + status.k}>{status.t}</div>}
            <div style={{ marginTop: 10 }}>
              {templates.length === 0 ? (
                <div className="hint">Nenhum template salvo ainda neste canal.</div>
              ) : (
                templates.map((t) => (
                  <div key={t.id} className="tplrow">
                    <span className="n">
                      {t.name} · {t.data.w}×{t.data.h}
                    </span>
                    <button className="btn sm" onClick={() => loadForEdit(t)}>
                      editar
                    </button>
                    <button
                      className="btn sm"
                      onClick={async () => {
                        if (!confirm("Excluir template?")) return;
                        await api.del("/api/templates/" + t.id);
                        if (editingId === t.id) {
                          setEditing(null);
                          setEditingId(null);
                          setName("");
                        }
                        reloadTemplates();
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Zone({
  z,
  type,
  label,
  selected,
  onDown,
  onResize,
}: {
  z: { x: number; y: number; w: number; h: number };
  type: "photo" | "text";
  label: string;
  selected: boolean;
  onDown: (e: React.PointerEvent) => void;
  onResize: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      className={"zone " + type + (selected ? " sel" : "")}
      style={{ left: z.x * 100 + "%", top: z.y * 100 + "%", width: z.w * 100 + "%", height: z.h * 100 + "%" }}
      onPointerDown={onDown}
    >
      <div className="tag">{label}</div>
      <div className="rs" onPointerDown={onResize} />
    </div>
  );
}

function TextProps({
  z,
  customFontFamily,
  update,
  onDelete,
}: {
  z: TextZone;
  customFontFamily: string | null;
  update: (mut: (z: any) => void) => void;
  onDelete: () => void;
}) {
  return (
    <>
      <div className="ctl">
        nome do campo
        <input type="text" value={z.key} onChange={(e) => update((x) => (x.key = e.target.value))} />
      </div>
      <div className="ctl">
        texto de exemplo
        <textarea value={z.sample} onChange={(e) => update((x) => (x.sample = e.target.value))} />
      </div>
      <div className="ctl">
        fonte
        <select value={z.font} onChange={(e) => update((x) => (x.font = e.target.value))}>
          {FONTS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
          {customFontFamily && <option value="CustomTpl">★ fonte enviada</option>}
        </select>
      </div>
      <div className="two">
        <div className="ctl">
          peso
          <select value={z.weight} onChange={(e) => update((x) => (x.weight = +e.target.value))}>
            <option value="400">Regular</option>
            <option value="600">Semibold</option>
            <option value="700">Bold</option>
            <option value="800">Extra</option>
            <option value="900">Black</option>
          </select>
        </div>
        <div className="ctl">
          cor
          <input type="color" value={z.color} onChange={(e) => update((x) => (x.color = e.target.value))} />
        </div>
      </div>
      <div className="two">
        <div className="ctl">
          alinhar
          <select value={z.align} onChange={(e) => update((x) => (x.align = e.target.value))}>
            <option value="left">esquerda</option>
            <option value="center">centro</option>
            <option value="right">direita</option>
          </select>
        </div>
        <div className="ctl">
          entrelinha
          <input
            type="number"
            step="0.05"
            value={z.lh}
            onChange={(e) => update((x) => (x.lh = +e.target.value || 1.05))}
          />
        </div>
      </div>
      <div className="two">
        <div className="ctl">
          tamanho
          <select value={z.sizeMode} onChange={(e) => update((x) => (x.sizeMode = e.target.value))}>
            <option value="auto">auto (preenche)</option>
            <option value="fixed">fixo (px)</option>
          </select>
        </div>
        <div className="ctl">
          px (se fixo)
          <input
            type="number"
            value={z.sizePx}
            onChange={(e) => update((x) => (x.sizePx = +e.target.value || 40))}
          />
        </div>
      </div>
      <label className="chk" style={{ margin: "4px 0 10px" }}>
        <input type="checkbox" checked={z.upper} onChange={(e) => update((x) => (x.upper = e.target.checked))} />{" "}
        MAIÚSCULAS
      </label>
      <button className="btn sm" style={{ width: "100%" }} onClick={onDelete}>
        remover este texto
      </button>
    </>
  );
}
