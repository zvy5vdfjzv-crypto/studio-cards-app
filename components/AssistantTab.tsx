"use client";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Channel } from "@/lib/types";

type Msg = { role: "user" | "assistant"; content: string };

const HELLO: Msg = {
  role: "assistant",
  content:
    "Oi! Sou seu assistente de cards. Me conta a notícia/fofoca (pode colar o texto) e eu escrevo as manchetes com palavras próprias e já mando gerar os cards. Ex.: \"faz 3 cards sobre [assunto], aqui estão os fatos: …\".",
};

export default function AssistantTab({
  channel,
  onGenerate,
}: {
  channel: Channel;
  onGenerate: (lines: string, template: string | null, count: number) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([HELLO]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const payload = next.filter((m) => m !== HELLO).map((m) => ({ role: m.role, content: m.content }));
      const d = await api.post("/api/ai/chat", { messages: payload, channelId: channel.id });
      const result = d.result || {};
      const reply: string = result.reply || "Certo!";
      setMsgs((m) => [...m, { role: "assistant", content: reply }]);

      const action = result.action;
      if (action && action.type === "gerar" && Array.isArray(action.linhas) && action.linhas.length) {
        const lines = action.linhas
          .map((l: any) => [l.texto || "", l.foto || "", l.fonte || ""].map((s: string) => s.trim()).join(" ; "))
          .join("\n");
        onGenerate(lines, action.template || null, action.linhas.length);
        setMsgs((m) => [
          ...m,
          {
            role: "assistant",
            content: `⚡ Gerando ${action.linhas.length} card(s) na aba "Gerar cards"…`,
          },
        ]);
      }
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: "⚠️ " + (e.message || "Falhou.") }]);
    }
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="h">
        ASSISTENTE IA <span className="mini">Gemini no servidor · ele escreve e dispara a geração</span>
      </div>
      <div className="b">
        <div className="chat" ref={scrollRef}>
          {msgs.map((m, i) => (
            <div key={i} className={"bubble " + m.role}>
              {m.content}
            </div>
          ))}
          {busy && (
            <div className="bubble assistant">
              <span className="spin" /> pensando…
            </div>
          )}
        </div>
        <div className="chatbar">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Conte a notícia ou peça os cards… (Enter envia, Shift+Enter quebra linha)"
          />
          <button className="btn solid" disabled={busy || !input.trim()} onClick={send}>
            {busy ? <span className="spin" /> : "enviar"}
          </button>
        </div>
        <div className="hint">
          O assistente não navega na web — cole os fatos que ele resume em manchete original, com crédito automático na foto.
        </div>
      </div>
    </div>
  );
}
