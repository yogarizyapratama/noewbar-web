"use client";

/**
 * Store owner dashboard (chapter 10.B).
 *
 * This file is deliberately thin: it owns data loading, realtime signals and
 * navigation, and delegates every surface to a panel component under this
 * folder. Structure mirrors what the backend can actually do: connection,
 * catalog, orders with owner-only verification, conversation takeover, billing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CreditCard,
  Globe,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Package,
  Receipt,
  ShoppingBag,
  Smartphone,
  Tag,
  X,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Badge, Button, ErrorState, StatusDot, cn } from "@/components/ui";
import { AuthPanel } from "./auth-panel";
import { DashboardLoadingScreen } from "./loading-screen";
import { PanelStatus } from "./panel-status";
import { PanelWhatsapp } from "./panel-whatsapp";
import { PanelProducts } from "./panel-products";
import { PanelWebsiteBuilder } from "./panel-website-builder";
import { PanelPromos } from "./panel-promos";
import { PanelKatalog } from "./panel-katalog";
import { PanelSimulator } from "./panel-simulator";
import { PanelPesanan } from "./panel-pesanan";
import { PanelChat } from "./panel-chat";
import { PanelBilling } from "./panel-billing";
import { PanelHelpdesk } from "./panel-helpdesk";
import { NotificationBell } from "@/components/notification-bell";
import { SupportLiveChatWidget } from "@/components/support-live-chat-widget";
import type { Billing, ConversationRow, Health, MessageRow, OrderRow } from "./types";

type TabId =
  | "status"
  | "whatsapp"
  | "products"
  | "website"
  | "simulator"
  | "promos"
  | "katalog"
  | "pesanan"
  | "chat"
  | "billing"
  | "helpdesk";

const NAV: NavItem<TabId>[] = [
  {
    id: "status",
    label: "Dashboard",
    group: "Utama",
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
    keywords: "dashboard ringkasan beranda kpi status toko utama",
  },
  {
    id: "products",
    label: "Katalog Produk & AI",
    group: "Operasional",
    icon: <ShoppingBag className="h-4 w-4" aria-hidden="true" />,
    keywords: "produk barang katalog sku harga stok varian import csv",
  },
  {
    id: "website",
    label: "AI Website Builder",
    group: "Operasional",
    icon: <Globe className="h-4 w-4" aria-hidden="true" />,
    keywords: "website toko online builder landing page prompt template",
  },
  {
    id: "simulator",
    label: "AI Persona & Simulator",
    group: "Operasional",
    icon: <Bot className="h-4 w-4" aria-hidden="true" />,
    keywords: "ai persona bot simulator wa tes coba uji",
  },
  {
    id: "promos",
    label: "Promosi & Pengiriman",
    group: "Operasional",
    icon: <Tag className="h-4 w-4" aria-hidden="true" />,
    keywords: "diskon promo voucher bundling jam operasional cut off kirim batas waktu kupon",
  },
  {
    id: "katalog",
    label: "Basis Dokumen & Sheets",
    group: "Operasional",
    icon: <Package className="h-4 w-4" aria-hidden="true" />,
    keywords: "spreadsheet sheets stok harga ongkir kecamatan dokumen sop",
  },
  {
    id: "pesanan",
    label: "Pesanan & Bukti Bayar",
    group: "Operasional",
    icon: <Receipt className="h-4 w-4" aria-hidden="true" />,
    keywords: "order bukti transfer verifikasi",
  },
  {
    id: "chat",
    label: "Live Chat",
    group: "Operasional",
    icon: <MessageSquare className="h-4 w-4" aria-hidden="true" />,
    keywords: "percakapan takeover ambil alih balas",
  },
  {
    id: "whatsapp",
    label: "Koneksi WhatsApp",
    group: "Pengaturan",
    icon: <Smartphone className="h-4 w-4" aria-hidden="true" />,
    keywords: "qr pairing nomor sesi scan",
  },
  {
    id: "billing",
    label: "Langganan",
    group: "Akun",
    icon: <CreditCard className="h-4 w-4" aria-hidden="true" />,
    keywords: "paket bayar tagihan midtrans",
  },
  {
    id: "helpdesk",
    label: "Pusat Bantuan & Tiket",
    group: "Bantuan",
    icon: <LifeBuoy className="h-4 w-4" aria-hidden="true" />,
    keywords: "bantuan tiket support helpdesk zendesk kendala crm komplain",
  },
];

const VALID_TABS: TabId[] = [
  "status",
  "products",
  "website",
  "simulator",
  "promos",
  "katalog",
  "pesanan",
  "chat",
  "whatsapp",
  "billing",
  "helpdesk",
];

export default function DashboardPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTabState] = useState<TabId>(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (q && VALID_TABS.includes(q as TabId)) return q as TabId;
    }
    return "status";
  });

  const setTab = useCallback((nextTab: TabId) => {
    setTabState(nextTab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("tab") !== nextTab) {
        url.searchParams.set("tab", nextTab);
        window.history.pushState({ tab: nextTab }, "", url.toString());
      }
    }
  }, []);

  useEffect(() => {
    function onPopState() {
      const q = new URLSearchParams(window.location.search).get("tab");
      if (q && VALID_TABS.includes(q as TabId)) {
        setTabState(q as TabId);
      } else {
        setTabState("status");
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [live, setLive] = useState<string | null>(null);

  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const activeConvRef = useRef<string | null>(activeConv);
  useEffect(() => {
    activeConvRef.current = activeConv;
  }, [activeConv]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [billing, setBilling] = useState<Billing | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState(false);

  // Subscription expiry UI state
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [expiryDismissed, setExpiryDismissed] = useState(false);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      if (!res.ok) {
        setAuthed(true);
        setHealthError(`Status gateway mengembalikan kode error (${res.status}).`);
        return;
      }
      const json = await res.json();
      setAuthed(true);
      setHealth(json.data ?? json);
      setHealthError(null);
    } catch {
      setHealthError("Tidak dapat terhubung ke server toko. Periksa jaringan Anda.");
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (!res.ok) {
        setOrdersError("Endpoint pesanan menolak permintaan. Coba muat ulang.");
        return;
      }
      const json = await res.json();
      setOrders(json.orders ?? []);
      setCounts(json.counts ?? {});
      setOrdersError(null);
    } catch {
      setOrdersError("Tidak dapat menghubungi endpoint pesanan.");
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/conversations", { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json();
    setConversations(json.conversations ?? []);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    setChatLoading(true);
    try {
      const res = await fetch(`/api/conversations?conversation_id=${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setMessages(json.messages ?? []);
    } finally {
      setChatLoading(false);
    }
  }, []);

  const loadBilling = useCallback(async () => {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", { cache: "no-store" });
      if (!res.ok) {
        setBillingError(true);
        return;
      }
      const json = await res.json();
      setBilling({ subscription: json.subscription, plans: json.plans ?? undefined });
      setBillingError(false);
    } catch {
      setBillingError(true);
    } finally {
      setBillingLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    if (!authed) return;
    if (tab === "pesanan") loadOrders();
    if (tab === "chat") loadConversations();
    if (tab === "billing") loadBilling();
  }, [authed, tab, loadOrders, loadConversations, loadBilling]);

  // Live poll the status strip only; heavy panels refresh on demand.
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(loadHealth, 20000);
    return () => clearInterval(t);
  }, [authed, loadHealth]);

  // Subscription lockout: force to billing when expired, show modal when expiring soon
  useEffect(() => {
    if (!health?.subscription) return;
    const sub = health.subscription;
    if (sub.is_expired) {
      // Lock all other feature tabs except billing and helpdesk
      if (tab !== "billing" && tab !== "helpdesk") setTab("billing");
      if (!expiryDismissed) setShowExpiryModal(true);
    } else if (sub.is_expiring_soon && !expiryDismissed) {
      setShowExpiryModal(true);
    }
  }, [health?.subscription, tab, expiryDismissed, setTab]);

  useEffect(() => {
    if (!activeConv) return;
    const t = setInterval(() => loadThread(activeConv), 8000);
    return () => clearInterval(t);
  }, [activeConv, loadThread]);

  const [realtimeEvent, setRealtimeEvent] = useState<{ type?: string; [key: string]: unknown } | null>(null);

  // Server-Sent Events: the backend pushes "something changed" so open
  // dashboards refresh immediately instead of waiting for the next poll.
  useEffect(() => {
    if (!authed) return;
    const es = new EventSource("/api/realtime?scope=tenant");

    es.onmessage = (ev) => {
      let data: { type?: string; [key: string]: unknown } = {};
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      setRealtimeEvent(data);
      const type = data.type ?? "";
      if (!type) return;
      setLive(type);
      if (type === "chat") {
        loadConversations();
        if (activeConvRef.current) loadThread(activeConvRef.current);
      } else if (type === "order" || type === "proof" || type === "verified") {
        loadOrders();
      } else if (type === "billing" || type === "wa_status") {
        loadHealth();
        loadBilling();
      }
    };

    es.onerror = () => {
      /* the browser backs off and retries on its own */
    };

    return () => es.close();
  }, [authed, loadConversations, loadThread, loadOrders, loadHealth, loadBilling]);

  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => setLive(null), 2500);
    return () => clearTimeout(t);
  }, [live]);

  /* ------------------------------------------------------------- actions */

  async function verifyOrder(orderId: string, approve: boolean) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", order_id: orderId, approve }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Verifikasi gagal.");
    await loadOrders();
    loadHealth();
  }

  async function handleShip(orderId: string, trackingNumber: string) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ship", order_id: orderId, tracking_number: trackingNumber }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error ?? "Gagal menyimpan nomor resi.");
    await loadOrders();
  }

  async function toggleTakeover(conv: ConversationRow) {
    await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "takeover",
        conversation_id: conv.id,
        enabled: !conv.is_human_takeover,
      }),
    });
    await loadConversations();
    if (activeConv === conv.id) await loadThread(conv.id);
  }

  async function sendReply(text: string): Promise<string> {
    if (!activeConv) return "Tidak ada percakapan aktif.";
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", conversation_id: activeConv, message: text }),
    });
    const json = await res.json();
    await loadThread(activeConv);
    if (!json.ok) return json.error ?? "Gagal mengirim.";
    return json.delivered ? "Terkirim ke pembeli." : (json.error ?? "Tidak terkirim.");
  }

  async function checkout(plan: "PRO_MONTHLY" | "PRO_ANNUAL"): Promise<string | null> {
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const json = await res.json();

    if (json.snap_token) {
      const snapUrl =
        json.redirect_url ??
        `https://app.sandbox.midtrans.com/snap/v2/vtweb/${json.snap_token}`;
      window.open(snapUrl, "_blank", "noopener");
      return `Pesanan ${json.order_id} dibuat. Lanjutkan pembayaran di tab baru, lalu kembali ke sini.`;
    }

    return (
      json.note ?? json.error ?? `Pesanan ${json.order_id} dibuat tetapi Snap token tidak tersedia.`
    );
  }

  const handleSyncBilling = useCallback(async (): Promise<{ ok: boolean; message: string; activated?: boolean }> => {
    try {
      const res = await fetch("/api/billing/sync", { method: "POST" });
      const json = await res.json();
      if (json.ok && json.activated) {
        await loadHealth();
        await loadBilling();
        setLive("billing");
        return { ok: true, message: json.message ?? "Pembayaran berhasil diverifikasi. Paket Pro Anda aktif!", activated: true };
      } else if (json.ok) {
        await loadBilling();
        return { ok: true, message: json.message ?? "Status pembayaran diperbarui.", activated: false };
      } else {
        return { ok: false, message: json.error ?? "Gagal memeriksa status pembayaran." };
      }
    } catch {
      return { ok: false, message: "Koneksi ke server terputus saat sinkronisasi." };
    }
  }, [loadHealth, loadBilling]);

  // Handle return from Midtrans finish URL (/dashboard?billing=finish)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("billing") === "finish") {
      window.history.replaceState({}, "", window.location.pathname);
      setTab("billing");
      setExpiryDismissed(true);
      setShowExpiryModal(false);
      handleSyncBilling();
    }
  }, [handleSyncBilling]);

  /* ---------------------------------------------------------- render gates */

  const intent = useMemo(() => {
    if (typeof window === "undefined") return "login" as const;
    const p = new URLSearchParams(window.location.search).get("intent");
    return p === "register" ? ("register" as const) : ("login" as const);
  }, []);

  if (authed === false) {
    return <AuthPanel initialMode={intent} onSuccess={() => loadHealth()} />;
  }

  if (authed === null) {
    return (
      <DashboardLoadingScreen
        error={healthError}
        onRetry={() => {
          setHealthError(null);
          setHealthLoading(true);
          loadHealth();
        }}
        onBypass={() => {
          setAuthed(true);
        }}
      />
    );
  }

  const waOk = health?.whatsapp?.connection_status === "CONNECTED";
  const sub = health?.subscription;
  const isExpired = sub?.is_expired ?? false;
  const isExpiringSoon = sub?.is_expiring_soon ?? false;
  const daysLeft = sub?.days_remaining ?? null;
  const isTrial = sub?.status === "TRIAL" || sub?.status === "NONE";

  // Nav: lock non-billing items when subscription expired
  const navItems = NAV.map((item) => {
    if (item.id === "pesanan") {
      return { ...item, badge: (counts.PROOF_SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0) };
    }
    if (isExpired && item.id !== "billing") {
      return { ...item, disabled: true };
    }
    return item;
  });

  const handleNavigate = (nextTab: TabId) => {
    if (isExpired && nextTab !== "billing") return;
    setTab(nextTab);
  };

  return (
    <>
      {/* ── Expiry / Warning Modal ── */}
      {showExpiryModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="expiry-modal-title"
        >
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-overlay border border-ink-200">
            <button
              type="button"
              aria-label="Tutup"
              onClick={() => {
                setShowExpiryModal(false);
                setExpiryDismissed(true);
              }}
              className="absolute top-4 right-4 text-ink-400 hover:text-ink-700 p-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <div
              className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-xl border",
                isExpired
                  ? "bg-danger-wash text-danger-strong border-danger/25"
                  : "bg-warn-wash text-warn-strong border-warn/25"
              )}
            >
              {isExpired ? (
                <AlertCircle className="h-6 w-6 text-danger" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-warn" aria-hidden="true" />
              )}
            </div>
            <h2 id="expiry-modal-title" className="mb-2 text-lg font-bold text-ink-900 pr-8">
              {isExpired
                ? isTrial
                  ? "Masa Uji Coba Gratis Berakhir"
                  : "Langganan Anda Telah Berakhir"
                : isTrial
                  ? "Masa Uji Coba Hampir Berakhir"
                  : "Langganan Hampir Habis"}
            </h2>
            <p className="mb-5 text-sm text-ink-600 leading-relaxed">
              {isExpired
                ? isTrial
                  ? "Masa uji coba gratis 7 hari toko Anda telah selesai. Aktifkan paket langganan untuk menghubungkan kembali WhatsApp dan bot AI toko Anda."
                  : "Masa aktif langganan telah berakhir. Perbarui paket langganan untuk mengaktifkan kembali layanan bot toko Anda."
                : isTrial
                  ? `Masa uji coba toko Anda tersisa ${daysLeft} hari lagi. Pilih paket Pro sekarang agar interaksi pelanggan tidak terputus.`
                  : `Langganan Anda berakhir dalam ${daysLeft} hari. Perbarui sekarang agar layanan bot tidak terganggu.`}
            </p>
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  setShowExpiryModal(false);
                  setExpiryDismissed(true);
                  setTab("billing");
                  loadBilling();
                }}
              >
                {isExpired ? "Aktifkan Sekarang" : "Upgrade Paket"}
              </Button>
              <Button
                variant="secondary"
                onClick={async () => {
                  setShowExpiryModal(false);
                  setExpiryDismissed(true);
                  setTab("billing");
                  await handleSyncBilling();
                }}
              >
                Cek Pembayaran
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowExpiryModal(false);
                  setExpiryDismissed(true);
                }}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

    <AppShell<TabId>
      brand="NOEWBAR"
      brandNote={health?.tenant?.business_name ?? "Dashboard Toko"}
      nav={navItems}
      active={tab}
      onNavigate={handleNavigate}
      status={{
        ok: Boolean(health?.ai?.gateway_ok) && waOk,
        label: waOk ? (health?.ai?.gateway_ok ? "Sistem siap" : "AI gangguan") : "WA belum tertaut",
      }}
      headerActions={
        <div className="flex items-center gap-3">
          {live && (
            <Badge tone="signal" aria-live="polite">
              <StatusDot ok />
              Diperbarui
            </Badge>
          )}
          <NotificationBell
            scope="tenant"
            theme="light"
            externalEvent={realtimeEvent}
            onNavigate={(targetTab) => setTab(targetTab as TabId)}
          />
        </div>
      }
      sidebarFooter={
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => {
            await fetch("/api/auth", { method: "DELETE" });
            window.location.href = "/";
          }}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Keluar
        </Button>
      }
      commands={[
        {
          id: "refresh-status",
          label: "Probe ulang status sistem",
          hint: "Jalankan probe",
          icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
          run: () => {
            setTab("status");
            loadHealth();
          },
        },
        {
          id: "refresh-orders",
          label: "Muat ulang pesanan",
          hint: "Ambil data terbaru",
          icon: <Receipt className="h-4 w-4" aria-hidden="true" />,
          run: () => {
            setTab("pesanan");
            loadOrders();
          },
        },
        {
          id: "new-qr",
          label: "Mulai pairing WhatsApp",
          hint: "Buka QR",
          icon: <Smartphone className="h-4 w-4" aria-hidden="true" />,
          run: () => setTab("whatsapp"),
        },
      ]}
    >
      {healthError && tab !== "status" && (
        <div className="px-4 pt-4 sm:px-6 lg:px-8">
          <ErrorState title="Status sistem tidak terbaca" description={healthError} compact />
        </div>
      )}

      {/* Subscription expiry banner: persistent, cannot be dismissed when expired */}
      {(isExpired || (isExpiringSoon && !expiryDismissed)) && (
        <div
          className={cn(
            "mx-4 mt-4 flex items-center justify-between gap-3.5 rounded-xl border p-3.5 sm:px-5 sm:py-3.5 shadow-flat transition-colors sm:mx-6 lg:mx-8",
            isExpired
              ? "border-danger/30 bg-danger-wash text-danger-strong"
              : "border-warn/30 bg-warn-wash text-warn-strong"
          )}
          role="alert"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                isExpired
                  ? "border-danger/25 bg-white text-danger"
                  : "border-warn/25 bg-white text-warn"
              )}
            >
              {isExpired ? (
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0 text-sm">
              <span className="font-semibold text-ink-900">
                {isExpired
                  ? isTrial
                    ? "Masa uji coba gratis berakhir."
                    : "Langganan berakhir."
                  : isTrial
                    ? `Masa uji coba gratis berakhir dalam ${daysLeft} hari.`
                    : `Langganan berakhir dalam ${daysLeft} hari.`}
              </span>
              <span className="hidden sm:inline text-ink-600 ml-1.5 text-xs sm:text-sm">
                {isExpired
                  ? "Aktifkan paket untuk membuka kembali integrasi WhatsApp dan bot AI."
                  : "Tingkatkan ke paket Pro agar operasional bot WhatsApp toko tetap berjalan lancar."}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                isExpired
                  ? "bg-danger text-white hover:bg-danger-strong focus-visible:outline-danger"
                  : "bg-ink-900 text-white hover:bg-ink-800 focus-visible:outline-ink-900"
              )}
              onClick={() => {
                setTab("billing");
                loadBilling();
              }}
            >
              {isExpired ? "Aktifkan Sekarang" : "Upgrade Sekarang"}
            </button>
            {!isExpired && (
              <button
                type="button"
                className="rounded-lg p-1 text-ink-500 hover:bg-black/5 hover:text-ink-800 transition-colors"
                aria-label="Tutup notifikasi"
                onClick={() => setExpiryDismissed(true)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "status" && (
        <PanelStatus
          health={health}
          orders={orders}
          counts={counts}
          conversations={conversations}
          error={healthError}
          loading={healthLoading}
          onGoWhatsapp={() => setTab("whatsapp")}
          onGoSimulator={() => setTab("simulator")}
          onGoCatalog={() => setTab("katalog")}
          onGoOrders={() => setTab("pesanan")}
          onGoChat={() => setTab("chat")}
          onGoProducts={() => setTab("products")}
          onGoWebsite={() => setTab("website")}
          onGoPromos={() => setTab("promos")}
          onRefresh={() => {
            loadHealth();
            loadOrders();
            loadConversations();
          }}
        />
      )}

      {tab === "products" && <PanelProducts />}

      {tab === "website" && <PanelWebsiteBuilder />}

      {tab === "promos" &&
        (health ? (
          <PanelPromos
            initialPromoRules={health.promos?.promo_rules ?? []}
            initialVouchers={health.promos?.voucher_rules ?? []}
            initialShipping={health.shipping}
            onRefresh={() => {
              loadHealth();
            }}
          />
        ) : (
          <div className="rounded-2xl border border-ink-100 bg-white p-8 text-center text-ink-600 shadow-sm">
            <p className="text-sm">Memuat pengaturan promosi dan diskon...</p>
          </div>
        ))}

      {tab === "whatsapp" && <PanelWhatsapp health={health} onRefreshHealth={loadHealth} />}

      {tab === "katalog" && (
        <PanelKatalog
          key={health?.catalog?.sheets_url ?? "empty"}
          sheetUrl={health?.catalog?.sheets_url ?? ""}
          origin={health?.catalog?.origin_subdistrict ?? ""}
          configured={Boolean(health?.catalog?.configured)}
          lastSyncedAt={health?.catalog?.last_synced_at ?? null}
          payment={{
            bank_name: health?.catalog?.bank_name ?? "",
            bank_account_number: health?.catalog?.bank_account_number ?? "",
            bank_account_holder: health?.catalog?.bank_account_holder ?? "",
            qris_url: health?.catalog?.qris_key?.url ?? null,
          }}
          onGoProducts={() => setTab("products")}
        />
      )}

      {tab === "simulator" && (
        <PanelSimulator health={health} onRefreshHealth={loadHealth} />
      )}

      {tab === "pesanan" && (
        <PanelPesanan
          orders={orders}
          counts={counts}
          error={ordersError}
          loading={ordersLoading}
          onVerify={verifyOrder}
          onShip={handleShip}
          onRefresh={loadOrders}
        />
      )}

      {tab === "chat" && (
        <PanelChat
          conversations={conversations}
          activeId={activeConv}
          messages={messages}
          loading={chatLoading}
          onSelect={(id) => {
            setActiveConv(id);
            loadThread(id);
          }}
          onToggleTakeover={toggleTakeover}
          onSend={sendReply}
        />
      )}

      {tab === "billing" && (
        <PanelBilling
          billing={billing}
          loading={billingLoading}
          hasError={billingError}
          onCheckout={checkout}
          onRefresh={loadBilling}
          onSync={handleSyncBilling}
        />
      )}

      {tab === "helpdesk" && <PanelHelpdesk />}

      {/* Expired state: show informational overlay inside AppShell content area */}
      {isExpired && tab !== "billing" && tab !== "helpdesk" && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-danger/25 bg-danger-wash text-danger-strong">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-ink">Langganan Tidak Aktif</h2>
          <p className="max-w-sm text-sm text-ink-600 leading-relaxed">
            Fitur ini tidak tersedia karena langganan Anda telah berakhir.
          </p>
          <button
            className="mt-2 min-h-[44px] rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
            onClick={() => { setTab("billing"); loadBilling(); }}
          >
            Perbarui Langganan
          </button>
        </div>
      )}
    </AppShell>
    <SupportLiveChatWidget />
    </>
  );
}
