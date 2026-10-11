"use client";

/**
 * Master Control Console (chapter 11).
 *
 * Every panel renders a real probe result from /api/superadmin. When the operator
 * session is missing the console shows a login form; when a dependency is down
 * the panel names the dependency and its error instead of a green placeholder.
 */

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  DollarSign,
  LayoutDashboard,
  MessageSquare,
  Radio,
  Search,
  Server,
  ShoppingBag,
  Table2,
  Users,
  Webhook,
  X,
} from "lucide-react";
import {
  AppShell,
  type NavItem,
  type PaletteCommand,
} from "@/components/app-shell";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Segmented,
  StatusDot,
  rupiah,
  timeAgo,
} from "@/components/ui";
import { AdminLogin } from "./admin-login";

export type ConsoleData = {
  kill_switch: { disabled: boolean; disabledAt: string | null; disabledBy: string | null };
  superadmin_hash_configured: boolean;
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

type Tab = "telemetry" | "fleet" | "tenants" | "webhooks";
type TenantFilter = "all" | "ACTIVE" | "TRIAL" | "SUSPENDED";

const TABS: NavItem<Tab>[] = [
  {
    id: "telemetry",
    label: "Telemetri",
    group: "Pemantauan",
    icon: <Radio className="h-4 w-4" aria-hidden="true" />,
    keywords: "probe gateway daemon redis antrean rekonsiliasi",
  },
  {
    id: "fleet",
    label: "Fleet WhatsApp",
    group: "Pemantauan",
    icon: <Server className="h-4 w-4" aria-hidden="true" />,
    keywords: "sesi instance nomor restart",
  },
  {
    id: "tenants",
    label: "Kontrol Tenant",
    group: "Operasional",
    icon: <Table2 className="h-4 w-4" aria-hidden="true" />,
    keywords: "toko suspend trial perpanjang hapus",
  },
  {
    id: "webhooks",
    label: "Ledger Webhook",
    group: "Operasional",
    icon: <Webhook className="h-4 w-4" aria-hidden="true" />,
    keywords: "idempotensi provider midtrans",
  },
];

function ts(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
}

function ProbePanel({
  title,
  ok,
  icon,
  rows,
  footer,
}: {
  title: string;
  ok: boolean;
  icon: React.ReactNode;
  rows: [string, string][];
  footer?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader
        icon={icon}
        title={title}
        actions={
          <Badge tone={ok ? "signal" : "danger"}>
            <StatusDot ok={ok} />
            {ok ? "siap" : "gangguan"}
          </Badge>
        }
      />
      <CardBody className="p-0">
        <dl className="divide-y divide-ink-200">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 px-5 py-2.5">
              <dt className="text-xs text-ink-500">{k}</dt>
              <dd className="truncate font-mono text-xs font-medium text-ink" title={v}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        {footer && <div className="border-t border-ink-200 px-5 py-3">{footer}</div>}
      </CardBody>
    </Card>
  );
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
      setMsg("Gagal membaca data konsol.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!authed) return;
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [authed, load]);

  // Realtime fleet signals: kill-switch, tenant status and instance restarts
  // push an admin event so the console reflects them without waiting 30s.
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
    const t = setTimeout(() => setLive(null), 2500);
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
      setMsg(json.ok ? `Selesai: ${String(payload.action)}` : `${json.error}`);
      await load();
    } catch {
      setMsg("Aksi gagal dikirim.");
    } finally {
      setBusy(false);
    }
  }

  if (authed === false) {
    return <AdminLogin onSuccess={load} />;
  }

  if (authed === null || !data) {
    return (
      <main className="grid min-h-screen place-items-center bg-surface-sunken px-5">
        <p className="text-sm text-ink-500" role="status">
          Memuat konsol operator...
        </p>
      </main>
    );
  }

  const ks = data.kill_switch;
  const totalMRR = data.tenants.reduce(
    (acc, t) => acc + (t.subscription?.status === "ACTIVE" ? t.subscription.amount : 0),
    0
  );
  const activeTenantsCount = data.tenants.filter((t) => t.status === "ACTIVE").length;
  const trialTenantsCount = data.tenants.filter((t) => t.status === "TRIAL").length;
  const totalConversations = data.tenants.reduce((acc, t) => acc + t.conversations, 0);
  const totalOrders = data.tenants.reduce((acc, t) => acc + t.orders, 0);
  const totalDocs = data.tenants.reduce((acc, t) => acc + (t.knowledge_docs ?? 0), 0);

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

  const commands: PaletteCommand[] = [
    {
      id: "refresh",
      label: "Probe ulang seluruh konsol",
      hint: "Jalankan probe",
      icon: <Radio className="h-4 w-4" aria-hidden="true" />,
      run: load,
    },
    {
      id: "reconcile",
      label: "Jalankan rekonsiliasi Midtrans",
      hint: "Periksa transaksi menggantung",
      icon: <Webhook className="h-4 w-4" aria-hidden="true" />,
      run: () => act({ action: "reconcile" }),
    },
    {
      id: "kill",
      label: ks.disabled ? "Aktifkan bot global" : "Kill-switch global",
      hint: "Semua tenant",
      icon: <Server className="h-4 w-4" aria-hidden="true" />,
      run: () =>
        act(
          { action: "kill_switch", disabled: !ks.disabled },
          ks.disabled ? undefined : "Matikan SEMUA balasan bot di seluruh toko?"
        ),
    },
  ];

  return (
    <AppShell<Tab>
      brand="NOEWBAR CONSOLE"
      brandNote="Operator platform"
      nav={TABS}
      active={tab}
      onNavigate={setTab}
      status={{ ok: data.gateway.ok && data.daemon.ok, label: "Konsol operator" }}
      headerActions={
        <>
          <a
            href="/dashboard"
            className="btn-secondary btn-sm flex items-center gap-1.5 font-medium text-ink transition-colors"
            title="Buka dashboard toko klien"
          >
            <LayoutDashboard className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Dashboard Toko</span>
          </a>
          {live && (
            <Badge tone="signal" aria-live="polite">
              <StatusDot ok />
              Real-time
            </Badge>
          )}
        </>
      }
      sidebarFooter={
        ks.disabled ? (
          <Button
            variant="primary"
            className="w-full"
            loading={busy}
            onClick={() => act({ action: "kill_switch", disabled: false })}
          >
            Aktifkan bot global
          </Button>
        ) : (
          <Button
            variant="danger"
            className="w-full"
            loading={busy}
            onClick={() =>
              act(
                { action: "kill_switch", disabled: true },
                "Matikan SEMUA balasan bot di seluruh toko?"
              )
            }
          >
            Kill-switch global
          </Button>
        )
      }
      commands={commands}
    >
      <div className="page">
        {/* global banners */}
        {ks.disabled && (
          <Card className="border-danger/40 bg-danger-wash">
            <CardBody className="text-sm text-danger">
              <strong>Kill-switch aktif.</strong> Seluruh balasan bot dihentikan sejak{" "}
              {ts(ks.disabledAt)}
              {ks.disabledBy ? ` oleh ${ks.disabledBy}` : ""}. Tekan Aktifkan bot global untuk
              memulihkan.
            </CardBody>
          </Card>
        )}

        {!data.superadmin_hash_configured && (
          <Card className="border-warn/40 bg-warn-wash">
            <CardBody className="text-sm text-warn">
              <strong>SUPERADMIN_PASSWORD_HASH belum valid.</strong> Konsol berjalan dengan hash
              placeholder sehingga login akan selalu ditolak. Isi hash Argon2id asli di .env untuk
              mengaktifkan akses penuh.
            </CardBody>
          </Card>
        )}

        {msg && (
          <Card variant="sunken">
            <CardBody className="text-sm text-ink-600">{msg}</CardBody>
          </Card>
        )}

        {/* ------------------------------------------------------- TELEMETRY */}
        {tab === "telemetry" && (
          <>
            <PageHeader
              eyebrow="Diagnostik platform"
              title="Telemetri & Ringkasan"
              description="Setiap nilai di bawah adalah hasil probe langsung ke dependensi, dijalankan setiap 30 detik."
              icon={<Radio className="h-4 w-4" aria-hidden="true" />}
            />

            {/* Platform KPI Banner */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card className="p-5 transition-all hover:border-ink-300">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 bg-ink-50 text-ink-700 shadow-flat">
                    <Users className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold text-ink">Total Toko</p>
                </div>
                <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-ink">
                  {data.tenants.length}
                </p>
                <p className="mt-1 text-2xs text-ink-500">
                  {activeTenantsCount} aktif &middot; {trialTenantsCount} trial
                </p>
              </Card>

              <Card className="p-5 transition-all hover:border-ink-300">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-signal/20 bg-signal-wash text-signal-strong shadow-flat">
                    <DollarSign className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold text-ink">MRR Langganan</p>
                </div>
                <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-ink">
                  {rupiah(totalMRR)}
                </p>
                <p className="mt-1 text-2xs font-medium text-signal-strong">Tenant berbayar aktif</p>
              </Card>

              <Card className="p-5 transition-all hover:border-ink-300">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-indigo-200/60 bg-indigo-50 text-indigo-700 shadow-flat">
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold text-ink">Percakapan</p>
                </div>
                <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-ink">
                  {totalConversations}
                </p>
                <p className="mt-1 text-2xs text-ink-500">Pesan tertangani</p>
              </Card>

              <Card className="p-5 transition-all hover:border-ink-300">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-200/60 bg-amber-50 text-amber-700 shadow-flat">
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold text-ink">Pesanan</p>
                </div>
                <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-ink">
                  {totalOrders}
                </p>
                <p className="mt-1 text-2xs text-ink-500">Tercatat di sistem</p>
              </Card>

              <Card className="p-5 transition-all hover:border-ink-300">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg border border-sky-200/60 bg-sky-50 text-sky-700 shadow-flat">
                    <BookOpen className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <p className="text-xs font-semibold text-ink">Dokumen SOP</p>
                </div>
                <p className="mt-3 font-mono text-3xl font-bold tabular-nums text-ink">
                  {totalDocs}
                </p>
                <p className="mt-1 text-2xs text-ink-500">Basis pengetahuan AI</p>
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ProbePanel
                icon={<Radio className="h-4 w-4" aria-hidden="true" />}
                title="9router AI Gateway"
                ok={data.gateway.ok}
                rows={[
                  ["Endpoint", data.gateway.url],
                  ["Model", data.gateway.model],
                  [
                    "Latensi probe",
                    data.gateway.latency_ms !== null ? `${data.gateway.latency_ms} ms` : "-",
                  ],
                  ["Jumlah model", String(data.gateway.models.length)],
                  ["Error", data.gateway.error ?? "tidak ada"],
                ]}
              />

              <ProbePanel
                icon={<Server className="h-4 w-4" aria-hidden="true" />}
                title="Whatsmeow Daemon"
                ok={data.daemon.ok}
                rows={[
                  ["Endpoint", data.daemon.url],
                  [
                    "Sesi aktif",
                    data.daemon.active_instances !== null
                      ? String(data.daemon.active_instances)
                      : "-",
                  ],
                  ["Lapor pada", ts(data.daemon.uptime_reported_at)],
                  ["Error", data.daemon.error ?? "tidak ada"],
                ]}
              />

              <ProbePanel
                icon={<Server className="h-4 w-4" aria-hidden="true" />}
                title="Antrean BullMQ"
                ok={data.queue.redis}
                rows={[
                  ["Redis", data.redis ? "terhubung" : "tidak terhubung"],
                  ["Menunggu", String(data.queue.waiting)],
                  ["Terjadwal", String(data.queue.delayed)],
                  ["Aktif", String(data.queue.active)],
                  ["Gagal", String(data.queue.failed)],
                  ["Pending di DB", String(data.queue.pendingInDb)],
                ]}
              />

              <ProbePanel
                icon={<Webhook className="h-4 w-4" aria-hidden="true" />}
                title="Telegram Alert"
                ok={data.telegram.ok}
                rows={[
                  ["Bot", data.telegram.username ?? "-"],
                  ["Status", data.telegram.ok ? "terhubung" : "tidak terhubung"],
                  ["Error", data.telegram.error ?? "tidak ada"],
                ]}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title="Status langganan platform"
                  description="Sebaran status langganan seluruh tenant."
                />
                <CardBody className="p-0">
                  {Object.entries(data.subscription_counts).length === 0 ? (
                    <EmptyState
                      title="Belum ada langganan tercatat"
                      description="Angka muncul setelah tenant pertama menyelesaikan pembayaran."
                    />
                  ) : (
                    <dl className="divide-y divide-ink-200">
                      {Object.entries(data.subscription_counts).map(([k, v]) => (
                        <div
                          key={k}
                          className="flex items-baseline justify-between gap-4 px-5 py-2.5"
                        >
                          <dt className="text-xs text-ink-500">{k}</dt>
                          <dd className="font-mono text-xs font-semibold tabular-nums text-ink">
                            {v}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Rekonsiliasi Midtrans"
                  description="Memeriksa transaksi menggantung lewat Status API dan memindahkan tenant yang lewat jatuh tempo ke masa tenggang atau suspend."
                  actions={
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={busy}
                      onClick={() => act({ action: "reconcile" })}
                    >
                      Jalankan sekarang
                    </Button>
                  }
                />
                <CardBody className="space-y-3">
                  <div>
                    <label htmlFor="orderid" className="label">
                      Cek satu order Midtrans
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="orderid"
                        className="field flex-1"
                        placeholder="NOEWBAR-M-xxxxxxxx-1712..."
                        value={orderId}
                        onChange={(e) => setOrderId(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && orderId) {
                            act({ action: "sync_midtrans", order_id: orderId });
                          }
                        }}
                        autoComplete="off"
                      />
                      <Button
                        variant="secondary"
                        loading={busy}
                        disabled={!orderId}
                        onClick={() => act({ action: "sync_midtrans", order_id: orderId })}
                      >
                        Cek
                      </Button>
                    </div>
                    <p className="hint">
                      Order ID diambil dari ledger webhook atau email konfirmasi Midtrans.
                    </p>
                  </div>

                  {data.recent_orders.length > 0 && (
                    <div className="rounded border border-ink-200">
                      <p className="border-b border-ink-200 px-3 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-500">
                        Pesanan terbaru
                      </p>
                      <ul className="divide-y divide-ink-200">
                        {data.recent_orders.slice(0, 5).map((o) => (
                          <li
                            key={o.id}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-mono text-2xs text-ink">{o.order_number}</p>
                              <p className="truncate text-2xs text-ink-500">
                                {o.tenant} &middot; {timeAgo(o.created_at)}
                              </p>
                            </div>
                            <p className="shrink-0 font-mono text-2xs font-semibold tabular-nums text-ink">
                              Rp {rupiah(o.total)}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        )}

        {/* ----------------------------------------------------------- FLEET */}
        {tab === "fleet" && (
          <>
            <PageHeader
              eyebrow="Sesi WhatsApp"
              title="Fleet WhatsApp"
              description="Satu baris per nomor toko. Restart ulang soket tanpa menghapus kredensial sesi."
              icon={<Server className="h-4 w-4" aria-hidden="true" />}
              actions={
                <Badge tone={data.daemon.ok ? "signal" : "danger"}>
                  <StatusDot ok={data.daemon.ok} />
                  daemon {data.daemon.ok ? "siap" : "gangguan"}
                </Badge>
              }
            />

            {data.fleet.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Server className="h-5 w-5" aria-hidden="true" />}
                  title="Belum ada sesi nomor toko"
                  description="Sesi dibuat saat tenant menekan Tampilkan QR pairing di dashboard mereka."
                />
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-ink-200 bg-ink-50">
                      <tr className="text-2xs uppercase tracking-wide text-ink-500">
                        <th className="px-4 py-2.5 font-semibold">Instance</th>
                        <th className="px-4 py-2.5 font-semibold">Toko</th>
                        <th className="px-4 py-2.5 font-semibold">Status</th>
                        <th className="px-4 py-2.5 font-semibold">Nomor</th>
                        <th className="px-4 py-2.5 font-semibold">Terakhir aktif</th>
                        <th className="px-4 py-2.5 font-semibold">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-200">
                      {data.fleet.map((f) => (
                        <tr key={f.instance_key} className="hover:bg-ink-50">
                          <td className="px-4 py-3 font-mono text-xs text-ink">{f.instance_key}</td>
                          <td className="px-4 py-3 text-ink">{f.tenant}</td>
                          <td className="px-4 py-3">
                            <Badge tone={f.connection_status === "CONNECTED" ? "signal" : "warn"}>
                              {f.connection_status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-ink">
                            {f.phone_number ?? "-"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-500">
                            {f.last_seen ? timeAgo(f.last_seen) : "belum pernah"}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="secondary"
                              size="sm"
                              loading={busy}
                              onClick={() =>
                                act(
                                  { action: "restart_instance", instance_key: f.instance_key },
                                  `Restart soket ${f.instance_key}? Sesi tetap tersimpan, hanya koneksi yang disambung ulang.`
                                )
                              }
                            >
                              Restart
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        {/* --------------------------------------------------------- TENANTS */}
        {tab === "tenants" && (
          <>
            <PageHeader
              eyebrow="Siklus hidup"
              title="Kontrol tenant"
              description="Perpanjang uji coba, aktifkan, tangguhkan, atau hapus permanen. Penghapusan tidak bisa dibatalkan."
              icon={<Table2 className="h-4 w-4" aria-hidden="true" />}
            />

            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded border border-ink-200 bg-white p-3.5">
                <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
                  <Users className="h-3.5 w-3.5 text-ink-400" /> Total Toko
                </p>
                <p className="mt-1 font-mono text-xl font-bold text-ink">{data.tenants.length}</p>
                <p className="mt-0.5 text-2xs text-ink-500">
                  {activeTenantsCount} aktif &middot; {trialTenantsCount} trial
                </p>
              </div>
              <div className="rounded border border-ink-200 bg-white p-3.5">
                <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
                  <DollarSign className="h-3.5 w-3.5 text-ink-400" /> Estimasi MRR
                </p>
                <p className="mt-1 font-mono text-xl font-bold text-ink">Rp {rupiah(totalMRR)}</p>
                <p className="mt-0.5 text-2xs text-ink-500">Langganan aktif</p>
              </div>
              <div className="rounded border border-ink-200 bg-white p-3.5">
                <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
                  <MessageSquare className="h-3.5 w-3.5 text-ink-400" /> Sesi Obrolan
                </p>
                <p className="mt-1 font-mono text-xl font-bold text-ink">
                  {totalConversations.toLocaleString("id-ID")}
                </p>
                <p className="mt-0.5 text-2xs text-ink-500">Percakapan AI</p>
              </div>
              <div className="rounded border border-ink-200 bg-white p-3.5">
                <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
                  <ShoppingBag className="h-3.5 w-3.5 text-ink-400" /> Pesanan Toko
                </p>
                <p className="mt-1 font-mono text-xl font-bold text-ink">
                  {totalOrders.toLocaleString("id-ID")}
                </p>
                <p className="mt-0.5 text-2xs text-ink-500">Tercatat di sistem</p>
              </div>
              <div className="rounded border border-ink-200 bg-white p-3.5">
                <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
                  <BookOpen className="h-3.5 w-3.5 text-ink-400" /> Dokumen AI
                </p>
                <p className="mt-1 font-mono text-xl font-bold text-ink">
                  {totalDocs.toLocaleString("id-ID")}
                </p>
                <p className="mt-0.5 text-2xs text-ink-500">Basis pengetahuan</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented
                label="Filter status tenant"
                items={[
                  { id: "all" as TenantFilter, label: "Semua", count: data.tenants.length },
                  {
                    id: "ACTIVE" as TenantFilter,
                    label: "ACTIVE",
                    count: data.tenants.filter((t) => t.status === "ACTIVE").length,
                  },
                  {
                    id: "TRIAL" as TenantFilter,
                    label: "TRIAL",
                    count: data.tenants.filter((t) => t.status === "TRIAL").length,
                  },
                  {
                    id: "SUSPENDED" as TenantFilter,
                    label: "SUSPENDED",
                    count: data.tenants.filter((t) => t.status === "SUSPENDED").length,
                  },
                ]}
                value={tenantFilter}
                onChange={setTenantFilter}
              />

              <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  placeholder="Cari toko, email, atau WA..."
                  value={tenantQuery}
                  onChange={(e) => setTenantQuery(e.target.value)}
                  className="w-full rounded border border-ink-300 bg-white py-1.5 pl-8 pr-8 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
                />
                {tenantQuery && (
                  <button
                    type="button"
                    onClick={() => setTenantQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {data.tenants.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Table2 className="h-5 w-5" aria-hidden="true" />}
                  title="Belum ada tenant terdaftar"
                  description="Tenant muncul setelah ada toko yang menyelesaikan pendaftaran."
                />
              </Card>
            ) : filteredTenants.length === 0 ? (
              <Card>
                <EmptyState
                  title="Tidak ada tenant yang cocok"
                  description={
                    tenantQuery
                      ? `Tidak ditemukan toko dengan kata kunci "${tenantQuery}".`
                      : `Tidak ada tenant berstatus ${tenantFilter}.`
                  }
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setTenantFilter("all");
                        setTenantQuery("");
                      }}
                    >
                      Reset filter & pencarian
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTenants.map((t) => (
                  <Card key={t.id}>
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-ink">{t.business_name}</p>
                          <Badge
                            tone={
                              t.status === "ACTIVE"
                                ? "signal"
                                : t.status === "SUSPENDED"
                                  ? "danger"
                                  : "warn"
                            }
                          >
                            {t.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-ink-600">{t.email}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-2xs text-ink-500">
                          <span>WA {t.owner_whatsapp}</span>
                          <span>{t.conversations} percakapan</span>
                          <span>{t.orders} pesanan</span>
                          <span>{t.knowledge_docs ?? 0} dokumen AI</span>
                          <span>trial s.d. {ts(t.trial_expires_at)}</span>
                        </p>
                        {t.sheet && (
                          <p className="mt-0.5 truncate font-mono text-2xs text-ink-500">
                            Sheet sinkron {ts(t.sheet.last_synced_at)} &middot; asal {t.sheet.origin}
                          </p>
                        )}
                      </div>

                      <div className="text-right">
                        {t.subscription ? (
                          <>
                            <p className="font-mono text-sm font-bold tabular-nums text-ink">
                              Rp {rupiah(t.subscription.amount)}
                            </p>
                            <p className="mt-0.5 text-2xs text-ink-500">
                              {t.subscription.plan} &middot; {t.subscription.status}
                            </p>
                          </>
                        ) : (
                          <p className="text-2xs text-ink-500">belum berlangganan</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 px-5 py-3">
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busy}
                        onClick={() =>
                          act({ action: "extend_trial", tenant_id: t.id, days: 7 })
                        }
                      >
                        Perpanjang trial 7 hari
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busy}
                        disabled={t.status === "ACTIVE"}
                        onClick={() =>
                          act({ action: "tenant_status", tenant_id: t.id, status: "ACTIVE" })
                        }
                      >
                        Jadikan ACTIVE
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={busy}
                        disabled={t.status === "SUSPENDED"}
                        onClick={() =>
                          act(
                            { action: "tenant_status", tenant_id: t.id, status: "SUSPENDED" },
                            `Tangguhkan ${t.business_name}? Bot berhenti membalas sampai diaktifkan kembali.`
                          )
                        }
                      >
                        Suspend
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={busy}
                        onClick={() =>
                          act(
                            { action: "wipe_tenant", tenant_id: t.id, confirm: "HAPUS" },
                            `HAPUS PERMANEN ${t.business_name} beserta seluruh percakapan dan pesanan? Tindakan ini tidak bisa dibatalkan.`
                          )
                        }
                      >
                        Hapus permanen
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* -------------------------------------------------------- WEBHOOKS */}
        {tab === "webhooks" && (
          <>
            <PageHeader
              eyebrow="Idempotensi"
              title="Ledger webhook"
              description="Setiap webhook masuk dicatat sebelum diproses. Kiriman ulang dari provider ditolak unique constraint, sehingga langganan tidak pernah diperpanjang dua kali."
              icon={<Webhook className="h-4 w-4" aria-hidden="true" />}
            />

            {data.webhooks.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<Webhook className="h-5 w-5" aria-hidden="true" />}
                  title="Belum ada webhook tercatat"
                  description="Baris muncul begitu penyedia pembayaran mengirim notifikasi pertama."
                />
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="border-b border-ink-200 bg-ink-50">
                      <tr className="text-2xs uppercase tracking-wide text-ink-500">
                        <th className="px-4 py-2.5 font-semibold">Provider</th>
                        <th className="px-4 py-2.5 font-semibold">Event key</th>
                        <th className="px-4 py-2.5 font-semibold">Tipe</th>
                        <th className="px-4 py-2.5 font-semibold">Diproses</th>
                        <th className="px-4 py-2.5 font-semibold">Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-200">
                      {data.webhooks.map((w) => (
                        <tr key={w.id} className="hover:bg-ink-50">
                          <td className="px-4 py-3 font-mono text-xs text-ink">{w.provider}</td>
                          <td className="px-4 py-3 font-mono text-xs text-ink">{w.event_key}</td>
                          <td className="px-4 py-3 text-xs text-ink-600">{w.event_type ?? "-"}</td>
                          <td className="px-4 py-3">
                            <Badge tone={w.processed ? "signal" : "neutral"}>
                              {w.processed ? "ya" : "belum"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-ink-500">
                            {ts(w.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
