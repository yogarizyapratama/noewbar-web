"use client";

/**
 * Superadmin Management Console (Refactored Professional Edition).
 *
 * Standar antislop:
 * - Desain profesional bersih untuk manajemen platform enterprise.
 * - Tanpa klise hacker retro, tanpa ornamen sci-fi berlebihan, tanpa gradien generik AI.
 * - Kontras warna WCAG AA, navigasi keyboard penuh, zero em-dash.
 * - Data real-time langsung terhubung ke PostgreSQL, Redis, WhatsMeow, dan AI Gateway.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Cpu,
  Database,
  ExternalLink,
  HardDrive,
  Layers,
  LogOut,
  MessageSquare,
  Power,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Users,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import { Badge, Button, StatusDot, cn, rupiah, timeAgo } from "@/components/ui";
import { AdminLogin } from "./admin-login";

export type ConsoleData = {
  kill_switch: { disabled: boolean; disabledAt: string | null; disabledBy: string | null };
  superadmin_hash_configured: boolean;
  system_stats?: {
    node_version: string;
    memory_heap_used_mb: number;
    memory_rss_mb: number;
    uptime_seconds: number;
    total_tenants: number;
    total_orders: number;
    total_conversations: number;
    total_products: number;
  };
  gateway: {
    ok: boolean;
    url: string;
    model: string;
    models: string[];
    latency_ms: number | null;
    error: string | null;
  };
  daemon: {
    ok: boolean;
    url: string;
    active_instances: number | null;
    uptime_reported_at: string | null;
    error: string | null;
  };
  queue: {
    redis: boolean;
    waiting: number;
    delayed: number;
    active: number;
    failed: number;
    pendingInDb: number;
  };
  redis: boolean;
  telegram: { ok: boolean; username: string | null; error: string | null };
  webhooks: {
    id: string;
    provider: string;
    event_key: string;
    event_type: string | null;
    processed: boolean;
    created_at: string;
  }[];
  fleet: {
    instance_key: string;
    tenant: string;
    connection_status: string;
    phone_number: string | null;
    last_seen: string | null;
  }[];
  tenants: {
    id: string;
    business_name: string;
    email: string;
    owner_whatsapp: string;
    status: string;
    trial_expires_at: string;
    conversations: number;
    orders: number;
    knowledge_docs?: number;
    products?: number;
    websites?: number;
    sheet: { url: string; origin: string; last_synced_at: string | null } | null;
    subscription: { plan: string; status: string; expires_at: string; amount: number } | null;
  }[];
  subscription_counts: Record<string, number>;
  recent_orders: {
    id: string;
    order_number: string;
    tenant: string;
    order_status: string;
    payment_status: string;
    total: number;
    created_at: string;
  }[];
};

type Tab = "overview" | "tenants" | "fleet" | "webhooks" | "system_ops";
type TenantFilter = "all" | "ACTIVE" | "TRIAL" | "SUSPENDED";

function formatSeconds(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} hari ${h} jam ${m} mnt`;
  if (h > 0) return `${h} jam ${m} mnt`;
  return `${m} mnt`;
}

function ts(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function SuperadminPage() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveEvent, setLiveEvent] = useState<string | null>(null);
  const [tenantFilter, setTenantFilter] = useState<TenantFilter>("all");
  const [tenantQuery, setTenantQuery] = useState("");
  const [orderId, setOrderId] = useState("");
  const [wipeConfirmModal, setWipeConfirmModal] = useState<{ id: string; name: string } | null>(null);
  const [wipeInput, setWipeInput] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/superadmin", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const json = await res.json();
      if (json.ok) {
        setData(json as ConsoleData);
        setAuthed(true);
      }
    } catch {
      setMsg({ text: "Gagal memuat telemetri server.", tone: "error" });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Polling fallback setiap 30 detik
  useEffect(() => {
    if (!authed) return;
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, [authed, load]);

  // Real-time EventSource listener
  useEffect(() => {
    if (!authed) return;
    const es = new EventSource("/api/realtime?scope=admin");
    es.onmessage = (ev) => {
      let type = "";
      try {
        type = (JSON.parse(ev.data) as { type?: string }).type ?? "";
      } catch {
        return;
      }
      if (type === "fleet" || type === "killswitch" || type === "billing" || type === "alert") {
        setLiveEvent(type);
        load();
      }
    };
    es.onerror = () => {};
    return () => es.close();
  }, [authed, load]);

  useEffect(() => {
    if (!liveEvent) return;
    const t = setTimeout(() => setLiveEvent(null), 3000);
    return () => clearTimeout(t);
  }, [liveEvent]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function act(payload: Record<string, unknown>, confirmText?: string): Promise<void> {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({ text: `Perubahan berhasil disimpan: ${String(payload.action)}`, tone: "success" });
      } else {
        setMsg({ text: json.error || "Operasi ditolak oleh server.", tone: "error" });
      }
      await load();
    } catch {
      setMsg({ text: "Koneksi ke server terputus saat mengeksekusi aksi.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/superadmin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setAuthed(false);
  }

  if (authed === false) {
    return <AdminLogin onSuccess={load} />;
  }

  if (authed === null || !data) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs font-medium text-slate-400">
            Memuat Konsol Manajemen Sistem...
          </p>
        </div>
      </main>
    );
  }

  const ks = data.kill_switch;
  const stats = data.system_stats;
  const totalMRR = data.tenants.reduce(
    (acc, t) => acc + (t.subscription?.status === "ACTIVE" ? t.subscription.amount : 0),
    0
  );
  const activeTenantsCount = data.tenants.filter((t) => t.status === "ACTIVE").length;
  const trialTenantsCount = data.tenants.filter((t) => t.status === "TRIAL").length;
  const totalConversations = stats?.total_conversations ?? data.tenants.reduce((acc, t) => acc + t.conversations, 0);
  const totalOrders = stats?.total_orders ?? data.tenants.reduce((acc, t) => acc + t.orders, 0);
  const totalStores = stats?.total_tenants ?? data.tenants.length;

  const filteredTenants = data.tenants
    .filter((t) => (tenantFilter === "all" ? true : t.status === tenantFilter))
    .filter((t) => {
      if (!tenantQuery.trim()) return true;
      const q = tenantQuery.toLowerCase().trim();
      return (
        t.business_name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.owner_whatsapp.toLowerCase().includes(q)
      );
    });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* 1. TOP EXECUTIVE HEADER */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 max-w-7xl mx-auto">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600/15 border border-indigo-500/30 text-indigo-400">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white tracking-tight">
                  Noewbar Platform Console
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Sistem Aktif
                </span>
                {liveEvent && (
                  <span className="inline-flex items-center gap-1 rounded bg-indigo-950 border border-indigo-500/40 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                    Sinyal: {liveEvent}
                  </span>
                )}
              </div>
              <p className="text-2xs text-slate-400">
                Manajemen Terpusat Multi-Tenant &amp; Operasi Infrastruktur
              </p>
            </div>
          </div>

          {/* Real-time Telemetry Strip */}
          <div className="hidden xl:flex items-center gap-3 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-1.5">
            <div className="flex items-center gap-1.5" title="Latency AI Gateway">
              <Zap className={cn("h-3.5 w-3.5", data.gateway.ok ? "text-emerald-400" : "text-rose-400")} />
              <span className="text-slate-400">AI:</span>
              <span className="font-mono font-semibold text-slate-100">
                {data.gateway.latency_ms ? `${data.gateway.latency_ms} ms` : "Gangguan"}
              </span>
            </div>
            <span className="text-slate-750">|</span>
            <div className="flex items-center gap-1.5" title="Soket WhatsApp Aktif">
              <Server className={cn("h-3.5 w-3.5", data.daemon.ok ? "text-emerald-400" : "text-rose-400")} />
              <span className="text-slate-400">WA Soket:</span>
              <span className="font-mono font-semibold text-slate-100">{data.daemon.active_instances ?? 0}</span>
            </div>
            <span className="text-slate-750">|</span>
            <div className="flex items-center gap-1.5" title="Beban Antrean Pesan BullMQ">
              <Cpu className={cn("h-3.5 w-3.5", data.queue.redis ? "text-amber-400" : "text-rose-400")} />
              <span className="text-slate-400">Antrean:</span>
              <span className="font-mono font-semibold text-slate-100">
                {data.queue.waiting} antre
                {data.queue.failed > 0 && <span className="text-rose-400 font-bold ml-1">({data.queue.failed} gagal)</span>}
              </span>
            </div>
            {stats && (
              <>
                <span className="text-slate-750">|</span>
                <div className="flex items-center gap-1.5" title="Memori V8 Heap Server">
                  <Activity className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-slate-400">Memori:</span>
                  <span className="font-mono font-semibold text-slate-100">{stats.memory_heap_used_mb} MB</span>
                  <span className="text-slate-500 text-[11px]">({formatSeconds(stats.uptime_seconds)})</span>
                </div>
              </>
            )}
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Global Emergency Kill Switch */}
            {ks.disabled ? (
              <Button
                size="sm"
                variant="accent"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs border-none"
                loading={busy}
                onClick={() => act({ action: "kill_switch", disabled: false })}
              >
                <Power className="mr-1.5 h-3.5 w-3.5" />
                Aktifkan Kembali Bot Global
              </Button>
            ) : (
              <Button
                size="sm"
                variant="danger"
                className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs"
                loading={busy}
                onClick={() =>
                  act(
                    { action: "kill_switch", disabled: true },
                    "PERINGATAN: Matikan seluruh balasan bot WhatsApp di semua toko? Pembeli tidak akan mendapatkan balasan otomatis sampai bot dinyalakan kembali."
                  )
                }
              >
                <Power className="mr-1.5 h-3.5 w-3.5 text-rose-400" />
                Emergency Kill Switch
              </Button>
            )}

            <Button
              size="sm"
              variant="secondary"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border-slate-750"
              onClick={handleRefresh}
              loading={refreshing}
              title="Perbarui data telemetri langsung"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} />
              Segarkan
            </Button>

            <a
              href="/dashboard"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Buka panel toko tenant di tab baru"
            >
              <span>Dashboard Toko</span>
              <ExternalLink className="h-3 w-3 text-slate-500" />
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Keluar dari Konsol Superadmin"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 2. NAVIGATION TABS */}
        <div className="mt-3.5 flex items-center gap-1 overflow-x-auto border-t border-slate-800/80 pt-2.5 max-w-7xl mx-auto">
          {[
            { id: "overview", label: "Ringkasan & Infrastruktur", icon: <Layers className="h-4 w-4" /> },
            { id: "tenants", label: `Kelola Toko (${data.tenants.length})`, icon: <Users className="h-4 w-4" /> },
            { id: "fleet", label: `Fleet WhatsApp (${data.fleet.length})`, icon: <Server className="h-4 w-4" /> },
            { id: "webhooks", label: `Ledger Webhooks (${data.webhooks.length})`, icon: <Webhook className="h-4 w-4" /> },
            { id: "system_ops", label: "Operasi Sistem", icon: <Cpu className="h-4 w-4" /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as Tab)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                tab === t.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-850"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Banner Darurat Kill-Switch */}
        {ks.disabled && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 shadow-md flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-rose-400 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold text-rose-200 uppercase tracking-wide">
                  Global Kill Switch Sedang Aktif
                </p>
                <p className="text-xs text-rose-300 mt-0.5 leading-relaxed">
                  Semua balasan otomatis bot dihentikan sejak {ts(ks.disabledAt)}
                  {ks.disabledBy ? ` oleh ${ks.disabledBy}` : ""}. Pesan dari pembeli tetap tersimpan namun tidak dibalas bot.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="accent"
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs border-none shrink-0"
              onClick={() => act({ action: "kill_switch", disabled: false })}
            >
              Nyalakan Kembali
            </Button>
          </div>
        )}

        {/* Feedback Notifikasi Banner */}
        {msg && (
          <div
            role="status"
            className={cn(
              "rounded-xl border p-3.5 text-xs flex items-center justify-between transition-all",
              msg.tone === "success"
                ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-200"
                : "border-rose-500/30 bg-rose-950/40 text-rose-200"
            )}
          >
            <div className="flex items-center gap-2.5">
              {msg.tone === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setMsg(null)}
              className="text-slate-400 hover:text-white p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              aria-label="Tutup notifikasi"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ==================================================== TAB 1: OVERVIEW & INFRASTRUCTURE */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Top 4 Business & Scale Metrics */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Pendapatan Bulanan (MRR)
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-950/60 border border-emerald-800/40 text-emerald-400">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-white font-mono">
                  Rp {rupiah(totalMRR)}
                </p>
                <p className="mt-1 text-2xs text-emerald-400 font-medium">
                  {data.subscription_counts["ACTIVE"] ?? 0} Toko Berlangganan Aktif
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Total Klien Toko
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
                    <Users className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-white font-mono">
                  {totalStores} <span className="text-sm font-normal text-slate-400">tenant</span>
                </p>
                <p className="mt-1 text-2xs text-indigo-300 font-medium">
                  {activeTenantsCount} Aktif &bull; {trialTenantsCount} Masa Percobaan
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Total Pesanan Transaksi
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-950/60 border border-amber-800/40 text-amber-400">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-white font-mono">
                  {totalOrders} <span className="text-sm font-normal text-slate-400">pesanan</span>
                </p>
                <p className="mt-1 text-2xs text-slate-400">
                  Transaksi diproses otomatis via Midtrans
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Percakapan Bot WhatsApp
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-950/60 border border-sky-800/40 text-sky-400">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                </div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-white font-mono">
                  {totalConversations} <span className="text-sm font-normal text-slate-400">chat</span>
                </p>
                <p className="mt-1 text-2xs text-sky-300">
                  Respon bot customer service 24 jam
                </p>
              </div>
            </div>

            {/* Infrastructure Health Cards */}
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Kesehatan Infrastruktur &amp; Layanan Backend
                </h2>
                <span className="text-2xs text-slate-500">Pembaruan otomatis berkala</span>
              </div>

              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {/* 1. AI Gateway */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Zap className="h-4 w-4 text-indigo-400" />
                      <h3 className="text-xs font-bold text-white">AI Gateway</h3>
                    </div>
                    <Badge tone={data.gateway.ok ? "signal" : "danger"}>
                      <StatusDot ok={data.gateway.ok} />
                      {data.gateway.ok ? "Aktif" : "Gangguan"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Model Aktif:</span>
                      <span className="font-mono text-2xs font-semibold text-indigo-300">{data.gateway.model}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Latency:</span>
                      <span className="font-mono text-2xs font-semibold text-white">
                        {data.gateway.latency_ms ? `${data.gateway.latency_ms} ms` : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Model Terdaftar:</span>
                      <span className="text-slate-300 text-2xs">{data.gateway.models.length} model siap</span>
                    </div>
                    {data.gateway.error && (
                      <p className="text-rose-400 text-2xs mt-1 leading-relaxed">{data.gateway.error}</p>
                    )}
                  </div>
                </div>

                {/* 2. WhatsApp Daemon */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Server className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-white">WhatsMeow Daemon</h3>
                    </div>
                    <Badge tone={data.daemon.ok ? "signal" : "danger"}>
                      <StatusDot ok={data.daemon.ok} />
                      {data.daemon.ok ? "Terhubung" : "Terputus"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Sesi Soket Aktif:</span>
                      <span className="font-mono text-2xs font-bold text-emerald-400">{data.daemon.active_instances ?? 0} instance</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Daemon URL:</span>
                      <span className="font-mono text-2xs text-slate-400 truncate max-w-[150px]" title={data.daemon.url}>
                        {data.daemon.url}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Ping Terakhir:</span>
                      <span className="text-2xs text-slate-300">{ts(data.daemon.uptime_reported_at)}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Redis / BullMQ Queue */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Cpu className="h-4 w-4 text-amber-400" />
                      <h3 className="text-xs font-bold text-white">Redis &amp; BullMQ</h3>
                    </div>
                    <Badge tone={data.queue.redis ? "signal" : "danger"}>
                      <StatusDot ok={data.queue.redis} />
                      {data.queue.redis ? "Normal" : "Gangguan"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Antrean Menunggu:</span>
                      <span className="font-mono text-2xs font-semibold text-amber-300">{data.queue.waiting} tugas</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Anti-Ghosting Nudge:</span>
                      <span className="font-mono text-2xs text-slate-300">{data.queue.delayed} tertunda</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Gagal / Fallback:</span>
                      <span className={cn("font-mono text-2xs", data.queue.failed > 0 ? "text-rose-400 font-bold" : "text-slate-400")}>
                        {data.queue.failed} gagal / {data.queue.pendingInDb} db
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. PostgreSQL Cluster */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Database className="h-4 w-4 text-purple-400" />
                      <h3 className="text-xs font-bold text-white">Database PostgreSQL</h3>
                    </div>
                    <Badge tone="signal">
                      <StatusDot ok />
                      Terkoneksi
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Toko (Tenant):</span>
                      <span className="font-mono text-2xs font-bold text-white">{stats?.total_tenants ?? data.tenants.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total Transaksi:</span>
                      <span className="font-mono text-2xs font-bold text-white">{stats?.total_orders ?? totalOrders}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Total SKU Produk:</span>
                      <span className="font-mono text-2xs font-bold text-white">{stats?.total_products ?? 0} SKU</span>
                    </div>
                  </div>
                </div>

                {/* 5. Telegram Alert Bot */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Bell className="h-4 w-4 text-sky-400" />
                      <h3 className="text-xs font-bold text-white">Saluran Bot Telegram</h3>
                    </div>
                    <Badge tone={data.telegram.ok ? "signal" : "warn"}>
                      <StatusDot ok={data.telegram.ok} />
                      {data.telegram.ok ? "Siap" : "Belum Konfigurasi"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Akun Bot:</span>
                      <span className="font-mono text-2xs text-sky-300">@{data.telegram.username || "belum_diatur"}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-400">Tes Saluran:</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 text-[11px] px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200"
                        onClick={() => act({ action: "test_telegram" })}
                      >
                        Kirim Notifikasi Uji
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 6. Runtime Server Node */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <HardDrive className="h-4 w-4 text-slate-300" />
                      <h3 className="text-xs font-bold text-white">Runtime Node.js</h3>
                    </div>
                    <Badge tone="signal">
                      <StatusDot ok />
                      V8 Stabil
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Versi Mesin:</span>
                      <span className="font-mono text-2xs font-semibold text-slate-200">
                        {stats?.node_version ?? process.version}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Memori RSS:</span>
                      <span className="font-mono text-2xs">{stats?.memory_rss_mb ?? 0} MB</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Waktu Aktif:</span>
                      <span className="text-2xs text-emerald-400 font-medium font-mono">
                        {stats ? formatSeconds(stats.uptime_seconds) : "-"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Global Recent Transactions Feed */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
              <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Aktivitas Transaksi Lintas Toko
                  </h3>
                  <p className="text-2xs text-slate-400 mt-0.5">
                    Transaksi pesanan terkini yang masuk dari seluruh toko di platform.
                  </p>
                </div>
                <span className="text-2xs text-slate-500 font-mono">
                  {data.recent_orders.length} order tercatat
                </span>
              </div>
              <div className="divide-y divide-slate-800/80">
                {data.recent_orders.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-500">
                    Belum ada riwayat transaksi pada platform.
                  </p>
                ) : (
                  data.recent_orders.slice(0, 5).map((o) => (
                    <div
                      key={o.id}
                      className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-indigo-400">{o.order_number}</span>
                        <span className="text-slate-400">
                          Toko: <strong className="text-slate-200">{o.tenant}</strong>
                        </span>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-slate-400 text-2xs">{timeAgo(o.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-emerald-400">
                          Rp {rupiah(o.total)}
                        </span>
                        <Badge
                          tone={o.payment_status === "VERIFIED" ? "signal" : "warn"}
                          className="text-[11px]"
                        >
                          {o.payment_status === "VERIFIED" ? "Terbayar" : "Menunggu"}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== TAB 2: TENANTS MANAGEMENT */}
        {tab === "tenants" && (
          <div className="space-y-4">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {(["all", "ACTIVE", "TRIAL", "SUSPENDED"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTenantFilter(st)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      tenantFilter === st
                        ? "bg-indigo-600 text-white font-semibold shadow-sm"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750"
                    )}
                  >
                    {st === "all" ? "Semua Status" : st === "ACTIVE" ? "Aktif" : st === "TRIAL" ? "Masa Percobaan" : "Ditangguhkan"}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[260px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari nama toko, email, WhatsApp..."
                  value={tenantQuery}
                  onChange={(e) => setTenantQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-750 bg-slate-950 pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Tenants Data Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-2xs uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Toko &amp; Kontak</th>
                      <th className="px-5 py-3.5 font-semibold">Status Langganan</th>
                      <th className="px-5 py-3.5 font-semibold text-center">Beban AI &amp; Chat</th>
                      <th className="px-5 py-3.5 font-semibold text-center">Data Katalog</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Aksi Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500 text-xs">
                          Tidak ada tenant toko yang sesuai dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-850/40 transition-colors">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-white text-sm">{t.business_name}</p>
                            <p className="text-2xs text-slate-400 mt-0.5">{t.email}</p>
                            <p className="font-mono text-2xs text-indigo-400 mt-0.5">{t.owner_whatsapp}</p>
                          </td>
                          <td className="px-5 py-4">
                            <Badge
                              tone={t.status === "ACTIVE" ? "signal" : t.status === "TRIAL" ? "warn" : "danger"}
                              className="text-[11px]"
                            >
                              {t.status === "ACTIVE" ? "Aktif" : t.status === "TRIAL" ? "Trial" : "Ditangguhkan"}
                            </Badge>
                            <p className="mt-1 text-2xs text-slate-400">
                              Batas: {new Date(t.trial_expires_at).toLocaleDateString("id-ID")}
                            </p>
                            {t.subscription && (
                              <p className="text-2xs text-emerald-400 font-semibold font-mono mt-0.5">
                                {t.subscription.plan} &bull; Rp {rupiah(t.subscription.amount)}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-semibold text-slate-200">
                                {t.conversations} chat / {t.orders} order
                              </span>
                              <span className="text-[11px] text-indigo-300 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40 mt-1 font-mono">
                                Est. {t.conversations * 450} Token
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-center text-2xs text-slate-400">
                            <div>{t.products ?? 0} SKU Produk</div>
                            <div>{t.knowledge_docs ?? 0} SOP Bisnis</div>
                            <div>{t.websites ?? 0} Website Aktif</div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200"
                                onClick={() => act({ action: "extend_trial", tenant_id: t.id, days: 14 })}
                                title="Perpanjang masa trial selama 14 hari"
                              >
                                +14 Hari
                              </Button>
                              <Button
                                size="sm"
                                variant={t.status === "SUSPENDED" ? "accent" : "secondary"}
                                className={cn(
                                  "h-7 text-xs px-2.5",
                                  t.status === "SUSPENDED"
                                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                    : "bg-amber-950/60 hover:bg-amber-900 border border-amber-800/60 text-amber-300"
                                )}
                                onClick={() =>
                                  act({
                                    action: "tenant_status",
                                    tenant_id: t.id,
                                    status: t.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                                  })
                                }
                              >
                                {t.status === "SUSPENDED" ? "Aktifkan" : "Suspend"}
                              </Button>
                              <button
                                type="button"
                                onClick={() => {
                                  setWipeConfirmModal({ id: t.id, name: t.business_name });
                                  setWipeInput("");
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                                title="Hapus seluruh data toko permanen"
                                aria-label={`Hapus toko ${t.business_name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== TAB 3: WHATSAPP FLEET */}
        {tab === "fleet" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden">
              <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Fleet Sesi Soket WhatsApp Toko
                  </h3>
                  <p className="text-2xs text-slate-400 mt-0.5">
                    Monitoring koneksi soket real-time WhatsMeow untuk setiap tenant toko.
                  </p>
                </div>
                <span className="text-2xs text-slate-400 font-mono">
                  {data.fleet.length} Sesi Terhubung
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-2xs uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Instance Key</th>
                      <th className="px-5 py-3.5 font-semibold">Toko Terkait</th>
                      <th className="px-5 py-3.5 font-semibold">Status Soket</th>
                      <th className="px-5 py-3.5 font-semibold">Nomor WhatsApp</th>
                      <th className="px-5 py-3.5 font-semibold">Aktivitas Terakhir</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Aksi Soket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {data.fleet.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          Belum ada instance WhatsApp yang terdaftar pada sistem daemon.
                        </td>
                      </tr>
                    ) : (
                      data.fleet.map((inst) => (
                        <tr key={inst.instance_key} className="hover:bg-slate-850/40">
                          <td className="px-5 py-4 font-mono font-semibold text-indigo-300">{inst.instance_key}</td>
                          <td className="px-5 py-4 font-semibold text-white">{inst.tenant}</td>
                          <td className="px-5 py-4">
                            <Badge
                              tone={
                                inst.connection_status === "CONNECTED"
                                  ? "signal"
                                  : inst.connection_status === "PAIRING"
                                  ? "warn"
                                  : "danger"
                              }
                              className="text-[11px]"
                            >
                              <StatusDot ok={inst.connection_status === "CONNECTED"} />
                              {inst.connection_status === "CONNECTED"
                                ? "Tersambung"
                                : inst.connection_status === "PAIRING"
                                ? "Scan QR"
                                : "Terputus"}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 font-mono text-slate-200">
                            {inst.phone_number || "Belum Tersambung"}
                          </td>
                          <td className="px-5 py-4 text-2xs text-slate-400">
                            {inst.last_seen ? timeAgo(inst.last_seen) : "-"}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200"
                              onClick={() =>
                                act(
                                  { action: "restart_instance", instance_key: inst.instance_key },
                                  `Mulai ulang koneksi soket untuk sesi ${inst.instance_key}?`
                                )
                              }
                            >
                              Restart Soket
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== TAB 4: WEBHOOKS & PAYMENTS */}
        {tab === "webhooks" && (
          <div className="space-y-4">
            {/* Quick Midtrans Sync Tool */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Sinkronisasi Transaksi Midtrans Manual
                </h3>
                <p className="text-2xs text-slate-400 mt-0.5">
                  Verifikasi dan mutakhirkan status pembayaran instan jika terjadi keterlambatan webhook pihak ketiga.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Order ID Midtrans..."
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="rounded-lg border border-slate-750 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none w-52"
                />
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs border-none"
                  disabled={!orderId.trim()}
                  onClick={() => act({ action: "sync_midtrans", order_id: orderId.trim() })}
                >
                  Cek Status
                </Button>
              </div>
            </div>

            {/* Webhook Ledger Audit Table */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden">
              <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Buku Besar Audit Webhook Masuk
                  </h3>
                  <p className="text-2xs text-slate-400 mt-0.5">
                    Log event yang masuk dengan perlindungan idempotensi untuk mencegah duplikasi pesanan.
                  </p>
                </div>
                <span className="text-2xs text-slate-400 font-mono">
                  {data.webhooks.length} Event Tercatat
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-2xs uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">Provider</th>
                      <th className="px-5 py-3.5 font-semibold">Event Key</th>
                      <th className="px-5 py-3.5 font-semibold">Tipe Event</th>
                      <th className="px-5 py-3.5 font-semibold">Status Proses</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Waktu Masuk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {data.webhooks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          Belum ada catatan event webhook yang terekam.
                        </td>
                      </tr>
                    ) : (
                      data.webhooks.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-850/40">
                          <td className="px-5 py-4">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold font-mono",
                                w.provider === "MIDTRANS"
                                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800/60"
                                  : "bg-indigo-950 text-indigo-300 border border-indigo-800/60"
                              )}
                            >
                              {w.provider}
                            </span>
                          </td>
                          <td className="px-5 py-4 font-mono font-medium text-slate-200">{w.event_key}</td>
                          <td className="px-5 py-4 text-slate-400 text-2xs">{w.event_type || "-"}</td>
                          <td className="px-5 py-4">
                            <span
                              className={cn(
                                "text-2xs font-semibold",
                                w.processed ? "text-emerald-400" : "text-amber-400"
                              )}
                            >
                              {w.processed ? "Selesai" : "Pending"}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right text-2xs text-slate-400 font-mono">
                            {ts(w.created_at)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== TAB 5: SYSTEM OPERATIONS */}
        {tab === "system_ops" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3.5">
                Operasi Pemeliharaan Rutin Platform
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Op 1: Maintenance Sweep */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <Cpu className="h-4 w-4 text-indigo-400" />
                      <h3 className="text-xs font-bold text-white">Maintenance Sweep 3-in-1</h3>
                    </div>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Jalankan siklus sweep berkala: kadaluarsakan pesanan tanpa pembayaran lebih dari 2 jam, kirim antrean nudge WhatsApp anti-ghosting, dan rekonsiliasi masa langganan.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full justify-center bg-indigo-600 hover:bg-indigo-500 text-white text-xs border-none"
                      loading={busy}
                      onClick={() => act({ action: "trigger_maintenance" })}
                    >
                      Jalankan Sweep Sekarang
                    </Button>
                  </div>
                </div>

                {/* Op 2: Midtrans Force Reconcile */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <Webhook className="h-4 w-4 text-emerald-400" />
                      <h3 className="text-xs font-bold text-white">Rekonsiliasi Langganan</h3>
                    </div>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Pindai transaksi pembayaran Midtrans untuk memastikan toko yang telah menyelesaikan transfer langganan otomatis aktif tanpa menunggu intervensi admin.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                      loading={busy}
                      onClick={() => act({ action: "reconcile" })}
                    >
                      Pindai Status Midtrans
                    </Button>
                  </div>
                </div>

                {/* Op 3: Telegram Alert Ping */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <Bell className="h-4 w-4 text-sky-400" />
                      <h3 className="text-xs font-bold text-white">Tes Notifikasi Telegram</h3>
                    </div>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Kirim pesan pengujian alert darurat ke kanal Telegram pengawas untuk memastikan notifikasi sistem berjalan semestinya.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full justify-center bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
                      loading={busy}
                      onClick={() => act({ action: "test_telegram" })}
                    >
                      Kirim Notifikasi Uji
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Konfirmasi Hapus Toko (Wipe Tenant) */}
      {wipeConfirmModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-slate-900 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-950 text-rose-400 border border-rose-800">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Konfirmasi Penghapusan Toko
                </h3>
                <p className="text-2xs text-rose-300">Tindakan ini bersifat permanen dan tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Anda akan menghapus seluruh data toko <strong>&ldquo;{wipeConfirmModal.name}&rdquo;</strong> beserta seluruh katalog produk, riwayat percakapan, pesanan, dan instance WhatsApp terkait.
            </p>

            <div>
              <label htmlFor="wipe-confirm-input" className="block text-2xs font-medium text-slate-400 mb-1.5">
                Ketik <span className="text-rose-400 font-bold">HAPUS</span> untuk melanjutkan:
              </label>
              <input
                id="wipe-confirm-input"
                type="text"
                autoFocus
                placeholder="HAPUS"
                value={wipeInput}
                onChange={(e) => setWipeInput(e.target.value)}
                className="w-full rounded-lg border border-slate-750 bg-slate-950 px-3.5 py-2 text-xs text-white uppercase focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setWipeConfirmModal(null)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={wipeInput !== "HAPUS"}
                loading={busy}
                onClick={async () => {
                  const id = wipeConfirmModal.id;
                  setWipeConfirmModal(null);
                  await act({ action: "wipe_tenant", tenant_id: id, confirm: "HAPUS" });
                }}
              >
                Hapus Toko Permanen
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
