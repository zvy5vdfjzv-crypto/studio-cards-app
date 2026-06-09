"use client";
import { useState } from "react";
import { api } from "./api";
import type { AiCard } from "@/lib/types";

export default function AiTab({ onToGen }: { onToGen: (text: string) => void }) {
  const [input, setInput] = useState("");
  const [n, setN] = useState(10);
  const [webSearch, setWebSearch] = useState(true);
  const [cards, setCards] = useState<AiCard[]>([]);
  const [status, setStatus] = useState<{ k: string; t: string }>({ k: "", t: "" });
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!input.trim()) return setStatus({ k: "err", t: "Escreva o conteúdo/assunto." });
    setBusy(true);
    setStatus({ k: "busy", t: "Gerando textos…" });
    setCards([]);
    try {
      const d = await api.post("/api/ai/generate", { content: input, n, webSearch });
      setCards(d.cards || []);
      setStatus({ k: "ok", t: (d.cards?.length || 0) + " textos gerados. Revise e envie pro lote." });
    } catch (e: any) {
      setStatus({ k: "err", t: "Falhou: " + e.message });
    }
    setBusy(false);
  }

  function update(i: number, key: keyof AiCard, val: string) {
    setCards((cs) => cs.map((c, j) => (j === i ? { ...c, [key]: val } : c)));
  }

  function toGen() {
    const lines = cards.map((c) => [c.title || "", c.photo_query || "", c.source || ""].join(" ; ")).join("\n");
    onToGen(lines);
  }

  return (
    <>
      <div className="card">
        <div className="h">
          CONTEÚDO → TEXTOS DOS CARDS <span className="mini">IA no servidor · sua chave nunca vai pro browser</span>
        </div>
        <div className="b">
          <div className="ctl">
            o que você quer postar (um assunto por linha, ou um bloco de conteúdo)
            <textarea
              rows={5}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"Ex: as fofocas mais quentes do entretenimento hoje\nou cole uma notícia e peça pra resumir em card"}
            />
          </div>
          <label className="chk" style={{ marginBottom: 10 }}>
            <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} /> 🔥 pesquisar
            na web — traz notícia fresca (mantenha ligado p/ fofoca do dia)
          </label>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="ctl" style={{ margin: 0 }}>
              qtd. de cards
              <input
                type="number"
                value={n}
                onChange={(e) => setN(parseInt(e.target.value) || 10)}
                style={{ width: 80 }}
              />
            </div>
            <button className="btn solid" disabled={busy} onClick={run}>
              {busy ? <span className="spin" /> : "✦ GERAR TEXTOS"}
            </button>
          </div>
          {status.t && <div className={"status " + status.k}>{status.t}</div>}

          {cards.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {cards.map((c, i) => (
                <div key={i} className="tplrow" style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}>
                  <input
                    type="text"
                    value={c.title}
                    onChange={(e) => update(i, "title", e.target.value)}
                    style={{ fontSize: 13 }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      value={c.photo_query}
                      onChange={(e) => update(i, "photo_query", e.target.value)}
                      placeholder="foto"
                      style={{ fontSize: 12 }}
                    />
                    <input
                      type="text"
                      value={c.source}
                      onChange={(e) => update(i, "source", e.target.value)}
                      placeholder="fonte"
                      style={{ fontSize: 12 }}
                    />
                  </div>
                </div>
              ))}
              <button className="btn gold" style={{ marginTop: 10, width: "100%" }} onClick={toGen}>
                ⤵ enviar estes textos pro lote (aba 3)
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
