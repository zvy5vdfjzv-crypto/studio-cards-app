"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import ChannelBar from "./ChannelBar";
import BuilderTab from "./BuilderTab";
import AiTab from "./AiTab";
import AssistantTab from "./AssistantTab";
import GeneratorTab from "./GeneratorTab";
import { preloadGoogleFonts } from "./canvas";
import type { Channel, TemplateRecord } from "@/lib/types";

type Tab = "Build" | "AI" | "Chat" | "Gen";
type Features = { ai: boolean; assistant: boolean; instagram: boolean; drive: boolean };

export default function Studio() {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [tab, setTab] = useState<Tab>("Build");
  const [genPrefill, setGenPrefill] = useState<string>("");
  const [genTemplate, setGenTemplate] = useState<string | null>(null);
  const [genRunSignal, setGenRunSignal] = useState<number>(0);
  const [flash, setFlash] = useState<string>("");
  const [features, setFeatures] = useState<Features>({ ai: false, assistant: false, instagram: false, drive: false });

  const active = channels.find((c) => c.id === activeId) || null;

  const loadMe = useCallback(async () => {
    const d = await api.get("/api/auth/me");
    if (d.features) setFeatures(d.features);
    setChannels(d.channels || []);
    if (d.channels?.length && !d.channels.find((c: Channel) => c.id === activeId)) {
      setActiveId(d.channels[0].id);
    }
  }, [activeId]);

  useEffect(() => {
    preloadGoogleFonts();
    (async () => {
      try {
        await loadMe();
      } catch {}
      setLoading(false);
    })();
    // feedback de OAuth (Instagram/Drive)
    const sp = new URLSearchParams(window.location.search);
    const ig = sp.get("ig"),
      dr = sp.get("drive");
    if (ig) setFlash(ig === "ok" ? "Instagram conectado!" : "Falha ao conectar o Instagram: " + ig);
    if (dr) setFlash(dr === "ok" ? "Google Drive conectado!" : "Falha ao conectar o Drive: " + dr);
    if (ig || dr) window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTemplates = useCallback(async (channelId: string) => {
    if (!channelId) return setTemplates([]);
    try {
      const d = await api.get("/api/templates?channel=" + channelId);
      setTemplates(d.templates || []);
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    if (activeId) loadTemplates(activeId);
  }, [activeId, loadTemplates]);

  if (loading)
    return (
      <>
        <Header tab={tab} setTab={setTab} hideTabs />
        <div className="wrap">
          <div className="empty">
            <span className="spin" /> carregando…
          </div>
        </div>
      </>
    );

  let activeTab: Tab = tab;
  if (activeTab === "AI" && !features.ai) activeTab = "Build";
  if (activeTab === "Chat" && !features.assistant) activeTab = "Build";

  return (
    <>
      <Header tab={activeTab} setTab={setTab} showAi={features.ai} showAssistant={features.assistant} />
      <div className="wrap">
        {flash && (
          <div className={"alert" + (/conectado/.test(flash) ? " ok" : "")}>
            {flash} <a style={{ cursor: "pointer", color: "var(--gold)" }} onClick={() => setFlash("")}>fechar</a>
          </div>
        )}
        <ChannelBar
          channels={channels}
          activeId={activeId}
          setActiveId={setActiveId}
          reload={loadMe}
          features={features}
        />
        {!active ? (
          <div className="card">
            <div className="b empty">Crie um canal acima para começar.</div>
          </div>
        ) : activeTab === "Build" ? (
          <BuilderTab channel={active} templates={templates} reloadTemplates={() => loadTemplates(active.id)} />
        ) : activeTab === "AI" ? (
          <AiTab
            onToGen={(text) => {
              setGenPrefill(text);
              setTab("Gen");
            }}
          />
        ) : activeTab === "Chat" ? (
          <AssistantTab
            channel={active}
            onGenerate={(lines, template) => {
              setGenPrefill(lines);
              setGenTemplate(template);
              setGenRunSignal((s) => s + 1);
              setTab("Gen");
            }}
          />
        ) : (
          <GeneratorTab
            channel={active}
            templates={templates}
            prefill={genPrefill}
            desiredTemplate={genTemplate}
            runSignal={genRunSignal}
          />
        )}
      </div>
    </>
  );
}

function Header({
  tab,
  setTab,
  showAi,
  showAssistant,
  hideTabs,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  showAi?: boolean;
  showAssistant?: boolean;
  hideTabs?: boolean;
}) {
  return (
    <header>
      <div className="dot" />
      <h1>ESTÚDIO DE CARDS</h1>
      {!hideTabs && (
        <div className="tabs">
          <button className={tab === "Build" ? "on" : ""} onClick={() => setTab("Build")}>
            Criar template
          </button>
          {showAssistant && (
            <button className={tab === "Chat" ? "on" : ""} onClick={() => setTab("Chat")}>
              ✦ Assistente
            </button>
          )}
          {showAi && (
            <button className={tab === "AI" ? "on" : ""} onClick={() => setTab("AI")}>
              Conteúdo (IA)
            </button>
          )}
          <button className={tab === "Gen" ? "on" : ""} onClick={() => setTab("Gen")}>
            Gerar cards
          </button>
        </div>
      )}
    </header>
  );
}
