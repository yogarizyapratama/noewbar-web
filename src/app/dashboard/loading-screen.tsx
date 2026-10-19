"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Bot, CheckCircle2, Loader2, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui";

interface LoadingStep {
  id: string;
  label: string;
  sublabel: string;
}

const STEPS: LoadingStep[] = [
  {
    id: "auth",
    label: "Verifikasi Sesi Toko",
    sublabel: "Memeriksa kredensial & otorisasi akun...",
  },
  {
    id: "services",
    label: "Sinkronisasi AI & WhatsApp",
    sublabel: "Menghubungkan gateway WhatsApp & engine CS...",
  },
  {
    id: "data",
    label: "Menyiapkan Dashboard",
    sublabel: "Memuat pesanan, katalog, dan analitik...",
  },
];

interface DashboardLoadingScreenProps {
  error?: string | null;
  onRetry?: () => void;
  onBypass?: () => void;
}

export function DashboardLoadingScreen({
  error,
  onRetry,
  onBypass,
}: DashboardLoadingScreenProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progress, setProgress] = useState(18);
  const [isDelayed, setIsDelayed] = useState(false);

  // Progressive loading simulation with real stage transitions
  useEffect(() => {
    const t1 = setTimeout(() => {
      setCurrentStepIndex(1);
      setProgress(55);
    }, 1200);

    const t2 = setTimeout(() => {
      setCurrentStepIndex(2);
      setProgress(88);
    }, 2800);

    const t3 = setTimeout(() => {
      setIsDelayed(true);
      setProgress(96);
    }, 6000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const hasIssue = Boolean(error) || isDelayed;

  return (
    <main
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-surface-sunken px-4 py-8 select-none"
      role="status"
      aria-live="polite"
    >
      {/* Subtle ambient warmth background */}
      <div
        className="pointer-events-none absolute inset-0 bg-ambient opacity-80"
        aria-hidden="true"
      />

      {/* Decorative subtle grid lines */}
      <div
        className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #0F172A 1px, transparent 1px), linear-gradient(to bottom, #0F172A 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm">
        {/* Main Loading Card */}
        <div className="overflow-hidden rounded-2xl border border-ink-200/80 bg-white p-6 sm:p-7 shadow-raised transition-all">
          {/* Animated Brand Emblem */}
          <div className="relative mx-auto mb-5 h-16 w-16">
            {/* Outer soft ping ring */}
            <div
              className="absolute -inset-1 rounded-[18px] bg-signal/20 animate-ping opacity-60 duration-1000"
              aria-hidden="true"
            />
            {/* Emblem Box */}
            <div className="relative flex h-full w-full items-center justify-center rounded-2xl bg-ink-900 text-white shadow-raised overflow-hidden">
              <Bot className="h-8 w-8 text-white transition-transform duration-500" />

              {/* Shimmer sheen pass */}
              <div
                className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]"
                aria-hidden="true"
              />

              {/* Signal Status Dot */}
              <span
                className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-signal ring-2 ring-ink-900 animate-pulse"
                aria-label="Status aktif"
              />
            </div>
          </div>

          {/* Titles */}
          <div className="text-center">
            <p className="eyebrow text-ink-500 tracking-wider">NOEWBAR CS PRO</p>
            <h1 className="mt-1 text-lg font-bold tracking-tight text-ink-900">
              Memuat Workspace
            </h1>
            <p className="mt-1 text-xs text-ink-500">
              Menyiapkan antarmuka toko & otomasi WhatsApp Anda
            </p>
          </div>

          {/* Animated Progress Bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-[11px] font-medium text-ink-500 mb-1.5">
              <span>Status Inisialisasi</span>
              <span className="font-mono text-ink-700">{progress}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100 relative">
              <div
                className="h-full bg-signal transition-all duration-700 ease-out rounded-full relative"
                style={{ width: `${progress}%` }}
              >
                <div
                  className="absolute inset-0 bg-white/25 -translate-x-full animate-[shimmer_1.5s_infinite]"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          {/* Stepper Status Indicator */}
          <div className="mt-5 space-y-2.5 border-t border-ink-100 pt-4">
            {STEPS.map((step, idx) => {
              const isDone = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;

              return (
                <div
                  key={step.id}
                  className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors ${
                    isCurrent
                      ? "bg-surface-sunken border border-ink-100/80"
                      : "opacity-60"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-signal-strong" />
                    ) : isCurrent ? (
                      <Loader2 className="h-4 w-4 text-ink-800 animate-spin" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-ink-300" />
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <p
                      className={`text-xs font-semibold leading-none ${
                        isCurrent ? "text-ink-900" : "text-ink-600"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p className="mt-1 text-[11px] text-ink-500 truncate">
                      {isCurrent ? step.sublabel : isDone ? "Selesai disiapkan" : "Menunggu giliran"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error or Delay Fallback UI */}
          {hasIssue && (
            <div className="mt-5 rounded-xl border border-warn/30 bg-warn-wash p-3.5 text-left animate-fade-up">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 text-warn-strong mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-ink-900">
                    {error ? "Kendala Koneksi Server" : "Memerlukan Waktu Lebih Lama"}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-600">
                    {error ||
                      "Jaringan sedang lambat atau backend sedang memuat ulang service. Anda dapat mencoba lagi atau langsung masuk."}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                {onRetry && (
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={onRetry}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Muat Ulang
                  </Button>
                )}
                {onBypass && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full text-xs"
                    onClick={onBypass}
                  >
                    Masuk Langsung
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Security & System Info Footer */}
        <div className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-ink-400">
          <Smartphone className="h-3.5 w-3.5" />
          <span>Sesi Terenkripsi & Otomasi Toko Aktif</span>
        </div>
      </div>
    </main>
  );
}
