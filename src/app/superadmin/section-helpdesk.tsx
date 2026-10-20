"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Lock,
  MessageSquare,
  Phone,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  User,
  ExternalLink,
  ChevronRight,
  Headphones,
  CheckCheck,
} from "lucide-react";
import { Badge, Button, StatusDot, cn } from "@/components/ui";

export interface LiveChatSessionSummary {
  id: string;
  status: string;
  tenant: {
    id: string;
    business_name: string;
    email: string;
    owner_name: string;
    owner_whatsapp: string;
    status: string;
  };
  unread_count: number;
  last_message_at: string;
  last_message: {
    id: string;
    sender_type: string;
    sender_name: string;
    message: string;
    created_at: string;
  } | null;
}

export interface LiveChatMessageItem {
  id: string;
  sender_type: "TENANT" | "SUPERADMIN" | "SYSTEM";
  sender_name: string;
  message: string;
  read_by_superadmin: boolean;
  read_by_tenant: boolean;
  created_at: string;
}

export interface SuperadminTicket {
  id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  tenant: {
    id: string;
    business_name: string;
    email: string;
    owner_whatsapp: string;
    status: string;
  };
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  last_message: {
    sender_type: string;
    sender_name: string;
    message: string;
    is_internal: boolean;
    created_at: string;
  } | null;
}

export interface TicketMessage {
  id: string;
  sender_type: "TENANT" | "SUPERADMIN" | "SYSTEM";
  sender_name: string;
  message: string;
  attachments: unknown[];
  is_internal: boolean;
  created_at: string;
}

export interface SuperadminTicketDetail extends SuperadminTicket {
  messages: TicketMessage[];
}

export function SectionHelpdesk() {
  const [tickets, setTickets] = useState<SuperadminTicket[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    waiting_tenant: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<SuperadminTicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Mode tab: Tickets vs Live Chat
  const [activeTab, setActiveTab] = useState<"tickets" | "livechat">("tickets");

  // Live Chat state
  const [liveSessions, setLiveSessions] = useState<LiveChatSessionSummary[]>([]);
  const [liveTotalUnread, setLiveTotalUnread] = useState(0);
  const [liveLoading, setLiveLoading] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<{
    session: LiveChatSessionSummary;
    messages: LiveChatMessageItem[];
  } | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [liveReplyText, setLiveReplyText] = useState("");
  const [liveSending, setLiveSending] = useState(false);

  // Reply state
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [actionMsg, setActionMsg] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  async function loadLiveSessions(silent = false) {
    if (!silent) setLiveLoading(true);
    try {
      const res = await fetch("/api/superadmin/livechat");
      const json = await res.json();
      if (json.ok) {
        setLiveSessions(json.sessions || []);
        setLiveTotalUnread(json.total_unread || 0);
        if (!selectedSessionId && json.sessions && json.sessions.length > 0) {
          setSelectedSessionId(json.sessions[0].id);
        }
      }
    } catch {
      // Ignore
    } finally {
      if (!silent) setLiveLoading(false);
    }
  }

  async function loadSessionDetail(sessionId: string) {
    setSessionLoading(true);
    try {
      const res = await fetch(`/api/superadmin/livechat/${sessionId}`);
      const json = await res.json();
      if (json.ok) {
        setActiveSession({ session: json.session, messages: json.messages || [] });
        loadLiveSessions(true);
      }
    } catch {
      // Ignore
    } finally {
      setSessionLoading(false);
    }
  }

  async function handleSendLiveReply(e?: React.FormEvent) {
    e?.preventDefault();
    if (!selectedSessionId || !liveReplyText.trim() || liveSending) return;
    setLiveSending(true);
    const text = liveReplyText.trim();
    setLiveReplyText("");
    try {
      const res = await fetch(`/api/superadmin/livechat/${selectedSessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json();
      if (json.ok && json.message) {
        setActiveSession((prev) =>
          prev ? { ...prev, messages: [...prev.messages, json.message] } : null
        );
        loadLiveSessions(true);
      }
    } catch {
      // Ignore
    } finally {
      setLiveSending(false);
    }
  }

  async function loadTickets() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter !== "ALL") q.set("status", statusFilter);
      if (priorityFilter !== "ALL") q.set("priority", priorityFilter);
      if (categoryFilter !== "ALL") q.set("category", categoryFilter);
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`/api/superadmin/tickets?${q.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setTickets(json.tickets || []);
        if (json.stats) setStats(json.stats);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/superadmin/tickets/${id}`);
      const json = await res.json();
      if (json.ok) {
        setActiveTicket(json.ticket);
      }
    } catch {
      // Ignore
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, [statusFilter, priorityFilter, categoryFilter]);

  useEffect(() => {
    if (selectedTicketId) {
      loadDetail(selectedTicketId);
    } else {
      setActiveTicket(null);
    }
  }, [selectedTicketId]);

  useEffect(() => {
    loadLiveSessions(true);

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/realtime?scope=admin");
      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === "support_chat" || payload.type === "ticket" || payload.type === "reload") {
            loadLiveSessions(true);
            if (selectedSessionId) {
              loadSessionDetail(selectedSessionId);
            }
            if (activeTab === "tickets") {
              loadTickets();
            }
          }
        } catch {
          // Ignore
        }
      };
    } catch {
      // Fallback
    }

    return () => {
      eventSource?.close();
    };
  }, [selectedSessionId, activeTab]);

  useEffect(() => {
    if (selectedSessionId) {
      loadSessionDetail(selectedSessionId);
    } else {
      setActiveSession(null);
    }
  }, [selectedSessionId]);

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;
    setSending(true);
    setActionMsg(null);
    try {
      const res = await fetch(`/api/superadmin/tickets/${activeTicket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: replyText.trim(),
          is_internal: isInternalNote,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setReplyText("");
        setActionMsg({
          text: isInternalNote ? "Catatan internal berhasil disimpan." : "Balasan publik terkirim ke pemilik toko.",
          tone: "success",
        });
        await loadDetail(activeTicket.id);
        await loadTickets();
      } else {
        setActionMsg({ text: json.error || "Gagal mengirim balasan", tone: "error" });
      }
    } catch {
      setActionMsg({ text: "Koneksi ke server gagal", tone: "error" });
    } finally {
      setSending(false);
    }
  }

  async function handleUpdateStatus(newStatus: string) {
    if (!activeTicket) return;
    try {
      const res = await fetch(`/api/superadmin/tickets/${activeTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.ok) {
        await loadDetail(activeTicket.id);
        await loadTickets();
      }
    } catch {
      // Ignore
    }
  }

  async function handleUpdatePriority(newPriority: string) {
    if (!activeTicket) return;
    try {
      const res = await fetch(`/api/superadmin/tickets/${activeTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: newPriority }),
      });
      const json = await res.json();
      if (json.ok) {
        await loadDetail(activeTicket.id);
        await loadTickets();
      }
    } catch {
      // Ignore
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "OPEN":
        return <Badge tone="signal"><StatusDot ok /> Terbuka</Badge>;
      case "IN_PROGRESS":
        return <Badge tone="neutral" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1" /> Diproses</Badge>;
      case "WAITING_TENANT":
        return <Badge tone="warn"><AlertCircle className="h-3 w-3 mr-1" /> Menunggu Toko</Badge>;
      case "RESOLVED":
        return <Badge tone="neutral" className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Selesai</Badge>;
      case "CLOSED":
        return <Badge tone="neutral">Ditutup</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  }

  function getPriorityBadge(priority: string) {
    switch (priority) {
      case "URGENT":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Mendesak</span>;
      case "HIGH":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">Tinggi</span>;
      case "MEDIUM":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">Sedang</span>;
      case "LOW":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">Rendah</span>;
      default:
        return <span className="text-xs text-ink-500">{priority}</span>;
    }
  }

  return (
    <div className="space-y-5">
      {/* Top Header Mode Switcher: Tiket vs Live Chat */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 pb-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("tickets")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px]",
              activeTab === "tickets"
                ? "bg-ink-900 text-white shadow-sm"
                : "bg-surface-sunken text-ink-600 hover:text-ink-900 hover:bg-ink-100"
            )}
          >
            <LifeBuoy className="h-4 w-4" />
            <span>Tiket Bantuan & Antrean SLA</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-ink-800 text-ink-200">
              {stats.open + stats.in_progress}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("livechat")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all min-h-[40px] relative",
              activeTab === "livechat"
                ? "bg-emerald-700 text-white shadow-sm"
                : "bg-surface-sunken text-ink-600 hover:text-ink-900 hover:bg-ink-100"
            )}
          >
            <Headphones className="h-4 w-4" />
            <span>Live Chat Support (Real-Time)</span>
            {liveTotalUnread > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 animate-pulse">
                {liveTotalUnread} Baru
              </span>
            ) : (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            )}
          </button>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (activeTab === "tickets") loadTickets();
            else loadLiveSessions();
          }}
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", (loading || liveLoading) && "animate-spin")} />
          Segarkan
        </Button>
      </div>

      {activeTab === "tickets" && (
        <>
          {/* Top Overview KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">Total Tiket</span>
          <p className="mt-1 text-2xl font-bold text-ink-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
          <span className="text-2xs font-semibold uppercase tracking-wider text-emerald-800">Terbuka (Baru)</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.open}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm">
          <span className="text-2xs font-semibold uppercase tracking-wider text-blue-800">Sedang Ditangani</span>
          <p className="mt-1 text-2xl font-bold text-blue-700">{stats.in_progress}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <span className="text-2xs font-semibold uppercase tracking-wider text-amber-800">Menunggu Klien</span>
          <p className="mt-1 text-2xl font-bold text-amber-700">{stats.waiting_tenant}</p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <span className="text-2xs font-semibold uppercase tracking-wider text-ink-500">Selesai / Closed</span>
          <p className="mt-1 text-2xl font-bold text-ink-700">{stats.resolved}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status buttons */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {["ALL", "OPEN", "IN_PROGRESS", "WAITING_TENANT", "RESOLVED"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                  statusFilter === st
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-surface-sunken hover:text-ink-900"
                )}
              >
                {st === "ALL" ? "Semua" : st === "OPEN" ? "Terbuka" : st === "IN_PROGRESS" ? "Diproses" : st === "WAITING_TENANT" ? "Menunggu Toko" : "Selesai"}
              </button>
            ))}
          </div>

          {/* Priority dropdown */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:border-ink-900 focus:outline-none bg-white text-ink-700 font-medium"
          >
            <option value="ALL">Semua Prioritas</option>
            <option value="URGENT">Mendesak</option>
            <option value="HIGH">Tinggi</option>
            <option value="MEDIUM">Sedang</option>
            <option value="LOW">Rendah</option>
          </select>

          {/* Category dropdown */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs focus:border-ink-900 focus:outline-none bg-white text-ink-700 font-medium"
          >
            <option value="ALL">Semua Kategori</option>
            <option value="TECHNICAL">Teknis / Bug</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="BILLING">Billing / Paket</option>
            <option value="FEATURE_REQUEST">Fitur Baru</option>
            <option value="GENERAL">Umum</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-400" />
            <input
              type="text"
              placeholder="Cari tiket, toko, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadTickets()}
              className="rounded-lg border border-ink-200 pl-8 pr-3 py-1.5 text-xs focus:border-ink-900 focus:outline-none w-52"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadTickets}
            aria-label="Muat ulang"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Two-Column Helpdesk Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Tickets Queue (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-ink-200 bg-white shadow-sm overflow-hidden divide-y divide-ink-100 max-h-[750px] overflow-y-auto">
          {loading ? (
            <div className="py-16 text-center text-xs text-ink-500">Memuat antrean tiket platform...</div>
          ) : tickets.length === 0 ? (
            <div className="py-16 text-center text-ink-500">
              <LifeBuoy className="h-8 w-8 text-ink-300 mx-auto mb-2" />
              <p className="text-xs font-semibold">Tidak ada tiket yang cocok dengan filter.</p>
            </div>
          ) : (
            tickets.map((t) => {
              const isSelected = t.id === selectedTicketId;
              return (
                <button
                  key={t.id}
                  onClick={() => setSelectedTicketId(t.id)}
                  type="button"
                  className={cn(
                    "w-full text-left p-4 transition-colors flex items-start justify-between gap-3",
                    isSelected ? "bg-ink-50/90 border-l-4 border-l-ink-900" : "hover:bg-surface-sunken/60"
                  )}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-ink-500">{t.ticket_number}</span>
                      {getStatusBadge(t.status)}
                      {getPriorityBadge(t.priority)}
                    </div>
                    <h4 className="text-xs font-bold text-ink-900 truncate">{t.subject}</h4>
                    <p className="text-2xs text-ink-600 font-medium">
                      Toko: <span className="text-ink-900 font-semibold">{t.tenant.business_name}</span> ({t.tenant.owner_whatsapp})
                    </p>
                    {t.last_message && (
                      <p className="text-[11px] text-ink-500 line-clamp-1 italic">
                        {t.last_message.is_internal && <Lock className="inline h-2.5 w-2.5 text-amber-600 mr-1" />}
                        {t.last_message.sender_name}: {t.last_message.message}
                      </p>
                    )}
                    <span className="text-[10px] text-ink-400 block pt-0.5">
                      {new Date(t.updated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-ink-400 shrink-0 mt-2" />
                </button>
              );
            })
          )}
        </div>

        {/* Right Column: Ticket Workspace (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-ink-200 bg-white shadow-sm overflow-hidden">
          {!selectedTicketId || !activeTicket ? (
            <div className="py-32 text-center text-ink-500 px-6">
              <LifeBuoy className="h-12 w-12 text-ink-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-ink-900">Pilih Tiket untuk Mengelola</h4>
              <p className="text-xs text-ink-500 mt-1 max-w-sm mx-auto">
                Klik salah satu tiket dari antrean di sebelah kiri untuk melihat riwayat percakapan, mengubah status, atau membalas klien.
              </p>
            </div>
          ) : (
            <div>
              {/* Workspace Header & Action Controls */}
              <div className="border-b border-ink-100 bg-surface-sunken/40 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-ink-500">{activeTicket.ticket_number}</span>
                      {getStatusBadge(activeTicket.status)}
                      {getPriorityBadge(activeTicket.priority)}
                      <span className="text-2xs text-ink-400">· {activeTicket.category}</span>
                    </div>
                    <h3 className="text-base font-bold text-ink-900 mt-1">{activeTicket.subject}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <a
                      href={`https://wa.me/${activeTicket.tenant.owner_whatsapp.replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink-200 bg-white text-ink-700 hover:text-ink-900 shadow-xs font-semibold"
                    >
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      Chat WhatsApp Toko
                      <ExternalLink className="h-3 w-3 text-ink-400" />
                    </a>
                  </div>
                </div>

                {/* Status & Priority Controls Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-ink-200/50 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-600 text-2xs uppercase tracking-wider">Status:</span>
                    <select
                      value={activeTicket.status}
                      onChange={(e) => handleUpdateStatus(e.target.value)}
                      className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-bold focus:border-ink-900 focus:outline-none"
                    >
                      <option value="OPEN">Terbuka (Open)</option>
                      <option value="IN_PROGRESS">Sedang Ditangani (In Progress)</option>
                      <option value="WAITING_TENANT">Menunggu Respon Klien (Waiting)</option>
                      <option value="RESOLVED">Selesai (Resolved)</option>
                      <option value="CLOSED">Tutup Permanen (Closed)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-600 text-2xs uppercase tracking-wider">Prioritas:</span>
                    <select
                      value={activeTicket.priority}
                      onChange={(e) => handleUpdatePriority(e.target.value)}
                      className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-bold focus:border-ink-900 focus:outline-none"
                    >
                      <option value="LOW">Rendah</option>
                      <option value="MEDIUM">Sedang</option>
                      <option value="HIGH">Tinggi</option>
                      <option value="URGENT">Mendesak</option>
                    </select>
                  </div>

                  <div className="text-2xs text-ink-500">
                    Klien: <span className="font-semibold text-ink-800">{activeTicket.tenant.business_name}</span> ({activeTicket.tenant.email})
                  </div>
                </div>
              </div>

              {/* Message History Thread */}
              <div className="p-5 space-y-3.5 max-h-[420px] overflow-y-auto">
                {detailLoading ? (
                  <div className="py-12 text-center text-xs text-ink-500">Memuat rincian percakapan...</div>
                ) : (
                  activeTicket.messages.map((m) => {
                    const isSuperadmin = m.sender_type === "SUPERADMIN";
                    const isSystem = m.sender_type === "SYSTEM";

                    if (isSystem) {
                      return (
                        <div key={m.id} className="flex justify-center my-1.5">
                          <span className="text-2xs bg-ink-100 text-ink-600 px-3 py-1 rounded-full font-medium">
                            {m.message}
                          </span>
                        </div>
                      );
                    }

                    if (m.is_internal) {
                      return (
                        <div
                          key={m.id}
                          className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 space-y-1 shadow-2xs"
                        >
                          <div className="flex items-center justify-between text-amber-800 text-2xs font-semibold">
                            <span className="flex items-center gap-1">
                              <Lock className="h-3 w-3 text-amber-600" />
                              Catatan Internal Staf ({m.sender_name})
                            </span>
                            <span>{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="whitespace-pre-wrap leading-relaxed">{m.message}</p>
                          <span className="text-[10px] text-amber-700/80 italic block">
                            *Catatan ini hanya terlihat oleh Superadmin & tim support internal.
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "flex flex-col max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed",
                          isSuperadmin
                            ? "ml-auto bg-ink-900 text-white rounded-br-none"
                            : "mr-auto bg-surface-sunken border border-ink-200 text-ink-900 rounded-bl-none"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3 text-2xs opacity-75 mb-1">
                          <span className="font-semibold flex items-center gap-1">
                            {isSuperadmin ? (
                              <ShieldCheck className="h-3 w-3 text-emerald-400 inline" />
                            ) : (
                              <User className="h-3 w-3 text-ink-500 inline" />
                            )}
                            {m.sender_name}
                          </span>
                          <span>{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{m.message}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Action Message Feedback */}
              {actionMsg && (
                <div
                  className={cn(
                    "mx-5 mb-2 rounded-lg p-2 text-2xs flex items-center gap-1.5",
                    actionMsg.tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                  )}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  {actionMsg.text}
                </div>
              )}

              {/* Reply / Internal Note Form */}
              <div className="border-t border-ink-100 bg-surface-sunken/20 p-4">
                <form onSubmit={handleSendReply} className="space-y-3">
                  <div className="flex items-center justify-between">
                    {/* Toggle: Public Reply vs Internal Note */}
                    <div className="flex items-center gap-1.5 bg-ink-100/70 p-1 rounded-lg text-2xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setIsInternalNote(false)}
                        className={cn(
                          "px-2.5 py-1 rounded-md transition-colors flex items-center gap-1",
                          !isInternalNote ? "bg-white text-ink-900 shadow-2xs" : "text-ink-600 hover:text-ink-900"
                        )}
                      >
                        <MessageSquare className="h-3 w-3 text-emerald-600" />
                        Balasan Publik ke Klien
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsInternalNote(true)}
                        className={cn(
                          "px-2.5 py-1 rounded-md transition-colors flex items-center gap-1",
                          isInternalNote ? "bg-white text-amber-900 shadow-2xs" : "text-ink-600 hover:text-ink-900"
                        )}
                      >
                        <Lock className="h-3 w-3 text-amber-600" />
                        Catatan Internal Staf
                      </button>
                    </div>

                    <span className="text-[11px] text-ink-500">
                      {isInternalNote ? "Tersimpan untuk staf internal" : "Klien akan menerima notifikasi real-time"}
                    </span>
                  </div>

                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      isInternalNote
                        ? "Tulis catatan investigasi teknis atau instruksi koordinasi tim support..."
                        : "Ketik pesan balasan resmi untuk pemilik toko..."
                    }
                    rows={3}
                    className={cn(
                      "w-full resize-none rounded-xl border p-3 text-xs focus:outline-none",
                      isInternalNote
                        ? "border-amber-300 bg-amber-50/30 focus:border-amber-600"
                        : "border-ink-200 bg-white focus:border-ink-900"
                    )}
                  />

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={sending || !replyText.trim()}
                      className={isInternalNote ? "bg-amber-800 hover:bg-amber-900" : ""}
                    >
                      <Send className="h-3.5 w-3.5 mr-1" />
                      {sending ? "Menyimpan..." : isInternalNote ? "Simpan Catatan Internal" : "Kirim Balasan"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* Live Chat Support Workspace */}
      {activeTab === "livechat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[620px]">
          {/* Left Column: Sesi Chat Toko */}
          <div className="lg:col-span-4 rounded-2xl border border-ink-200 bg-white flex flex-col shadow-sm overflow-hidden h-[620px]">
            <div className="p-3.5 border-b border-ink-100 bg-surface-sunken/40 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-ink-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Headphones className="h-3.5 w-3.5 text-emerald-600" />
                  Sesi Chat Toko
                </h3>
                <p className="text-[11px] text-ink-500">
                  {liveSessions.length} toko terhubung
                </p>
              </div>
              {liveTotalUnread > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                  {liveTotalUnread} belum dibaca
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-ink-100">
              {liveLoading && liveSessions.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-400">
                  Memuat sesi obrolan...
                </div>
              ) : liveSessions.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-400">
                  Belum ada sesi live chat dari merchant.
                </div>
              ) : (
                liveSessions.map((s) => {
                  const isSelected = selectedSessionId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSessionId(s.id)}
                      className={cn(
                        "w-full text-left p-3.5 transition-colors flex items-start gap-3",
                        isSelected
                          ? "bg-emerald-50/70 border-l-4 border-l-emerald-600"
                          : "hover:bg-surface-sunken"
                      )}
                    >
                      <div className="h-9 w-9 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                        {s.tenant.business_name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-ink-900 truncate">
                            {s.tenant.business_name}
                          </span>
                          <span className="text-[10px] text-ink-400 whitespace-nowrap">
                            {new Date(s.last_message_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-500 truncate mt-0.5">
                          {s.last_message?.message || "Sesi dimulai..."}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] text-ink-400 truncate">
                            {s.tenant.owner_name}
                          </span>
                          {s.unread_count > 0 && (
                            <span className="ml-auto inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-slate-950 rounded-full shrink-0">
                              {s.unread_count} baru
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Chat Stream & Reply Box */}
          <div className="lg:col-span-8 rounded-2xl border border-ink-200 bg-white flex flex-col shadow-sm overflow-hidden h-[620px]">
            {activeSession ? (
              <>
                {/* Header info */}
                <div className="p-4 border-b border-ink-200 bg-surface-sunken/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
                      {activeSession.session.tenant.business_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-ink-900">
                          {activeSession.session.tenant.business_name}
                        </h3>
                        <Badge tone="signal"><StatusDot ok /> Live</Badge>
                      </div>
                      <p className="text-xs text-ink-500">
                        Owner: {activeSession.session.tenant.owner_name} • {activeSession.session.tenant.email}
                      </p>
                    </div>
                  </div>

                  {activeSession.session.tenant.owner_whatsapp && (
                    <a
                      href={`https://wa.me/${activeSession.session.tenant.owner_whatsapp.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 text-emerald-600" />
                      Chat WhatsApp Toko
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* Message list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 text-xs">
                  {sessionLoading ? (
                    <div className="flex items-center justify-center h-full text-ink-400">
                      Memuat pesan...
                    </div>
                  ) : (
                    activeSession.messages.map((m) => {
                      const isStaff = m.sender_type === "SUPERADMIN";
                      const isSystem = m.sender_type === "SYSTEM";

                      if (isSystem) {
                        return (
                          <div key={m.id} className="text-center my-2">
                            <span className="inline-block px-3 py-1 bg-slate-200/80 text-slate-700 text-[11px] rounded-full border border-slate-300/60 max-w-[85%]">
                              {m.message}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={m.id}
                          className={cn("flex flex-col", isStaff ? "items-end" : "items-start")}
                        >
                          <span className="text-[10px] text-ink-400 mb-0.5 px-1 font-medium">
                            {isStaff ? "Anda (Tim Support Noewbar)" : m.sender_name}
                          </span>
                          <div
                            className={cn(
                              "max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed break-words shadow-sm",
                              isStaff
                                ? "bg-slate-900 text-white rounded-tr-none"
                                : "bg-white text-slate-900 border border-slate-200 rounded-tl-none"
                            )}
                          >
                            {m.message}
                          </div>
                          <span className="text-[10px] text-ink-400 mt-1 px-1 flex items-center gap-1">
                            {new Date(m.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {isStaff && (
                              <CheckCheck
                                className={cn(
                                  "h-3 w-3",
                                  m.read_by_tenant ? "text-emerald-600" : "text-ink-400"
                                )}
                              />
                            )}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Form */}
                <form
                  onSubmit={handleSendLiveReply}
                  className="p-3 border-t border-ink-200 bg-white"
                >
                  <div className="flex items-end gap-2">
                    <textarea
                      rows={2}
                      value={liveReplyText}
                      onChange={(e) => setLiveReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendLiveReply();
                        }
                      }}
                      placeholder="Balas chat merchant ini secara langsung... (Enter untuk kirim)"
                      className="flex-1 p-2.5 text-xs border border-ink-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none bg-slate-50 focus:bg-white"
                      disabled={liveSending}
                    />
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!liveReplyText.trim() || liveSending}
                      className="h-10 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs"
                    >
                      <Send className="h-4 w-4 mr-1" />
                      {liveSending ? "Kirim..." : "Kirim"}
                    </Button>
                  </div>
                  <div className="text-[11px] text-ink-400 mt-1.5 flex items-center justify-between px-1">
                    <span>Shift+Enter untuk baris baru</span>
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <StatusDot ok /> Pesan terkirim instan via SSE ke widget toko
                    </span>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-ink-400">
                <Headphones className="h-12 w-12 text-ink-300 mb-3" />
                <h4 className="font-bold text-sm text-ink-700">Pilih Percakapan Toko</h4>
                <p className="text-xs text-ink-500 max-w-sm mt-1">
                  Pilih salah satu sesi obrolan merchant di kolom kiri untuk melihat riwayat dan membalas chat secara langsung.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
