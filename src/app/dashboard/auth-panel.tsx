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
import { ArrowLeft, Eye, EyeOff, LogIn, MessageCircle, ShieldCheck, UserPlus } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ErrorState,
  Segmented,
  StatusDot,
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
  const [showPassword, setShowPassword] = useState(false);
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

        <h1 className="mt-6 text-2xl font-bold leading-tight text-ink">
          {mode === "login" ? "Masuk ke Dashboard" : "Mulai Uji Coba 7 Hari"}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
          {mode === "login"
            ? "Gunakan email dan kata sandi yang telah Anda daftarkan."
            : "Tanpa kartu kredit. Semua fitur otomatisasi aktif selama masa uji coba."}
        </p>

        <div className="mt-5">
          <Segmented
            label="Pilih mode autentikasi"
            items={[
              { id: "login" as Mode, label: "Masuk Akun", icon: <LogIn className="h-4 w-4" aria-hidden="true" /> },
              { id: "register" as Mode, label: "Daftar Baru", icon: <UserPlus className="h-4 w-4" aria-hidden="true" /> },
            ]}
            value={mode}
            onChange={setMode}
          />
        </div>

        {mode === "register" && (
          <div className="mt-3.5 rounded-lg border border-signal/25 bg-signal-wash px-3.5 py-2.5 text-xs text-signal-strong flex items-center gap-2.5">
            <StatusDot ok pulse={false} />
            <span>Uji coba gratis 7 hari penuh. Semua fitur AI & katalog aktif tanpa biaya awal.</span>
          </div>
        )}

        <Card className="mt-4 shadow-raised border-ink-200">
          <CardBody className="p-6">
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

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="label mb-0">
                    Kata Sandi
                  </label>
                  {mode === "login" && (
                    <a
                      href="https://wa.me/?text=Halo%20Admin%20Noewbar,%20saya%20butuh%20bantuan%20reset%20kata%20sandi%20toko%20saya"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-2xs font-semibold text-ink-600 hover:text-ink transition-colors"
                    >
                      Lupa kata sandi?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={mode === "register" ? 8 : 1}
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder={mode === "register" ? "Buat kata sandi minimal 8 karakter..." : "Masukkan kata sandi..."}
                    className="field pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-500 hover:text-ink hover:bg-ink-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === "register" && <p className="hint">Minimal 8 karakter.</p>}
              </div>

              {mode === "register" && (
                <div className="space-y-4 border-t border-ink-200 pt-4">
                  <p className="eyebrow">Identitas toko</p>

                  <TextField
                    id="business_name"
                    label="Nama toko"
                    required
                    value={form.business_name}
                    onChange={(e) => set("business_name", e.target.value)}
                    placeholder="Contoh: Toko Fashion Bandung"
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
                      <p className="eyebrow">Katalog & Pengiriman</p>
                      <Badge tone="neutral">opsional</Badge>
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
                        hint="Boleh dikosongkan. Bisa diisi nanti di tab Katalog dan media."
                      />
                      <TextField
                        id="origin_subdistrict"
                        label="Kecamatan asal pengiriman"
                        value={form.origin_subdistrict}
                        onChange={(e) => set("origin_subdistrict", e.target.value)}
                        placeholder="Kebayoran Baru, Jakarta Selatan"
                        optional
                        hint="Boleh dikosongkan. Bisa diatur nanti di tab Pengaturan Toko."
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
                    hint="Opsional untuk salinan peringatan darurat ke bot Telegram Anda."
                  />
                </div>
              )}

              {error && <ErrorState title="Tidak dapat diproses" description={error} compact />}

              <Button type="submit" variant="primary" className="w-full min-h-[44px] text-sm font-semibold" loading={busy}>
                {busy ? "Memproses..." : mode === "login" ? "Masuk ke Dashboard" : "Daftar dan Mulai Uji Coba"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <div className="mt-4">
          <PwaInstallPrompt variant="banner" />
        </div>

        <div className="mt-6 flex flex-col items-center gap-2.5 text-center">
          <p className="flex items-center gap-1.5 text-xs leading-relaxed text-ink-600">
            <ShieldCheck className="h-4 w-4 text-signal shrink-0" aria-hidden="true" />
            <span>Kredensial disimpan dengan enkripsi Argon2id. Sesi WhatsApp terisolasi multi-tenant.</span>
          </p>
          <a
            href="https://wa.me/?text=Halo%20Admin%20Noewbar,%20saya%20ingin%20bertanya%20seputar%20pendaftaran%20toko"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-semibold text-ink-600 hover:text-ink hover:underline transition-colors"
          >
            <MessageCircle className="h-3.5 w-3.5 text-signal" />
            Butuh bantuan? Hubungi CS WhatsApp
          </a>
        </div>
      </div>
    </main>
  );
}
