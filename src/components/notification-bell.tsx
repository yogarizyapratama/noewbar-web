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

import { useEffect, useRef, useState } from "react";
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

export function NotificationBell({
  scope,
  theme = "light",
  onNavigate,
}: {
  scope: "tenant" | "admin";
  theme?: "light" | "dark";
  onNavigate?: (targetTab: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [hasNewAlert, setHasNewAlert] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const storageKey = `noewbar_notif_${scope}`;

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

  // 2. Realtime SSE Listener
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = `/api/realtime?scope=${scope}`;
    const es = new EventSource(url);

    es.onmessage = (ev) => {
      let data: { type?: string; [key: string]: unknown } = {};
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }

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
        switch (eventType) {
          case "killswitch":
            notifItem = {
              id: `ks-${Date.now()}`,
              type: "killswitch",
              title: "Status Emergency Kill-Switch",
              description: "Saklar darurat bot global diubah statusnya oleh operator.",
              timestamp: now,
              read: false,
              targetTab: "killswitch",
            };
            break;
          case "fleet":
            notifItem = {
              id: `fleet-${Date.now()}`,
              type: "fleet",
              title: "Aktivitas Fleet & Tenant",
              description: "Pembaruan instance WhatsApp atau perubahan status tenant toko.",
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
              description: "Siklus sweep pemeliharaan sistem atau uji saluran alert dieksekusi.",
              timestamp: now,
              read: false,
              targetTab: "system_ops",
            };
            break;
          case "billing":
            notifItem = {
              id: `admin-bill-${Date.now()}`,
              type: "billing",
              title: "Transaksi Webhook Midtrans",
              description: "Webhook pembayaran langganan baru masuk dan direkonsiliasi.",
              timestamp: now,
              read: false,
              targetTab: "financials",
            };
            break;
        }
      }

      if (notifItem) {
        setNotifications((prev) => [notifItem!, ...prev.slice(0, 49)]);
        setHasNewAlert(true);
      }
    };

    es.onerror = () => {
      // EventSource reconnects automatically
    };

    return () => es.close();
  }, [scope]);

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
        return <Smartphone className="h-4 w-4 text-indigo-500" />;
      case "billing":
        return <CreditCard className="h-4 w-4 text-purple-500" />;
      case "killswitch":
        return <Power className="h-4 w-4 text-rose-500" />;
      case "fleet":
        return <Server className="h-4 w-4 text-emerald-500" />;
      case "alert":
        return <Zap className="h-4 w-4 text-amber-500" />;
      default:
        return <Bell className="h-4 w-4 text-indigo-500" />;
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
          "relative p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 flex items-center justify-center",
          isDark
            ? "text-slate-400 hover:text-white hover:bg-slate-800"
            : "text-ink-500 hover:text-ink hover:bg-ink-50 border border-ink-200"
        )}
        aria-label="Notifikasi Real-time"
        title="Lihat notifikasi real-time"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-sm font-mono">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
        {hasNewAlert && (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
        )}
      </button>

      {/* Dropdown Menu Popover */}
      {open && (
        <div
          className={cn(
            "absolute right-0 mt-2 z-50 w-80 sm:w-96 rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150",
            isDark
              ? "bg-slate-900 border-slate-750 text-slate-100"
              : "bg-white border-ink-200 text-ink"
          )}
        >
          {/* Header Popover */}
          <div
            className={cn(
              "px-4 py-3 border-b flex items-center justify-between",
              isDark ? "border-slate-800 bg-slate-950/80" : "border-ink-100 bg-ink-50/60"
            )}
          >
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-indigo-500" />
              <h4 className="text-xs font-bold tracking-tight">
                {scope === "tenant" ? "Notifikasi Toko" : "Notifikasi Konsol Platform"}
              </h4>
              {unreadCount > 0 && (
                <span className="rounded-full bg-indigo-600 px-1.5 py-0.2 text-[10px] font-bold text-white font-mono">
                  {unreadCount} baru
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-2xs">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className={cn(
                    "font-medium transition-colors hover:underline",
                    isDark ? "text-indigo-400" : "text-indigo-600"
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
                className="text-slate-400 hover:text-white p-1"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

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
                "px-2.5 py-1 rounded-md font-medium transition-colors",
                filter === "all"
                  ? isDark
                    ? "bg-indigo-600 text-white font-semibold"
                    : "bg-ink-900 text-white font-semibold"
                  : isDark
                  ? "text-slate-400 hover:text-white hover:bg-slate-800"
                  : "text-ink-500 hover:text-ink hover:bg-ink-50"
              )}
            >
              Semua ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors",
                filter === "unread"
                  ? isDark
                    ? "bg-indigo-600 text-white font-semibold"
                    : "bg-ink-900 text-white font-semibold"
                  : isDark
                  ? "text-slate-400 hover:text-white hover:bg-slate-800"
                  : "text-ink-500 hover:text-ink hover:bg-ink-50"
              )}
            >
              Belum Dibaca ({unreadCount})
            </button>
          </div>

          {/* List Item Notifikasi */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/40">
            {filteredList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                <CheckCheck className="h-6 w-6 mx-auto text-slate-600 mb-2" />
                <p className="font-medium">Tidak ada notifikasi baru</p>
                <p className="text-2xs text-slate-500">
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
                        ? "bg-indigo-950/20 hover:bg-indigo-950/40"
                        : "bg-indigo-50/40 hover:bg-indigo-50/70"
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
                      <span className="text-[10px] font-mono shrink-0 text-slate-500">
                        {timeAgo(item.timestamp)}
                      </span>
                    </div>
                    <p className="text-2xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                    {item.targetTab && (
                      <span
                        className={cn(
                          "inline-block mt-1 text-[10px] font-medium underline",
                          isDark ? "text-indigo-400" : "text-indigo-600"
                        )}
                      >
                        Buka bagian ini &rarr;
                      </span>
                    )}
                  </div>
                  {!item.read && (
                    <span
                      className="h-2 w-2 rounded-full bg-indigo-500 shrink-0 mt-1.5"
                      title="Belum dibaca"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
