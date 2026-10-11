"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import { cn } from "@/components/ui";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function PwaInstallPrompt({
  variant = "button",
  className,
}: {
  variant?: "button" | "compact" | "banner";
  className?: string;
}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if already running as standalone PWA
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(Boolean(isStandaloneMode));

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosGuide(true);
    } else {
      // For desktop or non-supported browsers, show guide or toast
      setShowIosGuide(true);
    }
  }

  if (isStandalone || installed) {
    return null;
  }

  return (
    <>
      {variant === "compact" ? (
        <button
          type="button"
          onClick={handleInstallClick}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 transition-colors hover:bg-indigo-500/20 dark:text-indigo-400",
            className
          )}
          title="Pasang / Unduh Aplikasi di HP atau Desktop"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Pasang Aplikasi</span>
        </button>
      ) : variant === "banner" ? (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-indigo-900/50 dark:bg-indigo-950/40",
            className
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Pasang Noewbar di Layar Utama HP
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Akses cepat ke chat WhatsApp toko, stok produk, dan pesanan tanpa perlu buka browser.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 min-h-[44px]"
          >
            <Download className="h-4 w-4" />
            <span>Pasang Sekarang</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleInstallClick}
          className={cn(
            "flex min-h-[36px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500 dark:hover:bg-slate-850 sm:text-sm",
            className
          )}
          title="Pasang aplikasi di smartphone atau komputer"
        >
          <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>Unduh Aplikasi</span>
        </button>
      )}

      {/* Guide Modal for iOS or manual install */}
      {showIosGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Tutup petunjuk pemasangan"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Pasang Aplikasi Noewbar
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Instal langsung ke layar beranda HP Anda
                </p>
              </div>
            </div>

            <div className="space-y-3 py-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-700 font-bold dark:bg-indigo-950 dark:text-indigo-400">
                  1
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {isIos ? "Tekan tombol Share di Safari" : "Buka Menu Browser"}
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    {isIos ? (
                      <>
                        Ikon kotak dengan panah ke atas (<Share2 className="inline h-3.5 w-3.5" />) di bagian bawah layar.
                      </>
                    ) : (
                      "Tekan tanda titik tiga di pojok kanan atas browser."
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-indigo-100 text-indigo-700 font-bold dark:bg-indigo-950 dark:text-indigo-400">
                  2
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Pilih &quot;Tambahkan ke Layar Utama&quot;
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Atau &quot;Install App&quot; / &quot;Add to Home Screen&quot;. Aplikasi Noewbar akan langsung terpasang seperti aplikasi bawaan.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-850">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-emerald-100 text-emerald-700 font-bold dark:bg-emerald-950 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    Siap Digunakan Kapan Saja
                  </p>
                  <p className="text-slate-500 dark:text-slate-400">
                    Buka langsung dari home screen tanpa batas URL dan notifikasi langsung aktif.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosGuide(false)}
              className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 min-h-[44px]"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
