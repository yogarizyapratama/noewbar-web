"use client";

/**
 * Superadmin Management Console (Enterprise Application Management Edition).
 *
 * Standar antislop:
 * - Layout konsol manajemen aplikasi lengkap dengan Sidebar Navigasi terstruktur.
 * - Tanpa klise hacker retro, tanpa ornamen sci-fi berlebihan, tanpa gradien generik AI.
 * - Kontras warna WCAG AA, navigasi keyboard penuh, zero em-dash.
 * - Data real-time langsung terhubung ke PostgreSQL, Redis, WhatsMeow, dan AI Gateway.
 * - Fitur manajemen lengkap: Onboarding Tenant baru, Inspeksi Detail Tenant,
 *   Ekspor CSV, AI Model Explorer & Latency Tester, Webhook Ledger Audit, Transaksi Global,
 *   Fleet WhatsApp Control, dan System Maintenance.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Copy,
  Cpu,
  CreditCard,
  Database,
  Download,
  ExternalLink,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
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
import { NotificationBell } from "@/components/notification-bell";
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
    owner_name?: string;
    email: string;
    owner_whatsapp: string;
    status: string;
    created_at?: string;
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

type NavigationSection =
  | "overview"
  | "infrastructure"
  | "tenants"
  | "financials"
  | "fleet"
  | "ai_models"
  | "orders"
  | "webhooks"
  | "system_ops"
  | "killswitch";

type TenantFilter = "all" | "ACTIVE" | "TRIAL" | "SUSPENDED";

type NavItem = {
  id: NavigationSection;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeTone?: "signal" | "danger";
};

type NavGroup = {
  group: string;
  items: NavItem[];
};

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

function exportTenantsToCSV(tenants: ConsoleData["tenants"]) {
  const headers = ["ID", "Nama Bisnis", "Pemilik", "Email", "WhatsApp", "Status", "Batas Trial", "Total Chat", "Total Order", "Total SKU"];
  const rows = tenants.map((t) => [
    t.id,
    `"${t.business_name.replace(/"/g, '""')}"`,
    `"${(t.owner_name || "").replace(/"/g, '""')}"`,
    t.email,
    t.owner_whatsapp,
    t.status,
    t.trial_expires_at,
    t.conversations,
    t.orders,
    t.products ?? 0,
  ]);
  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `noewbar_tenants_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function SuperadminPage() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [activeSection, setActiveSection] = useState<NavigationSection>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveEvent, setLiveEvent] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Filters & Search
  const [tenantFilter, setTenantFilter] = useState<TenantFilter>("all");
  const [tenantQuery, setTenantQuery] = useState("");
  const [orderQuery, setOrderQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | "VERIFIED" | "PENDING">("all");
  const [modelSearch, setModelSearch] = useState("");
  const [webhookProviderFilter, setWebhookProviderFilter] = useState<"all" | "MIDTRANS" | "TELEGRAM">("all");

  // Modals & Drawers
  const [selectedTenant, setSelectedTenant] = useState<ConsoleData["tenants"][0] | null>(null);
  const [createTenantModal, setCreateTenantModal] = useState(false);
  const [wipeConfirmModal, setWipeConfirmModal] = useState<{ id: string; name: string } | null>(null);
  const [wipeInput, setWipeInput] = useState("");
  const [orderIdSync, setOrderIdSync] = useState("");

  // Create Tenant Form State
  const [newTenant, setNewTenant] = useState({
    business_name: "",
    owner_name: "",
    email: "",
    password: "",
    owner_whatsapp: "",
    status: "TRIAL" as "TRIAL" | "ACTIVE",
    trial_days: 14,
  });

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

  async function handleCreateTenant(e: React.FormEvent) {
    e.preventDefault();
    if (!newTenant.business_name || !newTenant.email || !newTenant.password || !newTenant.owner_whatsapp) {
      setMsg({ text: "Mohon lengkapi seluruh formulir toko baru.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_tenant",
          ...newTenant,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({ text: `Toko "${newTenant.business_name}" berhasil dibuat.`, tone: "success" });
        setCreateTenantModal(false);
        setNewTenant({
          business_name: "",
          owner_name: "",
          email: "",
          password: "",
          owner_whatsapp: "",
          status: "TRIAL",
          trial_days: 14,
        });
        await load();
      } else {
        setMsg({ text: json.error || "Gagal membuat tenant baru.", tone: "error" });
      }
    } catch {
      setMsg({ text: "Terjadi kesalahan saat membuat toko baru.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleTestAIGateway() {
    setBusy(true);
    try {
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test_ai_gateway" }),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({
          text: `AI Gateway Sehat: Latensi ${json.latencyMs} ms, ${json.models?.length ?? 0} model siap.`,
          tone: "success",
        });
        await load();
      } else {
        setMsg({ text: json.error || "Pengujian AI Gateway gagal.", tone: "error" });
      }
    } catch {
      setMsg({ text: "Koneksi ke AI Gateway terputus saat pengujian.", tone: "error" });
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

  function copyToClipboard(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
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
  const suspendedTenantsCount = data.tenants.filter((t) => t.status === "SUSPENDED").length;
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
        (t.owner_name && t.owner_name.toLowerCase().includes(q)) ||
        t.email.toLowerCase().includes(q) ||
        t.owner_whatsapp.toLowerCase().includes(q) ||
        t.id.toLowerCase().includes(q)
      );
    });

  const filteredOrders = data.recent_orders
    .filter((o) => (orderFilter === "all" ? true : o.payment_status === orderFilter))
    .filter((o) => {
      if (!orderQuery.trim()) return true;
      const q = orderQuery.toLowerCase().trim();
      return (
        o.order_number.toLowerCase().includes(q) ||
        o.tenant.toLowerCase().includes(q)
      );
    });

  const filteredModels = data.gateway.models.filter((m) =>
    modelSearch.trim() ? m.toLowerCase().includes(modelSearch.toLowerCase().trim()) : true
  );

  const filteredWebhooks = data.webhooks.filter((w) =>
    webhookProviderFilter === "all" ? true : w.provider === webhookProviderFilter
  );

  // Navigasi Terstruktur
  const navGroups: NavGroup[] = [
    {
      group: "MONITORING & KESEHATAN",
      items: [
        { id: "overview", label: "Ringkasan Eksekutif", icon: <LayoutDashboard className="h-4 w-4" /> },
        { id: "infrastructure", label: "Kesehatan Infrastruktur", icon: <Server className="h-4 w-4" /> },
      ],
    },
    {
      group: "MANAJEMEN ENTITAS",
      items: [
        {
          id: "tenants",
          label: "Direktori Toko",
          badge: `${data.tenants.length}`,
          icon: <Users className="h-4 w-4" />,
        },
        { id: "financials", label: "Finansial & Langganan", icon: <CreditCard className="h-4 w-4" /> },
      ],
    },
    {
      group: "GATEWAY & KOMUNIKASI",
      items: [
        {
          id: "fleet",
          label: "Fleet WhatsApp",
          badge: `${data.fleet.length}`,
          icon: <MessageSquare className="h-4 w-4" />,
        },
        {
          id: "ai_models",
          label: "AI Gateway & Model",
          badge: data.gateway.ok ? "Aktif" : "Gangguan",
          icon: <Zap className="h-4 w-4" />,
        },
      ],
    },
    {
      group: "INTEGRASI & AUDIT",
      items: [
        {
          id: "orders",
          label: "Transaksi Lintas Toko",
          badge: `${data.recent_orders.length}`,
          icon: <ShoppingBag className="h-4 w-4" />,
        },
        {
          id: "webhooks",
          label: "Buku Besar Webhook",
          badge: `${data.webhooks.length}`,
          icon: <Webhook className="h-4 w-4" />,
        },
      ],
    },
    {
      group: "SISTEM & OPERASI",
      items: [
        { id: "system_ops", label: "Pemeliharaan Platform", icon: <Cpu className="h-4 w-4" /> },
        {
          id: "killswitch",
          label: "Pengamanan & Darurat",
          badge: ks.disabled ? "OFF" : "ON",
          badgeTone: ks.disabled ? "danger" : "signal",
          icon: <ShieldAlert className="h-4 w-4" />,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* ==================================================== 1. GLOBAL TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900/95 backdrop-blur-md px-4 sm:px-6 py-2.5">
        <div className="flex items-center justify-between gap-3 max-w-full mx-auto">
          {/* Brand & Sidebar Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileMenuOpen(!mobileMenuOpen);
                } else {
                  setSidebarOpen(!sidebarOpen);
                }
              }}
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-850 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="Toggle Navigasi Sidebar"
              aria-label="Toggle Sidebar"
            >
              <Menu className="h-4 w-4 lg:hidden" />
              <PanelLeftClose className={cn("h-4 w-4 hidden lg:block", !sidebarOpen && "hidden")} />
              <PanelLeftOpen className={cn("h-4 w-4 hidden lg:block", sidebarOpen && "hidden")} />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white tracking-tight">
                    Noewbar Platform
                  </span>
                  <span className="rounded bg-indigo-950 border border-indigo-500/40 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-300">
                    Console
                  </span>
                  {ks.disabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/70 px-2 py-0.5 text-[10px] font-bold text-rose-300 animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      Kill-Switch Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Sistem Stabil
                    </span>
                  )}
                  {liveEvent && (
                    <span className="inline-flex items-center gap-1 rounded bg-indigo-950 border border-indigo-500/40 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                      Sinyal: {liveEvent}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry Pills Strip */}
          <div className="hidden xl:flex items-center gap-2.5 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1">
            <div className="flex items-center gap-1.5" title="Latency AI Gateway">
              <Zap className={cn("h-3 w-3", data.gateway.ok ? "text-emerald-400" : "text-rose-400")} />
              <span className="text-slate-400 text-2xs">AI:</span>
              <span className="font-mono font-semibold text-xs text-slate-100">
                {data.gateway.latency_ms ? `${data.gateway.latency_ms} ms` : "Gangguan"}
              </span>
            </div>
            <span className="text-slate-800">&bull;</span>
            <div className="flex items-center gap-1.5" title="Soket WhatsApp Aktif">
              <Server className={cn("h-3 w-3", data.daemon.ok ? "text-emerald-400" : "text-rose-400")} />
              <span className="text-slate-400 text-2xs">WA:</span>
              <span className="font-mono font-semibold text-xs text-slate-100">{data.daemon.active_instances ?? 0}</span>
            </div>
            <span className="text-slate-800">&bull;</span>
            <div className="flex items-center gap-1.5" title="Beban Antrean Pesan BullMQ">
              <Cpu className={cn("h-3 w-3", data.queue.redis ? "text-amber-400" : "text-rose-400")} />
              <span className="text-slate-400 text-2xs">Antre:</span>
              <span className="font-mono font-semibold text-xs text-slate-100">{data.queue.waiting}</span>
            </div>
            {stats && (
              <>
                <span className="text-slate-800">&bull;</span>
                <div className="flex items-center gap-1.5" title="Memori V8 Heap">
                  <Activity className="h-3 w-3 text-indigo-400" />
                  <span className="text-slate-400 text-2xs">RAM:</span>
                  <span className="font-mono font-semibold text-xs text-slate-100">{stats.memory_heap_used_mb} MB</span>
                </div>
              </>
            )}
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="accent"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs border-none font-medium h-8 px-3"
              onClick={() => setCreateTenantModal(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Toko Baru
            </Button>

            <Button
              size="sm"
              variant="secondary"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs border-slate-750 h-8 px-2.5"
              onClick={handleRefresh}
              loading={refreshing}
              title="Perbarui data konsol"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </Button>

            <NotificationBell
              scope="admin"
              theme="dark"
              onNavigate={(targetTab) => setActiveSection(targetTab as NavigationSection)}
            />

            <a
              href="/dashboard"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-850 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 h-8"
              title="Buka panel toko tenant di tab baru"
            >
              <span>Dashboard Toko</span>
              <ExternalLink className="h-3 w-3 text-slate-500" />
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 h-8 w-8 flex items-center justify-center"
              title="Keluar dari Konsol Superadmin"
              aria-label="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================== 2. MAIN APPLICATION CONTAINER (SIDEBAR + WORKSPACE) */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR NAVIGATION */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 lg:static flex flex-col border-r border-slate-800 bg-slate-900 transition-all duration-200 ease-in-out shrink-0",
            sidebarOpen ? "w-64" : "w-16 hidden lg:flex",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Mobile Header in Drawer */}
          <div className="p-4 border-b border-slate-800 flex items-center justify-between lg:hidden">
            <span className="text-xs font-bold text-white">Menu Navigasi Platform</span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Links Scrollable */}
          <nav className="flex-1 overflow-y-auto p-3 space-y-5">
            {navGroups.map((grp) => (
              <div key={grp.group} className="space-y-1">
                {sidebarOpen && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {grp.group}
                  </p>
                )}
                <div className="space-y-0.5">
                  {grp.items.map((item) => {
                    const active = activeSection === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveSection(item.id as NavigationSection);
                          setMobileMenuOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                          active
                            ? "bg-indigo-600 text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-slate-100 hover:bg-slate-850"
                        )}
                        title={item.label}
                      >
                        <span className={cn(active ? "text-white" : "text-slate-400")}>
                          {item.icon}
                        </span>
                        {sidebarOpen && (
                          <div className="flex-1 flex items-center justify-between overflow-hidden">
                            <span className="truncate">{item.label}</span>
                            {"badge" in item && (
                              <span
                                className={cn(
                                  "ml-2 rounded px-1.5 py-0.2 text-[10px] font-mono",
                                  active
                                    ? "bg-indigo-700 text-white"
                                    : item.badgeTone === "danger"
                                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                                    : "bg-slate-800 text-slate-300"
                                )}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar Footer */}
          {sidebarOpen ? (
            <div className="p-3 border-t border-slate-800 bg-slate-950/60 text-2xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-400">
                <span>Versi Mesin:</span>
                <span className="font-mono text-slate-200">{stats?.node_version ?? process.version}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Uptime Server:</span>
                <span className="font-mono text-emerald-400">
                  {stats ? formatSeconds(stats.uptime_seconds) : "-"}
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2 border-t border-slate-800 flex justify-center text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-400" title="Server Aktif" />
            </div>
          )}
        </aside>

        {/* WORKSPACE CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Breadcrumbs & Active Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div>
              <div className="flex items-center gap-2 text-2xs text-slate-400">
                <span>Konsol Manajemen</span>
                <ChevronRight className="h-3 w-3 text-slate-600" />
                <span className="text-indigo-400 font-medium capitalize">
                  {activeSection.replace("_", " ")}
                </span>
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight mt-0.5">
                {activeSection === "overview" && "Ringkasan Eksekutif & Skala Platform"}
                {activeSection === "infrastructure" && "Pusat Kesehatan Infrastruktur & Layanan Backend"}
                {activeSection === "tenants" && "Direktori & Manajemen Toko Klien (Multi-Tenant)"}
                {activeSection === "financials" && "Analisis Finansial & Siklus Langganan"}
                {activeSection === "fleet" && "Fleet & Soket Daemon WhatsApp Toko"}
                {activeSection === "ai_models" && "AI Gateway Orchestrator & Model Explorer"}
                {activeSection === "orders" && "Monitoring Pesanan Transaksi Lintas Toko"}
                {activeSection === "webhooks" && "Buku Besar Audit Webhook & Idempotensi"}
                {activeSection === "system_ops" && "Operasi Pemeliharaan Rutin & Jadwal Platform"}
                {activeSection === "killswitch" && "Protokol Keamanan & Emergency Kill Switch"}
              </h1>
            </div>

            {/* Quick action buttons context-sensitive */}
            <div className="flex items-center gap-2">
              {activeSection === "tenants" && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200"
                    onClick={() => exportTenantsToCSV(data.tenants)}
                    title="Unduh seluruh data toko ke file CSV"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Ekspor CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white border-none"
                    onClick={() => setCreateTenantModal(true)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Tambah Toko
                  </Button>
                </>
              )}
              {activeSection === "ai_models" && (
                <Button
                  size="sm"
                  variant="primary"
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white border-none"
                  loading={busy}
                  onClick={handleTestAIGateway}
                >
                  <Zap className="mr-1.5 h-3.5 w-3.5" />
                  Uji Latensi AI Real-time
                </Button>
              )}
              {activeSection === "system_ops" && (
                <Button
                  size="sm"
                  variant="primary"
                  className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white border-none"
                  loading={busy}
                  onClick={() => act({ action: "trigger_maintenance" })}
                >
                  <Cpu className="mr-1.5 h-3.5 w-3.5" />
                  Eksekusi Sweep 3-in-1
                </Button>
              )}
            </div>
          </div>

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

          {/* Banner Darurat Kill-Switch */}
          {ks.disabled && activeSection !== "killswitch" && (
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

          {/* ==================================================== SECTION: OVERVIEW */}
          {activeSection === "overview" && (
            <div className="space-y-6">
              {/* 4 Financial & Scale KPI Cards */}
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
                      Total Toko (Tenant)
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-white font-mono">
                    {totalStores} <span className="text-sm font-normal text-slate-400">tenant</span>
                  </p>
                  <p className="mt-1 text-2xs text-indigo-300 font-medium">
                    {activeTenantsCount} Aktif &bull; {trialTenantsCount} Trial &bull; {suspendedTenantsCount} Suspend
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
                    Total {stats?.total_products ?? 0} SKU produk terdaftar
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
                  <p className="mt-1 text-2xs text-sky-300 font-mono">
                    Est. {rupiah(totalConversations * 450)} token terproses
                  </p>
                </div>
              </div>

              {/* Infrastructure Summary Strip */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Snapshot Status Layanan Inti
                    </h2>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      Pemantauan langsung 6 komponen backend utama platform.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs px-2.5 bg-slate-800 text-slate-300"
                    onClick={() => setActiveSection("infrastructure")}
                  >
                    Detail Lengkap
                    <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>

                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 text-xs">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-400 text-2xs">
                      <span>AI Gateway</span>
                      <StatusDot ok={data.gateway.ok} />
                    </div>
                    <p className="font-mono font-bold text-white mt-1">
                      {data.gateway.latency_ms ? `${data.gateway.latency_ms} ms` : "Off"}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{data.gateway.model}</p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-400 text-2xs">
                      <span>WhatsMeow</span>
                      <StatusDot ok={data.daemon.ok} />
                    </div>
                    <p className="font-mono font-bold text-white mt-1">
                      {data.daemon.active_instances ?? 0} Soket
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {data.daemon.ok ? "Terhubung" : "Terputus"}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-400 text-2xs">
                      <span>Redis &amp; Antrean</span>
                      <StatusDot ok={data.queue.redis} />
                    </div>
                    <p className="font-mono font-bold text-white mt-1">
                      {data.queue.waiting} Tugas
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {data.queue.failed > 0 ? `${data.queue.failed} Gagal` : "Normal"}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-400 text-2xs">
                      <span>PostgreSQL</span>
                      <StatusDot ok />
                    </div>
                    <p className="font-mono font-bold text-white mt-1">
                      {totalStores} Tenant
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      Cluster Sehat
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-400 text-2xs">
                      <span>Telegram Bot</span>
                      <StatusDot ok={data.telegram.ok} />
                    </div>
                    <p className="font-mono font-bold text-white mt-1">
                      {data.telegram.ok ? "Siap" : "Belum"}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      @{data.telegram.username || "none"}
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                    <div className="flex items-center justify-between text-slate-400 text-2xs">
                      <span>Node.js V8</span>
                      <StatusDot ok />
                    </div>
                    <p className="font-mono font-bold text-white mt-1">
                      {stats?.memory_heap_used_mb ?? 0} MB
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      Uptime {stats ? formatSeconds(stats.uptime_seconds) : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recent Platform Orders Feed */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
                <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Pesanan Masuk Terkini Seluruh Toko
                    </h3>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      Aktivitas transaksi live dari pembeli di seluruh tenant.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs px-2.5 bg-slate-800 text-slate-300"
                    onClick={() => setActiveSection("orders")}
                  >
                    Lihat Semua
                    <ArrowUpRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
                <div className="divide-y divide-slate-800/80">
                  {data.recent_orders.length === 0 ? (
                    <p className="p-6 text-center text-xs text-slate-500">
                      Belum ada catatan pesanan di platform.
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

          {/* ==================================================== SECTION: INFRASTRUCTURE */}
          {activeSection === "infrastructure" && (
            <div className="space-y-6">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {/* 1. AI Gateway */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Zap className="h-4 w-4 text-indigo-400" />
                      <h3 className="text-xs font-bold text-white">AI Gateway (9router)</h3>
                    </div>
                    <Badge tone={data.gateway.ok ? "signal" : "danger"}>
                      <StatusDot ok={data.gateway.ok} />
                      {data.gateway.ok ? "Aktif" : "Gangguan"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Model Default:</span>
                      <span className="font-mono text-2xs font-semibold text-indigo-300">{data.gateway.model}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Latency Round-trip:</span>
                      <span className="font-mono text-2xs font-semibold text-white">
                        {data.gateway.latency_ms ? `${data.gateway.latency_ms} ms` : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Model Terdaftar:</span>
                      <span className="text-slate-300 text-2xs">{data.gateway.models.length} model siap</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-slate-800 hover:bg-slate-700 text-slate-200"
                        loading={busy}
                        onClick={handleTestAIGateway}
                      >
                        Uji Latensi Gateway
                      </Button>
                    </div>
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
                    <div className="pt-2 border-t border-slate-800">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-slate-800 hover:bg-slate-700 text-slate-200"
                        onClick={() => setActiveSection("fleet")}
                      >
                        Kelola Fleet WhatsApp
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 3. Redis & BullMQ Queue */}
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
                    <div className="pt-2 border-t border-slate-800">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-slate-800 hover:bg-slate-700 text-slate-200"
                        onClick={() => act({ action: "trigger_maintenance" })}
                      >
                        Bersihkan Antrean Tertunda
                      </Button>
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
                    <div className="pt-2 border-t border-slate-800">
                      <p className="text-2xs text-slate-500">Prisma Connection Pool Aktif</p>
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
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Status Alert:</span>
                      <span className="text-2xs text-slate-300">{data.telegram.ok ? "Aktif" : "Menunggu API Key"}</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-slate-800 hover:bg-slate-700 text-slate-200"
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
                      <h3 className="text-xs font-bold text-white">Runtime Node.js &amp; V8</h3>
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
                      <span className="text-slate-400">Memori Heap / RSS:</span>
                      <span className="font-mono text-2xs">{stats?.memory_heap_used_mb ?? 0} MB / {stats?.memory_rss_mb ?? 0} MB</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Waktu Aktif:</span>
                      <span className="text-2xs text-emerald-400 font-medium font-mono">
                        {stats ? formatSeconds(stats.uptime_seconds) : "-"}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-slate-800">
                      <p className="text-2xs text-slate-500">Platform macOS Darwin x64/arm64</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== SECTION: TENANTS DIRECTORY */}
          {activeSection === "tenants" && (
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
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        tenantFilter === st
                          ? "bg-indigo-600 text-white font-semibold shadow-sm"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750"
                      )}
                    >
                      {st === "all" && `Semua Status (${data.tenants.length})`}
                      {st === "ACTIVE" && `Aktif (${activeTenantsCount})`}
                      {st === "TRIAL" && `Trial (${trialTenantsCount})`}
                      {st === "SUSPENDED" && `Ditangguhkan (${suspendedTenantsCount})`}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[280px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Cari nama bisnis, email, WA, ID..."
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
                              <button
                                type="button"
                                onClick={() => setSelectedTenant(t)}
                                className="font-semibold text-white text-sm hover:text-indigo-400 transition-colors text-left flex items-center gap-1.5"
                              >
                                <span>{t.business_name}</span>
                                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                              </button>
                              <p className="text-2xs text-slate-400 mt-0.5">
                                {t.owner_name ? `${t.owner_name} &bull; ` : ""}{t.email}
                              </p>
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
                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200"
                                  onClick={() => setSelectedTenant(t)}
                                >
                                  Detail
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs px-2 bg-slate-800 hover:bg-slate-700 text-slate-200"
                                  onClick={() => act({ action: "extend_trial", tenant_id: t.id, days: 14 })}
                                  title="Perpanjang masa trial selama 14 hari"
                                >
                                  +14 Hari
                                </Button>
                                <Button
                                  size="sm"
                                  variant={t.status === "SUSPENDED" ? "accent" : "secondary"}
                                  className={cn(
                                    "h-7 text-xs px-2",
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

          {/* ==================================================== SECTION: FINANCIALS & BILLING */}
          {activeSection === "financials" && (
            <div className="space-y-6">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <span className="text-xs font-medium text-slate-400">Total MRR Aktif</span>
                  <p className="mt-2 text-2xl font-bold font-mono text-emerald-400">
                    Rp {rupiah(totalMRR)}
                  </p>
                  <p className="text-2xs text-slate-400 mt-1">
                    Dari {activeTenantsCount} tenant aktif
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <span className="text-xs font-medium text-slate-400">Rata-rata Nilai per Toko (ARPU)</span>
                  <p className="mt-2 text-2xl font-bold font-mono text-indigo-400">
                    Rp {rupiah(activeTenantsCount > 0 ? Math.round(totalMRR / activeTenantsCount) : 0)}
                  </p>
                  <p className="text-2xs text-slate-400 mt-1">Berdasarkan paket berlangganan</p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
                  <span className="text-xs font-medium text-slate-400">Status Langganan Berjalan</span>
                  <div className="mt-2 flex items-center gap-3 text-xs font-mono">
                    <span className="text-emerald-400">{data.subscription_counts["ACTIVE"] ?? 0} Aktif</span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="text-amber-400">{data.subscription_counts["TRIAL"] ?? 0} Trial</span>
                    <span className="text-slate-600">&bull;</span>
                    <span className="text-rose-400">{data.subscription_counts["EXPIRED"] ?? 0} Expired</span>
                  </div>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-2xs h-6 bg-slate-800 hover:bg-slate-700 text-slate-200"
                      onClick={() => act({ action: "reconcile" })}
                    >
                      Pindai Status Midtrans
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tabel Tenant Subscription Detail */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden">
                <div className="border-b border-slate-800 px-5 py-4 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Rincian Paket &amp; Siklus Penagihan Tenant
                  </h3>
                  <span className="text-2xs text-slate-400 font-mono">
                    {data.tenants.length} Tenant Terdaftar
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-2xs uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5 font-semibold">Toko Klien</th>
                        <th className="px-5 py-3.5 font-semibold">Paket Langganan</th>
                        <th className="px-5 py-3.5 font-semibold">Nominal Tagihan</th>
                        <th className="px-5 py-3.5 font-semibold">Status Bayar</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Tanggal Berakhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {data.tenants.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-850/40">
                          <td className="px-5 py-4 font-semibold text-white">{t.business_name}</td>
                          <td className="px-5 py-4">
                            {t.subscription ? (
                              <span className="font-semibold text-indigo-300">{t.subscription.plan}</span>
                            ) : (
                              <span className="text-slate-500">Masa Uji Coba Gratis</span>
                            )}
                          </td>
                          <td className="px-5 py-4 font-mono font-semibold text-slate-200">
                            Rp {rupiah(t.subscription?.amount ?? 0)}
                          </td>
                          <td className="px-5 py-4">
                            <Badge
                              tone={t.status === "ACTIVE" ? "signal" : t.status === "TRIAL" ? "warn" : "danger"}
                            >
                              {t.status === "ACTIVE" ? "Lunas" : t.status === "TRIAL" ? "Trial" : "Tertunda"}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-2xs text-slate-400">
                            {new Date(t.trial_expires_at).toLocaleDateString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== SECTION: WHATSAPP FLEET */}
          {activeSection === "fleet" && (
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

          {/* ==================================================== SECTION: AI MODELS & GATEWAY */}
          {activeSection === "ai_models" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Konfigurasi Gateway AI &amp; Model Orchestrator
                    </h3>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      Sistem routing LLM terpusat dengan rotasi kunci otomatis dan fallback upstream.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="primary"
                    className="h-8 text-xs bg-indigo-600 hover:bg-indigo-500 text-white border-none"
                    loading={busy}
                    onClick={handleTestAIGateway}
                  >
                    <Zap className="mr-1.5 h-3.5 w-3.5" />
                    Uji Latensi AI Real-time
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 text-2xs">Model Aktif Utama:</span>
                    <p className="font-mono font-bold text-indigo-300 text-sm mt-0.5">{data.gateway.model}</p>
                    <p className="text-2xs text-slate-500 mt-1">Dipakai oleh semua bot toko</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 text-2xs">Latensi Respon Terakhir:</span>
                    <p className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                      {data.gateway.latency_ms ? `${data.gateway.latency_ms} ms` : "Belum diuji"}
                    </p>
                    <p className="text-2xs text-slate-500 mt-1">Uji round-trip gateway</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-400 text-2xs">Model Siap Pakai:</span>
                    <p className="font-mono font-bold text-white text-sm mt-0.5">{data.gateway.models.length} Model</p>
                    <p className="text-2xs text-slate-500 mt-1">Mendukung multi-turn tool calls</p>
                  </div>
                </div>
              </div>

              {/* Model Catalog Grid */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Katalog Model Terdaftar pada Gateway
                    </h3>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      Daftar model yang tersedia untuk failover chain dan routing cerdas.
                    </p>
                  </div>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari model..."
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-750 bg-slate-950 pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 max-h-96 overflow-y-auto">
                  {filteredModels.length === 0 ? (
                    <p className="col-span-4 text-center py-6 text-xs text-slate-500">
                      Tidak ada model yang cocok dengan pencarian.
                    </p>
                  ) : (
                    filteredModels.map((m) => (
                      <div
                        key={m}
                        className={cn(
                          "p-2.5 rounded-xl border text-xs flex items-center justify-between transition-colors",
                          m === data.gateway.model
                            ? "border-indigo-500/50 bg-indigo-950/40 text-indigo-200"
                            : "border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-750"
                        )}
                      >
                        <span className="font-mono text-2xs truncate" title={m}>
                          {m}
                        </span>
                        {m === data.gateway.model && (
                          <span className="shrink-0 text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-semibold">
                            Utama
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== SECTION: ORDERS FEED */}
          {activeSection === "orders" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-1.5 text-xs">
                  {(["all", "VERIFIED", "PENDING"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderFilter(st)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                        orderFilter === st
                          ? "bg-indigo-600 text-white font-semibold shadow-sm"
                          : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750"
                      )}
                    >
                      {st === "all" ? "Semua Status" : st === "VERIFIED" ? "Terbayar" : "Menunggu"}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[280px]">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Cari order number atau toko..."
                    value={orderQuery}
                    onChange={(e) => setOrderQuery(e.target.value)}
                    className="w-full rounded-lg border border-slate-750 bg-slate-950 pl-9 pr-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-2xs uppercase text-slate-400 border-b border-slate-800 tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5 font-semibold">Nomor Pesanan</th>
                        <th className="px-5 py-3.5 font-semibold">Toko Klien</th>
                        <th className="px-5 py-3.5 font-semibold">Total Pembayaran</th>
                        <th className="px-5 py-3.5 font-semibold">Status Bayar</th>
                        <th className="px-5 py-3.5 font-semibold">Waktu Transaksi</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-slate-300">
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-slate-500">
                            Tidak ada data pesanan yang sesuai filter.
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((o) => (
                          <tr key={o.id} className="hover:bg-slate-850/40">
                            <td className="px-5 py-4 font-mono font-semibold text-indigo-400">{o.order_number}</td>
                            <td className="px-5 py-4 font-semibold text-white">{o.tenant}</td>
                            <td className="px-5 py-4 font-mono font-bold text-emerald-400">
                              Rp {rupiah(o.total)}
                            </td>
                            <td className="px-5 py-4">
                              <Badge tone={o.payment_status === "VERIFIED" ? "signal" : "warn"}>
                                {o.payment_status === "VERIFIED" ? "Terbayar" : "Menunggu"}
                              </Badge>
                            </td>
                            <td className="px-5 py-4 text-2xs text-slate-400 font-mono">
                              {ts(o.created_at)}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200"
                                onClick={() => act({ action: "sync_midtrans", order_id: o.order_number })}
                              >
                                Cek Midtrans
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

          {/* ==================================================== SECTION: WEBHOOKS */}
          {activeSection === "webhooks" && (
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
                    value={orderIdSync}
                    onChange={(e) => setOrderIdSync(e.target.value)}
                    className="rounded-lg border border-slate-750 bg-slate-950 px-3 py-2 text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none w-52"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs border-none"
                    disabled={!orderIdSync.trim()}
                    onClick={() => act({ action: "sync_midtrans", order_id: orderIdSync.trim() })}
                  >
                    Cek Status
                  </Button>
                </div>
              </div>

              {/* Webhook Ledger Audit Table */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden">
                <div className="border-b border-slate-800 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Buku Besar Audit Webhook Masuk
                    </h3>
                    <p className="text-2xs text-slate-400 mt-0.5">
                      Log event yang masuk dengan perlindungan idempotensi untuk mencegah duplikasi pesanan.
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {(["all", "MIDTRANS", "TELEGRAM"] as const).map((prov) => (
                      <button
                        key={prov}
                        type="button"
                        onClick={() => setWebhookProviderFilter(prov)}
                        className={cn(
                          "px-2.5 py-1 rounded text-2xs font-medium transition-colors",
                          webhookProviderFilter === prov
                            ? "bg-indigo-600 text-white font-semibold"
                            : "bg-slate-800 text-slate-400 hover:text-white"
                        )}
                      >
                        {prov === "all" ? "Semua Provider" : prov}
                      </button>
                    ))}
                  </div>
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
                      {filteredWebhooks.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-500">
                            Belum ada catatan event webhook yang terekam.
                          </td>
                        </tr>
                      ) : (
                        filteredWebhooks.map((w) => (
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

          {/* ==================================================== SECTION: SYSTEM OPERATIONS */}
          {activeSection === "system_ops" && (
            <div className="space-y-6">
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
          )}

          {/* ==================================================== SECTION: KILL SWITCH & EMERGENCY */}
          {activeSection === "killswitch" && (
            <div className="space-y-6 max-w-3xl">
              <div
                className={cn(
                  "rounded-2xl border p-6 space-y-4",
                  ks.disabled
                    ? "border-rose-500/50 bg-rose-950/30"
                    : "border-slate-800 bg-slate-900/80"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                      ks.disabled
                        ? "bg-rose-950 text-rose-400 border-rose-800"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    )}
                  >
                    <Power className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Global Emergency Kill-Switch
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Status Saat Ini:{" "}
                      <strong className={ks.disabled ? "text-rose-400" : "text-emerald-400"}>
                        {ks.disabled ? "BOT DIMATIKAN (KILL SWITCH AKTIF)" : "NORMAL (BOT AKTIF)"}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950/70 p-4 rounded-xl border border-slate-850">
                  <p className="font-semibold text-slate-200">Dampak Operasional Saklar Darurat:</p>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Menghentikan seluruh balasan otomatis bot AI WhatsApp di setiap toko di platform.</li>
                    <li>Pesan pembeli yang masuk tetap tersimpan di database dan tidak akan hilang.</li>
                    <li>Admin toko tetap dapat membalas pesan secara manual melalui antarmuka live chat.</li>
                    <li>Gunakan tombol ini saat terjadi gangguan upstream AI yang kritis atau banjir spam anomali.</li>
                  </ul>
                  {ks.disabled && (
                    <p className="text-rose-300 font-mono text-2xs pt-2 border-t border-rose-900/40">
                      Dimatikan sejak {ts(ks.disabledAt)} {ks.disabledBy ? `oleh ${ks.disabledBy}` : ""}
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  {ks.disabled ? (
                    <Button
                      size="sm"
                      variant="accent"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs border-none px-4 py-2"
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
                      className="bg-rose-900 hover:bg-rose-800 border border-rose-700 text-rose-100 text-xs px-4 py-2"
                      loading={busy}
                      onClick={() =>
                        act(
                          { action: "kill_switch", disabled: true },
                          "PERINGATAN TINGKAT TINGGI: Anda akan mematikan seluruh balasan otomatis bot di SEMUA toko di platform. Lanjutkan?"
                        )
                      }
                    >
                      <Power className="mr-1.5 h-3.5 w-3.5 text-rose-300" />
                      Aktifkan Emergency Kill-Switch
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ==================================================== MODAL: CREATE TENANT */}
      {createTenantModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-750 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                  <Plus className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Tambah Toko Klien Baru</h3>
                  <p className="text-2xs text-slate-400">Onboarding manual langsung dari konsol Superadmin</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateTenantModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-2xs font-medium text-slate-400 mb-1">
                  Nama Bisnis / Toko:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Hijab Cantik Official"
                  value={newTenant.business_name}
                  onChange={(e) => setNewTenant({ ...newTenant, business_name: e.target.value })}
                  className="w-full rounded-lg border border-slate-750 bg-slate-950 px-3.5 py-2 text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-medium text-slate-400 mb-1">
                    Nama Pemilik Toko:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Rina Sari"
                    value={newTenant.owner_name}
                    onChange={(e) => setNewTenant({ ...newTenant, owner_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-750 bg-slate-950 px-3.5 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-medium text-slate-400 mb-1">
                    Nomor WhatsApp Pemilik:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="081234567890"
                    value={newTenant.owner_whatsapp}
                    onChange={(e) => setNewTenant({ ...newTenant, owner_whatsapp: e.target.value })}
                    className="w-full rounded-lg border border-slate-750 bg-slate-950 px-3.5 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-medium text-slate-400 mb-1">
                    Email Login Toko:
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="rina@hijabcantik.com"
                    value={newTenant.email}
                    onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-750 bg-slate-950 px-3.5 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-medium text-slate-400 mb-1">
                    Password Awal:
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Minimal 6 karakter"
                    value={newTenant.password}
                    onChange={(e) => setNewTenant({ ...newTenant, password: e.target.value })}
                    className="w-full rounded-lg border border-slate-750 bg-slate-950 px-3.5 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-medium text-slate-400 mb-1">
                    Status Akun:
                  </label>
                  <select
                    value={newTenant.status}
                    onChange={(e) =>
                      setNewTenant({ ...newTenant, status: e.target.value as "TRIAL" | "ACTIVE" })
                    }
                    className="w-full rounded-lg border border-slate-750 bg-slate-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="TRIAL">Masa Uji Coba (Trial)</option>
                    <option value="ACTIVE">Langsung Aktif (Active)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-medium text-slate-400 mb-1">
                    Durasi Masa Trial (Hari):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={newTenant.trial_days}
                    onChange={(e) => setNewTenant({ ...newTenant, trial_days: parseInt(e.target.value, 10) || 14 })}
                    className="w-full rounded-lg border border-slate-750 bg-slate-950 px-3.5 py-2 text-white font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  onClick={() => setCreateTenantModal(false)}
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  type="submit"
                  loading={busy}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white border-none"
                >
                  Buat Toko Sekarang
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== MODAL: TENANT DETAIL INSPECTOR */}
      {selectedTenant && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
        >
          <div className="w-full max-w-xl rounded-2xl border border-slate-750 bg-slate-900 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{selectedTenant.business_name}</h3>
                  <Badge
                    tone={
                      selectedTenant.status === "ACTIVE"
                        ? "signal"
                        : selectedTenant.status === "TRIAL"
                        ? "warn"
                        : "danger"
                    }
                  >
                    {selectedTenant.status}
                  </Badge>
                </div>
                <p className="text-2xs text-slate-400 mt-0.5">
                  ID: <span className="font-mono text-indigo-300">{selectedTenant.id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTenant(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-2xs">Kontak Email:</span>
                <p className="font-medium text-slate-200">{selectedTenant.email}</p>
                <span className="text-slate-400 text-2xs block pt-1">WhatsApp Pemilik:</span>
                <p className="font-mono text-indigo-400">{selectedTenant.owner_whatsapp}</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <span className="text-slate-400 text-2xs">Status Masa Trial:</span>
                <p className="text-slate-200">
                  Hingga {new Date(selectedTenant.trial_expires_at).toLocaleDateString("id-ID")}
                </p>
                <span className="text-slate-400 text-2xs block pt-1">Paket Berlangganan:</span>
                <p className="font-mono text-emerald-400 font-semibold">
                  {selectedTenant.subscription
                    ? `${selectedTenant.subscription.plan} (Rp ${rupiah(selectedTenant.subscription.amount)})`
                    : "Masa Uji Coba"}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <span className="text-2xs font-semibold text-slate-400 uppercase tracking-wider">
                Penggunaan Kapasitas &amp; Beban AI
              </span>
              <div className="grid grid-cols-4 gap-2 text-center pt-1">
                <div className="p-2 rounded bg-slate-900">
                  <span className="text-slate-400 text-2xs block">Percakapan</span>
                  <span className="font-mono font-bold text-white">{selectedTenant.conversations}</span>
                </div>
                <div className="p-2 rounded bg-slate-900">
                  <span className="text-slate-400 text-2xs block">Pesanan</span>
                  <span className="font-mono font-bold text-white">{selectedTenant.orders}</span>
                </div>
                <div className="p-2 rounded bg-slate-900">
                  <span className="text-slate-400 text-2xs block">SKU Produk</span>
                  <span className="font-mono font-bold text-white">{selectedTenant.products ?? 0}</span>
                </div>
                <div className="p-2 rounded bg-slate-900">
                  <span className="text-slate-400 text-2xs block">Est. Token</span>
                  <span className="font-mono font-bold text-indigo-400">
                    {selectedTenant.conversations * 450}
                  </span>
                </div>
              </div>
            </div>

            {selectedTenant.sheet && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="text-2xs text-slate-400">Google Sheet Katalog:</span>
                <a
                  href={selectedTenant.sheet.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block font-mono text-2xs text-indigo-400 truncate hover:underline"
                >
                  {selectedTenant.sheet.url}
                </a>
                <p className="text-2xs text-slate-500">
                  Asal Pengiriman: {selectedTenant.sheet.origin || "-"} &bull; Sinkron Terakhir:{" "}
                  {selectedTenant.sheet.last_synced_at ? timeAgo(selectedTenant.sheet.last_synced_at) : "-"}
                </p>
              </div>
            )}

            {/* Quick Actions Footer inside Modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs h-7 bg-slate-800 text-slate-200"
                  onClick={() => copyToClipboard(selectedTenant.id, "ID Toko")}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copyFeedback === "ID Toko" ? "Tersalin!" : "Salin ID"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs h-7 bg-slate-800 text-slate-200"
                  onClick={async () => {
                    await act({ action: "extend_trial", tenant_id: selectedTenant.id, days: 14 });
                    setSelectedTenant(null);
                  }}
                >
                  +14 Hari
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={selectedTenant.status === "SUSPENDED" ? "accent" : "secondary"}
                  className={cn(
                    "text-xs h-7",
                    selectedTenant.status === "SUSPENDED"
                      ? "bg-emerald-600 text-white"
                      : "bg-amber-950 text-amber-300 border border-amber-800"
                  )}
                  onClick={async () => {
                    await act({
                      action: "tenant_status",
                      tenant_id: selectedTenant.id,
                      status: selectedTenant.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED",
                    });
                    setSelectedTenant(null);
                  }}
                >
                  {selectedTenant.status === "SUSPENDED" ? "Aktifkan Akun" : "Suspend Toko"}
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  className="text-xs h-7 bg-rose-950 text-rose-300 border border-rose-800"
                  onClick={() => {
                    const t = selectedTenant;
                    setSelectedTenant(null);
                    setWipeConfirmModal({ id: t.id, name: t.business_name });
                    setWipeInput("");
                  }}
                >
                  Hapus Permanen
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== MODAL: WIPE TENANT CONFIRMATION */}
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
