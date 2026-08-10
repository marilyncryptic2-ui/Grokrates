"use client";

import { useState } from "react";
import type { RegistryProtocol, YieldOpportunity } from "@/lib/types";

// /admin — add protocols without code. Password-gated (ADMIN_PASSWORD env).
// New protocols start INACTIVE; preview their numbers, then flip live.

const empty: RegistryProtocol = {
  id: "", name: "", website: "", type: "llama-slug", llamaSlug: "",
  apiUrl: "", apiKey: "", map: { list: "data", symbol: "symbol", apyPct: "apy", tvlUsd: "tvlUsd" },
  active: false,
};

export default function AdminPage() {
  const [pw, setPw] = useState("");
  const [authed, setAuthed] = useState(false);
  const [registry, setRegistry] = useState<RegistryProtocol[]>([]);
  const [persistent, setPersistent] = useState(true);
  const [form, setForm] = useState<RegistryProtocol>(empty);
  const [preview, setPreview] = useState<YieldOpportunity[] | null>(null);
  const [msg, setMsg] = useState("");

  const api = (body?: object) =>
    fetch("/api/admin", {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${pw}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? r.statusText); return r.json(); });

  const login = async () => {
    try {
      const j = await api();
      setRegistry(j.registry); setPersistent(j.persistent); setAuthed(true); setMsg("");
    } catch { setMsg("Wrong password, or ADMIN_PASSWORD is not set on the deployment."); }
  };
  const upsert = async (p: RegistryProtocol) => {
    const j = await api({ action: "upsert", protocol: p });
    setRegistry(j.registry); setForm(empty); setMsg(`Saved ${p.name}. New entries start inactive — preview, then activate.`);
  };
  const remove = async (id: string) => {
    await api({ action: "delete", id });
    setRegistry((r) => r.filter((x) => x.id !== id));
  };
  const runPreview = async () => {
    setMsg("Running preview…");
    const j = await api({ action: "preview" });
    setPreview(j.preview); setMsg(j.warnings?.length ? `Preview warnings: ${j.warnings.join("; ")}` : "Preview complete.");
  };

  const input = (label: string, value: string, set: (v: string) => void, ph = "") => (
    <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
      {label}
      <input value={value} placeholder={ph} onChange={(e) => set(e.target.value)}
        style={{ display: "block", width: "100%", marginTop: 4, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 13, padding: "7px 9px" }} />
    </label>
  );

  if (!authed) {
    return (
      <main className="wrap" style={{ maxWidth: 480, paddingTop: 60 }}>
        <h1 className="section-title">ADMIN</h1>
        {input("Password", pw, setPw)}
        <button className="chip" onClick={login}>Log in</button>
        {msg && <p className="section-sub" style={{ marginTop: 12 }}>{msg}</p>}
      </main>
    );
  }

  return (
    <main className="wrap" style={{ paddingTop: 30, paddingBottom: 60 }}>
      <h1 className="section-title">PROTOCOL REGISTRY</h1>
      {!persistent && (
        <p className="section-sub" style={{ color: "var(--warn)" }}>
          No Redis configured — registry entries will not survive a redeploy. Add Upstash env vars to persist.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
        <section>
          <h2 className="section-title" style={{ fontSize: 13 }}>ADD / EDIT</h2>
          {input("Name", form.name, (v) => setForm({ ...form, name: v }), "Example Protocol")}
          {input("Website", form.website, (v) => setForm({ ...form, website: v }), "https://…")}
          <label style={{ display: "block", fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
            Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as RegistryProtocol["type"] })}
              style={{ display: "block", marginTop: 4, background: "var(--bg)", border: "1px solid var(--line)", borderRadius: 6, color: "var(--text)", fontSize: 13, padding: "7px 9px" }}>
              <option value="llama-slug">Registry protocol</option>
              <option value="generic-rest">Generic REST (their own API)</option>
            </select>
          </label>
          {form.type === "llama-slug" && input("Llama project slug", form.llamaSlug ?? "", (v) => setForm({ ...form, llamaSlug: v }), "e.g. new-protocol-v2")}
          {form.type === "generic-rest" && (
            <>
              {input("API URL", form.apiUrl ?? "", (v) => setForm({ ...form, apiUrl: v }), "https://api.protocol.xyz/markets")}
              {input("API key (optional)", form.apiKey ?? "", (v) => setForm({ ...form, apiKey: v }))}
              {input("List path", form.map?.list ?? "", (v) => setForm({ ...form, map: { ...form.map!, list: v } }), "data.markets")}
              {input("Symbol field", form.map?.symbol ?? "", (v) => setForm({ ...form, map: { ...form.map!, symbol: v } }), "symbol")}
              {input("APY %% field", form.map?.apyPct ?? "", (v) => setForm({ ...form, map: { ...form.map!, apyPct: v } }), "supplyApy")}
              {input("TVL USD field", form.map?.tvlUsd ?? "", (v) => setForm({ ...form, map: { ...form.map!, tvlUsd: v } }), "tvlUsd")}
            </>
          )}
          <button className="chip" onClick={() => upsert(form)}>Save (starts inactive)</button>
        </section>

        <section>
          <h2 className="section-title" style={{ fontSize: 13 }}>REGISTERED</h2>
          {registry.length === 0 && <p className="section-sub">Nothing yet. Built-in protocols live in code config.</p>}
          {registry.map((p) => (
            <div key={p.id} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px", marginBottom: 10, fontSize: 13 }}>
              <strong>{p.name}</strong>
              <span className={`badge ${p.active ? "" : "warn"}`}>{p.active ? "live" : "inactive"}</span>
              <span className="badge">{p.type}</span>
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                <button className="chip" onClick={() => upsert({ ...p, active: !p.active })}>
                  {p.active ? "Deactivate" : "Activate"}
                </button>
                <button className="chip" onClick={() => setForm(p)}>Edit</button>
                <button className="chip" onClick={() => remove(p.id)}>Delete</button>
              </div>
            </div>
          ))}
          <button className="chip" onClick={runPreview} style={{ marginTop: 6 }}>Preview all (incl. inactive)</button>
          {preview && (
            <div style={{ marginTop: 12 }}>
              <h3 className="section-title" style={{ fontSize: 12 }}>PREVIEW — verify against the protocol UI before activating</h3>
              {preview.length === 0 && <p className="section-sub">Preview produced no pools (check field paths, TVL floor, shortlist).</p>}
              {preview.map((o) => (
                <div key={o.id} className="sub" style={{ padding: "4px 0", fontFamily: "var(--font-mono)" }}>
                  {o.protocolLabel} · {o.asset} · {o.chain} · {o.apy.toFixed(2)}% · ${(o.tvlUsd / 1e6).toFixed(0)}M
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      {msg && <p className="section-sub" style={{ marginTop: 16 }}>{msg}</p>}
    </main>
  );
}
