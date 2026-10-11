"use client";

/**
 * Operator console sign-in. Credentials come from the environment, never from
 * the database, so there is no tenant account that can reach this surface.
 */

import { useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button, Card, CardBody, ErrorState, TextField } from "@/components/ui";

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
        setError(json.error ?? "Login gagal.");
        return;
      }
      onSuccess();
    } catch {
      setError("Tidak dapat menghubungi server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-surface-sunken px-5 py-12">
      <div className="w-full max-w-md">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Kembali ke halaman utama
        </a>

        <div className="mt-6 flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded bg-ink font-mono text-xs font-bold text-white">
            N
          </span>
          <span className="font-mono text-sm font-bold tracking-tight">NOEWBAR CONSOLE</span>
        </div>

        <h1 className="mt-6 text-2xl font-bold leading-tight">Konsol operator</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          Akses terbatas untuk pengelola platform. Kredensial diatur di environment, bukan di
          database.
        </p>

        <Card className="mt-5">
          <CardBody>
            <form onSubmit={submit} className="space-y-4">
              <TextField
                id="aemail"
                label="Email operator"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="operator@noewbar.id"
              />
              <TextField
                id="apass"
                label="Password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />

              {error && <ErrorState title="Login ditolak" description={error} compact />}

              <Button type="submit" variant="primary" className="w-full" loading={busy}>
                {!busy && <KeyRound className="h-4 w-4" aria-hidden="true" />}
                Masuk konsol
              </Button>
            </form>
          </CardBody>
        </Card>

        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Setiap tindakan di konsol ini tercatat pada ledger dan memengaruhi seluruh tenant.
        </p>
      </div>
    </main>
  );
}
