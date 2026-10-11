"use client";

/**
 * Sign-in and sign-up surface. Doubles as the entry point from the landing page
 * CTAs (`/dashboard?intent=register`).
 *
 * Only business name, owner name and the owner's WhatsApp number are required.
 * The catalog fields are optional because they have a home in the Catalog tab,
 * but an account can never be born without an identity to contact.
 */

import { useState } from "react";
import { ArrowLeft, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ErrorState,
  Segmented,
  TextField,
} from "@/components/ui";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

type Mode = "login" | "register";

export function AuthPanel({
  initialMode = "login",
  onSuccess,
}: {
  initialMode?: Mode;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    business_name: "",
    owner_name: "",
    owner_whatsapp: "",
    sheets_url: "",
    origin_subdistrict: "",
    owner_telegram_chat_id: "",
  });

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const payload =
      mode === "login"
        ? { intent: "login", email: form.email, password: form.password }
        : { intent: "register", ...form };

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Gagal masuk.");
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
          <span className="font-mono text-sm font-bold tracking-tight">NOEWBAR CS PRO</span>
        </div>

        <h1 className="mt-6 text-2xl font-bold leading-tight">
          {mode === "login" ? "Masuk ke dashboard" : "Mulai uji coba 7 hari"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
          {mode === "login"
            ? "Gunakan email dan password yang Anda daftarkan."
            : "Tanpa kartu kredit. Semua fitur terbuka selama masa uji coba."}
        </p>

        <div className="mt-5">
          <Segmented
            label="Pilih mode"
            items={[
              { id: "login" as Mode, label: "Masuk", icon: <LogIn className="h-3.5 w-3.5" aria-hidden="true" /> },
              { id: "register" as Mode, label: "Daftar", icon: <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>

        <Card className="mt-4">
          <CardBody>
            <form onSubmit={submit} className="space-y-4">
              <TextField
                id="email"
                label="Email"
                type="email"
                required
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                autoComplete="email"
                placeholder="nama@toko.com"
              />

              <TextField
                id="password"
                label="Password"
                type="password"
                required
                minLength={mode === "register" ? 8 : 1}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                hint={mode === "register" ? "Minimal 8 karakter." : undefined}
              />

              {mode === "register" && (
                <div className="space-y-4 border-t border-ink-200 pt-4">
                  <p className="eyebrow">Identitas toko</p>

                  <TextField
                    id="business_name"
                    label="Nama toko"
                    required
                    value={form.business_name}
                    onChange={(e) => set("business_name", e.target.value)}
                    placeholder="Toko Baju Bandung"
                  />
                  <TextField
                    id="owner_name"
                    label="Nama pemilik"
                    required
                    value={form.owner_name}
                    onChange={(e) => set("owner_name", e.target.value)}
                    placeholder="Budi Santoso"
                  />
                  <TextField
                    id="owner_whatsapp"
                    label="Nomor WhatsApp pribadi pemilik"
                    required
                    value={form.owner_whatsapp}
                    onChange={(e) => set("owner_whatsapp", e.target.value)}
                    placeholder="0812xxxxxxx"
                    inputMode="tel"
                    hint="Notifikasi darurat dikirim ke nomor ini saat bot mengoper percakapan."
                  />

                  <div className="border-t border-ink-200 pt-4">
                    <div className="mb-3 flex items-center gap-2">
                      <p className="eyebrow">Katalog</p>
                      <Badge>boleh dilewati</Badge>
                    </div>
                    <div className="space-y-4">
                      <TextField
                        id="sheets_url"
                        label="Link Google Sheets katalog"
                        value={form.sheets_url}
                        onChange={(e) => set("sheets_url", e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        inputMode="url"
                        optional
                        hint="Boleh dikosongkan. Isi nanti di tab Katalog dan media."
                      />
                      <TextField
                        id="origin_subdistrict"
                        label="Kecamatan asal pengiriman"
                        value={form.origin_subdistrict}
                        onChange={(e) => set("origin_subdistrict", e.target.value)}
                        placeholder="Kebayoran Baru, Jakarta Selatan"
                        optional
                        hint="Boleh dikosongkan. Isi nanti di tab Katalog dan media."
                      />
                    </div>
                  </div>

                  <TextField
                    id="tg"
                    label="Chat ID Telegram"
                    value={form.owner_telegram_chat_id}
                    onChange={(e) => set("owner_telegram_chat_id", e.target.value)}
                    placeholder="123456789"
                    optional
                    hint="Hanya kalau Anda ingin salinan peringatan darurat di Telegram."
                  />
                </div>
              )}

              {error && <ErrorState title="Tidak dapat diproses" description={error} compact />}

              <Button type="submit" variant="primary" className="w-full" loading={busy}>
                {busy ? "Memproses..." : mode === "login" ? "Masuk" : "Daftar dan mulai uji coba"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <div className="mt-4">
          <PwaInstallPrompt variant="banner" />
        </div>

        <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Password disimpan sebagai hash scrypt. Kredensial sesi WhatsApp tidak pernah dikirim ke
          browser sebagai teks biasa.
        </p>
      </div>
    </main>
  );
}
