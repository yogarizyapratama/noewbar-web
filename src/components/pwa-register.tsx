"use client";

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. Service Worker registration
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for worker updates
          reg.onupdatefound = () => {
            const installing = reg.installing;
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                  // New content is available
                  console.log("[PWA] Service worker updated.");
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn("[PWA] Service worker registration failed:", err);
        });
    }

    // 2. Connectivity listener
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900 shadow-md sm:left-auto sm:right-6"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
        <span className="font-semibold">Mode Offline Aktif</span>
      </div>
      <p className="mt-0.5 text-2xs text-amber-700">
        Perangkat Anda sedang offline. Menampilkan data tersimpan di memori cache lokal.
      </p>
    </div>
  );
}
