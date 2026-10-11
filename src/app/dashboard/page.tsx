"use client";

/**
 * Store owner dashboard (chapter 10.B).
 *
 * This file is deliberately thin: it owns data loading, realtime signals and
 * navigation, and delegates every surface to a panel component under this
 * folder. Structure mirrors what the backend can actually do: connection,
 * catalog, orders with owner-only verification, conversation takeover, billing.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  CreditCard,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Package,
  Receipt,
  Smartphone,
} from "lucide-react";
import { AppShell, type NavItem } from "@/components/app-shell";
import { Badge, Button, ErrorState, StatusDot } from "@/components/ui";
import { AuthPanel } from "./auth-panel";
import { PanelStatus } from "./panel-status";
import { PanelWhatsapp } from "./panel-whatsapp";
import { PanelKatalog } from "./panel-katalog";
import { PanelSimulator } from "./panel-simulator";
import { PanelPesanan } from "./panel-pesanan";
import { PanelChat } from "./panel-chat";
import { PanelBilling } from "./panel-billing";
import type { Billing, ConversationRow, Health, MessageRow, OrderRow } from "./types";

type TabId = "status" | "whatsapp" | "katalog" | "simulator" | "pesanan" | "chat" | "billing";

const NAV: NavItem<TabId>[] = [
  {
    id: "status",
    label: "Dashboard",
    group: "Utama",
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden="true" />,
    keywords: "dashboard ringkasan beranda kpi status toko utama",
  },
  {
    id: "simulator",
    label: "AI Persona & Simulator",
    group: "Operasional",
    icon: <Bot className="h-4 w-4" aria-hidden="true" />,
    keywords: "ai persona bot simulator wa tes coba uji",
  },
  {
    id: "katalog",
    label: "Katalog & Media",
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
];

export default function DashboardPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>("status");
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
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const [billing, setBilling] = useState<Billing | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState(false);

  const loadHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/maintenance", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const json = await res.json();
      setAuthed(true);
      setHealth(json);
      setHealthError(null);
    } catch {
      setHealthError("Tidak dapat membaca status sistem.");
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
      setBilling({ subscription: json.subscription });
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

  useEffect(() => {
    if (!activeConv) return;
    const t = setInterval(() => loadThread(activeConv), 8000);
    return () => clearInterval(t);
  }, [activeConv, loadThread]);

  // Server-Sent Events: the backend pushes "something changed" so open
  // dashboards refresh immediately instead of waiting for the next poll.
  useEffect(() => {
    if (!authed) return;
    const es = new EventSource("/api/realtime?scope=tenant");

    es.onmessage = (ev) => {
      let type = "";
      try {
        type = (JSON.parse(ev.data) as { type?: string }).type ?? "";
      } catch {
        return;
      }
      if (!type) return;
      setLive(type);
      if (type === "chat") {
        loadConversations();
        if (activeConv) loadThread(activeConv);
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
  }, [authed, activeConv, loadConversations, loadThread, loadOrders, loadHealth, loadBilling]);

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
      const snapUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${json.snap_token}`;
      window.open(snapUrl, "_blank", "noopener");
      return `Pesanan ${json.order_id} dibuat. Lanjutkan pembayaran di tab baru, lalu kembali ke sini.`;
    }

    return (
      json.note ?? json.error ?? `Pesanan ${json.order_id} dibuat tetapi Snap token tidak tersedia.`
    );
  }

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
      <main className="grid min-h-screen place-items-center bg-surface-sunken px-5">
        <p className="text-sm text-ink-500" role="status">
          Memuat dashboard...
        </p>
      </main>
    );
  }

  const waOk = health?.whatsapp?.connection_status === "CONNECTED";

  return (
    <AppShell<TabId>
      brand="NOEWBAR"
      brandNote={health?.tenant?.business_name ?? "Dashboard Toko"}
      nav={NAV.map((item) =>
        item.id === "pesanan"
          ? { ...item, badge: (counts.PROOF_SUBMITTED ?? 0) + (counts.UNDER_REVIEW ?? 0) }
          : item
      )}
      active={tab}
      onNavigate={setTab}
      status={{
        ok: Boolean(health?.ai?.gateway_ok) && waOk,
        label: waOk ? (health?.ai?.gateway_ok ? "Sistem siap" : "AI gangguan") : "WA belum tertaut",
      }}
      headerActions={
        live ? (
          <Badge tone="signal" aria-live="polite">
            <StatusDot ok />
            Diperbarui
          </Badge>
        ) : undefined
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

      {tab === "status" && (
        <PanelStatus
          health={health}
          error={healthError}
          loading={healthLoading}
          onGoWhatsapp={() => setTab("whatsapp")}
          onGoSimulator={() => setTab("simulator")}
          onGoCatalog={() => setTab("katalog")}
          onGoOrders={() => setTab("pesanan")}
          onGoChat={() => setTab("chat")}
          onRefresh={loadHealth}
        />
      )}

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
        />
      )}
    </AppShell>
  );
}
