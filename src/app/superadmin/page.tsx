"use client";

/**
 * Superadmin Management Console (Enterprise Application Management Edition).
 *
 * Standar Antislop & Noewbar Design System:
 * - Menggunakan Noewbar Design System konsisten: bg-surface-sunken, bg-white, border-ink-200, text-ink, dan signal emerald accents.
 * - Layout konsol manajemen aplikasi lengkap dengan Sidebar Navigasi terstruktur.
 * - Tanpa klise hacker retro, tanpa ornamen sci-fi berlebihan, tanpa gradien generik AI.
 * - Kontras warna WCAG AA, navigasi keyboard penuh, zero em-dash.
 * - Data real-time langsung terhubung ke PostgreSQL, Redis, WhatsMeow, dan AI Gateway.
 * - Fitur manajemen lengkap: Onboarding Tenant baru, Inspeksi Detail Tenant,
 *   Ekspor CSV, AI Model Explorer & Latency Tester, Webhook Ledger Audit, Transaksi Global,
 *   Fleet WhatsApp Control, dan System Maintenance.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  Bell,
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
  QrCode,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShoppingBag,
  Smartphone,
  Trash2,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Badge, Button, Modal,
  ConfirmModal, StatusDot, cn, rupiah, timeAgo } from "@/components/ui";
import { NotificationBell } from "@/components/notification-bell";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
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
  superadmin_wa?: {
    connection_status: string;
    phone_number: string | null;
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
  | "superadmin_wa"
  | "broadcast"
  | "fleet"
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

const VALID_SECTIONS: NavigationSection[] = [
  "overview",
  "infrastructure",
  "tenants",
  "financials",
  "superadmin_wa",
  "broadcast",
  "fleet",
  "killswitch",
];

export default function SuperadminPage() {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [activeSectionState, setActiveSectionState] = useState<NavigationSection>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("section");
      if (q && (VALID_SECTIONS as string[]).includes(q)) return q as NavigationSection;
    }
    return "overview";
  });

  const setActiveSection = useCallback((next: NavigationSection) => {
    setActiveSectionState(next);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("section") !== next) {
        url.searchParams.set("section", next);
        window.history.pushState({ section: next }, "", url.toString());
      }
    }
  }, []);

  const activeSection = activeSectionState;

  useEffect(() => {
    function onPopState() {
      const q = new URLSearchParams(window.location.search).get("section");
      if (q && (VALID_SECTIONS as string[]).includes(q)) {
        setActiveSectionState(q as NavigationSection);
      } else {
        setActiveSectionState("overview");
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveEvent, setLiveEvent] = useState<string | null>(null);
  const [realtimeEvent, setRealtimeEvent] = useState<{ type?: string; [key: string]: unknown } | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Filters & Search
  const [tenantFilter, setTenantFilter] = useState<TenantFilter>("all");
  const [tenantQuery, setTenantQuery] = useState("");

  // Modals & Drawers
  const [selectedTenant, setSelectedTenant] = useState<ConsoleData["tenants"][0] | null>(null);
  const [createTenantModal, setCreateTenantModal] = useState(false);
  const [wipeConfirmModal, setWipeConfirmModal] = useState<{ id: string; name: string } | null>(null);
  const [pendingAct, setPendingAct] = useState<{ payload: Record<string, unknown>; title: string; description: string } | null>(null);
  const [wipeInput, setWipeInput] = useState("");

  // Broadcast state
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastSelectedIds, setBroadcastSelectedIds] = useState<string[]>([]);
  const [broadcastResult, setBroadcastResult] = useState<{ total: number; sent: number; failed: number } | null>(null);
  const [broadcastBusy, setBroadcastBusy] = useState(false);

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

  // Superadmin WhatsApp Connection State & Handlers
  const [saQr, setSaQr] = useState<string | null>(null);
  const [saPolling, setSaPolling] = useState(false);
  const [saCountdown, setSaCountdown] = useState(0);
  const [saBusy, setSaBusy] = useState(false);
  const saTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearSaTimer = useCallback(() => {
    if (saTimerRef.current) {
      clearInterval(saTimerRef.current);
      saTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearSaTimer, [clearSaTimer]);

  const pollSaWaStatus = useCallback(async () => {
    setSaPolling(true);
    setSaCountdown(15);
    clearSaTimer();
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds
    saTimerRef.current = setInterval(async () => {
      attempts += 1;
      if (attempts >= maxAttempts) {
        clearSaTimer();
        setSaPolling(false);
        setMsg({ text: "Waktu pairing WhatsApp habis. Silakan muat ulang QR jika belum terhubung.", tone: "error" });
        return;
      }
      setSaCountdown((c) => (c > 0 ? c - 1 : 0));
      try {
        const res = await fetch("/api/superadmin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "superadmin_wa_status" }),
        });
        const json = await res.json();
        if (json.ok) {
          if (json.qr_base64) {
            setSaQr(json.qr_base64);
          }
          if (json.connection_status === "CONNECTED") {
            clearSaTimer();
            setSaPolling(false);
            setSaQr(null);
            load();
            setMsg({ text: "WhatsApp Super Admin berhasil terhubung!", tone: "success" });
            return;
          }
        }
      } catch {
        // backoff
      }
    }, 2000);
  }, [clearSaTimer, load, setMsg]);

  const handleStartSaWa = async () => {
    setSaBusy(true);
    setSaQr(null);
    try {
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "superadmin_wa_start" }),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.qr_base64) {
          setSaQr(json.qr_base64);
        }
        pollSaWaStatus();
      } else {
        setMsg({ text: json.error ?? "Gagal memulai pairing WhatsApp Super Admin.", tone: "error" });
      }
    } catch {
      setMsg({ text: "Gagal menghubungi server WhatsApp.", tone: "error" });
    } finally {
      setSaBusy(false);
    }
  };

  const handleLogoutSaWa = async () => {
    setSaBusy(true);
    clearSaTimer();
    setSaPolling(false);
    setSaQr(null);
    try {
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "superadmin_wa_logout" }),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({ text: "Koneksi WhatsApp Super Admin berhasil diputuskan.", tone: "success" });
        load();
      } else {
        setMsg({ text: json.error ?? "Gagal memutuskan koneksi WhatsApp.", tone: "error" });
      }
    } catch {
      setMsg({ text: "Koneksi gagal saat memutuskan WhatsApp.", tone: "error" });
    } finally {
      setSaBusy(false);
    }
  };

  const handleRefreshSaWa = async () => {
    setSaBusy(true);
    try {
      const res = await fetch("/api/superadmin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "superadmin_wa_status" }),
      });
      const json = await res.json();
      if (json.ok) {
        if (json.qr_base64) {
          setSaQr(json.qr_base64);
        }
        load();
        setMsg({
          text: `Status WhatsApp Super Admin: ${json.connection_status}${json.phone_number ? ` (${json.phone_number})` : ""}`,
          tone: json.connection_status === "CONNECTED" ? "success" : "error",
        });
      }
    } catch {
      setMsg({ text: "Gagal mengecek status WhatsApp Super Admin.", tone: "error" });
    } finally {
      setSaBusy(false);
    }
  };

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
      let data: { type?: string; [key: string]: unknown } = {};
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      setRealtimeEvent(data);
      const type = data.type ?? "";
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

  function requestAct(payload: Record<string, unknown>, title: string, description: string) {
    setPendingAct({ payload, title, description });
  }

  async function runPendingAct() {
    if (!pendingAct) return;
    const payload = pendingAct.payload;
    setPendingAct(null);
    await act(payload);
  }

  async function act(payload: Record<string, unknown>): Promise<void> {
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
      <main className="min-h-screen flex items-center justify-center bg-surface-sunken px-4 text-ink">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-signal border-t-transparent" />
          <p className="text-xs font-medium text-ink-500">
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
  const connectedFleetCount = data.fleet.filter((f) => f.connection_status === "CONNECTED").length;

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

  // Navigasi Terstruktur Manajemen Aplikasi Noewbar (SaaS Console)
  const navGroups: NavGroup[] = [
    {
      group: "IKHTISAR PLATFORM",
      items: [
        { id: "overview", label: "Ringkasan Platform", icon: <LayoutDashboard className="h-4 w-4" /> },
        { id: "infrastructure", label: "Kesehatan & Operasi Sistem", icon: <Server className="h-4 w-4" /> },
      ],
    },
    {
      group: "MANAJEMEN TOKO",
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
      group: "SALURAN & AI GATEWAY",
      items: [
        {
          id: "superadmin_wa",
          label: "Koneksi WA Super Admin",
          badge: data.superadmin_wa?.connection_status === "CONNECTED" ? "Aktif" : "Offline",
          badgeTone: data.superadmin_wa?.connection_status === "CONNECTED" ? "signal" : "danger",
          icon: <Smartphone className="h-4 w-4" />,
        },
        {
          id: "broadcast",
          label: "Siaran Pesan ke Tenant",
          icon: <Bell className="h-4 w-4" />,
        },
        {
          id: "fleet",
          label: "Koneksi WhatsApp Toko",
          badge: `${data.fleet.length}`,
          icon: <MessageSquare className="h-4 w-4" />,
        },
      ],
    },
    {
      group: "KEAMANAN APLIKASI",
      items: [
        {
          id: "killswitch",
          label: "Kontrol Darurat AI",
          badge: ks.disabled ? "OFF" : "ON",
          badgeTone: ks.disabled ? "danger" : "signal",
          icon: <ShieldAlert className="h-4 w-4" />,
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-surface-sunken text-ink font-sans flex flex-col selection:bg-signal-wash selection:text-ink">
      {/* ==================================================== 1. GLOBAL TOP BAR */}
      <header className="sticky top-0 z-40 border-b border-ink-200 bg-white/95 backdrop-blur-md px-4 sm:px-6 py-2.5">
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
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:text-ink hover:bg-ink-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
              title="Buka atau tutup navigasi"
              aria-label="Toggle Sidebar"
            >
              <span className="lg:hidden flex items-center justify-center">
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </span>
              <span className="hidden lg:flex items-center justify-center">
                {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
              </span>
            </button>

            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink font-mono text-xs font-bold text-white shadow-raised">
                N
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-ink tracking-tight">
                    Noewbar Platform
                  </span>
                  <span className="rounded bg-ink-100 border border-ink-200 px-1.5 py-0.5 text-[10px] font-semibold text-ink-700">
                    Console
                  </span>
                  {ks.disabled ? (
                    <span className="inline-flex items-center gap-1 rounded border border-danger/20 bg-danger-wash px-2 py-0.5 text-[10px] font-bold text-danger-strong animate-pulse">
                      <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                      Kill-Switch Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded border border-signal/20 bg-signal-wash px-2 py-0.5 text-[10px] font-medium text-signal-strong">
                      <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                      Sistem Stabil
                    </span>
                  )}
                  {liveEvent && (
                    <span className="inline-flex items-center gap-1 rounded bg-ink-100 border border-ink-200 px-2 py-0.5 text-[10px] font-medium text-ink-700">
                      Sinyal: {liveEvent}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Telemetry Pills Strip: Metrik Aplikasi SaaS Nyata */}
          <div className="hidden xl:flex items-center gap-2.5 whitespace-nowrap text-xs text-ink-600 bg-white border border-ink-200 rounded-lg px-3 py-1 shadow-flat">
            <div className="flex items-center gap-1.5" title="Toko Terdaftar">
              <Users className="h-3 w-3 text-ink-700" />
              <span className="text-ink-400 text-2xs">Toko:</span>
              <span className="font-mono font-semibold text-xs text-ink">
                {totalStores} ({activeTenantsCount} Aktif)
              </span>
            </div>
            <span className="text-ink-200">&bull;</span>
            <div className="flex items-center gap-1.5" title="Fleet WhatsApp Terhubung">
              <MessageSquare className={cn("h-3 w-3", connectedFleetCount > 0 ? "text-signal-strong" : "text-warn-strong")} />
              <span className="text-ink-400 text-2xs">Fleet WA:</span>
              <span className="font-mono font-semibold text-xs text-ink">
                {connectedFleetCount}/{totalStores} Siap
              </span>
            </div>
            <span className="text-ink-200">&bull;</span>
            <div className="flex items-center gap-1.5" title="Latency AI Gateway">
              <Zap className={cn("h-3 w-3", data.gateway.ok ? "text-signal-strong" : "text-danger-strong")} />
              <span className="text-ink-400 text-2xs">AI Gateway:</span>
              <span className="font-mono font-semibold text-xs text-ink">
                {data.gateway.latency_ms ? `${data.gateway.latency_ms} ms` : "Gangguan"}
              </span>
            </div>
            <span className="text-ink-200">&bull;</span>
            <div className="flex items-center gap-1.5" title="Total Transaksi Toko">
              <ShoppingBag className="h-3 w-3 text-warn-strong" />
              <span className="text-ink-400 text-2xs">Pesanan:</span>
              <span className="font-mono font-semibold text-xs text-ink">{totalOrders}</span>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <PwaInstallPrompt
              variant="compact"
              className="hidden md:flex border-ink-200 bg-white text-ink-700 hover:bg-ink-50 shadow-flat"
            />

            <Button
              size="sm"
              variant="accent"
              className="bg-ink hover:bg-ink-800 text-white text-xs border-none font-medium h-8 px-3 shadow-flat"
              onClick={() => setCreateTenantModal(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Toko Baru
            </Button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-600 hover:text-ink hover:bg-ink-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal disabled:opacity-50 shadow-flat"
              title="Perbarui data konsol"
              aria-label="Segarkan data konsol"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin text-signal-strong")} />
            </button>

            <NotificationBell
              scope="admin"
              theme="light"
              externalEvent={realtimeEvent}
              onNavigate={(targetTab) => setActiveSection(targetTab as NavigationSection)}
            />

            <a
              href="/dashboard"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-700 hover:text-ink hover:bg-ink-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal h-8 shadow-flat"
              title="Buka panel toko tenant di tab baru"
            >
              <span>Dashboard Toko</span>
              <ExternalLink className="h-3 w-3 text-ink-400" />
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-lg text-ink-400 hover:text-danger-strong hover:bg-danger-wash transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger h-8 w-8 flex items-center justify-center"
              title="Keluar dari Konsol Superadmin"
              aria-label="Logout"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ==================================================== 2. MAIN APPLICATION CONTAINER (SIDEBAR + WORKSPACE) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mobile Backdrop Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] lg:hidden animate-fade-in"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* SIDEBAR NAVIGATION */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 lg:sticky lg:top-0 flex flex-col border-r border-ink-200 bg-white transition-all duration-200 ease-in-out shrink-0 w-72 lg:w-auto lg:h-screen lg:min-h-0",
            sidebarOpen ? "lg:w-64" : "lg:w-16",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          {/* Mobile Header in Drawer */}
          <div className="p-4 border-b border-ink-200 flex items-center justify-between lg:hidden">
            <span className="text-xs font-bold text-ink">Menu Navigasi Platform</span>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1 rounded text-ink-400 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Links Scrollable */}
          <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
            {navGroups.map((grp) => (
              <div key={grp.group} className="space-y-1">
                {sidebarOpen && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-ink-400">
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
                          "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                          active
                            ? "bg-ink-100 text-ink font-semibold shadow-flat"
                            : "text-ink-600 hover:text-ink hover:bg-ink-50"
                        )}
                        title={item.label}
                      >
                        <span className={cn(active ? "text-ink" : "text-ink-400")}>
                          {item.icon}
                        </span>
                        {sidebarOpen && (
                          <div className="flex-1 flex items-center justify-between overflow-hidden">
                            <span className="truncate">{item.label}</span>
                            {"badge" in item && (
                              <span
                                className={cn(
                                  "ml-2 rounded px-1.5 py-0.5 text-[10px] font-mono",
                                  active
                                    ? "bg-ink-200 text-ink font-semibold"
                                    : item.badgeTone === "danger"
                                    ? "bg-danger-wash text-danger-strong border border-danger/20 font-bold"
                                    : "bg-ink-100 text-ink-600 border border-ink-200"
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
            <div className="p-3 border-t border-ink-200 bg-surface-sunken/60 text-2xs space-y-2">
              <PwaInstallPrompt
                variant="compact"
                className="w-full justify-center border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
              />
              <div className="flex items-center justify-between text-ink-500">
                <span>Noewbar Console:</span>
                <span className="font-mono text-ink font-semibold">v1.0.0</span>
              </div>
              <div className="flex items-center justify-between text-ink-500">
                <span>Multi-tenant SaaS:</span>
                <span className="text-signal-strong font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                  Operasional
                </span>
              </div>
            </div>
          ) : (
            <div className="p-2 border-t border-ink-200 flex justify-center text-ink-400">
              <span className="h-2 w-2 rounded-full bg-signal" title="Multi-tenant Operasional" />
            </div>
          )}
        </aside>

        {/* WORKSPACE CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-surface-sunken">
          {/* Breadcrumbs & Active Title Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-200 pb-4">
            <div>
              <div className="flex items-center gap-2 text-2xs text-ink-400">
                <span>Konsol Manajemen</span>
                <ChevronRight className="h-3 w-3 text-ink-300" />
                <span className="text-signal-strong font-medium capitalize">
                  {activeSection === "overview"
                    ? "Ringkasan Platform"
                     : activeSection === "tenants"
                    ? "Direktori Toko"
                     : activeSection === "financials"
                    ? "Finansial & Langganan"
                    : activeSection === "superadmin_wa"
                    ? "Koneksi WA Super Admin"
                    : activeSection === "fleet"
                    ? "Koneksi WhatsApp"
                    : activeSection === "broadcast"
                    ? "Siaran Pesan"
                    : activeSection === "killswitch"
                    ? "Kontrol Darurat"
                    : activeSection.replace("_", " ")}
                </span>
              </div>
              <h1 className="text-lg font-bold text-ink tracking-tight mt-0.5">
                {activeSection === "overview" && "Ringkasan Platform & Operasional Toko"}
                {activeSection === "tenants" && "Direktori & Manajemen Toko (Tenant)"}
                {activeSection === "financials" && "Analisis Finansial & Langganan Toko"}
                {activeSection === "superadmin_wa" && "Pusat Koneksi WhatsApp Resmi Super Admin"}
                {activeSection === "fleet" && "Koneksi & Fleet WhatsApp Toko"}
                {activeSection === "broadcast" && "Siaran Pesan WhatsApp ke Tenant"}
                {activeSection === "killswitch" && "Protokol Keamanan & Emergency Kill Switch"}
                {activeSection === "infrastructure" && "Pusat Kesehatan & Operasi Sistem"}
              </h1>
            </div>

            {/* Quick action buttons context-sensitive */}
            <div className="flex items-center gap-2">
              {activeSection === "tenants" && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 text-xs bg-white hover:bg-ink-50 border border-ink-200 text-ink-700 shadow-flat"
                    onClick={() => exportTenantsToCSV(data.tenants)}
                    title="Unduh seluruh data toko ke file CSV"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Ekspor CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    className="h-8 text-xs bg-ink hover:bg-ink-800 text-white border-none shadow-flat"
                    onClick={() => setCreateTenantModal(true)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Toko Baru
                  </Button>
                </>
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
                  ? "border-signal/30 bg-signal-wash text-signal-strong"
                  : "border-danger/30 bg-danger-wash text-danger-strong"
              )}
            >
              <div className="flex items-center gap-2">
                {msg.tone === "success" ? (
                  <StatusDot ok={true} pulse={false} />
                ) : (
                  <AlertCircle className="h-4 w-4 text-danger-strong shrink-0" />
                )}
                <span>{msg.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setMsg(null)}
                className="text-ink-400 hover:text-ink p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
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
              className="rounded-xl border border-danger/30 bg-danger-wash p-4 shadow-flat flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-6 w-6 text-danger-strong shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xs font-bold text-danger-strong uppercase tracking-wide">
                    Global Kill Switch Sedang Aktif
                  </p>
                  <p className="text-xs text-danger-strong/90 mt-0.5 leading-relaxed">
                    Semua balasan otomatis bot dihentikan sejak {ts(ks.disabledAt)}
                    {ks.disabledBy ? ` oleh ${ks.disabledBy}` : ""}. Pesan dari pembeli tetap tersimpan namun tidak dibalas bot.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="accent"
                className="bg-danger hover:bg-danger-strong text-white text-xs border-none shrink-0"
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
                <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-flat">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-500">
                      Pendapatan Bulanan (MRR)
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-signal-wash border border-signal/20 text-signal-strong">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-ink font-mono">
                    Rp {rupiah(totalMRR)}
                  </p>
                  <p className="mt-1 text-2xs text-signal-strong font-medium">
                    {data.subscription_counts["ACTIVE"] ?? 0} Toko Berlangganan Aktif
                  </p>
                </div>

                <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-flat">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-500">
                      Total Toko (Tenant)
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 border border-ink-200 text-ink">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-ink font-mono">
                    {totalStores} <span className="text-sm font-normal text-ink-500">tenant</span>
                  </p>
                  <p className="mt-1 text-2xs text-ink-600 font-medium">
                    {activeTenantsCount} Aktif &bull; {trialTenantsCount} Trial &bull; {suspendedTenantsCount} Suspend
                  </p>
                </div>

                <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-flat">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-500">
                      Total Pesanan Transaksi
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-warn-wash border border-warn/20 text-warn-strong">
                      <ShoppingBag className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-ink font-mono">
                    {totalOrders} <span className="text-sm font-normal text-ink-500">pesanan</span>
                  </p>
                  <p className="mt-1 text-2xs text-ink-500">
                    Total {stats?.total_products ?? 0} SKU produk terdaftar
                  </p>
                </div>

                <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-flat">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-ink-500">
                      Percakapan Bot WhatsApp
                    </span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 border border-ink-200 text-ink-700">
                      <MessageSquare className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-ink font-mono">
                    {totalConversations} <span className="text-sm font-normal text-ink-500">chat</span>
                  </p>
                  <p className="mt-1 text-2xs text-ink-600 font-mono">
                    Est. {rupiah(totalConversations * 450)} token terproses
                  </p>
                </div>
              </div>

              {/* Ringkasan Status Layanan SaaS & Kesiapan Toko */}
              <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-4 shadow-flat">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
                      Kesiapan Layanan SaaS & Gateway Toko
                    </h2>
                    <p className="text-2xs text-ink-500 mt-0.5">
                      Status operasional saluran WhatsApp, mesin AI, dan penagihan langganan multi-tenant.
                    </p>
                  </div>
                  <Badge tone={connectedFleetCount > 0 && data.gateway.ok ? "signal" : "warn"}>
                    <StatusDot ok={connectedFleetCount > 0 && data.gateway.ok} />
                    {connectedFleetCount > 0 && data.gateway.ok ? "Layanan Siap" : "Perlu Perhatian"}
                  </Badge>
                </div>

                <div className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  {/* Card 1: WhatsApp Fleet */}
                  <div className="p-4 rounded-xl bg-surface-sunken border border-ink-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-ink-500 text-2xs">
                        <span className="font-semibold text-ink-700">Fleet WhatsApp</span>
                        <StatusDot ok={connectedFleetCount > 0} />
                      </div>
                      <p className="font-mono text-lg font-bold text-ink mt-1.5">
                        {connectedFleetCount} <span className="text-xs font-normal text-ink-500">/ {totalStores} Toko</span>
                      </p>
                      <p className="text-2xs text-ink-500 mt-1">
                        {data.daemon.active_instances ?? 0} sesi aktif terhubung
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-ink-200">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                        onClick={() => setActiveSection("fleet")}
                      >
                        Buka Fleet WA
                        <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Card 2: AI Gateway */}
                  <div className="p-4 rounded-xl bg-surface-sunken border border-ink-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-ink-500 text-2xs">
                        <span className="font-semibold text-ink-700">AI Gateway CS</span>
                        <StatusDot ok={data.gateway.ok} />
                      </div>
                      <p className="font-mono text-lg font-bold text-ink mt-1.5">
                        {data.gateway.latency_ms ? `${data.gateway.latency_ms} ms` : "Aktif"}
                      </p>
                      <p className="text-2xs text-ink-500 mt-1 truncate" title={data.gateway.model}>
                        Model: {data.gateway.model}
                      </p>
                    </div>

                  </div>

                  {/* Card 3: Billing & Langganan */}
                  <div className="p-4 rounded-xl bg-surface-sunken border border-ink-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-ink-500 text-2xs">
                        <span className="font-semibold text-ink-700">Langganan Toko</span>
                        <StatusDot ok={activeTenantsCount > 0} />
                      </div>
                      <p className="font-mono text-lg font-bold text-ink mt-1.5">
                        {activeTenantsCount} <span className="text-xs font-normal text-ink-500">Aktif</span>
                      </p>
                      <p className="text-2xs text-ink-500 mt-1">
                        {trialTenantsCount} toko masa trial 14 hari
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-ink-200">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                        onClick={() => setActiveSection("financials")}
                      >
                        Kelola Langganan
                        <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Card 4: Keamanan & Status Bot */}
                  <div className="p-4 rounded-xl bg-surface-sunken border border-ink-200 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between text-ink-500 text-2xs">
                        <span className="font-semibold text-ink-700">Status Bot AI</span>
                        <StatusDot ok={!ks.disabled} />
                      </div>
                      <p className="font-mono text-lg font-bold text-ink mt-1.5">
                        {ks.disabled ? (
                          <span className="text-danger-strong">Dimatikan</span>
                        ) : (
                          <span className="text-signal-strong">Aktif Normal</span>
                        )}
                      </p>
                      <p className="text-2xs text-ink-500 mt-1">
                        {ks.disabled ? "Emergency kill-switch aktif" : "Semua bot AI melayani pembeli"}
                      </p>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-ink-200">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                        onClick={() => setActiveSection("killswitch")}
                      >
                        Kontrol Darurat
                        <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Platform Orders Feed */}
              <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-flat">
                <div className="border-b border-ink-100 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                      Pesanan Masuk Terkini Seluruh Toko
                    </h3>
                    <p className="text-2xs text-ink-500 mt-0.5">
                      Aktivitas transaksi live dari pembeli di seluruh tenant.
                    </p>
                  </div>

                </div>
                <div className="divide-y divide-ink-100">
                  {data.recent_orders.length === 0 ? (
                    <p className="p-6 text-center text-xs text-ink-500">
                      Belum ada catatan pesanan di platform.
                    </p>
                  ) : (
                    data.recent_orders.slice(0, 5).map((o) => (
                      <div
                        key={o.id}
                        className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs hover:bg-ink-50/60 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-ink">{o.order_number}</span>
                          <span className="text-ink-500">
                            Toko: <strong className="text-ink">{o.tenant}</strong>
                          </span>
                          <span className="text-ink-300">&bull;</span>
                          <span className="text-ink-400 text-2xs">{timeAgo(o.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-semibold text-signal-strong">
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
                <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-3 shadow-flat">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Zap className="h-4 w-4 text-signal-strong" />
                      <h3 className="text-xs font-bold text-ink">AI Gateway (9router)</h3>
                    </div>
                    <Badge tone={data.gateway.ok ? "signal" : "danger"}>
                      <StatusDot ok={data.gateway.ok} />
                      {data.gateway.ok ? "Aktif" : "Gangguan"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-ink-600">
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Model Default:</span>
                      <span className="font-mono text-2xs font-semibold text-ink">{data.gateway.model}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Latency Round-trip:</span>
                      <span className="font-mono text-2xs font-semibold text-ink">
                        {data.gateway.latency_ms ? `${data.gateway.latency_ms} ms` : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Model Terdaftar:</span>
                      <span className="text-ink-700 text-2xs font-medium">{data.gateway.models.length} model siap</span>
                    </div>
                    <div className="pt-2 border-t border-ink-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                        loading={busy}
                        onClick={handleTestAIGateway}
                      >
                        Uji Latensi Gateway
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 2. WhatsApp Daemon */}
                <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-3 shadow-flat">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Server className="h-4 w-4 text-signal-strong" />
                      <h3 className="text-xs font-bold text-ink">WhatsMeow Daemon</h3>
                    </div>
                    <Badge tone={data.daemon.ok ? "signal" : "danger"}>
                      <StatusDot ok={data.daemon.ok} />
                      {data.daemon.ok ? "Terhubung" : "Terputus"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-ink-600">
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Sesi Soket Aktif:</span>
                      <span className="font-mono text-2xs font-bold text-signal-strong">{data.daemon.active_instances ?? 0} instance</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Daemon URL:</span>
                      <span className="font-mono text-2xs text-ink-500 truncate max-w-[150px]" title={data.daemon.url}>
                        {data.daemon.url}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Ping Terakhir:</span>
                      <span className="text-2xs text-ink-600">{ts(data.daemon.uptime_reported_at)}</span>
                    </div>
                    <div className="pt-2 border-t border-ink-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                        onClick={() => setActiveSection("fleet")}
                      >
                        Kelola Fleet WhatsApp
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 3. Redis & BullMQ Queue */}
                <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-3 shadow-flat">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Cpu className="h-4 w-4 text-warn-strong" />
                      <h3 className="text-xs font-bold text-ink">Redis &amp; BullMQ</h3>
                    </div>
                    <Badge tone={data.queue.redis ? "signal" : "danger"}>
                      <StatusDot ok={data.queue.redis} />
                      {data.queue.redis ? "Normal" : "Gangguan"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-ink-600">
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Antrean Menunggu:</span>
                      <span className="font-mono text-2xs font-semibold text-warn-strong">{data.queue.waiting} tugas</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Anti-Ghosting Nudge:</span>
                      <span className="font-mono text-2xs text-ink-600">{data.queue.delayed} tertunda</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Gagal / Fallback:</span>
                      <span className={cn("font-mono text-2xs", data.queue.failed > 0 ? "text-danger-strong font-bold" : "text-ink-500")}>
                        {data.queue.failed} gagal / {data.queue.pendingInDb} db
                      </span>
                    </div>
                    <div className="pt-2 border-t border-ink-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                        onClick={() => act({ action: "trigger_maintenance" })}
                      >
                        Bersihkan Antrean Tertunda
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 4. PostgreSQL Cluster */}
                <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-3 shadow-flat">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Database className="h-4 w-4 text-ink-700" />
                      <h3 className="text-xs font-bold text-ink">Database PostgreSQL</h3>
                    </div>
                    <Badge tone="signal">
                      <StatusDot ok />
                      Terkoneksi
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-ink-600">
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Total Transaksi:</span>
                      <span className="font-mono text-2xs font-semibold text-ink">{totalOrders} pesanan</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Total Percakapan:</span>
                      <span className="font-mono text-2xs font-semibold text-ink">{totalConversations} sesi</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Total SKU Produk:</span>
                      <span className="font-mono text-2xs font-bold text-ink">{stats?.total_products ?? 0} SKU</span>
                    </div>
                    <div className="pt-2 border-t border-ink-100">
                      <p className="text-2xs text-ink-400">Prisma Connection Pool Aktif</p>
                    </div>
                  </div>
                </div>

                {/* 5. Telegram Alert Bot */}
                <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-3 shadow-flat">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Bell className="h-4 w-4 text-ink-700" />
                      <h3 className="text-xs font-bold text-ink">Saluran Bot Telegram</h3>
                    </div>
                    <Badge tone={data.telegram.ok ? "signal" : "warn"}>
                      <StatusDot ok={data.telegram.ok} />
                      {data.telegram.ok ? "Siap" : "Belum Konfigurasi"}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-ink-600">
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Akun Bot:</span>
                      <span className="font-mono text-2xs text-ink-700">@{data.telegram.username || "belum_diatur"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Status Alert:</span>
                      <span className="text-2xs text-ink-600">{data.telegram.ok ? "Aktif" : "Menunggu API Key"}</span>
                    </div>
                    <div className="pt-2 border-t border-ink-100">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs h-7 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                        onClick={() => act({ action: "test_telegram" })}
                      >
                        Kirim Notifikasi Uji
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 6. Runtime Server Node */}
                <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-3 shadow-flat">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <HardDrive className="h-4 w-4 text-ink-700" />
                      <h3 className="text-xs font-bold text-ink">Runtime Node.js &amp; V8</h3>
                    </div>
                    <Badge tone="signal">
                      <StatusDot ok />
                      V8 Stabil
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-xs text-ink-600">
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Versi Mesin:</span>
                      <span className="font-mono text-2xs font-semibold text-ink">
                        {stats?.node_version ?? process.version}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Memori Heap / RSS:</span>
                      <span className="font-mono text-2xs">{stats?.memory_heap_used_mb ?? 0} MB / {stats?.memory_rss_mb ?? 0} MB</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-ink-500">Waktu Aktif:</span>
                      <span className="text-2xs text-signal-strong font-medium font-mono">
                        {stats ? formatSeconds(stats.uptime_seconds) : "-"}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-ink-100">
                      <p className="text-2xs text-ink-400">Platform macOS Darwin x64/arm64</p>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-ink-200 p-4 rounded-2xl shadow-flat">
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {(["all", "ACTIVE", "TRIAL", "SUSPENDED"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setTenantFilter(st)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                        tenantFilter === st
                          ? "bg-ink text-white font-semibold shadow-flat"
                          : "bg-ink-100 text-ink-600 hover:text-ink hover:bg-ink-200"
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
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Cari nama bisnis, email, WA, ID..."
                    value={tenantQuery}
                    onChange={(e) => setTenantQuery(e.target.value)}
                    className="w-full rounded-lg border border-ink-200 bg-white pl-9 pr-3.5 py-2 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
                  />
                </div>
              </div>

              {/* Tenants Data Table */}
              <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-flat">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-50 text-2xs uppercase text-ink-500 border-b border-ink-200 tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5 font-semibold">Toko &amp; Kontak</th>
                        <th className="px-5 py-3.5 font-semibold">Status Langganan</th>
                        <th className="px-5 py-3.5 font-semibold text-center">Beban AI &amp; Chat</th>
                        <th className="px-5 py-3.5 font-semibold text-center">Data Katalog</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Aksi Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 text-ink">
                      {filteredTenants.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-ink-500 text-xs">
                            Tidak ada tenant toko yang sesuai dengan filter pencarian.
                          </td>
                        </tr>
                      ) : (
                        filteredTenants.map((t) => (
                          <tr key={t.id} className="hover:bg-ink-50/60 transition-colors">
                            <td className="px-5 py-4">
                              <div className="flex flex-col">
                                <span className="font-semibold text-ink text-sm">
                                  {t.business_name}
                                </span>
                                <span className="text-2xs text-ink-500 mt-0.5">
                                  Owner: {t.owner_name || "Belum diatur"} &bull; {t.email}
                                </span>
                                <span className="text-2xs font-mono text-ink-600 mt-0.5">
                                  WA: {t.owner_whatsapp}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <Badge
                                tone={t.status === "ACTIVE" ? "signal" : t.status === "TRIAL" ? "warn" : "danger"}
                                className="text-[11px]"
                              >
                                {t.status === "ACTIVE" ? "Aktif" : t.status === "TRIAL" ? "Trial" : "Ditangguhkan"}
                              </Badge>
                              <p className="mt-1 text-2xs text-ink-500">
                                Batas: {new Date(t.trial_expires_at).toLocaleDateString("id-ID")}
                              </p>
                              {t.subscription && (
                                <p className="text-2xs text-signal-strong font-semibold font-mono mt-0.5">
                                  {t.subscription.plan} &bull; Rp {rupiah(t.subscription.amount)}
                                </p>
                              )}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <div className="inline-flex flex-col items-center">
                                <span className="font-semibold text-ink">
                                  {t.conversations} chat / {t.orders} order
                                </span>
                                <span className="text-[11px] text-ink-700 bg-ink-100 px-2 py-0.5 rounded border border-ink-200 mt-1 font-mono">
                                  Est. {t.conversations * 450} Token
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-4 text-center text-2xs text-ink-500">
                              <div>{t.products ?? 0} SKU Produk</div>
                              <div>{t.knowledge_docs ?? 0} SOP Bisnis</div>
                              <div>{t.websites ?? 0} Website Aktif</div>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs px-2.5 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700 shadow-flat"
                                  onClick={() => setSelectedTenant(t)}
                                >
                                  Detail
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-7 text-xs px-2 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700 shadow-flat"
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
                                      ? "bg-signal hover:bg-signal/90 text-white"
                                      : "bg-warn-wash hover:bg-warn-wash/80 border border-warn/30 text-warn-strong"
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
                                  className="p-1.5 rounded-lg text-ink-400 hover:text-danger-strong hover:bg-danger-wash transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
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
                <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-flat">
                  <span className="text-xs font-medium text-ink-500">Total MRR Aktif</span>
                  <p className="mt-2 text-2xl font-bold font-mono text-signal-strong">
                    Rp {rupiah(totalMRR)}
                  </p>
                  <p className="text-2xs text-ink-500 mt-1">
                    Dari {activeTenantsCount} tenant aktif
                  </p>
                </div>
                <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-flat">
                  <span className="text-xs font-medium text-ink-500">Rata-rata Nilai per Toko (ARPU)</span>
                  <p className="mt-2 text-2xl font-bold font-mono text-ink">
                    Rp {rupiah(activeTenantsCount > 0 ? Math.round(totalMRR / activeTenantsCount) : 0)}
                  </p>
                  <p className="text-2xs text-ink-500 mt-1">Berdasarkan paket berlangganan</p>
                </div>
                <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-flat">
                  <span className="text-xs font-medium text-ink-500">Status Langganan Berjalan</span>
                  <div className="mt-2 flex items-center gap-3 text-xs font-mono">
                    <span className="text-signal-strong">{data.subscription_counts["ACTIVE"] ?? 0} Aktif</span>
                    <span className="text-ink-300">&bull;</span>
                    <span className="text-warn-strong">{data.subscription_counts["TRIAL"] ?? 0} Trial</span>
                    <span className="text-ink-300">&bull;</span>
                    <span className="text-danger-strong">{data.subscription_counts["EXPIRED"] ?? 0} Expired</span>
                  </div>
                  <div className="mt-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="text-2xs h-6 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                      onClick={() => act({ action: "reconcile" })}
                    >
                      Pindai Status Midtrans
                    </Button>
                  </div>
                </div>
              </div>

              {/* Tabel Tenant Subscription Detail */}
              <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-flat">
                <div className="border-b border-ink-100 px-5 py-4 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                    Rincian Paket &amp; Siklus Penagihan Tenant
                  </h3>
                  <span className="text-2xs text-ink-500 font-mono">
                    {data.tenants.length} Tenant Terdaftar
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-50 text-2xs uppercase text-ink-500 border-b border-ink-200 tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5 font-semibold">Toko Klien</th>
                        <th className="px-5 py-3.5 font-semibold">Paket Langganan</th>
                        <th className="px-5 py-3.5 font-semibold">Nominal Tagihan</th>
                        <th className="px-5 py-3.5 font-semibold">Status Bayar</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Tanggal Berakhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 text-ink">
                      {data.tenants.map((t) => (
                        <tr key={t.id} className="hover:bg-ink-50/60 transition-colors">
                          <td className="px-5 py-4 font-semibold text-ink">{t.business_name}</td>
                          <td className="px-5 py-4">
                            {t.subscription ? (
                              <span className="font-semibold text-ink-700">{t.subscription.plan}</span>
                            ) : (
                              <span className="text-ink-400">Masa Uji Coba Gratis</span>
                            )}
                          </td>
                          <td className="px-5 py-4 font-mono font-semibold text-ink">
                            Rp {rupiah(t.subscription?.amount ?? 0)}
                          </td>
                          <td className="px-5 py-4">
                            <Badge
                              tone={t.status === "ACTIVE" ? "signal" : t.status === "TRIAL" ? "warn" : "danger"}
                            >
                              {t.status === "ACTIVE" ? "Lunas" : t.status === "TRIAL" ? "Trial" : "Tertunda"}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-right font-mono text-2xs text-ink-500">
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
              <div className="rounded-2xl border border-ink-200 bg-white overflow-hidden shadow-flat">
                <div className="border-b border-ink-100 px-5 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                      Fleet Sesi Soket WhatsApp Toko
                    </h3>
                    <p className="text-2xs text-ink-500 mt-0.5">
                      Monitoring koneksi soket real-time WhatsMeow untuk setiap tenant toko.
                    </p>
                  </div>
                  <span className="text-2xs text-ink-500 font-mono">
                    {data.fleet.length} Sesi Terhubung
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-ink-50 text-2xs uppercase text-ink-500 border-b border-ink-200 tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5 font-semibold">Instance Key</th>
                        <th className="px-5 py-3.5 font-semibold">Toko Terkait</th>
                        <th className="px-5 py-3.5 font-semibold">Status Soket</th>
                        <th className="px-5 py-3.5 font-semibold">Nomor WhatsApp</th>
                        <th className="px-5 py-3.5 font-semibold">Aktivitas Terakhir</th>
                        <th className="px-5 py-3.5 font-semibold text-right">Aksi Soket</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-100 text-ink">
                      {data.fleet.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-ink-500">
                            Belum ada instance WhatsApp yang terdaftar pada sistem daemon.
                          </td>
                        </tr>
                      ) : (
                        data.fleet.map((inst) => (
                          <tr key={inst.instance_key} className="hover:bg-ink-50/60 transition-colors">
                            <td className="px-5 py-4 font-mono font-semibold text-ink">{inst.instance_key}</td>
                            <td className="px-5 py-4 font-semibold text-ink">{inst.tenant}</td>
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
                            <td className="px-5 py-4 font-mono text-ink">
                              {inst.phone_number || "Belum Tersambung"}
                            </td>
                            <td className="px-5 py-4 text-2xs text-ink-500">
                              {inst.last_seen ? timeAgo(inst.last_seen) : "-"}
                              {inst.connection_status === "CONNECTED" &&
                                inst.last_seen &&
                                Date.now() - new Date(inst.last_seen).getTime() > 5 * 60 * 1000 && (
                                  <span className="ml-1.5 rounded bg-warn-wash px-1.5 py-0.5 font-medium text-warn-strong">
                                    basi, refresh
                                  </span>
                                )}
                            </td>
                            <td className="px-5 py-4 text-right">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-7 text-xs px-2.5 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700 shadow-flat"
                                onClick={() =>
                                  requestAct(
                                    { action: "restart_instance", instance_key: inst.instance_key },
                                    "Mulai ulang soket?",
                                    `Koneksi soket sesi ${inst.instance_key} dimulai ulang.`
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

          {/* ==================================================== SECTION: SUPERADMIN WA CONNECTION */}
          {activeSection === "superadmin_wa" && (
            <div className="space-y-6">
              <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
                {/* Left Card: Status & QR Pairing */}
                <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-5 shadow-flat">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                        Status WhatsApp Super Admin
                      </h3>
                      <p className="text-2xs text-ink-500 mt-0.5">
                        Koneksi WhatsApp resmi platform untuk siaran langsung ke pemilik toko
                      </p>
                    </div>
                    <Badge
                      tone={data.superadmin_wa?.connection_status === "CONNECTED" ? "signal" : "danger"}
                    >
                      <StatusDot ok={data.superadmin_wa?.connection_status === "CONNECTED"} />
                      {data.superadmin_wa?.connection_status === "CONNECTED" ? "TERHUBUNG" : "OFFLINE"}
                    </Badge>
                  </div>

                  {data.superadmin_wa?.connection_status === "CONNECTED" ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950 space-y-2">
                        <div className="flex items-center gap-2">
                          <Smartphone className="h-4 w-4 text-emerald-700" />
                          <span className="text-xs font-bold">Nomor WhatsApp Aktif:</span>
                          <span className="font-mono text-xs font-semibold text-emerald-800">
                            {data.superadmin_wa.phone_number || "Nomor Terdaftar"}
                          </span>
                        </div>
                        <p className="text-2xs text-emerald-800 leading-relaxed">
                          Sesi WhatsApp Super Admin ini aktif dan siap digunakan sebagai pengirim pesan broadcast pengumuman, peringatan perpanjangan masa langganan, dan follow-up langsung ke WhatsApp pemilik toko.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                          loading={saBusy}
                          onClick={handleRefreshSaWa}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Periksa Status Sesi
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 text-xs border border-red-200 text-red-600 hover:bg-red-50"
                          loading={saBusy}
                          onClick={handleLogoutSaWa}
                        >
                          <LogOut className="mr-1.5 h-3.5 w-3.5" />
                          Putuskan Koneksi (Logout)
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          className="h-8 text-xs bg-ink text-white hover:bg-ink-800"
                          onClick={() => setActiveSection("broadcast")}
                        >
                          <Bell className="mr-1.5 h-3.5 w-3.5" />
                          Buka Menu Siaran
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-xs text-ink-600 leading-relaxed">
                        WhatsApp Super Admin belum terhubung. Klik tombol di bawah untuk menampilkan QR Code dan pindai menggunakan aplikasi WhatsApp di smartphone pengelola.
                      </p>

                      {!saQr && (
                        <div>
                          <Button
                            size="sm"
                            variant="primary"
                            className="h-9 text-xs bg-ink text-white hover:bg-ink-800"
                            loading={saBusy}
                            onClick={handleStartSaWa}
                          >
                            <QrCode className="mr-1.5 h-3.5 w-3.5" />
                            Tautkan WhatsApp (Generate QR)
                          </Button>
                        </div>
                      )}

                      {saQr && (
                        <div className="flex flex-col items-center justify-center p-6 bg-surface-sunken rounded-xl border border-ink-200 space-y-4">
                          <div className="bg-white p-3 rounded-xl border border-ink-200 shadow-flat">
                            <img
                              src={saQr.startsWith("data:") ? saQr : `data:image/png;base64,${saQr}`}
                              alt="QR Code WhatsApp Super Admin"
                              className="h-56 w-56 object-contain"
                            />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-ink-600">
                            <RefreshCw className={cn("h-3.5 w-3.5", saPolling && "animate-spin text-signal-strong")} />
                            <span>Menunggu pemindaian... ({saCountdown}s)</span>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs bg-white hover:bg-ink-50 border border-ink-200"
                            loading={saBusy}
                            onClick={handleStartSaWa}
                          >
                            Muat Ulang QR
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Card: Panduan Pairing */}
                <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-4 shadow-flat">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink">
                      Panduan Penautan WhatsApp Super Admin
                    </h3>
                    <p className="text-2xs text-ink-500 mt-0.5">
                      Langkah-langkah menautkan nomor resmi untuk kebutuhan sistem
                    </p>
                  </div>

                  <div className="space-y-3 text-xs text-ink-700">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-sunken border border-ink-200">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-2xs font-bold text-white">
                        1
                      </span>
                      <p>
                        Buka aplikasi <strong>WhatsApp</strong> di smartphone resmi atau nomor admin platform Noewbar.
                      </p>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-sunken border border-ink-200">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-2xs font-bold text-white">
                        2
                      </span>
                      <p>
                        Buka menu titik tiga (Android) atau menu <strong>Pengaturan</strong> (iOS), lalu pilih <strong>Perangkat Tertaut</strong> (Linked Devices).
                      </p>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-sunken border border-ink-200">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-2xs font-bold text-white">
                        3
                      </span>
                      <p>
                        Tekan <strong>Tautkan Perangkat</strong> dan arahkan kamera ponsel ke QR Code di sebelah kiri.
                      </p>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-sunken border border-ink-200">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-2xs font-bold text-white">
                        4
                      </span>
                      <p>
                        Tunggu beberapa detik sampai sistem mendeteksi koneksi dan status berganti menjadi <strong>TERHUBUNG</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-ink-200 pt-3 text-2xs text-ink-500 leading-relaxed">
                    <strong>Catatan:</strong> Sesi WhatsApp ini terisolasi khusus untuk kebutuhan Super Admin (Broadcast &amp; Follow-up Tenant) dan tidak mengganggu sesi bot AI WhatsApp toko milik tenant.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================================================== SECTION: BROADCAST */}
          {activeSection === "broadcast" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-ink-200 bg-white p-5 space-y-5 shadow-flat">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Siaran Pesan ke Tenant</h3>
                    <p className="text-2xs text-ink-500 mt-0.5">
                      Kirim pesan langsung dari nomor WhatsApp Super Admin ke nomor WhatsApp pemilik toko (tenant).
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-xs bg-white hover:bg-ink-50 border border-ink-200 text-ink-700 self-start sm:self-auto"
                    onClick={() => setActiveSection("superadmin_wa")}
                  >
                    <Smartphone className="mr-1.5 h-3.5 w-3.5" />
                    Koneksi WA Super Admin
                  </Button>
                </div>

                {/* Sender Status Banner */}
                {data.superadmin_wa?.connection_status === "CONNECTED" ? (
                  <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-950 text-xs">
                    <div className="flex items-center gap-2.5">
                      <StatusDot ok={true} />
                      <span>
                        <strong>WhatsApp Pengirim:</strong> Terhubung (
                        {data.superadmin_wa.phone_number || "Super Admin"}), pesan akan dikirim langsung ke nomor WhatsApp pemilik toko.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-950 text-xs">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>WhatsApp Super Admin Belum Terhubung:</strong> Anda harus menautkan nomor WhatsApp Super Admin terlebih dahulu sebelum dapat mengirim siaran.
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      className="h-7 text-xs bg-ink text-white hover:bg-ink-800 border-none shrink-0"
                      onClick={() => setActiveSection("superadmin_wa")}
                    >
                      Tautkan Sekarang
                    </Button>
                  </div>
                )}

                {/* Tenant selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-ink">Target Penerima Toko</label>
                    <span className="text-2xs text-ink-400">
                      {broadcastSelectedIds.length === 0
                        ? `Semua Toko (${data.tenants.length})`
                        : `${broadcastSelectedIds.length} toko dipilih`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                    <button
                      onClick={() => setBroadcastSelectedIds([])}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        broadcastSelectedIds.length === 0
                          ? "border-ink bg-ink text-white"
                          : "border-ink-200 text-ink-600 hover:bg-ink-50"
                      )}
                    >
                      Semua Toko ({data.tenants.length})
                    </button>
                    {data.tenants.map((t) => {
                      const isSelected = broadcastSelectedIds.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          onClick={() =>
                            setBroadcastSelectedIds((prev) =>
                              isSelected ? prev.filter((id) => id !== t.id) : [...prev, t.id]
                            )
                          }
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                            isSelected
                              ? "border-ink bg-ink text-white"
                              : "border-ink-200 text-ink-600 hover:bg-ink-50"
                          )}
                        >
                          {t.business_name}
                          {t.owner_whatsapp && (
                            <span className="ml-1 opacity-70 text-2xs">({t.owner_whatsapp})</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Message composer */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-ink" htmlFor="broadcast-msg">
                    Isi Pesan Siaran
                  </label>
                  <textarea
                    id="broadcast-msg"
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                    rows={6}
                    placeholder="Contoh: Halo Kak [Nama Toko], masa langganan Noewbar Anda akan berakhir dalam 3 hari. Segera perbarui paket untuk memastikan AI CS tetap aktif..."
                    className="w-full rounded-xl border border-ink-200 bg-surface-sunken px-4 py-3 text-sm text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal/20 resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-ink-400">{broadcastMsg.length}/4000</span>
                    <Button
                      size="sm"
                      variant="primary"
                      className="h-9 bg-ink text-white hover:bg-ink-800 border-none"
                      loading={broadcastBusy}
                      disabled={
                        !broadcastMsg.trim() ||
                        broadcastBusy ||
                        data.superadmin_wa?.connection_status !== "CONNECTED"
                      }
                      onClick={async () => {
                        setBroadcastBusy(true);
                        setBroadcastResult(null);
                        try {
                          const res = await fetch("/api/superadmin", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action: "broadcast_tenants",
                              message: broadcastMsg,
                              ...(broadcastSelectedIds.length > 0 ? { tenant_ids: broadcastSelectedIds } : {}),
                            }),
                          });
                          const json = await res.json();
                          if (json.ok) {
                            setBroadcastResult({ total: json.total, sent: json.sent, failed: json.failed });
                            setMsg({
                              text: `Pesan siaran terkirim ke ${json.sent} dari ${json.total} toko.`,
                              tone: json.failed > 0 ? "error" : "success",
                            });
                          } else {
                            setMsg({ text: json.error ?? "Gagal mengirim siaran.", tone: "error" });
                          }
                        } catch {
                          setMsg({ text: "Koneksi gagal saat mengirim siaran.", tone: "error" });
                        } finally {
                          setBroadcastBusy(false);
                        }
                      }}
                    >
                      <Bell className="mr-1.5 h-3.5 w-3.5" />
                      Kirim Siaran via WhatsApp Super Admin
                    </Button>
                  </div>
                </div>

                {/* Broadcast result */}
                {broadcastResult && (
                  <div
                    className={cn(
                      "flex items-center gap-4 rounded-xl border p-4 text-sm",
                      broadcastResult.failed === 0
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-amber-200 bg-amber-50 text-amber-800"
                    )}
                  >
                    <div className="flex-1">
                      <span className="font-semibold">{broadcastResult.sent} berhasil terkirim</span>
                      {broadcastResult.failed > 0 && (
                        <span className="ml-2 text-red-600">· {broadcastResult.failed} gagal</span>
                      )}
                      <span className="text-ink-500"> dari {broadcastResult.total} target toko</span>
                    </div>
                    <button onClick={() => setBroadcastResult(null)} className="shrink-0 text-ink-400 hover:text-ink">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}





          {/* ==================================================== SECTION: KILL SWITCH & EMERGENCY */}
          {activeSection === "killswitch" && (
            <div className="space-y-6 max-w-3xl">
              <div
                className={cn(
                  "rounded-2xl border p-6 space-y-4 shadow-flat",
                  ks.disabled
                    ? "border-danger/30 bg-danger-wash"
                    : "border-ink-200 bg-white"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
                      ks.disabled
                        ? "bg-danger-wash text-danger-strong border-danger/30"
                        : "bg-ink-100 text-ink border-ink-200"
                    )}
                  >
                    <Power className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      Global Emergency Kill-Switch
                    </h3>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Status Saat Ini:{" "}
                      <strong className={ks.disabled ? "text-danger-strong" : "text-signal-strong"}>
                        {ks.disabled ? "BOT DIMATIKAN (KILL SWITCH AKTIF)" : "NORMAL (BOT AKTIF)"}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="text-xs text-ink-700 space-y-2 leading-relaxed bg-surface-sunken p-4 rounded-xl border border-ink-200">
                  <p className="font-semibold text-ink">Dampak Operasional Saklar Darurat:</p>
                  <ul className="list-disc list-inside space-y-1 text-ink-600">
                    <li>Menghentikan seluruh balasan otomatis bot AI WhatsApp di setiap toko di platform.</li>
                    <li>Pesan pembeli yang masuk tetap tersimpan di database dan tidak akan hilang.</li>
                    <li>Admin toko tetap dapat membalas pesan secara manual melalui antarmuka live chat.</li>
                    <li>Gunakan tombol ini saat terjadi gangguan upstream AI yang kritis atau banjir spam anomali.</li>
                  </ul>
                  {ks.disabled && (
                    <p className="text-danger-strong font-mono text-2xs pt-2 border-t border-danger/20">
                      Dimatikan sejak {ts(ks.disabledAt)} {ks.disabledBy ? `oleh ${ks.disabledBy}` : ""}
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  {ks.disabled ? (
                    <Button
                      size="sm"
                      variant="accent"
                      className="bg-signal hover:bg-signal/90 text-white text-xs border-none px-4 py-2 shadow-flat"
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
                      className="bg-danger hover:bg-danger-strong text-white text-xs px-4 py-2 shadow-flat border-none"
                      loading={busy}
                      onClick={() =>
                        requestAct(
                          { action: "kill_switch", disabled: true },
                          "Matikan seluruh bot?",
                          "Seluruh balasan otomatis bot di SEMUA toko platform dimatikan."
                        )
                      }
                    >
                      <Power className="mr-1.5 h-3.5 w-3.5 text-white" />
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
      <Modal open={createTenantModal} onClose={() => setCreateTenantModal(false)}>
        <div className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-6 space-y-5 shadow-overlay text-ink">
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-white">
                <Plus className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Tambah Toko Klien Baru</h3>
                <p className="text-2xs text-ink-500">Onboarding manual langsung dari konsol Superadmin</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCreateTenantModal(false)}
              className="text-ink-400 hover:text-ink p-1 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleCreateTenant} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-2xs font-semibold text-ink-700 mb-1">
                Nama Bisnis / Toko:
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: Hijab Cantik Official"
                value={newTenant.business_name}
                onChange={(e) => setNewTenant({ ...newTenant, business_name: e.target.value })}
                className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-ink-700 mb-1">
                  Nama Pemilik Toko:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rina Sari"
                  value={newTenant.owner_name}
                  onChange={(e) => setNewTenant({ ...newTenant, owner_name: e.target.value })}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-ink-700 mb-1">
                  WhatsApp Pemilik (62xxx):
                </label>
                <input
                  type="text"
                  required
                  placeholder="628123456789"
                  value={newTenant.owner_whatsapp}
                  onChange={(e) => setNewTenant({ ...newTenant, owner_whatsapp: e.target.value })}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-ink font-mono placeholder:text-ink-400 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-ink-700 mb-1">
                  Email Login Akun:
                </label>
                <input
                  type="email"
                  required
                  placeholder="owner@toko.com"
                  value={newTenant.email}
                  onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
                />
              </div>
              <div>
                <label className="block text-2xs font-semibold text-ink-700 mb-1">
                  Kata Sandi Awal:
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimal 8 karakter"
                  value={newTenant.password}
                  onChange={(e) => setNewTenant({ ...newTenant, password: e.target.value })}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-semibold text-ink-700 mb-1">
                  Status Akun:
                </label>
                <select
                  value={newTenant.status}
                  onChange={(e) =>
                    setNewTenant({ ...newTenant, status: e.target.value as "TRIAL" | "ACTIVE" })
                  }
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-ink focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
                >
                  <option value="TRIAL">Masa Uji Coba (Trial)</option>
                  <option value="ACTIVE">Langsung Aktif (Active)</option>
                </select>
              </div>
              <div>
                <label className="block text-2xs font-semibold text-ink-700 mb-1">
                  Durasi Masa Trial (Hari):
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={newTenant.trial_days}
                  onChange={(e) => setNewTenant({ ...newTenant, trial_days: parseInt(e.target.value, 10) || 14 })}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-ink font-mono focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-ink-100">
              <Button
                size="sm"
                variant="secondary"
                type="button"
                className="bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                onClick={() => setCreateTenantModal(false)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                variant="primary"
                type="submit"
                loading={busy}
                className="bg-ink hover:bg-ink-800 text-white border-none shadow-flat"
              >
                Buat Toko Sekarang
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ==================================================== MODAL: TENANT DETAIL INSPECTOR */}
      <Modal open={!!selectedTenant} onClose={() => setSelectedTenant(null)}>
        {selectedTenant && (
          <div className="w-full max-w-xl rounded-2xl border border-ink-200 bg-white p-6 space-y-5 shadow-overlay text-ink">
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-ink">{selectedTenant.business_name}</h3>
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
                <p className="text-2xs text-ink-500 mt-0.5">
                  ID: <span className="font-mono text-ink-700">{selectedTenant.id}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTenant(null)}
                className="text-ink-400 hover:text-ink p-1 rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-sunken border border-ink-200 space-y-1">
                <span className="text-ink-500 text-2xs">Kontak Email:</span>
                <p className="font-medium text-ink">{selectedTenant.email}</p>
                <span className="text-ink-500 text-2xs block pt-1">WhatsApp Pemilik:</span>
                <p className="font-mono text-ink font-semibold">{selectedTenant.owner_whatsapp}</p>
              </div>

              <div className="p-3 rounded-xl bg-surface-sunken border border-ink-200 space-y-1">
                <span className="text-ink-500 text-2xs">Status Masa Trial:</span>
                <p className="text-ink">
                  Hingga {new Date(selectedTenant.trial_expires_at).toLocaleDateString("id-ID")}
                </p>
                <span className="text-ink-500 text-2xs block pt-1">Paket Berlangganan:</span>
                <p className="font-mono text-signal-strong font-semibold">
                  {selectedTenant.subscription
                    ? `${selectedTenant.subscription.plan} (Rp ${rupiah(selectedTenant.subscription.amount)})`
                    : "Masa Uji Coba"}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-surface-sunken border border-ink-200 text-xs space-y-2">
              <span className="text-2xs font-semibold text-ink-500 uppercase tracking-wider">
                Penggunaan Kapasitas &amp; Beban AI
              </span>
              <div className="grid grid-cols-4 gap-2 text-center pt-1">
                <div className="p-2 rounded bg-white border border-ink-100">
                  <span className="text-ink-500 text-2xs block">Percakapan</span>
                  <span className="font-mono font-bold text-ink">{selectedTenant.conversations}</span>
                </div>
                <div className="p-2 rounded bg-white border border-ink-100">
                  <span className="text-ink-500 text-2xs block">Pesanan</span>
                  <span className="font-mono font-bold text-ink">{selectedTenant.orders}</span>
                </div>
                <div className="p-2 rounded bg-white border border-ink-100">
                  <span className="text-ink-500 text-2xs block">SKU Produk</span>
                  <span className="font-mono font-bold text-ink">{selectedTenant.products ?? 0}</span>
                </div>
                <div className="p-2 rounded bg-white border border-ink-100">
                  <span className="text-ink-500 text-2xs block">Est. Token</span>
                  <span className="font-mono font-bold text-signal-strong">
                    {selectedTenant.conversations * 450}
                  </span>
                </div>
              </div>
            </div>

            {selectedTenant.sheet && (
              <div className="p-3 rounded-xl bg-surface-sunken border border-ink-200 text-xs space-y-1">
                <span className="text-2xs text-ink-500">Google Sheet Katalog:</span>
                <a
                  href={selectedTenant.sheet.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block font-mono text-2xs text-ink hover:text-signal-strong truncate hover:underline"
                >
                  {selectedTenant.sheet.url}
                </a>
                <p className="text-2xs text-ink-400">
                  Asal Pengiriman: {selectedTenant.sheet.origin || "-"} &bull; Sinkron Terakhir:{" "}
                  {selectedTenant.sheet.last_synced_at ? timeAgo(selectedTenant.sheet.last_synced_at) : "-"}
                </p>
              </div>
            )}

            {/* Quick Actions Footer inside Modal */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-ink-100">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs h-7 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                  onClick={() => copyToClipboard(selectedTenant.id, "ID Toko")}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  {copyFeedback === "ID Toko" ? "Tersalin!" : "Salin ID"}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-xs h-7 bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
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
                      ? "bg-signal hover:bg-signal/90 text-white"
                      : "bg-warn-wash text-warn-strong border border-warn/30 hover:bg-warn-wash/80"
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
                  className="text-xs h-7 bg-danger-wash text-danger-strong border border-danger/30 hover:bg-danger hover:text-white"
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
        )}
      </Modal>

      {/* ==================================================== MODAL: WIPE TENANT CONFIRMATION */}
      <Modal open={!!wipeConfirmModal} onClose={() => setWipeConfirmModal(null)}>
        {wipeConfirmModal && (
          <div className="w-full max-w-md rounded-2xl border border-danger/30 bg-white p-6 space-y-4 shadow-overlay text-ink">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-wash text-danger-strong border border-danger/30">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">
                  Konfirmasi Penghapusan Toko
                </h3>
                <p className="text-2xs text-danger-strong">Tindakan ini bersifat permanen dan tidak dapat dibatalkan</p>
              </div>
            </div>

            <p className="text-xs text-ink-600 leading-relaxed">
              Anda akan menghapus seluruh data toko <strong>&ldquo;{wipeConfirmModal.name}&rdquo;</strong> beserta seluruh katalog produk, riwayat percakapan, pesanan, dan instance WhatsApp terkait.
            </p>

            <div>
              <label htmlFor="wipe-confirm-input" className="block text-2xs font-semibold text-ink-700 mb-1.5">
                Ketik <span className="text-danger-strong font-bold">HAPUS</span> untuk melanjutkan:
              </label>
              <input
                id="wipe-confirm-input"
                type="text"
                autoFocus
                placeholder="HAPUS"
                value={wipeInput}
                onChange={(e) => setWipeInput(e.target.value)}
                className="w-full rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-xs text-ink uppercase focus:border-danger focus:ring-1 focus:ring-danger font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
              <Button
                size="sm"
                variant="secondary"
                className="bg-white hover:bg-ink-50 border border-ink-200 text-ink-700"
                onClick={() => setWipeConfirmModal(null)}
              >
                Batal
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={wipeInput !== "HAPUS"}
                loading={busy}
                className="bg-danger hover:bg-danger-strong text-white border-none"
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
        )}
      </Modal>
      <ConfirmModal
        open={!!pendingAct}
        title={pendingAct?.title ?? ""}
        description={pendingAct?.description ?? ""}
        confirmLabel="Ya, lanjutkan"
        danger
        busy={busy}
        onConfirm={runPendingAct}
        onClose={() => setPendingAct(null)}
      />
    </div>
  );
}
