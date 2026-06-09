"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import Auth from "./Auth";
import ChannelBar from "./ChannelBar";
import BuilderTab from "./BuilderTab";
import AiTab from "./AiTab";
import GeneratorTab from "./GeneratorTab";
import { preloadGoogleFonts } from "./canvas";
import type { Channel, TemplateRecord } from "@/lib/types";

type User = { id: string; email: string; name: string };
type Tab = "Build" | "AI" | "Gen";

export default function Studio() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [tab, setTab] = useState<Tab>("Build");
  const [genPrefill, setGenPrefill] = useState<string>("");
  const [flash, setFlash] = useState<string>("");

  const active = channels.find((c) => c.id === activeId) || null;

  const loadMe = useCallback(async () => {
    const d = await api.get("/api/auth/me");
    setUser(d.user);
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

  if (!user)
    return (
      <>
        <Header tab={tab} setTab={setTab} hideTabs />
        <Auth onAuthed={() => loadMe()} />
      </>
    );

  return (
    <>
      <Header
        tab={tab}
        setTab={setTab}
        user={user}
        onLogout={async () => {
          await api.post("/api/auth/logout");
          setUser(null);
          setChannels([]);
          setActiveId("");
        }}
      />
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
        />
        {!active ? (
          <div className="card">
            <div className="b empty">Crie um canal acima para começar.</div>
          </div>
        ) : tab === "Build" ? (
          <BuilderTab channel={active} templates={templates} reloadTemplates={() => loadTemplates(active.id)} />
        ) : tab === "AI" ? (
          <AiTab
            onToGen={(text) => {
              setGenPrefill(text);
              setTab("Gen");
            }}
          />
        ) : (
          <GeneratorTab channel={active} templates={templates} prefill={genPrefill} />
        )}
      </div>
    </>
  );
}

function Header({
  tab,
  setTab,
  user,
  onLogout,
  hideTabs,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  user?: User;
  onLogout?: () => void;
  hideTabs?: boolean;
}) {
  return (
    <header>
      <div className="dot" />
      <h1>ESTÚDIO DE CARDS</h1>
      {!hideTabs && (
        <div className="tabs">
          <button className={tab === "Build" ? "on" : ""} onClick={() => setTab("Build")}>
            1 · Criar template
          </button>
          <button className={tab === "AI" ? "on" : ""} onClick={() => setTab("AI")}>
            2 · Conteúdo (IA)
          </button>
          <button className={tab === "Gen" ? "on" : ""} onClick={() => setTab("Gen")}>
            3 · Gerar cards
          </button>
        </div>
      )}
      {user && (
        <div style={{ marginLeft: hideTabs ? "auto" : 14, display: "flex", alignItems: "center", gap: 10 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {user.email}
          </span>
          <button className="btn sm" onClick={onLogout}>
            sair
          </button>
        </div>
      )}
    </header>
  );
}
