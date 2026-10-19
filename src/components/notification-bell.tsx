"use client";

/**
 * Realtime Notification Bell Component (SSE Driven).
 *
 * Standar antislop:
 * - Mendukung mode tenant (Dashboard Toko) dan admin (Superadmin Console).
 * - Notifikasi penting real-time berbasis Server-Sent Events (/api/realtime).
 * - Filter 'Semua' dan 'Belum Dibaca', tandai dibaca per-item atau sekaligus.
 * - Navigasi kontekstual: klik notifikasi langsung membuka tab / modul terkait.
 * - Terintegrasi localStorage agar riwayat notifikasi tersimpan saat refresh.
 * - Zero em-dash di seluruh teks.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  CreditCard,
  MessageSquare,
  Package,
  Power,
  Server,
  Smartphone,
  Trash2,
  Volume2,
  VolumeX,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { cn, timeAgo } from "@/components/ui";

export type AppNotification = {
  id: string;
  type: "order" | "proof" | "chat" | "wa_status" | "billing" | "killswitch" | "fleet" | "alert" | "verified";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  targetTab?: string;
};

function playNotificationChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Harmonic two-tone chime (E5 -> A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.12, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.25);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.15, now + 0.14);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  } catch {
    // Autoplay policy or unsupported audio context
  }
}

export function NotificationBell({
  scope,
  theme = "light",
  onNavigate,
  externalEvent,
}: {
  scope: "tenant" | "admin";
  theme?: "light" | "dark";
  onNavigate?: (targetTab: string) => void;
  externalEvent?: { type?: string; [key: string]: unknown } | null;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasDesktopPermission, setHasDesktopPermission] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const storageKey = `noewbar_notif_${scope}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedSound = localStorage.getItem("noewbar_sound_notif");
      if (savedSound !== null) setSoundEnabled(savedSound === "true");
      if ("Notification" in window) {
        setHasDesktopPermission(Notification.permission === "granted");
      }
    } catch {}
  }, []);

  function toggleSound() {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("noewbar_sound_notif", String(next));
      } catch {}
      if (next) playNotificationChime();
      return next;
    });
  }

  function requestDesktopPermission() {
    if (typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().then((permission) => {
        setHasDesktopPermission(permission === "granted");
        if (permission === "granted") {
          new Notification("Notifikasi Noewbar Aktif", {
            body: "Anda akan menerima pemberitahuan instan saat ada pesanan atau bukti bayar baru.",
            icon: "/favicon.ico",
          });
        }
      });
    }
  }

  // 1. Muat riwayat notifikasi dari localStorage saat pertama mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setNotifications(JSON.parse(saved));
      } else {
        // Data inisial default yang informatif jika belum ada event
        const defaultNotifs: AppNotification[] =
          scope === "tenant"
            ? [
                {
                  id: "init-1",
                  type: "wa_status",
                  title: "Sistem Siap Digunakan",
                  description: "Sambungkan WhatsApp toko Anda pada menu Koneksi WhatsApp untuk mulai melayani pembeli otomatis.",
                  timestamp: new Date().toISOString(),
                  read: false,
                  targetTab: "whatsapp",
                },
              ]
            : [
                {
                  id: "admin-init-1",
                  type: "alert",
                  title: "Konsol Platform Aktif",
                  description: "Telemetri cluster AI Gateway, WhatsMeow daemon, dan database berjalan normal.",
                  timestamp: new Date().toISOString(),
                  read: true,
                  targetTab: "overview",
                },
              ];
        setNotifications(defaultNotifs);
      }
    } catch {
      // Abaikan error localStorage
    }
  }, [storageKey, scope]);

  // Simpan ke localStorage setiap kali notifikasi berubah
  useEffect(() => {
    if (typeof window === "undefined" || notifications.length === 0) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications.slice(0, 50)));
    } catch {
      // Abaikan quota error
    }
  }, [notifications, storageKey]);

  // 2. Realtime Event Processor
  const processEvent = useCallback((data: { type?: string; [key: string]: unknown }) => {
    const eventType = data.type as AppNotification["type"];
    if (!eventType) return;

    let notifItem: AppNotification | null = null;
    const now = new Date().toISOString();

    if (scope === "tenant") {
      switch (eventType) {
        case "order":
          notifItem = {
            id: `order-${Date.now()}`,
            type: "order",
            title: "Pesanan Baru Masuk",
            description: "Pelanggan baru saja menyelesaikan pembuatan pesanan.",
            timestamp: now,
            read: false,
            targetTab: "pesanan",
          };
          break;
        case "proof":
          notifItem = {
            id: `proof-${Date.now()}`,
            type: "proof",
            title: "Bukti Transfer Baru Diunggah",
            description: "Pembeli telah mengirimkan foto bukti transfer pembayaran, mohon verifikasi.",
            timestamp: now,
            read: false,
            targetTab: "pesanan",
          };
          break;
        case "verified":
          notifItem = {
            id: `verified-${Date.now()}`,
            type: "verified",
            title: "Pembayaran Terverifikasi",
            description: "Pesanan telah dikonfirmasi lunas dan siap diproses pengiriman.",
            timestamp: now,
            read: false,
            targetTab: "pesanan",
          };
          break;
        case "chat":
          notifItem = {
            id: `chat-${Date.now()}`,
            type: "chat",
            title: "Pesan WhatsApp Masuk",
            description: "Percakapan baru dari pembeli masuk dan ditangani oleh bot.",
            timestamp: now,
            read: false,
            targetTab: "chat",
          };
          break;
        case "wa_status":
          notifItem = {
            id: `wa-${Date.now()}`,
            type: "wa_status",
            title: "Perubahan Sesi WhatsApp",
            description: "Status koneksi daemon WhatsMeow toko Anda telah diperbarui.",
            timestamp: now,
            read: false,
            targetTab: "whatsapp",
          };
          break;
        case "billing":
          notifItem = {
            id: `bill-${Date.now()}`,
            type: "billing",
            title: "Status Langganan Diperbarui",
            description: "Perubahan paket langganan atau siklus billing toko telah dicatat.",
            timestamp: now,
            read: false,
            targetTab: "billing",
          };
          break;
      }
    } else {
      // Scope Admin (Superadmin Platform)
      const detail = typeof data.detail === "string" ? data.detail : undefined;
      switch (eventType) {
        case "killswitch":
          notifItem = {
            id: `ks-${Date.now()}`,
            type: "killswitch",
            title: "Status Emergency Kill-Switch",
            description: detail ?? "Saklar darurat bot global diubah statusnya oleh operator.",
            timestamp: now,
            read: false,
            targetTab: "killswitch",
          };
          break;
        case "fleet":
          notifItem = {
            id: `fleet-${Date.now()}`,
            type: "fleet",
            title: detail ? `Fleet WhatsApp: ${detail}` : "Aktivitas Fleet & Tenant",
            description: detail ?? "Pembaruan instance WhatsApp atau perubahan status tenant toko.",
            timestamp: now,
            read: false,
            targetTab: "fleet",
          };
          break;
        case "alert":
          notifItem = {
            id: `alert-${Date.now()}`,
            type: "alert",
            title: "Operasi Pemeliharaan Platform",
            description: detail ?? "Siklus sweep pemeliharaan sistem atau uji saluran alert dieksekusi.",
            timestamp: now,
            read: false,
            targetTab: "infrastructure",
          };
          break;
        case "billing":
          notifItem = {
            id: `admin-bill-${Date.now()}`,
            type: "billing",
            title: "Transaksi Webhook Midtrans",
            description: detail ?? "Webhook pembayaran langganan baru masuk dan direkonsiliasi.",
            timestamp: now,
            read: false,
            targetTab: "financials",
          };
          break;
        case "wa_status":
          notifItem = {
            id: `admin-wa-${Date.now()}`,
            type: "wa_status",
            title: "Status WhatsApp Berubah",
            description: detail ?? "Status koneksi WhatsApp diperbarui.",
            timestamp: now,
            read: false,
            targetTab: "fleet",
          };
          break;
      }
    }

    if (notifItem) {
      // Dedupe: collapse same-type events arriving within 5s into one item
      // (a single admin click fans out multiple same-type events).
      setNotifications((prev) => {
        const first = prev[0];
        const incomingAt = Date.parse(notifItem!.timestamp);
        if (
          first &&
          first.type === notifItem!.type &&
          first.title === notifItem!.title &&
          incomingAt - Date.parse(first.timestamp) < 5000
        ) {
          return prev;
        }
        return [notifItem!, ...prev.slice(0, 49)];
      });
      setHasNewAlert(true);

      // Play audio chime if enabled
      if (soundEnabled) {
        playNotificationChime();
      }

      // Fire desktop browser notification if permission is granted
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          const n = new Notification(notifItem.title, {
            body: notifItem.description,
            icon: "/favicon.ico",
          });
          const targetTab = notifItem.targetTab;
          if (targetTab && onNavigate) {
            n.onclick = () => {
              window.focus();
              onNavigate(targetTab);
            };
          }
        } catch {}
      }
    }
  }, [onNavigate, scope, soundEnabled]);

  // Use external event stream if parent provides one, otherwise fallback to own EventSource
  useEffect(() => {
    if (externalEvent !== undefined) {
      if (externalEvent) processEvent(externalEvent);
      return;
    }
    if (typeof window === "undefined") return;
    const url = `/api/realtime?scope=${scope}`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        processEvent(data);
      } catch {}
    };

    es.onerror = () => {
      // EventSource reconnects automatically
    };

    return () => es.close();
  }, [externalEvent, processEvent, scope]);

  // Click outside listener untuk menutup dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function markAllAsRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setHasNewAlert(false);
  }

  function markAsRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? ({ ...n, read: true }) : n)));
  }

  function clearAll() {
    setNotifications([]);
    setHasNewAlert(false);
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  }

  function handleItemClick(notif: AppNotification) {
    markAsRead(notif.id);
    if (notif.targetTab && onNavigate) {
      onNavigate(notif.targetTab);
      setOpen(false);
    }
  }

  const filteredList = notifications.filter((n) => (filter === "unread" ? !n.read : true));

  function getIcon(type: AppNotification["type"]) {
    switch (type) {
      case "order":
        return <Package className="h-4 w-4 text-emerald-500" />;
      case "proof":
        return <Wallet className="h-4 w-4 text-amber-500" />;
      case "verified":
        return <Check className="h-4 w-4 text-emerald-500" />;
      case "chat":
        return <MessageSquare className="h-4 w-4 text-sky-500" />;
      case "wa_status":
        return <Smartphone className="h-4 w-4 text-signal" />;
      case "billing":
        return <CreditCard className="h-4 w-4 text-warn" />;
      case "killswitch":
        return <Power className="h-4 w-4 text-danger" />;
      case "fleet":
        return <Server className="h-4 w-4 text-signal" />;
      case "alert":
        return <Zap className="h-4 w-4 text-warn" />;
      default:
        return <Bell className="h-4 w-4 text-ink-600" />;
    }
  }

  const isDark = theme === "dark";

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Tombol Lonceng */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          if (hasNewAlert) setHasNewAlert(false);
        }}
        className={cn(
          "relative h-11 w-11 min-h-[44px] min-w-[44px] lg:h-8 lg:w-8 lg:min-h-0 lg:min-w-0 p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal flex items-center justify-center",
          isDark
            ? "text-slate-400 hover:text-white hover:bg-slate-800"
            : "text-ink-600 hover:text-ink hover:bg-ink-100 border border-ink-200"
        )}
        aria-label="Notifikasi Real-time"
        title="Lihat notifikasi real-time"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white shadow-xs font-mono">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {hasNewAlert && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-signal animate-ping" />
        )}
      </button>

      {/* Dropdown Menu Popover */}
      {open && (
        <div
          className={cn(
            "absolute right-0 mt-2 z-50 w-[calc(100vw-24px)] max-w-sm sm:w-96 rounded-2xl border shadow-overlay overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150",
            isDark
              ? "bg-slate-900 border-slate-750 text-slate-100"
              : "bg-white border-ink-200 text-ink"
          )}
        >
          {/* Header Popover */}
          <div
            className={cn(
              "px-4 py-3 border-b flex items-center justify-between",
              isDark ? "border-slate-800 bg-slate-950/80" : "border-ink-200 bg-ink-50/80"
            )}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-signal" />
              <h4 className="text-xs font-bold tracking-tight text-ink">
                {scope === "tenant" ? "Notifikasi Toko" : "Notifikasi Konsol Platform"}
              </h4>
              {unreadCount > 0 && (
                <span className="whitespace-nowrap rounded-md bg-signal px-2 py-0.5 text-[10px] font-bold text-white font-mono">
                  {unreadCount} baru
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-2xs">
              <button
                type="button"
                onClick={toggleSound}
                className={cn(
                  "p-1 rounded transition-colors",
                  soundEnabled
                    ? "text-signal-strong hover:bg-signal-wash"
                    : "text-ink-400 hover:text-ink-600"
                )}
                title={
                  soundEnabled
                    ? "Suara notifikasi aktif (klik untuk membisukan)"
                    : "Suara notifikasi dibisukan (klik untuk aktifkan)"
                }
                aria-label="Toggle Suara Notifikasi"
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-ink-400" />
                )}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className={cn(
                    "font-medium transition-colors hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-signal ml-1",
                    isDark ? "text-emerald-400" : "text-signal-strong"
                  )}
                  title="Tandai semua telah dibaca"
                >
                  Tandai dibaca
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                  title="Bersihkan riwayat notifikasi"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-ink p-1"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Desktop Notification Permission Banner */}
          {!hasDesktopPermission && (
            <div className="flex items-center justify-between gap-2 border-b border-signal/25 bg-signal-wash px-4 py-2 text-2xs text-signal-strong">
              <span>Notifikasi desktop saat browser diminimize:</span>
              <button
                type="button"
                onClick={requestDesktopPermission}
                className="rounded bg-signal-strong px-2 py-0.5 font-bold text-white shadow-2xs hover:bg-signal transition-colors whitespace-nowrap"
              >
                Aktifkan
              </button>
            </div>
          )}

          {/* Filter Tab Sub-bar */}
          <div
            className={cn(
              "px-4 py-2 border-b flex items-center gap-2 text-2xs",
              isDark ? "border-slate-800 bg-slate-900" : "border-ink-100 bg-white"
            )}
          >
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "min-h-[32px] px-3 py-1 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                filter === "all"
                  ? isDark
                    ? "bg-signal text-white font-semibold"
                    : "bg-ink text-white font-semibold"
                  : isDark
                  ? "text-slate-400 hover:text-white hover:bg-slate-800"
                  : "text-ink-600 hover:text-ink hover:bg-ink-100"
              )}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "min-h-[32px] px-3 py-1 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                filter === "unread"
                  ? isDark
                    ? "bg-signal text-white font-semibold"
                    : "bg-ink text-white font-semibold"
                  : isDark
                  ? "text-slate-400 hover:text-white hover:bg-slate-800"
                  : "text-ink-600 hover:text-ink hover:bg-ink-100"
              )}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {/* List Item Notifikasi */}
          <div
            className={cn(
              "max-h-80 overflow-y-auto divide-y",
              isDark ? "divide-slate-800/40" : "divide-ink-100"
            )}
          >
            {filteredList.length === 0 ? (
              <div
                className={cn(
                  "p-8 text-center text-xs space-y-1",
                  isDark ? "text-slate-500" : "text-ink-500"
                )}
              >
                <CheckCheck
                  className={cn("h-6 w-6 mx-auto mb-2", isDark ? "text-slate-600" : "text-ink-300")}
                />
                <p className="font-medium">Tidak ada notifikasi baru</p>
                <p className={cn("text-2xs", isDark ? "text-slate-500" : "text-ink-400")}>
                  {filter === "unread"
                    ? "Semua notifikasi sudah dibaca."
                    : "Event real-time akan muncul di sini secara otomatis."}
                </p>
              </div>
            ) : (
              filteredList.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "p-3.5 flex items-start gap-3 cursor-pointer transition-colors text-xs",
                    !item.read
                      ? isDark
                        ? "bg-emerald-950/20 hover:bg-emerald-950/40"
                        : "bg-signal-wash/60 hover:bg-signal-wash"
                      : isDark
                      ? "hover:bg-slate-850/60"
                      : "hover:bg-ink-50/60"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border mt-0.5",
                      isDark ? "bg-slate-800 border-slate-700" : "bg-white border-ink-200"
                    )}
                  >
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p
                        className={cn(
                          "font-semibold truncate",
                          !item.read
                            ? isDark
                              ? "text-white"
                              : "text-ink font-bold"
                            : isDark
                            ? "text-slate-300"
                            : "text-ink-700"
                        )}
                      >
                        {item.title}
                      </p>
                      <span
                        className={cn(
                          "text-[10px] font-mono shrink-0",
                          isDark ? "text-slate-500" : "text-ink-400"
                        )}
                      >
                        {timeAgo(item.timestamp)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-2xs mt-0.5 line-clamp-2 leading-relaxed",
                        isDark ? "text-slate-400" : "text-ink-500"
                      )}
                    >
                      {item.description}
                    </p>
                    {item.targetTab && (
                      <span
                        className={cn(
                          "inline-block mt-1 text-[10px] font-medium underline",
                          isDark ? "text-signal" : "text-signal-strong"
                        )}
                      >
                        Buka bagian ini &rarr;
                      </span>
                    )}
                  </div>
                  {!item.read && (
                    <span
                      className="h-2 w-2 rounded-full bg-signal shrink-0 mt-1.5"
                      title="Belum dibaca"
                    />
                  )}
                </div>
              ))
            )}
          </div>
          {notifications.length > 0 && (
            <div
              className={cn(
                "px-4 py-2 border-t text-2xs",
                isDark ? "border-slate-800 text-slate-500" : "border-ink-100 text-ink-400"
              )}
            >
              Menampilkan {filteredList.length} dari {notifications.length} notifikasi
            </div>
          )}
        </div>
      )}
    </div>
  );
}
