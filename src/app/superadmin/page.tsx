"use client";

/**
 * Master Control Console - Dark Command Center Edition (Chapter 11).
 *
 * Antarmuka Operator Khusus Admin Sistem Platform:
 * - Telemetri node real-time (AI Gateway, WhatsMeow Daemon, Redis/BullMQ, PostgreSQL).
 * - Monitor multi-tenant & perkiraan konsumsi kuota AI seluruh toko.
 * - Fleet manajemen sesi WhatsApp dan kontrol soket terdistribusi.
 * - Audit ledger webhook dan sinkronisasi pembayaran Midtrans.
 * - Operasi pemeliharaan platform (Maintenance sweep 3-in-1, Telegram alert ping).
 * - Emergency Kill-Switch global satu sentuhan.
 *
 * Standar Anti-Slop:
 * - Dark Command Center palette, kontras WCAG AA, monospace telemetry, zero em-dash.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertOctagon,
  Bell,
  CheckCircle2,
  Cpu,
  Database,
  DollarSign,
  HardDrive,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Radio,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShoppingBag,
  Terminal,
  Trash2,
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

type Tab = "telemetry" | "tenants" | "fleet" | "webhooks" | "system_ops";
type TenantFilter = "all" | "ACTIVE" | "TRIAL" | "SUSPENDED";

function formatSeconds(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d}h ${h}j ${m}m`;
  if (h > 0) return `${h}j ${m}m`;
  return `${m}m`;
}

function ts(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

export default function SuperadminPage() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("telemetry");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<string | null>(null);
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
      setMsg("Gagal membaca telemetri konsol.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Polling fallback setiap 30 detik
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
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
        setLive(type);
        load();
      }
    };
    es.onerror = () => {};
    return () => es.close();
  }, [authed, load]);

  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => setLive(null), 3000);
    return () => clearTimeout(t);
  }, [live]);

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
        setMsg(`Aksi berhasil: ${String(payload.action)}`);
      } else {
        setMsg(`Gagal: ${json.error || "Aksi ditolak server."}`);
      }
      await load();
    } catch {
      setMsg("Aksi gagal dikirim ke server konsol.");
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
      <main className="grid min-h-screen place-items-center bg-[#070A11] px-5 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Terminal className="h-8 w-8 text-cyan-400 animate-pulse" />
          <p className="font-mono text-xs uppercase tracking-wider text-slate-400">
            Menginisialisasi Mission Control Console...
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
    <div className="min-h-screen bg-[#070A11] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* 1. TOP HEADER: MISSION CONTROL COCKPIT */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#0B0F19]/95 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Brand + Cluster Identity */}
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/80 font-mono text-xs font-bold shadow-md shadow-cyan-950/30">
              <Terminal className="h-4 w-4" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold tracking-wider text-cyan-400 uppercase">
                  NOEWBAR OPS COCKPIT
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.2 font-mono text-[10px] text-slate-300">
                  NODE-JKT-01
                </span>
                {live && (
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 font-mono text-[10px] text-emerald-400 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    LIVE SIGNAL
                  </span>
                )}
              </div>
              <p className="text-2xs text-slate-400 font-mono">
                Platform Administrator &amp; Multi-Tenant Fleet Master
              </p>
            </div>
          </div>

          {/* Quick Telemetry Ticker (Monospaced Metrics) */}
          <div className="hidden xl:flex items-center gap-3 font-mono text-2xs text-slate-300 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5">
            <div className="flex items-center gap-1.5" title="AI Gateway Round-trip latency">
              <Zap className={cn("h-3 w-3", data.gateway.ok ? "text-cyan-400" : "text-rose-400")} />
              <span>AI GW:</span>
              <span className="font-bold text-slate-100">{data.gateway.latency_ms ? `${data.gateway.latency_ms}ms` : "DOWN"}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5" title="WhatsMeow Daemon Sockets">
              <Server className={cn("h-3 w-3", data.daemon.ok ? "text-emerald-400" : "text-rose-400")} />
              <span>WA Sockets:</span>
              <span className="font-bold text-slate-100">{data.daemon.active_instances ?? 0}</span>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5" title="BullMQ Nudge Queue">
              <Cpu className={cn("h-3 w-3", data.queue.redis ? "text-amber-400" : "text-rose-400")} />
              <span>Queue:</span>
              <span className="font-bold text-slate-100">{data.queue.waiting} wait / {data.queue.failed} fail</span>
            </div>
            {stats && (
              <>
                <span className="text-slate-700">|</span>
                <div className="flex items-center gap-1.5" title="Node Uptime & Memory">
                  <Activity className="h-3 w-3 text-purple-400" />
                  <span>Heap:</span>
                  <span className="font-bold text-slate-100">{stats.memory_heap_used_mb}MB</span>
                  <span className="text-slate-500">({formatSeconds(stats.uptime_seconds)})</span>
                </div>
              </>
            )}
          </div>

          {/* Top Actions: Emergency Kill Switch, Store Dashboard Link, Logout */}
          <div className="flex items-center gap-2 shrink-0">
            {ks.disabled ? (
              <Button
                size="sm"
                variant="accent"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs border-none shadow-md"
                loading={busy}
                onClick={() => act({ action: "kill_switch", disabled: false })}
              >
                <Zap className="mr-1.5 h-3.5 w-3.5" />
                Nyalakan Bot Global
              </Button>
            ) : (
              <Button
                size="sm"
                variant="danger"
                className="bg-rose-700 hover:bg-rose-600 text-white font-mono text-xs border-none shadow-md"
                loading={busy}
                onClick={() =>
                  act(
                    { action: "kill_switch", disabled: true },
                    "PERINGATAN KRITIS: Matikan seluruh balasan bot WhatsApp di SEMUA toko client?"
                  )
                }
              >
                <AlertOctagon className="mr-1.5 h-3.5 w-3.5" />
                Emergency Kill-Switch
              </Button>
            )}

            <Button
              size="sm"
              variant="secondary"
              className="bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 font-mono text-xs"
              onClick={load}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Probe
            </Button>

            <a
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-750 bg-slate-900 px-3 py-1.5 font-mono text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              title="Masuk ke Dashboard Toko Merchant"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard Toko</span>
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              title="Keluar dari Konsol Superadmin"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 2. COMMAND NAVIGATION TABS */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto border-t border-slate-800/80 pt-2.5">
          {[
            { id: "telemetry", label: "Telemetri Node", icon: <Radio className="h-3.5 w-3.5" /> },
            { id: "tenants", label: `Kontrol Tenant (${data.tenants.length})`, icon: <Users className="h-3.5 w-3.5" /> },
            { id: "fleet", label: `Fleet WhatsApp (${data.fleet.length})`, icon: <Server className="h-3.5 w-3.5" /> },
            { id: "webhooks", label: `Ledger Webhooks (${data.webhooks.length})`, icon: <Webhook className="h-3.5 w-3.5" /> },
            { id: "system_ops", label: "Operasi & Pemeliharaan", icon: <Cpu className="h-3.5 w-3.5" /> },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as Tab)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-xs font-semibold whitespace-nowrap transition-all",
                tab === t.id
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-700/80 shadow-md shadow-cyan-950/40"
                  : "bg-slate-900/60 text-slate-400 border border-slate-800/60 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {/* Main Body */}
      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Banner Kritis jika Kill-Switch Aktif */}
        {ks.disabled && (
          <div className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 shadow-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-6 w-6 text-rose-400 shrink-0" />
              <div>
                <p className="font-mono text-sm font-bold text-rose-200 uppercase tracking-wide">
                  GLOBAL KILL-SWITCH AKTIF
                </p>
                <p className="text-xs text-rose-300 mt-0.5">
                  Seluruh balasan bot AI di semua toko dibekukan sejak {ts(ks.disabledAt)}
                  {ks.disabledBy ? ` oleh ${ks.disabledBy}` : ""}.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="accent"
              className="bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs border-none"
              onClick={() => act({ action: "kill_switch", disabled: false })}
            >
              Pulihkan Bot Sekarang
            </Button>
          </div>
        )}

        {/* Banner Feedback Aksi Operator */}
        {msg && (
          <div className="rounded-lg border border-cyan-500/40 bg-cyan-950/40 px-4 py-3 font-mono text-xs text-cyan-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
              <span>{msg}</span>
            </div>
            <button
              type="button"
              onClick={() => setMsg(null)}
              className="text-cyan-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* ---------------------------------------------------- TAB 1: TELEMETRY */}
        {tab === "telemetry" && (
          <div className="space-y-6">
            {/* Platform Master KPIs */}
            <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xs uppercase tracking-wider text-slate-400">
                    Platform MRR (Rupiah)
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-mono text-xs">
                    <DollarSign className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-3 font-mono text-2xl font-extrabold text-white">
                  Rp {rupiah(totalMRR)}
                </p>
                <p className="mt-1 font-mono text-2xs text-emerald-400">
                  {data.subscription_counts["ACTIVE"] ?? 0} Toko Berlangganan Aktif
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xs uppercase tracking-wider text-slate-400">
                    Total Toko Client
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono text-xs">
                    <Users className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-3 font-mono text-2xl font-extrabold text-white">
                  {totalStores} <span className="text-xs font-normal text-slate-400">tenant</span>
                </p>
                <p className="mt-1 font-mono text-2xs text-cyan-400">
                  {activeTenantsCount} Aktif &bull; {trialTenantsCount} Masa Percobaan
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xs uppercase tracking-wider text-slate-400">
                    Volume Pesanan Transaksi
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-950 text-amber-400 border border-amber-800/60 font-mono text-xs">
                    <ShoppingBag className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-3 font-mono text-2xl font-extrabold text-white">
                  {totalOrders} <span className="text-xs font-normal text-slate-400">order</span>
                </p>
                <p className="mt-1 font-mono text-2xs text-amber-400">
                  Diproses otomatis oleh platform
                </p>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xs uppercase tracking-wider text-slate-400">
                    Total Percakapan CS Bot
                  </span>
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-purple-950 text-purple-400 border border-purple-800/60 font-mono text-xs">
                    <MessageSquare className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-3 font-mono text-2xl font-extrabold text-white">
                  {totalConversations} <span className="text-xs font-normal text-slate-400">chat</span>
                </p>
                <p className="mt-1 font-mono text-2xs text-purple-400">
                  Direspon 24/7 tanpa delay
                </p>
              </div>
            </div>

            {/* Probe Node Servers Grid (6 Deep Probe Cards) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400">
                  Status Kesehatan Dependensi &amp; Node Cluster
                </h3>
                <span className="font-mono text-2xs text-slate-500">Auto-probe setiap 30 detik</span>
              </div>

              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {/* Probe 1: AI Gateway */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-cyan-400" />
                      <h4 className="font-mono text-xs font-bold text-white uppercase">AI LLM Gateway</h4>
                    </div>
                    <Badge tone={data.gateway.ok ? "signal" : "danger"}>
                      <StatusDot ok={data.gateway.ok} />
                      {data.gateway.ok ? "ONLINE" : "OFFLINE"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 font-mono text-2xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Active Model:</span>
                      <span className="font-bold text-cyan-300">{data.gateway.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gateway Latency:</span>
                      <span className="font-bold text-white">{data.gateway.latency_ms ? `${data.gateway.latency_ms} ms` : "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Available Models:</span>
                      <span className="text-slate-300">{data.gateway.models.length} model loaded</span>
                    </div>
                    {data.gateway.error && (
                      <p className="text-rose-400 mt-1 font-sans">{data.gateway.error}</p>
                    )}
                  </div>
                </div>

                {/* Probe 2: WhatsApp Gateway Daemon */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Server className="h-4 w-4 text-emerald-400" />
                      <h4 className="font-mono text-xs font-bold text-white uppercase">WhatsMeow Daemon</h4>
                    </div>
                    <Badge tone={data.daemon.ok ? "signal" : "danger"}>
                      <StatusDot ok={data.daemon.ok} />
                      {data.daemon.ok ? "ONLINE" : "OFFLINE"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 font-mono text-2xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Active Instances:</span>
                      <span className="font-bold text-emerald-400">{data.daemon.active_instances ?? 0} sockets</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Daemon Base URL:</span>
                      <span className="text-slate-400 truncate max-w-[150px]" title={data.daemon.url}>{data.daemon.url}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Daemon Ping:</span>
                      <span className="text-slate-300">{ts(data.daemon.uptime_reported_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Probe 3: Redis & BullMQ Queue */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-amber-400" />
                      <h4 className="font-mono text-xs font-bold text-white uppercase">Redis / BullMQ Queue</h4>
                    </div>
                    <Badge tone={data.queue.redis ? "signal" : "danger"}>
                      <StatusDot ok={data.queue.redis} />
                      {data.queue.redis ? "HEALTHY" : "DOWN"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 font-mono text-2xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Waiting Jobs:</span>
                      <span className="font-bold text-amber-300">{data.queue.waiting}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Delayed (Anti-Ghosting):</span>
                      <span>{data.queue.delayed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Failed / Pending In DB:</span>
                      <span className={cn(data.queue.failed > 0 && "text-rose-400 font-bold")}>
                        {data.queue.failed} failed / {data.queue.pendingInDb} fallback db
                      </span>
                    </div>
                  </div>
                </div>

                {/* Probe 4: PostgreSQL Cluster */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-purple-400" />
                      <h4 className="font-mono text-xs font-bold text-white uppercase">PostgreSQL Database</h4>
                    </div>
                    <Badge tone="signal">
                      <StatusDot ok />
                      CONNECTED
                    </Badge>
                  </div>
                  <div className="space-y-1.5 font-mono text-2xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Toko (Tenants):</span>
                      <span className="font-bold text-white">{stats?.total_tenants ?? data.tenants.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Transaksi Orders:</span>
                      <span className="font-bold text-white">{stats?.total_orders ?? totalOrders}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Produk SKU:</span>
                      <span className="font-bold text-white">{stats?.total_products ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Probe 5: Telegram Alert Bot */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-sky-400" />
                      <h4 className="font-mono text-xs font-bold text-white uppercase">Telegram Alert Channel</h4>
                    </div>
                    <Badge tone={data.telegram.ok ? "signal" : "warn"}>
                      <StatusDot ok={data.telegram.ok} />
                      {data.telegram.ok ? "READY" : "NO BOT"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 font-mono text-2xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Target Bot:</span>
                      <span className="text-sky-300">@{data.telegram.username || "not_configured"}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-slate-500">Test Alert Ping:</span>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 text-[11px] px-2 bg-slate-800 text-slate-300 hover:text-white"
                        onClick={() => act({ action: "test_telegram" })}
                      >
                        Kirim Ping
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Probe 6: Node.js Runtime Spec */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-indigo-400" />
                      <h4 className="font-mono text-xs font-bold text-white uppercase">Runtime Server Node</h4>
                    </div>
                    <Badge tone="signal">
                      <StatusDot ok />
                      V8 ENGINE
                    </Badge>
                  </div>
                  <div className="space-y-1.5 font-mono text-2xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Node Version:</span>
                      <span className="font-bold text-indigo-300">{stats?.node_version ?? process.version}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Memory RSS:</span>
                      <span>{stats?.memory_rss_mb ?? 0} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Server Uptime:</span>
                      <span className="text-emerald-400 font-bold">{stats ? formatSeconds(stats.uptime_seconds) : "-"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 5 Pesanan Platform Terbaru */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 overflow-hidden">
              <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h4 className="font-mono text-xs font-bold text-white uppercase">
                    Aktivitas Transaksi Lintas Tenant (Global Feed)
                  </h4>
                  <p className="text-2xs text-slate-400">Order terbaru dari seluruh toko di platform.</p>
                </div>
                <span className="font-mono text-2xs text-slate-500">{data.recent_orders.length} transaksi terakhir</span>
              </div>
              <div className="divide-y divide-slate-800/80">
                {data.recent_orders.length === 0 ? (
                  <p className="p-4 text-center text-xs text-slate-500 font-mono">Belum ada transaksi di platform.</p>
                ) : (
                  data.recent_orders.slice(0, 5).map((o) => (
                    <div key={o.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                      <div className="flex items-center gap-3">
                        <span className="text-cyan-400 font-bold">{o.order_number}</span>
                        <span className="text-slate-400">Toko: <strong className="text-slate-200">{o.tenant}</strong></span>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-slate-400">{timeAgo(o.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-emerald-400">Rp {rupiah(o.total)}</span>
                        <Badge tone={o.payment_status === "VERIFIED" ? "signal" : "warn"} className="text-[10px]">
                          {o.payment_status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- TAB 2: TENANTS */}
        {tab === "tenants" && (
          <div className="space-y-4">
            {/* Toolbar Pencarian & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                {(["all", "ACTIVE", "TRIAL", "SUSPENDED"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setTenantFilter(st)}
                    className={cn(
                      "px-2.5 py-1 rounded font-semibold uppercase text-2xs transition-colors",
                      tenantFilter === st
                        ? "bg-cyan-900 text-cyan-200 border border-cyan-600"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-750"
                    )}
                  >
                    {st === "all" ? "Semua Status" : st}
                  </button>
                ))}
              </div>

              <div className="relative min-w-[240px]">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari toko, email, WA..."
                  value={tenantQuery}
                  onChange={(e) => setTenantQuery(e.target.value)}
                  className="w-full rounded-lg border border-slate-750 bg-slate-950 pl-8 pr-3 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Tabel Multi-Tenant & Kuota AI */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-950/80 text-2xs uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Nama Toko &amp; Kontak</th>
                      <th className="px-4 py-3">Status Langganan</th>
                      <th className="px-4 py-3 text-center">Beban Kuota AI &amp; Aktivitas</th>
                      <th className="px-4 py-3 text-center">Basis Data Toko</th>
                      <th className="px-4 py-3 text-right">Aksi Operator</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">
                          Tidak ada tenant yang cocok dengan filter.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-850/50 transition-colors">
                          <td className="px-4 py-3.5">
                            <p className="font-bold text-white text-sm">{t.business_name}</p>
                            <p className="text-2xs text-slate-400">{t.email}</p>
                            <p className="text-2xs text-cyan-400 font-mono mt-0.5">{t.owner_whatsapp}</p>
                          </td>
                          <td className="px-4 py-3.5">
                            <Badge
                              tone={t.status === "ACTIVE" ? "signal" : t.status === "TRIAL" ? "warn" : "danger"}
                              className="text-[10px]"
                            >
                              {t.status}
                            </Badge>
                            <p className="mt-1 text-2xs text-slate-400">
                              Berakhir: {new Date(t.trial_expires_at).toLocaleDateString("id-ID")}
                            </p>
                            {t.subscription && (
                              <p className="text-2xs text-emerald-400 font-semibold">
                                {t.subscription.plan} &bull; Rp {rupiah(t.subscription.amount)}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <div className="inline-flex flex-col items-center">
                              <span className="font-bold text-slate-100">{t.conversations} chat / {t.orders} order</span>
                              <span className="text-[10px] text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40 mt-1">
                                Est. {t.conversations * 450} Token AI
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center text-2xs text-slate-400">
                            <div>{t.products ?? 0} SKU Produk</div>
                            <div>{t.knowledge_docs ?? 0} Dokumen SOP</div>
                            <div>{t.websites ?? 0} Landing Page</div>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-[10px] px-2 bg-slate-800 text-slate-200 hover:text-white"
                                onClick={() => act({ action: "extend_trial", tenant_id: t.id, days: 7 })}
                              >
                                +7 Hari
                              </Button>
                              <Button
                                size="sm"
                                variant={t.status === "SUSPENDED" ? "accent" : "secondary"}
                                className={cn(
                                  "h-7 text-[10px] px-2",
                                  t.status === "SUSPENDED"
                                    ? "bg-emerald-700 text-white"
                                    : "bg-amber-900/60 text-amber-200 hover:bg-amber-800"
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
                                className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                                title="Hapus tenant permanen"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

        {/* ---------------------------------------------------- TAB 3: FLEET */}
        {tab === "fleet" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
              <div className="border-b border-slate-800 px-5 py-3 flex items-center justify-between">
                <div>
                  <h4 className="font-mono text-xs font-bold text-white uppercase">
                    Fleet Sesi Soket WhatsApp Toko
                  </h4>
                  <p className="text-2xs text-slate-400">Pantau seluruh nomor WA toko yang terhubung ke WhatsMeow daemon.</p>
                </div>
                <span className="font-mono text-2xs text-slate-400">{data.fleet.length} Sesi Terdaftar</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-950/80 text-2xs uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Instance Key</th>
                      <th className="px-4 py-3">Toko Terkait</th>
                      <th className="px-4 py-3">Status Koneksi</th>
                      <th className="px-4 py-3">Nomor WhatsApp</th>
                      <th className="px-4 py-3">Ping Terakhir</th>
                      <th className="px-4 py-3 text-right">Aksi Soket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {data.fleet.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-500">
                          Belum ada instance WhatsApp yang terdaftar.
                        </td>
                      </tr>
                    ) : (
                      data.fleet.map((inst) => (
                        <tr key={inst.instance_key} className="hover:bg-slate-850/50">
                          <td className="px-4 py-3.5 font-bold text-cyan-300">{inst.instance_key}</td>
                          <td className="px-4 py-3.5 font-semibold text-white">{inst.tenant}</td>
                          <td className="px-4 py-3.5">
                            <Badge
                              tone={inst.connection_status === "CONNECTED" ? "signal" : inst.connection_status === "PAIRING" ? "warn" : "danger"}
                              className="text-[10px]"
                            >
                              <StatusDot ok={inst.connection_status === "CONNECTED"} />
                              {inst.connection_status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3.5 text-slate-200">{inst.phone_number || "Belum Scan QR"}</td>
                          <td className="px-4 py-3.5 text-2xs text-slate-400">{inst.last_seen ? timeAgo(inst.last_seen) : "-"}</td>
                          <td className="px-4 py-3.5 text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 text-[10px] px-2 bg-slate-800 text-slate-200 hover:text-white"
                              onClick={() => act({ action: "restart_instance", instance_key: inst.instance_key }, `Restart soket sesi ${inst.instance_key}?`)}
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

        {/* ---------------------------------------------------- TAB 4: WEBHOOKS */}
        {tab === "webhooks" && (
          <div className="space-y-4">
            {/* Quick Midtrans Sync Tool */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="font-mono text-xs font-bold text-white uppercase">
                  Sinkronisasi Status Midtrans Manual
                </h4>
                <p className="text-2xs text-slate-400">Verifikasi status transaksi jika webhook Midtrans mengalami delay.</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Order ID Midtrans..."
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  className="rounded-lg border border-slate-750 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none w-48"
                />
                <Button
                  size="sm"
                  variant="primary"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs border-none"
                  disabled={!orderId.trim()}
                  onClick={() => act({ action: "sync_midtrans", order_id: orderId.trim() })}
                >
                  Cek Status
                </Button>
              </div>
            </div>

            {/* Tabel Ledger Webhook */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden">
              <div className="border-b border-slate-800 px-5 py-3 flex items-center justify-between">
                <h4 className="font-mono text-xs font-bold text-white uppercase">
                  Audit Ledger Webhook Masuk (Idempotensi Terlindungi)
                </h4>
                <span className="font-mono text-2xs text-slate-400">{data.webhooks.length} Events Tercatat</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-950/80 text-2xs uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Event Key</th>
                      <th className="px-4 py-3">Tipe Event</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Waktu Masuk</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-300">
                    {data.webhooks.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-500">Belum ada webhook event tercatat.</td>
                      </tr>
                    ) : (
                      data.webhooks.map((w) => (
                        <tr key={w.id} className="hover:bg-slate-850/50">
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold",
                              w.provider === "MIDTRANS" ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60" : "bg-cyan-950 text-cyan-400 border border-cyan-800/60"
                            )}>
                              {w.provider}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-200">{w.event_key}</td>
                          <td className="px-4 py-3 text-slate-400">{w.event_type || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={cn("text-2xs font-bold", w.processed ? "text-emerald-400" : "text-amber-400")}>
                              {w.processed ? "PROCESSED" : "PENDING"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-2xs text-slate-400">{ts(w.created_at)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ---------------------------------------------------- TAB 5: SYSTEM OPS */}
        {tab === "system_ops" && (
          <div className="space-y-6">
            <div>
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Operasi Pemeliharaan &amp; Diagnostik Cluster Platform
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Op 1: Maintenance Sweep */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Cpu className="h-4 w-4 text-cyan-400" />
                      <h4 className="font-mono text-xs font-bold text-white uppercase">Maintenance Sweep 3-in-1</h4>
                    </div>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Jalankan siklus sweep berkala manual: kadaluarsa reservasi stok 2 jam, kirim antrean anti-ghosting, dan rekonsiliasi status langganan tenant.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <Button
                      size="sm"
                      variant="primary"
                      className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs border-none"
                      loading={busy}
                      onClick={() => act({ action: "trigger_maintenance" })}
                    >
                      Jalankan Sweep Sekarang
                    </Button>
                  </div>
                </div>

                {/* Op 2: Midtrans Force Reconcile */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-emerald-400" />
                      <h4 className="font-mono text-xs font-bold text-white uppercase">Rekonsiliasi Langganan</h4>
                    </div>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Pindai seluruh tagihan Midtrans yang menggantung untuk memastikan langganan toko yang sudah lunas segera aktif otomatis.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs"
                      loading={busy}
                      onClick={() => act({ action: "reconcile" })}
                    >
                      Pindai Status Midtrans
                    </Button>
                  </div>
                </div>

                {/* Op 3: Telegram Alert Test Ping */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-sky-400" />
                      <h4 className="font-mono text-xs font-bold text-white uppercase">Uji Saluran Telegram</h4>
                    </div>
                    <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                      Kirim pesan pengujian alert darurat ke bot dan admin chat ID untuk memastikan notifikasi server dapat diterima.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-800">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs"
                      loading={busy}
                      onClick={() => act({ action: "test_telegram" })}
                    >
                      Kirim Pesan Uji
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Konfirmasi Wipe Tenant */}
      {wipeConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-rose-500/50 bg-slate-950 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-rose-950 text-rose-400 border border-rose-800">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h4 className="font-mono text-sm font-bold text-white uppercase">
                  Konfirmasi Hapus Toko
                </h4>
                <p className="text-2xs text-rose-400">Tindakan destruktif tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Anda akan menghapus seluruh data toko <strong>"{wipeConfirmModal.name}"</strong> termasuk semua katalog produk, percakapan, pesanan, dan sesi WhatsApp.
            </p>

            <div>
              <label htmlFor="wipe-confirm-input" className="block font-mono text-2xs uppercase text-slate-400 mb-1">
                Ketik <span className="text-rose-400 font-bold">HAPUS</span> untuk konfirmasi:
              </label>
              <input
                id="wipe-confirm-input"
                type="text"
                placeholder="HAPUS"
                value={wipeInput}
                onChange={(e) => setWipeInput(e.target.value)}
                className="w-full rounded-lg border border-slate-750 bg-slate-900 px-3 py-2 font-mono text-xs text-white uppercase focus:border-rose-500 focus:outline-none"
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
