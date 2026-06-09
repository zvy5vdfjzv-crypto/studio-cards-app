"use client";
import { useState } from "react";
import { api } from "./api";
import type { Channel } from "@/lib/types";

export default function ChannelBar({
  channels,
  activeId,
  setActiveId,
  reload,
  features,
}: {
  channels: Channel[];
  activeId: string;
  setActiveId: (id: string) => void;
  reload: () => Promise<void>;
  features: { ai: boolean; instagram: boolean; drive: boolean };
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const active = channels.find((c) => c.id === activeId) || null;

  async function createChannel() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const d = await api.post("/api/channels", { name: newName });
      await reload();
      setActiveId(d.channel.id);
      setNewName("");
      setCreating(false);
    } catch (e: any) {
      alert(e.message);
    }
    setBusy(false);
  }

  const igConnected = !!active?.ig_user_id;
  const driveConnected = !!active?.drive_connected;

  return (
    <div className="card">
      <div className="h">
        CANAL / CONTA
        <span className="mini">cada canal tem seus templates, histórico e contas vinculadas</span>
      </div>
      <div className="b">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            style={{ maxWidth: 280 }}
          >
            {channels.length === 0 && <option value="">— nenhum canal —</option>}
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {!creating ? (
            <button className="btn sm" onClick={() => setCreating(true)}>
              + novo canal
            </button>
          ) : (
            <span className="chips">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && createChannel()}
                placeholder="nome do canal"
                style={{ width: 180 }}
              />
              <button className="btn sm solid" disabled={busy} onClick={createChannel}>
                criar
              </button>
              <button className="btn sm" onClick={() => setCreating(false)}>
                ×
              </button>
            </span>
          )}
        </div>

        {active && (features.instagram || features.drive) && (
          <div style={{ marginTop: 14, display: "flex", gap: 18, flexWrap: "wrap" }}>
            {features.instagram && <IgBlock channel={active} connected={igConnected} reload={reload} />}
            {features.drive && <DriveBlock channel={active} connected={driveConnected} reload={reload} />}
          </div>
        )}
      </div>
    </div>
  );
}

function IgBlock({ channel, connected, reload }: { channel: Channel; connected: boolean; reload: () => Promise<void> }) {
  return (
    <div style={{ flex: "1 1 280px" }}>
      <div className="ctl" style={{ marginBottom: 6 }}>Instagram (publicação)</div>
      {connected ? (
        <div className="chips">
          <span className="badge ok">@{channel.ig_username || "conectado"}</span>
          <button
            className="btn sm"
            onClick={async () => {
              if (!confirm("Desconectar o Instagram deste canal?")) return;
              await api.post("/api/instagram/disconnect", { channelId: channel.id });
              await reload();
            }}
          >
            desconectar
          </button>
        </div>
      ) : (
        <>
          <a className="btn sm blue" href={`/api/instagram/connect?channel=${channel.id}`}>
            conectar conta Business/Creator
          </a>
          <div className="hint">Requer conta Instagram Business/Creator vinculada a uma Página do Facebook.</div>
        </>
      )}
    </div>
  );
}

function DriveBlock({ channel, connected, reload }: { channel: Channel; connected: boolean; reload: () => Promise<void> }) {
  return (
    <div style={{ flex: "1 1 280px" }}>
      <div className="ctl" style={{ marginBottom: 6 }}>Google Drive (ativos)</div>
      {connected ? (
        <div className="chips">
          <span className="badge ok">conectado</span>
          <span className="hint" style={{ margin: 0 }}>
            pasta: {channel.drive_folder_id || "definir ao importar no template"}
          </span>
        </div>
      ) : (
        <>
          <a className="btn sm" href={`/api/drive/connect?channel=${channel.id}`}>
            conectar Google Drive
          </a>
          <div className="hint">Lê fonte, logo e cores.json de uma pasta por canal.</div>
        </>
      )}
    </div>
  );
}
