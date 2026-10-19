"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, RefreshCw, WifiOff } from "lucide-react";
import { cn } from "@/components/ui";

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOnline(navigator.onLine);

    function handleOnline() {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    }

    function handleOffline() {
      setIsOnline(false);
      setShowReconnected(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function testConnection() {
    setChecking(true);
    try {
      const res = await fetch("/api/health", { method: "HEAD", cache: "no-store" });
      if (res.ok) {
        setIsOnline(true);
        setShowReconnected(true);
        setTimeout(() => setShowReconnected(false), 3000);
      } else {
        setIsOnline(false);
      }
    } catch {
      setIsOnline(false);
    } finally {
      setChecking(false);
    }
  }

  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {!isOnline ? (
        <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-white p-3.5 shadow-lg">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-danger-wash text-danger">
            <WifiOff className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-danger">Koneksi Terputus (Offline)</p>
            <p className="mt-0.5 text-2xs leading-relaxed text-ink-600">
              Tidak ada jaringan internet. Sistem akan menyinkronkan data secara otomatis saat koneksi kembali.
            </p>
            <button
              type="button"
              onClick={testConnection}
              disabled={checking}
              className="mt-2 inline-flex items-center gap-1.5 rounded border border-ink-200 bg-ink-50 px-2 py-1 text-2xs font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", checking && "animate-spin")} />
              <span>{checking ? "Memeriksa..." : "Coba Sambungkan"}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 rounded-lg border border-signal/40 bg-white px-3.5 py-2.5 shadow-lg">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-signal-wash text-signal-strong">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-signal-strong">Terhubung Kembali</p>
            <p className="text-2xs text-ink-600">Koneksi internet pulih. Data disinkronkan.</p>
          </div>
        </div>
      )}
    </div>
  );
}
