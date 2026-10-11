"use client";

/**
 * Operator console sign-in (Dark Command Center Edition).
 * Kredensial dibaca dari environment, bukan database tenant.
 */

import { useState } from "react";
import { ArrowLeft, KeyRound, ShieldAlert, Terminal } from "lucide-react";
import { Button } from "@/components/ui";

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Login ditolak. Periksa email atau password.");
        return;
      }
      onSuccess();
    } catch {
      setError("Gagal menghubungi server konsol.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#070A11] px-5 py-12 text-slate-100 selection:bg-cyan-500/30">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition-colors hover:text-cyan-400"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Kembali ke landing page
        </a>

        {/* Brand Beacon */}
        <div className="mt-6 flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-700/60 font-mono text-sm font-bold shadow-lg shadow-cyan-950/40">
              <Terminal className="h-4 w-4" />
            </span>
            <div>
              <span className="font-mono text-xs font-bold tracking-wider text-cyan-400 uppercase">
                NOEWBAR CLUSTER
              </span>
              <p className="font-mono text-sm font-extrabold text-white tracking-tight">
                MISSION CONTROL
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2.5 py-0.5 font-mono text-[10px] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            NODE ONLINE
          </span>
        </div>

        <div className="mt-6">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Autentikasi Master Operator
          </h1>
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
            Akses sistem tingkat tinggi khusus administrator platform. Memiliki kewenangan penuh atas seluruh node tenant.
          </p>
        </div>

        {/* Card Form */}
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-sm">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label
                htmlFor="aemail"
                className="block font-mono text-2xs uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Operator Email
              </label>
              <input
                id="aemail"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="operator@noewbar.id"
                className="w-full rounded-lg border border-slate-750 bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="apass"
                className="block font-mono text-2xs uppercase tracking-wider text-slate-400 mb-1.5"
              >
                Master Password Key
              </label>
              <input
                id="apass"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-slate-750 bg-slate-950 px-3.5 py-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs uppercase tracking-wider py-2.5 mt-2 shadow-lg shadow-cyan-900/30 border-none"
              loading={busy}
            >
              {!busy && <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />}
              Masuk Mission Control
            </Button>
          </form>
        </div>

        <div className="mt-4 rounded-lg border border-slate-850 bg-slate-950/60 p-3 text-2xs text-slate-500 font-mono leading-relaxed">
          Kredensial diverifikasi dengan Argon2id hash pada environment terisolasi. Seluruh sesi diaudit dalam ledger webhook platform.
        </div>
      </div>
    </main>
  );
}
