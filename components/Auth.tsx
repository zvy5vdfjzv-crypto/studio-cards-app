"use client";
import { useState } from "react";
import { api } from "./api";

export default function Auth({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    try {
      if (mode === "register") await api.post("/api/auth/register", { email, password, name });
      else await api.post("/api/auth/login", { email, password });
      onAuthed();
    } catch (e: any) {
      setErr(e.message);
    }
    setBusy(false);
  }

  return (
    <div className="authwrap">
      <div className="card">
        <div className="h">{mode === "login" ? "ENTRAR" : "CRIAR CONTA"}</div>
        <div className="b">
          {mode === "register" && (
            <div className="ctl">
              nome
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="seu nome" />
            </div>
          )}
          <div className="ctl">
            e-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
          </div>
          <div className="ctl">
            senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="mín. 6 caracteres"
            />
          </div>
          <button className="btn solid" style={{ width: "100%" }} disabled={busy} onClick={submit}>
            {busy ? <span className="spin" /> : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
          {err && <div className="status err">{err}</div>}
          <div className="hint" style={{ marginTop: 12 }}>
            {mode === "login" ? "Não tem conta? " : "Já tem conta? "}
            <a
              style={{ color: "var(--pink)", cursor: "pointer" }}
              onClick={() => {
                setErr("");
                setMode(mode === "login" ? "register" : "login");
              }}
            >
              {mode === "login" ? "Criar agora" : "Entrar"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
