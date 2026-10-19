"use client";

/**
 * WhatsApp connection tab.
 *
 * The QR is fetched through /api/wa/qr. The first response can legitimately
 * carry an empty qr_base64 because WhatsApp emits the code a moment after the
 * socket opens, so this panel polls until a QR arrives and shows a countdown
 * instead of leaving the user staring at a blank card.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Check, CheckCircle2, Copy, Download, KeyRound, Loader2, MessageSquare, QrCode, RefreshCw, Smartphone } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  ErrorState,
  ConfirmModal,
  PageHeader,
  StatusDot,
  cn,
} from "@/components/ui";
import type { Health } from "./types";

type QrState = { base64: string; status: string } | null;

const STEPS = [
  "Buka WhatsApp di HP toko Anda.",
  "Masuk ke Pengaturan, lalu Perangkat tertaut.",
  "Pilih Tautkan perangkat, arahkan kamera ke QR di samping.",
  "Tunggu sampai status berubah menjadi CONNECTED.",
];

const CODE_STEPS = [
  "Buka WhatsApp di HP toko Anda.",
  "Masuk ke Pengaturan > Perangkat tertaut.",
  "Pilih Tautkan perangkat > Tautkan dengan nomor telepon saja.",
  "Ketik 8 digit kode yang muncul di layar ini ke WhatsApp Anda.",
];

export function PanelWhatsapp({
  health,
  onRefreshHealth,
}: {
  health: Health | null;
  onRefreshHealth: () => void;
}) {
  const [qr, setQr] = useState<QrState>(null);
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live Gateway Ping Probe state
  const [pingLoading, setPingLoading] = useState(false);
  const [pingResult, setPingResult] = useState<{
    latency_ms: number;
    status: string;
    ok: boolean;
  } | null>(null);

  const handlePingGateway = useCallback(async () => {
    setPingLoading(true);
    try {
      const res = await fetch("/api/whatsapp/ping");
      const json = await res.json();
      if (json.ok) {
        setPingResult({
          latency_ms: json.latency_ms,
          status: json.status,
          ok: true,
        });
      } else {
        setPingResult({
          latency_ms: json.latency_ms ?? 0,
          status: json.status || "UNREACHABLE",
          ok: false,
        });
      }
    } catch {
      setPingResult({
        latency_ms: 0,
        status: "ERROR",
        ok: false,
      });
    } finally {
      setPingLoading(false);
    }
  }, []);

  const connected = health?.whatsapp?.connection_status === "CONNECTED";
  const daemonDown = health?.whatsapp ? health.whatsapp.daemon_reachable === false : false;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  useEffect(() => {
    handlePingGateway();
  }, [handlePingGateway]);

  const requestQr = useCallback(
    async (action: "start" | "poll" | "logout") => {
      const res = await fetch("/api/wa/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      return res.json();
    },
    []
  );

  /**
   * Poll until WhatsApp emits the code or the pairing completes. The window is
   * 5 minutes: pairing succeeds on the phone (device row appears in the daemon)
   * but the dashboard only learns it when a poll syncs the DB row, so a short
   * window leaves the UI stuck on PAIRING after a successful scan.
   */
  const pollForQr = useCallback(async () => {
    setPolling(true);
    setCountdown(150);
    let attempts = 0;

    await new Promise<void>((resolve) => {
      clearTimer();
      timerRef.current = setInterval(async () => {
        attempts += 1;
        setCountdown((c) => (c > 0 ? c - 1 : 0));
        try {
          const json = await requestQr("poll");
          if (json.qr_base64) {
            setQr({ base64: json.qr_base64, status: json.connection_status ?? "PAIRING" });
            clearTimer();
            setPolling(false);
            resolve();
            return;
          }
          if (json.connection_status === "CONNECTED") {
            clearTimer();
            setPolling(false);
            onRefreshHealth();
            resolve();
            return;
          }
        } catch {
          /* keep polling, the next tick may succeed */
        }
        if (attempts >= 150) {
          clearTimer();
          setPolling(false);
          onRefreshHealth();
          resolve();
        }
      }, 2000);
    });
  }, [clearTimer, onRefreshHealth, requestQr]);

  /**
   * Manual re-check: polls the daemon once so a scan that succeeded while the
   * auto-poll window was closed still flips the UI to CONNECTED.
   */
  async function recheckStatus() {
    setBusy(true);
    setError(null);
    try {
      const json = await requestQr("poll");
      if (json.connection_status === "CONNECTED") {
        setQr(null);
      } else if (json.daemon_reachable === false) {
        setError(json.error ?? "Server gateway WhatsApp belum terhubung.");
      }
    } catch {
      /* health refresh below still runs */
    } finally {
      setBusy(false);
      onRefreshHealth();
    }
  }

  async function logoutSession() {
    setConfirmLogout(false);
    setBusy(true);
    setError(null);
    try {
      const json = await requestQr("logout");
      if (!json.ok && json.error) {
        setError(json.error);
      }
      setQr(null);
    } catch {
      setError("Gagal menghubungi server gateway WhatsApp.");
    } finally {
      setBusy(false);
      onRefreshHealth();
    }
  }

  async function startPairing() {
    setBusy(true);
    setError(null);
    setQr(null);
    try {
      const json = await requestQr("start");
      if (json.daemon_reachable === false) {
        setError(
          json.error ??
            "Server gateway WhatsApp belum terhubung. Silakan coba sesaat lagi."
        );
        return;
      }
      if (json.connection_status === "CONNECTED") {
        onRefreshHealth();
        return;
      }
      if (json.qr_base64) {
        setQr({ base64: json.qr_base64, status: json.connection_status ?? "PAIRING" });
      } else {
        await pollForQr();
      }
      onRefreshHealth();
    } catch {
      setError("Gagal menghubungi server gateway WhatsApp.");
    } finally {
      setBusy(false);
    }
  }

  const [pairMethod, setPairMethod] = useState<"qr" | "code">("qr");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function requestPairingCode() {
    if (!phoneNumber.trim()) {
      setError("Masukkan nomor WhatsApp toko Anda.");
      return;
    }
    setCodeLoading(true);
    setError(null);
    setPairingCode(null);
    try {
      const res = await fetch("/api/wa/qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pair_phone",
          phone: phoneNumber.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mendapatkan kode pairing.");
      }
      setPairingCode(data.pairing_code);
      pollForQr();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCodeLoading(false);
    }
  }

  function copyCode() {
    if (!pairingCode) return;
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Integrasi"
        title="Koneksi WhatsApp"
        description="Pindai QR dengan WhatsApp di HP toko. Sesi disimpan terpisah per toko, jadi nomor satu toko tidak pernah tercampur dengan yang lain."
        icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={handlePingGateway}
              loading={pingLoading}
              title="Uji round-trip latency ke WhatsApp daemon"
            >
              <Activity className="h-4 w-4 text-signal-strong" aria-hidden="true" />
              {pingResult ? `Ping: ${pingResult.latency_ms} ms` : "Uji Ping Gateway"}
            </Button>
            <Button variant="secondary" onClick={recheckStatus}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Periksa status
            </Button>
          </div>
        }
      />

      {/* status strip */}
      <Card>
        <CardHeader
          icon={<Smartphone className="h-4 w-4" aria-hidden="true" />}
          title="Status nomor toko"
          description={
            connected
              ? "Nomor sudah tertaut dan siap menerima chat pembeli."
              : "Nomor belum tertaut. Bot belum bisa membalas siapa pun."
          }
          actions={
            <>
              <Badge tone={connected ? "signal" : daemonDown ? "danger" : "warn"}>
                <StatusDot ok={connected} pulse={connected} />
                {connected ? "CONNECTED" : health?.whatsapp?.connection_status ?? "OFFLINE"}
              </Badge>
              {connected && (
                <Button variant="secondary" size="sm" onClick={() => setConfirmLogout(true)} loading={busy}>
                  Putuskan sesi
                </Button>
              )}
            </>
          }
        />
        <CardBody className="p-0">
          <dl className="divide-y divide-ink-200">
            <div className="flex items-baseline justify-between gap-4 px-5 py-2.5">
              <dt className="text-xs text-ink-600">Nomor terpasang</dt>
              <dd className="font-mono text-xs font-medium text-ink">
                {health?.whatsapp?.phone_number ?? "belum terhubung"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-5 py-2.5">
              <dt className="text-xs text-ink-600">Server WhatsApp</dt>
              <dd
                className={cn(
                  "font-mono text-xs font-medium",
                  daemonDown ? "text-danger" : "text-signal-strong"
                )}
              >
                {daemonDown ? "belum terhubung" : "Online & Siap"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-2.5">
              <dt className="text-xs text-ink-600 flex items-center gap-1.5">
                <span>Latensi Gateway Probe</span>
                {pingResult && (
                  <span
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono font-bold",
                      pingResult.ok && pingResult.latency_ms < 50
                        ? "bg-signal-wash text-signal-strong"
                        : pingResult.ok && pingResult.latency_ms < 200
                        ? "bg-warn-wash text-warn-strong"
                        : "bg-danger-wash text-danger"
                    )}
                  >
                    {pingResult.latency_ms} ms
                  </span>
                )}
              </dt>
              <dd className="flex items-center gap-2">
                {pingResult ? (
                  <span className="font-mono text-xs text-ink-700">
                    {pingResult.ok
                      ? pingResult.latency_ms < 50
                        ? "Optimal (<50ms)"
                        : "Stabil"
                      : "Unreachable"}
                  </span>
                ) : (
                  <span className="text-xs text-ink-400">Belum diuji</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePingGateway}
                  loading={pingLoading}
                  className="h-6 px-2 text-[11px]"
                  title="Uji ulang latency probe"
                >
                  <Activity className="mr-1 h-3 w-3" />
                  Uji Ping
                </Button>
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 px-5 py-2.5">
              <dt className="text-xs text-ink-600">Catatan sistem</dt>
              <dd className="truncate font-mono text-xs font-medium text-ink">
                {health?.whatsapp?.error ?? "normal"}
              </dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* pairing card */}
        <Card>
          <CardHeader
            title="Tautkan perangkat"
            description={
              pairMethod === "qr"
                ? "Pindai QR dengan kamera WhatsApp di HP Anda (berlaku ~20 detik)."
                : "Tautkan via nomor HP tanpa perlu pindai kamera QR (cocok jika hanya punya 1 HP)."
            }
            actions={
              !connected && (
                <div className="inline-flex rounded-md border border-ink-200 bg-ink-50 p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPairMethod("qr");
                      setError(null);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                      pairMethod === "qr"
                        ? "bg-white text-ink shadow-xs"
                        : "text-ink-600 hover:text-ink"
                    )}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Pindai QR
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPairMethod("code");
                      setError(null);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                      pairMethod === "code"
                        ? "bg-white text-ink shadow-xs"
                        : "text-ink-600 hover:text-ink"
                    )}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Kode 8-Digit
                  </button>
                </div>
              )
            }
          />
          <CardBody>
            {error && (
              <div className="mb-4">
                <ErrorState title="Pairing gagal" description={error} compact />
              </div>
            )}

            {connected ? (
              <EmptyState
                tone="signal"
                icon={<CheckCircle2 className="h-5 w-5 text-signal" aria-hidden="true" />}
                title="Nomor sudah tertaut"
                description="Tidak perlu scan ulang. Untuk mengganti nomor, putuskan sesi dari HP lalu mulai pairing baru."
                action={
                  <Button variant="secondary" onClick={startPairing} loading={busy}>
                    Mulai pairing ulang
                  </Button>
                }
              />
            ) : pairMethod === "code" ? (
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                <div className="w-full shrink-0 rounded-lg border border-ink-200 bg-ink-50/50 p-4 sm:w-[280px]">
                  <label htmlFor="wa-phone-input" className="block text-xs font-medium text-ink-800">
                    Nomor WhatsApp Toko
                  </label>
                  <p className="mt-0.5 text-2xs text-ink-500">
                    Contoh: 08123456789 atau 628123456789
                  </p>
                  <div className="mt-2">
                    <input
                      id="wa-phone-input"
                      type="tel"
                      placeholder="08xxxxxxxxxx"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={codeLoading}
                      className="w-full rounded-md border border-ink-200 bg-white px-3 py-2 font-mono text-sm text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none focus:ring-1 focus:ring-ink-500"
                    />
                  </div>
                  <Button
                    variant="accent"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={requestPairingCode}
                    loading={codeLoading}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    {pairingCode ? "Minta Ulang Kode" : "Dapatkan Kode Pairing"}
                  </Button>

                  {pairingCode && (
                    <div className="mt-4 rounded-md border border-signal/40 bg-white p-3 text-center shadow-xs">
                      <p className="text-2xs font-semibold uppercase tracking-wider text-signal-strong">
                        Kode Pairing WhatsApp
                      </p>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <span className="font-mono text-2xl font-bold tracking-widest text-ink select-all">
                          {pairingCode.length === 8
                            ? `${pairingCode.slice(0, 4)} - ${pairingCode.slice(4)}`
                            : pairingCode}
                        </span>
                        <button
                          type="button"
                          onClick={copyCode}
                          className="inline-flex h-8 w-8 items-center justify-center rounded border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 active:bg-ink-100"
                          title="Salin kode"
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-signal-strong" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <p className="mt-1.5 text-2xs text-ink-500">
                        {copied ? "Kode berhasil disalin!" : "Masukkan kode ini di WhatsApp HP Anda"}
                      </p>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-ink-700">
                    Cara Menautkan Tanpa Scan QR:
                  </p>
                  <ol className="mt-3 space-y-2.5">
                    {CODE_STEPS.map((s, i) => (
                      <li key={s} className="flex gap-2.5 text-sm text-ink-600">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-ink-100 font-mono text-2xs font-bold text-ink-600">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ol>
                  {polling && (
                    <p
                      className="mt-4 rounded border border-signal/25 bg-signal-wash px-3 py-2 text-xs leading-relaxed text-signal-strong"
                      role="status"
                    >
                      Permintaan kode aktif. Silakan masukkan kode pada WhatsApp HP Anda. Sistem otomatis menunggu konfirmasi sambungan.
                    </p>
                  )}
                  {daemonDown && (
                    <p className="mt-4 rounded border border-danger/25 bg-danger-wash px-3 py-2 text-xs text-danger">
                      Server WhatsApp belum terhubung. Silakan periksa koneksi atau coba beberapa saat lagi.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                <div className="grid h-[220px] w-[220px] shrink-0 place-items-center rounded-lg border border-ink-200 bg-white p-2">
                  {qr?.base64 ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={qr.base64}
                      alt="QR pairing WhatsApp, berlaku sekitar 20 detik"
                      width={204}
                      height={204}
                      className="h-full w-full rounded object-contain"
                    />
                  ) : polling ? (
                    <div className="text-center">
                      <Loader2
                        className="mx-auto h-6 w-6 animate-spin text-ink-400"
                        aria-hidden="true"
                      />
                      <p className="mt-3 text-xs font-medium text-ink-600">Menyiapkan QR...</p>
                      <p className="mt-1 font-mono text-2xs text-ink-400">
                        menunggu WhatsApp ({countdown}s)
                      </p>
                    </div>
                  ) : (
                    <p className="px-4 text-center text-xs leading-relaxed text-ink-500">
                      QR belum diminta. Tekan tombol di bawah untuk memulai pairing.
                    </p>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="accent" onClick={startPairing} loading={busy}>
                      {qr?.base64 ? "Muat ulang QR" : "Tampilkan QR pairing"}
                    </Button>
                    {qr?.base64 && (
                      <a
                        href={qr.base64}
                        download="qr-pairing-whatsapp-noewbar.png"
                        className="btn-secondary inline-flex items-center gap-1.5 text-xs min-h-[36px] px-3 font-medium"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Unduh Gambar QR</span>
                      </a>
                    )}
                  </div>
                  {qr?.status && (
                    <p className="meta mt-3">
                      status sesi: {qr.status}
                      {qr.base64 ? " - QR siap dipindai" : ""}
                    </p>
                  )}
                  {polling && (
                    <p className="mt-3 rounded border border-signal/25 bg-signal-wash px-3 py-2 text-xs leading-relaxed text-signal-strong" role="status">
                      Sudah scan? Tunggu sebentar, sistem sedang mengonfirmasi sambungan ke WhatsApp. Kalau lebih dari 1 menit masih begini, tekan Periksa status.
                    </p>
                  )}
                  <ol className="mt-4 space-y-2.5">
                    {STEPS.map((s, i) => (
                      <li key={s} className="flex gap-2.5 text-sm text-ink-600">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-sm bg-ink-100 font-mono text-2xs font-bold text-ink-600">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{s}</span>
                      </li>
                    ))}
                  </ol>
                  {daemonDown && (
                    <p className="mt-4 rounded border border-danger/25 bg-danger-wash px-3 py-2 text-xs text-danger">
                      Server WhatsApp belum terhubung. Silakan periksa koneksi atau coba beberapa saat lagi.
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* safety note */}
        <Card variant="sunken">
          <CardHeader title="Kenapa ini aman" />
          <CardBody className="space-y-3 text-sm leading-relaxed text-ink-600">
            <p>
              Bot hanya membalas chat yang masuk lebih dulu, dan meniru jeda mengetik manusia.
              Bukan alat blast massal.
            </p>
            <p>
              Kredensial sesi disimpan di server dengan enkripsi, tidak pernah dikirim ke browser
              sebagai teks biasa.
            </p>
            <p className="text-xs text-ink-500">
              Anda bisa memutus tautan kapan saja dari HP: Perangkat tertaut, lalu pilih perangkat
              ini dan klik Keluar.
            </p>
          </CardBody>
        </Card>
      </div>
      <ConfirmModal
        open={confirmLogout}
        title="Putuskan sesi WhatsApp?"
        description="Bot berhenti membalas sampai nomor ditautkan ulang."
        confirmLabel="Putuskan sesi"
        danger
        busy={busy}
        onConfirm={logoutSession}
        onClose={() => setConfirmLogout(false)}
      />
    </div>
  );
}
