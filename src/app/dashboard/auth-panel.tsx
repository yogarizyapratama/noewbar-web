"use client";

/**
 * Sign-in and sign-up surface (Enterprise UX/UI Edition).
 *
 * Standar Desain Anti-Slop & Noewbar Design System:
 * - Layout responsif dual-panel di layar besar (Desktop) dan fluid di mobile.
 * - Progressive disclosure: Form pendaftaran fokus pada identitas inti toko (Email, Sandi, Nama Toko, WhatsApp),
 *   sementara katalog Google Sheets & asal pengiriman dibuat accordion opsional agar tidak membebani pengguna baru.
 * - Password Strength Meter real-time + konfirmasi sandi untuk mencegah salah ketik.
 * - Deteksi format nomor WhatsApp Indonesia (+62) dengan helper microcopy yang jelas.
 * - Tanpa gradien generik AI atau ornamen blur berlebihan; palet warna terarah (ink, signal emerald, warn).
 * - Aksesibilitas WCAG AA penuh, status interaksi lengkap (default, hover, focus-visible, active, disabled).
 */

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  User,
  UserPlus,
  Zap,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  ErrorState,
  Segmented,
  StatusDot,
  TextField,
  cn,
} from "@/components/ui";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

type Mode = "login" | "register";

export function AuthPanel({
  initialMode = "login",
  onSuccess,
}: {
  initialMode?: Mode;
  onSuccess?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
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

  // Password strength calculation for registration
  const passwordStrength = useMemo(() => {
    const p = form.password;
    if (!p) return { score: 0, label: "Kosong", tone: "neutral" as const };
    let score = 0;
    if (p.length >= 8) score += 1;
    if (p.length >= 12) score += 1;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score += 1;
    if (/[0-9]/.test(p) || /[^A-Za-z0-9]/.test(p)) score += 1;

    if (score <= 1) return { score: 1, label: "Lemah", tone: "danger" as const };
    if (score === 2) return { score: 2, label: "Cukup", tone: "warn" as const };
    if (score === 3) return { score: 3, label: "Kuat", tone: "signal" as const };
    return { score: 4, label: "Sangat Kuat", tone: "signal" as const };
  }, [form.password]);

  // Clean Indonesian WhatsApp number preview
  const formattedWhatsApp = useMemo(() => {
    let clean = form.owner_whatsapp.replace(/[\s-]/g, "");
    if (!clean) return "";
    if (clean.startsWith("+62")) clean = "0" + clean.slice(3);
    else if (clean.startsWith("62")) clean = "0" + clean.slice(2);
    return clean;
  }, [form.owner_whatsapp]);

  const passwordsMatch = form.password === form.confirmPassword;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "register") {
      if (form.password.length < 8) {
        setError("Kata sandi minimal 8 karakter untuk keamanan akun Anda.");
        return;
      }
      if (form.confirmPassword && !passwordsMatch) {
        setError("Konfirmasi kata sandi tidak cocok. Silakan periksa kembali.");
        return;
      }
      if (!form.owner_whatsapp.trim() || form.owner_whatsapp.length < 9) {
        setError("Masukkan nomor WhatsApp yang valid untuk menerima notifikasi pesanan.");
        return;
      }
    }

    setBusy(true);

    const payload =
      mode === "login"
        ? { intent: "login", email: form.email.trim(), password: form.password }
        : {
            intent: "register",
            email: form.email.trim(),
            password: form.password,
            business_name: form.business_name.trim(),
            owner_name: form.owner_name.trim(),
            owner_whatsapp: formattedWhatsApp || form.owner_whatsapp.trim(),
            sheets_url: form.sheets_url.trim(),
            origin_subdistrict: form.origin_subdistrict.trim(),
            owner_telegram_chat_id: form.owner_telegram_chat_id.trim(),
          };

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? (mode === "login" ? "Email atau kata sandi salah." : "Gagal mendaftarkan akun toko."));
        return;
      }

      if (onSuccess) {
        onSuccess();
      } else {
        window.location.href = "/dashboard";
      }
    } catch {
      setError("Tidak dapat menghubungi server. Periksa koneksi internet Anda.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-surface-sunken lg:grid lg:grid-cols-12">
      {/* ── Left / Center Column: Auth Form ── */}
      <div className="flex min-h-screen flex-col justify-between px-5 py-8 sm:px-8 lg:col-span-7 xl:col-span-7 lg:px-14 lg:py-12">
        <div className="mx-auto w-full max-w-lg">
          {/* Top Bar: Nav & Logo */}
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded px-1 py-0.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Kembali ke Beranda
            </a>

            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink font-mono text-xs font-bold text-white shadow-flat">
                N
              </span>
              <span className="font-mono text-xs font-bold tracking-tight text-ink">NOEWBAR CS PRO</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mt-8">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {mode === "login" ? "Masuk ke Dashboard Toko" : "Mulai 7 Hari Uji Coba Gratis"}
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-ink-600 sm:text-sm">
              {mode === "login"
                ? "Kelola bot WhatsApp otomatis, pantau pesanan pelanggan, dan perbarui katalog toko Anda."
                : "Tanpa kartu kredit. Bot WhatsApp AI langsung siap melayani pesanan pembeli 24 jam nonstop."}
            </p>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="mt-6">
            <Segmented
              label="Pilih mode akun"
              items={[
                { id: "login" as Mode, label: "Masuk Akun Toko", icon: <LogIn className="h-4 w-4" aria-hidden="true" /> },
                { id: "register" as Mode, label: "Daftar Toko Baru", icon: <UserPlus className="h-4 w-4" aria-hidden="true" /> },
              ]}
              value={mode}
              onChange={(nextMode) => {
                setMode(nextMode);
                setError(null);
              }}
            />
          </div>

          {/* Value Callout for Register Mode */}
          {mode === "register" && (
            <div className="mt-4 rounded-xl border border-signal/25 bg-signal-wash px-4 py-3 text-xs text-signal-strong flex items-start gap-2.5">
              <StatusDot ok pulse={false} />
              <div className="space-y-0.5">
                <p className="font-bold">Akses Penuh Semua Fitur Pro Selama 7 Hari</p>
                <p className="text-2xs text-signal-strong/90">
                  Koneksi WhatsApp, cek ongkir instan lokal, dan integrasi Google Sheets aktif tanpa biaya awal.
                </p>
              </div>
            </div>
          )}

          {/* Main Card Form */}
          <Card className="mt-5 border-ink-200 bg-white shadow-flat">
            <CardBody className="p-6 sm:p-7">
              <form onSubmit={submit} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label htmlFor="auth-email" className="label mb-1.5 flex items-center justify-between">
                    <span>Email Toko</span>
                    <span className="text-2xs font-normal text-ink-400">Untuk akses login dashboard</span>
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
                      <Mail className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <input
                      id="auth-email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      autoComplete="email"
                      placeholder="owner@tokoonline.com"
                      className="field pl-9"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="auth-password" className="label mb-0">
                      Kata Sandi
                    </label>
                    {mode === "login" && (
                      <a
                        href="https://wa.me/?text=Halo%20Admin%20Noewbar,%20saya%20butuh%20bantuan%20reset%20kata%20sandi%20toko%20saya"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-2xs font-semibold text-signal-strong hover:underline transition-colors"
                      >
                        Lupa kata sandi?
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={mode === "register" ? 8 : 1}
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      placeholder={mode === "register" ? "Buat kata sandi minimal 8 karakter..." : "Masukkan kata sandi..."}
                      className="field pl-9 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-400 hover:text-ink hover:bg-ink-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Password Strength Meter (Register Mode Only) */}
                  {mode === "register" && form.password && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-2xs">
                        <span className="text-ink-500">Kekuatan Kata Sandi:</span>
                        <span
                          className={cn(
                            "font-semibold",
                            passwordStrength.tone === "danger" && "text-danger-strong",
                            passwordStrength.tone === "warn" && "text-warn-strong",
                            passwordStrength.tone === "signal" && "text-signal-strong"
                          )}
                        >
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[1, 2, 3, 4].map((step) => (
                          <div
                            key={step}
                            className={cn(
                              "h-1.5 rounded-full transition-colors",
                              passwordStrength.score >= step
                                ? passwordStrength.tone === "danger"
                                  ? "bg-danger"
                                  : passwordStrength.tone === "warn"
                                    ? "bg-warn"
                                    : "bg-signal"
                                : "bg-ink-200"
                            )}
                          />
                        ))}
                      </div>
                      <p className="text-2xs text-ink-500">
                        {form.password.length < 8
                          ? "Gunakan minimal 8 karakter dengan kombinasi angka/huruf besar."
                          : "Kata sandi memenuhi standar keamanan Noewbar."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Confirm Password (Register Mode Only) */}
                {mode === "register" && (
                  <div>
                    <label htmlFor="auth-confirm-password" className="label mb-1.5 flex items-center justify-between">
                      <span>Ulangi Kata Sandi</span>
                      {form.confirmPassword && (
                        <span
                          className={cn(
                            "text-2xs font-semibold flex items-center gap-1",
                            passwordsMatch ? "text-signal-strong" : "text-danger-strong"
                          )}
                        >
                          {passwordsMatch ? (
                            <>
                              <Check className="h-3 w-3" /> Cocok
                            </>
                          ) : (
                            "Tidak Cocok"
                          )}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
                        <Lock className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <input
                        id="auth-confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={form.confirmPassword}
                        onChange={(e) => set("confirmPassword", e.target.value)}
                        autoComplete="new-password"
                        placeholder="Ketik ulang kata sandi Anda..."
                        className={cn(
                          "field pl-9 pr-11",
                          form.confirmPassword && !passwordsMatch && "border-danger focus:ring-danger/20"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? "Sembunyikan konfirmasi sandi" : "Tampilkan konfirmasi sandi"}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-400 hover:text-ink hover:bg-ink-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Remember Me Checkbox (Login Mode Only) */}
                {mode === "login" && (
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-ink-600 select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 rounded border-ink-300 text-ink focus:ring-signal"
                      />
                      <span>Ingat sesi masuk di perangkat ini</span>
                    </label>
                  </div>
                )}

                {/* ── Identity Toko (Register Mode) ── */}
                {mode === "register" && (
                  <div className="space-y-4 border-t border-ink-200 pt-4">
                    <div className="flex items-center justify-between">
                      <p className="eyebrow">Identitas Bisnis &amp; Kontak</p>
                      <span className="text-2xs text-ink-400">Wajib diisi</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="reg-business-name" className="label mb-1.5">
                          Nama Toko / Bisnis
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
                            <Store className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <input
                            id="reg-business-name"
                            type="text"
                            required
                            value={form.business_name}
                            onChange={(e) => set("business_name", e.target.value)}
                            placeholder="Contoh: Hijab Cantik Official"
                            className="field pl-9"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="reg-owner-name" className="label mb-1.5">
                          Nama Pemilik
                        </label>
                        <div className="relative">
                          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-ink-400">
                            <User className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <input
                            id="reg-owner-name"
                            type="text"
                            required
                            value={form.owner_name}
                            onChange={(e) => set("owner_name", e.target.value)}
                            placeholder="Budi Santoso"
                            className="field pl-9"
                          />
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Number with +62 Badge */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="reg-owner-wa" className="label mb-0">
                          Nomor WhatsApp Pribadi Pemilik
                        </label>
                        {formattedWhatsApp && (
                          <span className="text-2xs font-mono text-signal-strong">
                            Format: {formattedWhatsApp}
                          </span>
                        )}
                      </div>
                      <div className="relative flex rounded-lg border border-ink-200 bg-white focus-within:border-signal focus-within:ring-2 focus-within:ring-signal/20 transition-all">
                        <span className="inline-flex items-center border-r border-ink-200 bg-ink-50 px-3 text-xs font-semibold text-ink-600 select-none">
                          🇮🇩 +62
                        </span>
                        <input
                          id="reg-owner-wa"
                          type="tel"
                          required
                          value={form.owner_whatsapp}
                          onChange={(e) => set("owner_whatsapp", e.target.value)}
                          placeholder="81234567890 (atau 0812...)"
                          inputMode="tel"
                          className="w-full rounded-r-lg border-0 bg-transparent px-3 py-2 text-xs text-ink placeholder:text-ink-400 focus:outline-none"
                        />
                      </div>
                      <p className="mt-1 text-2xs text-ink-500 leading-relaxed">
                        Digunakan untuk notifikasi order masuk dan eskalasi darurat saat bot AI membutuhkan bantuan pemilik toko.
                      </p>
                    </div>

                    {/* ── Progressive Disclosure: Optional Catalog & Logistics ── */}
                    <div className="border-t border-ink-200 pt-3">
                      <button
                        type="button"
                        onClick={() => setShowOptionalFields(!showOptionalFields)}
                        className="flex w-full items-center justify-between py-2 text-xs font-semibold text-ink-700 hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal rounded"
                      >
                        <span className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-ink-500" />
                          Atur Katalog &amp; Asal Pengiriman Sekarang (Opsional)
                        </span>
                        <div className="flex items-center gap-1 text-ink-400 text-2xs">
                          <Badge tone="neutral" className="text-2xs">bisa nanti</Badge>
                          {showOptionalFields ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </div>
                      </button>

                      {showOptionalFields && (
                        <div className="mt-3 space-y-3.5 rounded-xl border border-ink-200 bg-surface-sunken p-4 animate-in fade-in duration-200">
                          <p className="text-2xs text-ink-600 leading-relaxed">
                            Informasi ini dapat dilewati sekarang dan diisi kapan saja nanti di tab <strong>Katalog</strong> dan <strong>Pengaturan Toko</strong>.
                          </p>

                          <TextField
                            id="reg-sheets-url"
                            label="Link Google Sheets Katalog"
                            value={form.sheets_url}
                            onChange={(e) => set("sheets_url", e.target.value)}
                            placeholder="https://docs.google.com/spreadsheets/d/..."
                            inputMode="url"
                            optional
                            hint="Link Google Sheets dengan izin 'Siapa saja yang memiliki link dapat melihat'."
                          />

                          <TextField
                            id="reg-subdistrict"
                            label="Kecamatan Asal Pengiriman"
                            value={form.origin_subdistrict}
                            onChange={(e) => set("origin_subdistrict", e.target.value)}
                            placeholder="Contoh: Coblong, Kota Bandung"
                            optional
                            hint="Patokan asal gudang untuk perhitungan ongkir otomatis ke seluruh Indonesia."
                          />

                          <TextField
                            id="reg-tg-chat"
                            label="Chat ID Telegram (Opsional)"
                            value={form.owner_telegram_chat_id}
                            onChange={(e) => set("owner_telegram_chat_id", e.target.value)}
                            placeholder="123456789"
                            optional
                            hint="Untuk menerima salinan notifikasi pesanan ke bot Telegram Anda."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {error && <ErrorState title="Terjadi Kendala" description={error} compact />}

                {/* Submit Action Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    className="w-full min-h-[44px] text-sm font-semibold shadow-flat flex items-center justify-center gap-2"
                    loading={busy}
                  >
                    {busy ? (
                      mode === "login" ? "Memverifikasi Kredensial..." : "Menyiapkan Akun Toko..."
                    ) : mode === "login" ? (
                      <>
                        Masuk ke Dashboard
                        <ArrowRight className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Daftar &amp; Mulai Uji Coba Gratis
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          {/* Bottom Switcher Helper */}
          <div className="mt-5 text-center">
            {mode === "login" ? (
              <p className="text-xs text-ink-600">
                Belum memiliki akun toko?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className="font-semibold text-signal-strong hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal rounded"
                >
                  Daftar gratis 7 hari tanpa kartu kredit
                </button>
              </p>
            ) : (
              <p className="text-xs text-ink-600">
                Sudah memiliki akun Noewbar?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="font-semibold text-signal-strong hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal rounded"
                >
                  Masuk ke dashboard toko Anda
                </button>
              </p>
            )}
          </div>

          {/* PWA Prompt Banner */}
          <div className="mt-4">
            <PwaInstallPrompt variant="banner" />
          </div>

          {/* Security & Support Guarantee */}
          <div className="mt-6 flex flex-col items-center gap-2 text-center">
            <p className="flex items-center gap-1.5 text-2xs leading-relaxed text-ink-500">
              <ShieldCheck className="h-3.5 w-3.5 text-signal shrink-0" aria-hidden="true" />
              <span>Enkripsi Argon2id berstandar perbankan. Data toko dan sesi WhatsApp terisolasi multi-tenant.</span>
            </p>
            <a
              href="https://wa.me/?text=Halo%20Admin%20Noewbar,%20saya%20butuh%20bantuan%20seputar%20akses%20toko%20saya"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[36px] items-center gap-1.5 text-2xs font-semibold text-ink-600 hover:text-ink hover:underline transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5 text-signal" />
              Butuh panduan? Hubungi Tim Dukungan WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* ── Right Column: SaaS Value Showcase (Desktop Only) ── */}
      <div className="hidden lg:col-span-5 xl:col-span-5 lg:flex flex-col justify-between bg-ink text-white p-10 lg:p-12 relative overflow-hidden border-l border-ink-800">
        {/* Ambient brand grid / subtle texture without AI cliché blobs */}
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:20px_20px] opacity-25 pointer-events-none" />

        <div className="relative z-10 space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-2xs font-semibold text-emerald-400">
            <Sparkles className="h-3 w-3" />
            Platform Otomatisasi Penjualan WhatsApp #1
          </div>

          <div>
            <h2 className="text-2xl xl:text-3xl font-bold tracking-tight text-white leading-tight">
              Tingkatkan Konversi Penjualan Toko Anda 24 Jam Nonstop.
            </h2>
            <p className="mt-3 text-xs xl:text-sm text-ink-300 leading-relaxed">
              Noewbar CS Pro menggabungkan kecerdasan buatan, data stok real-time, dan kalkulasi logistik lokal untuk melayani pembeli layaknya tim customer service terbaik.
            </p>
          </div>

          {/* Pillars List */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Respons Percakapan &lt; 2 Detik</h3>
                <p className="text-2xs text-ink-300 mt-0.5 leading-relaxed">
                  Gaya bahasa santun dan natural manusia. Mengerti ukuran tubuh, varian warna, dan promo bundling.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Cek Ongkir Mandiri Rp 0 (Bebas Biaya API)</h3>
                <p className="text-2xs text-ink-300 mt-0.5 leading-relaxed">
                  Menghitung tarif ekspedisi J&amp;T, SiCepat, dan JNE ke seluruh kecamatan Indonesia secara instan.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CreditCard className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">Direct Payment (0% Potongan Gateway)</h3>
                <p className="text-2xs text-ink-300 mt-0.5 leading-relaxed">
                  Uang pembeli 100% langsung masuk ke rekening bank atau QRIS pribadi toko Anda tanpa perantara.
                </p>
              </div>
            </div>
          </div>

          {/* Prinsip Keamanan & Kedaulatan Data */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm space-y-2.5">
            <div className="flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Prinsip Kedaulatan Data &amp; Zero-Custody
              </span>
            </div>
            <p className="text-xs text-ink-300 leading-relaxed">
              Noewbar CS Pro tidak menjadi perantara pembayaran atau memotong biaya komisi transaksi. Seluruh uang pembeli mengalir 100% langsung ke rekening bank atau QRIS pribadi toko Anda. Kredensial toko terlindungi dengan enkripsi Argon2id dan basis data multi-tenant terisolasi.
            </p>
          </div>
        </div>

        {/* Live System Indicator */}
        <div className="relative z-10 pt-8 border-t border-white/10 flex items-center justify-between text-2xs text-ink-400">
          <div className="flex items-center gap-2">
            <StatusDot ok pulse />
            <span className="text-emerald-400 font-medium">Semua Sistem Beroperasi Normal</span>
          </div>
          <span className="font-mono">v1.0.0 Pro</span>
        </div>
      </div>
    </main>
  );
}
