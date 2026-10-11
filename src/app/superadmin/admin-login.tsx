"use client";

/**
 * Superadmin Authentication Console (Refactored Professional Edition).
 *
 * Mengikuti standar antislop:
 * - Desain profesional bersih untuk manajemen platform enterprise.
 * - Tanpa ornamen klise hacker atau gradien generik AI.
 * - Kontras warna WCAG AA, navigasi keyboard penuh, zero em-dash.
 */

import { useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui";

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        body: JSON.stringify({ action: "login", email: email.trim(), password }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Kredensial salah. Periksa kembali email dan kata sandi Anda.");
        return;
      }
      onSuccess();
    } catch {
      setError("Gagal menghubungi server konsol. Periksa koneksi jaringan Anda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col justify-center items-center bg-slate-950 px-4 py-12 text-slate-100 sm:px-6">
      <div className="w-full max-w-md space-y-6">
        {/* Navigation Back */}
        <div>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1.5 py-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Kembali ke Beranda Utama
          </a>
        </div>

        {/* Card Shell */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-8 shadow-xl">
          {/* Header Brand */}
          <div className="flex items-center gap-3 border-b border-slate-800 pb-6">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-400">
              <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wider text-indigo-400">
                Noewbar Platform
              </p>
              <h1 className="text-lg font-bold text-white tracking-tight">
                Konsol Manajemen Sistem
              </h1>
            </div>
          </div>

          <div className="pt-6">
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Gerbang otentikasi administrator infrastruktur. Akses ini mengontrol seluruh node tenant, gateway bot, dan operasi server.
            </p>

            <form onSubmit={submit} className="space-y-4.5">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Email Administrator
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Mail className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <input
                    id="admin-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    placeholder="superadmin@noewbar.id"
                    className="w-full rounded-lg border border-slate-750 bg-slate-950 pl-9 pr-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                    <Lock className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <input
                    id="admin-password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Masukkan kata sandi administrator"
                    className="w-full rounded-lg border border-slate-750 bg-slate-950 pl-9 pr-10 py-2.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-rose-500/30 bg-rose-950/40 p-3.5 text-xs text-rose-300 flex items-start gap-2.5"
                >
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                loading={busy}
                className="w-full justify-center bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-2.5 mt-2 rounded-lg transition-colors border-none shadow-md shadow-indigo-950/40"
              >
                Masuk ke Konsol Sistem
              </Button>
            </form>
          </div>
        </div>

        {/* Security Assurance Note */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3.5 text-center text-2xs text-slate-400 leading-relaxed">
          Kredensial diamankan dengan enkripsi Argon2id berstandar OWASP. Seluruh aktivitas sesi dicatat dalam ledger audit sistem.
        </div>
      </div>
    </main>
  );
}
