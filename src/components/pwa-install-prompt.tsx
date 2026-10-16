"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Download,
  Share2,
  Smartphone,
  X,
} from "lucide-react";
import { Modal, cn } from "@/components/ui";

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
            "flex min-h-[36px] items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 shadow-flat transition-colors hover:border-ink-300 hover:bg-ink-50",
            className
          )}
          title="Pasang / Unduh Aplikasi di HP atau Desktop"
        >
          <Download className="h-3.5 w-3.5 text-signal" />
          <span>Pasang Aplikasi</span>
        </button>
      ) : variant === "banner" ? (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl border border-ink-200 bg-ink-50/80 p-4 sm:flex-row sm:items-center sm:justify-between",
            className
          )}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink text-white shadow-raised">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                Pasang Noewbar di Layar Utama HP
              </p>
              <p className="text-xs text-ink-600">
                Akses cepat ke chat WhatsApp toko, stok produk, dan pesanan tanpa perlu buka browser.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white shadow-raised transition-colors hover:bg-ink-800"
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
            "flex min-h-[36px] items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-flat transition-colors hover:border-ink-300 hover:bg-ink-50 sm:text-sm",
            className
          )}
          title="Pasang aplikasi di smartphone atau komputer"
        >
          <Download className="h-3.5 w-3.5 text-signal" />
          <span>Unduh Aplikasi</span>
        </button>
      )}

      {/* Guide Modal for iOS or manual install */}
      <Modal open={showIosGuide} onClose={() => setShowIosGuide(false)}>
        <div
          className="relative w-full max-w-sm card-overlay rounded-xl border border-ink-200 bg-white p-6 shadow-overlay"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => setShowIosGuide(false)}
            className="absolute right-4 top-4 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors"
            aria-label="Tutup petunjuk pemasangan"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-white shadow-raised">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">
                Pasang Aplikasi Noewbar
              </h3>
              <p className="text-xs text-ink-500">
                Instal langsung ke layar beranda HP Anda
              </p>
            </div>
          </div>

          <div className="space-y-3 py-2 text-xs text-ink-700">
            <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-ink-50/70 p-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ink-200 font-mono text-xs font-bold text-ink-800">
                1
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-ink">
                  {isIos ? "Tekan tombol Share di Safari" : "Buka Menu Browser"}
                </p>
                <p className="text-ink-500 flex items-center gap-1.5">
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

            <div className="flex items-start gap-3 rounded-lg border border-ink-200 bg-ink-50/70 p-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-ink-200 font-mono text-xs font-bold text-ink-800">
                2
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-ink">
                  Pilih &quot;Tambahkan ke Layar Utama&quot;
                </p>
                <p className="text-ink-500">
                  Atau &quot;Install App&quot; / &quot;Add to Home Screen&quot;. Aplikasi Noewbar akan langsung terpasang seperti aplikasi bawaan.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-signal-subtle bg-signal-wash p-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-signal-subtle text-signal-strong font-bold">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-signal-strong">
                  Siap Digunakan Kapan Saja
                </p>
                <p className="text-ink-600">
                  Buka langsung dari home screen tanpa batas URL dan notifikasi langsung aktif.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowIosGuide(false)}
            className="mt-4 w-full min-h-[44px] rounded-lg bg-ink px-4 py-2.5 text-xs font-semibold text-white shadow-raised transition-colors hover:bg-ink-800"
          >
            Saya Mengerti
          </button>
        </div>
      </Modal>
    </>
  );
}
