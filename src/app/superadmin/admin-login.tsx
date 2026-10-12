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
    <main className="min-h-screen flex flex-col justify-center items-center bg-surface-sunken px-4 py-12 text-ink sm:px-6">
      <div className="w-full max-w-md space-y-6">
        {/* Navigation Back */}
        <div>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-ink-500 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded px-1.5 py-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Kembali ke Beranda Utama
          </a>
        </div>

        {/* Card Shell */}
        <div className="rounded-2xl border border-ink-200 bg-white p-6 sm:p-8 shadow-raised space-y-6">
          {/* Header Brand */}
          <div className="flex items-center gap-3 border-b border-ink-100 pb-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink font-mono text-sm font-bold text-white shadow-raised">
              N
            </span>
            <div>
              <p className="text-2xs font-bold uppercase tracking-wider text-signal-strong">
                Superadmin Console
              </p>
              <h1 className="text-base sm:text-lg font-bold text-ink tracking-tight">
                Manajemen Sistem Platform
              </h1>
            </div>
          </div>

          <div>
            <p className="text-xs text-ink-500 leading-relaxed mb-5">
              Masuk untuk mengelola toko, langganan, dan koneksi WhatsApp platform.
            </p>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-xs font-semibold uppercase tracking-wide text-ink-600 mb-1.5"
                >
                  Email Administrator
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
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
                    className="w-full rounded-lg border border-ink-200 bg-white pl-9 pr-3.5 py-2.5 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none min-h-[42px] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-semibold uppercase tracking-wide text-ink-600 mb-1.5"
                >
                  Kata Sandi
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
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
                    className="w-full rounded-lg border border-ink-200 bg-white pl-9 pr-10 py-2.5 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none min-h-[42px] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-400 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded"
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
                  className="rounded-lg border border-danger/30 bg-danger-wash p-3.5 text-xs text-danger-strong flex items-start gap-2.5"
                >
                  <AlertCircle className="h-4 w-4 text-danger shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                loading={busy}
                className="w-full justify-center min-h-[44px] text-xs font-bold"
              >
                Masuk ke Konsol Sistem
              </Button>
            </form>
          </div>
        </div>

        {/* Security Assurance Note */}
        <p className="text-center text-2xs text-ink-400 leading-relaxed">
          Sesi operator dicatat di ledger audit sistem.
        </p>
      </div>
    </main>
  );
}
