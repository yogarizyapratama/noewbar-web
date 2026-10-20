"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LifeBuoy,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Headphones,
  Search,
} from "lucide-react";
import { Badge, Button, StatusDot, cn } from "@/components/ui";

export type TicketCategory = "GENERAL" | "BILLING" | "TECHNICAL" | "WHATSAPP" | "FEATURE_REQUEST";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_TENANT" | "RESOLVED" | "CLOSED";

export interface TicketSummary {
  id: string;
  ticket_number: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  last_message: {
    sender_type: string;
    sender_name: string;
    message: string;
    created_at: string;
  } | null;
}

export interface TicketMessage {
  id: string;
  sender_type: "TENANT" | "SUPERADMIN" | "SYSTEM";
  sender_name: string;
  message: string;
  attachments: unknown[];
  created_at: string;
}

export interface TicketDetail extends TicketSummary {
  messages: TicketMessage[];
}

const FAQS = [
  {
    q: "WhatsApp Tiba-tiba Putus atau Status Reconnecting?",
    a: "Buka menu 'Koneksi WhatsApp' di sidebar, klik tombol Disconnect bila sesi menggantung, lalu lakukan scan ulang kode QR melalui aplikasi WhatsApp di ponsel toko Anda.",
  },
  {
    q: "Pembayaran Langganan Berhasil tapi Akun Masih Trial?",
    a: "Sistem Midtrans memproses verifikasi otomatis dalam 1-3 menit. Anda dapat menekan tombol 'Cek Pembayaran' di menu Langganan untuk rekonsiliasi seketika, atau buat tiket Billing bila membutuhkan bantuan invoice khusus.",
  },
  {
    q: "Katalog Google Sheets Tidak Terupdate di AI?",
    a: "Pastikan akses spreadsheet disetel ke 'Siapa saja yang memiliki link dapat melihat' (Viewer), lalu klik tombol 'Sinkronkan Sekarang' di menu Basis Dokumen & Sheets.",
  },
  {
    q: "AI Chatbot Tidak Merespons Pesan Masuk?",
    a: "Periksa saklar 'Auto-Reply' di menu Basis Dokumen & Sheets. Pastikan juga percakapan pelanggan tidak sedang dalam mode 'Human Takeover' aktif di menu Live Chat.",
  },
  {
    q: "Format Berkas Apa Saja yang Didukung Basis Dokumen?",
    a: "Noewbar mendukung unggahan dokumen berupa PDF, DOCX (Word), TXT, Markdown (MD), dan CSV dengan batas ukuran hingga 10 MB per berkas.",
  },
];

export function PanelHelpdesk() {
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, in_progress: 0, resolved: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // New ticket modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newCategory, setNewCategory] = useState<TicketCategory>("TECHNICAL");
  const [newPriority, setNewPriority] = useState<TicketPriority>("MEDIUM");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Reply
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  async function loadTickets() {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (statusFilter !== "ALL") q.set("status", statusFilter);
      if (search.trim()) q.set("search", search.trim());
      const res = await fetch(`/api/support/tickets?${q.toString()}`);
      const json = await res.json();
      if (json.ok) {
        setTickets(json.tickets || []);
        if (json.stats) setStats(json.stats);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }

  async function loadTicketDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/support/tickets/${id}`);
      const json = await res.json();
      if (json.ok) {
        setActiveTicket(json.ticket);
      }
    } catch {
      // Graceful fallback
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, [statusFilter]);

  useEffect(() => {
    if (selectedTicketId) {
      loadTicketDetail(selectedTicketId);
    } else {
      setActiveTicket(null);
    }
  }, [selectedTicketId]);

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!newSubject.trim() || !newMessage.trim()) {
      setCreateError("Subjek dan penjelasan kendala wajib diisi.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: newSubject.trim(),
          category: newCategory,
          priority: newPriority,
          message: newMessage.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setIsModalOpen(false);
        setNewSubject("");
        setNewMessage("");
        setNewCategory("TECHNICAL");
        setNewPriority("MEDIUM");
        await loadTickets();
        if (json.ticket?.id) {
          setSelectedTicketId(json.ticket.id);
        }
      } else {
        setCreateError(json.error || "Gagal membuat tiket bantuan");
      }
    } catch {
      setCreateError("Gagal menghubungi server support, silakan coba beberapa saat lagi.");
    } finally {
      setCreating(false);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTicket || !replyText.trim()) return;
    setSendingReply(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/support/tickets/${activeTicket.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const json = await res.json();
      if (json.ok) {
        setReplyText("");
        await loadTicketDetail(activeTicket.id);
        await loadTickets();
      } else {
        setReplyError(json.error || "Gagal mengirim balasan");
      }
    } catch {
      setReplyError("Gagal mengirim balasan ke server");
    } finally {
      setSendingReply(false);
    }
  }

  async function handleResolveTicket() {
    if (!activeTicket) return;
    if (!confirm("Tandai tiket ini sebagai selesai? Tiket dapat dibuka kembali kapan saja bila Anda membalasnya.")) return;
    try {
      const res = await fetch(`/api/support/tickets/${activeTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });
      const json = await res.json();
      if (json.ok) {
        await loadTicketDetail(activeTicket.id);
        await loadTickets();
      }
    } catch {
      // Graceful fallback
    }
  }

  function getStatusBadge(status: TicketStatus) {
    switch (status) {
      case "OPEN":
        return <Badge tone="signal"><StatusDot ok /> Terbuka</Badge>;
      case "IN_PROGRESS":
        return <Badge tone="neutral" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="h-3 w-3 mr-1" /> Diproses</Badge>;
      case "WAITING_TENANT":
        return <Badge tone="warn"><AlertCircle className="h-3 w-3 mr-1" /> Perlu Respon Anda</Badge>;
      case "RESOLVED":
        return <Badge tone="neutral" className="bg-emerald-50 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Selesai</Badge>;
      case "CLOSED":
        return <Badge tone="neutral">Ditutup</Badge>;
      default:
        return <Badge tone="neutral">{status}</Badge>;
    }
  }

  function getPriorityBadge(priority: TicketPriority) {
    switch (priority) {
      case "URGENT":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">Mendesak</span>;
      case "HIGH":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">Tinggi</span>;
      case "MEDIUM":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">Sedang</span>;
      case "LOW":
        return <span className="inline-flex items-center px-2 py-0.5 rounded-md text-2xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">Rendah</span>;
    }
  }

  function getCategoryLabel(cat: TicketCategory) {
    switch (cat) {
      case "WHATSAPP":
        return "Integrasi WhatsApp";
      case "BILLING":
        return "Pembayaran & Paket";
      case "TECHNICAL":
        return "Kendala Teknis / Bug";
      case "FEATURE_REQUEST":
        return "Saran Fitur Baru";
      default:
        return "Bantuan Umum";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-ink-200/90 bg-white p-6 shadow-xs transition-shadow">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white shadow-xs">
                <LifeBuoy className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
                  Pusat Bantuan & Layanan Dukungan
                </h2>
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-2.5 py-0.5 text-2xs font-semibold text-emerald-800">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                    </span>
                    Tim Support Online (08:00 - 22:00 WIB)
                  </span>
                  <span className="text-2xs text-ink-400 hidden sm:inline">· Respons rata-rata &lt; 30 menit</span>
                </div>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-ink-600 leading-relaxed pt-1 max-w-2xl">
              Kirimkan pertanyaan, kendala teknis bot WhatsApp, sinkronisasi katalog, atau tagihan langsung ke Tim Rekayasa Noewbar.
            </p>
          </div>

          {/* Action Buttons in Single Row */}
          <div className="flex shrink-0 items-center gap-2.5 self-start lg:self-center">
            <Button
              variant="secondary"
              onClick={loadTickets}
              disabled={loading}
              className="border-ink-200 text-ink-700 hover:bg-ink-50 shadow-xs"
              aria-label="Muat ulang tiket"
            >
              <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
              Segarkan
            </Button>
            <Button
              variant="primary"
              onClick={() => setIsModalOpen(true)}
              className="shadow-xs font-semibold"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Buat Tiket Bantuan
            </Button>
          </div>
        </div>
      </div>

      {/* Interactive KPI Stat Cards (Filterable on Click) */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        {/* Total */}
        <button
          type="button"
          onClick={() => setStatusFilter("ALL")}
          className={cn(
            "rounded-xl border p-4 text-left transition-all duration-150 bg-white shadow-xs group",
            statusFilter === "ALL"
              ? "border-ink-900 ring-2 ring-ink-900/10 shadow-sm"
              : "border-ink-200/80 hover:border-ink-300 hover:bg-ink-50/40"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-ink-500">Total Tiket</span>
            <div className="rounded-lg bg-ink-100 p-1.5 text-ink-600 group-hover:bg-ink-200/70 transition-colors">
              <LifeBuoy className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-ink-900 font-mono">{stats.total}</p>
          <p className="mt-1 text-2xs text-ink-500">Seluruh riwayat bantuan</p>
        </button>

        {/* Open */}
        <button
          type="button"
          onClick={() => setStatusFilter("OPEN")}
          className={cn(
            "rounded-xl border p-4 text-left transition-all duration-150 bg-white shadow-xs group",
            statusFilter === "OPEN"
              ? "border-amber-500 ring-2 ring-amber-500/20 shadow-sm bg-amber-50/30"
              : "border-ink-200/80 hover:border-amber-300 hover:bg-amber-50/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-amber-800">Tiket Terbuka</span>
            <div className="rounded-lg bg-amber-100 p-1.5 text-amber-700 group-hover:bg-amber-200/70 transition-colors">
              <AlertCircle className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-700 font-mono">{stats.open}</p>
          <p className="mt-1 text-2xs text-amber-700/80">Menunggu antrean respon</p>
        </button>

        {/* In Progress */}
        <button
          type="button"
          onClick={() => setStatusFilter("IN_PROGRESS")}
          className={cn(
            "rounded-xl border p-4 text-left transition-all duration-150 bg-white shadow-xs group",
            statusFilter === "IN_PROGRESS"
              ? "border-blue-500 ring-2 ring-blue-500/20 shadow-sm bg-blue-50/30"
              : "border-ink-200/80 hover:border-blue-300 hover:bg-blue-50/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-blue-800">Sedang Ditangani</span>
            <div className="rounded-lg bg-blue-100 p-1.5 text-blue-700 group-hover:bg-blue-200/70 transition-colors">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-blue-700 font-mono">{stats.in_progress}</p>
          <p className="mt-1 text-2xs text-blue-700/80">Dalam investigasi teknis</p>
        </button>

        {/* Resolved */}
        <button
          type="button"
          onClick={() => setStatusFilter("RESOLVED")}
          className={cn(
            "rounded-xl border p-4 text-left transition-all duration-150 bg-white shadow-xs group",
            statusFilter === "RESOLVED"
              ? "border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm bg-emerald-50/30"
              : "border-ink-200/80 hover:border-emerald-300 hover:bg-emerald-50/20"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-2xs font-bold uppercase tracking-wider text-emerald-800">Selesai Dituntaskan</span>
            <div className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700 group-hover:bg-emerald-200/70 transition-colors">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-700 font-mono">{stats.resolved}</p>
          <p className="mt-1 text-2xs text-emerald-700/80">Solusi berhasil diberikan</p>
        </button>
      </div>

      {/* Main Content Area */}
      {selectedTicketId && activeTicket ? (
        /* Ticket Thread View */
        <div className="rounded-2xl border border-ink-200/90 bg-white shadow-sm overflow-hidden">
          {/* Thread Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 bg-surface-sunken/40 px-6 py-4 gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedTicketId(null)}
                aria-label="Kembali ke daftar tiket"
                className="shrink-0"
              >
                <ArrowLeft className="h-4 w-4 mr-1.5" />
                Kembali
              </Button>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-ink-600 bg-ink-100 px-2 py-0.5 rounded border border-ink-200">
                    {activeTicket.ticket_number}
                  </span>
                  {getStatusBadge(activeTicket.status)}
                  {getPriorityBadge(activeTicket.priority)}
                  <span className="text-xs text-ink-500 font-medium">· {getCategoryLabel(activeTicket.category)}</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-ink-900 mt-1">{activeTicket.subject}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {activeTicket.status !== "RESOLVED" && activeTicket.status !== "CLOSED" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResolveTicket}
                  className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
                  Tandai Selesai
                </Button>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="p-6 space-y-4 max-h-[520px] overflow-y-auto bg-surface-sunken/20">
            {detailLoading ? (
              <div className="py-12 text-center text-sm text-ink-500">Memuat percakapan tiket...</div>
            ) : (
              activeTicket.messages.map((m) => {
                const isTenant = m.sender_type === "TENANT";
                const isSystem = m.sender_type === "SYSTEM";

                if (isSystem) {
                  return (
                    <div key={m.id} className="flex justify-center my-3">
                      <span className="text-2xs bg-ink-100/80 text-ink-600 px-3 py-1 rounded-full font-medium border border-ink-200/50">
                        {m.message}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-xs transition-shadow",
                      isTenant
                        ? "ml-auto bg-ink-900 text-white rounded-br-none"
                        : "mr-auto bg-white border border-ink-200/80 text-ink-900 rounded-bl-none"
                    )}
                  >
                    <div className="flex items-center justify-between gap-4 text-2xs opacity-80 mb-2">
                      <span className="font-semibold flex items-center gap-1.5">
                        {!isTenant ? (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 inline" />
                            <span className="text-emerald-800 font-bold">{m.sender_name} (Tim Support)</span>
                          </>
                        ) : (
                          <span>{m.sender_name} (Anda)</span>
                        )}
                      </span>
                      <span className="font-mono">{new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    <p className="whitespace-pre-wrap">{m.message}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Reply Form */}
          <div className="border-t border-ink-100 bg-white p-4 sm:p-6">
            {replyError && (
              <div className="mb-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-1.5 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {replyError}
              </div>
            )}
            <form onSubmit={handleSendReply} className="flex flex-col gap-3">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Tulis balasan Anda atau tambahkan informasi baru untuk tim teknisi kami..."
                rows={3}
                className="w-full resize-none rounded-xl border border-ink-200 p-3 text-sm focus:border-ink-900 focus:ring-1 focus:ring-ink-900 focus:outline-none"
              />
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <span className="text-2xs text-ink-500">
                  Respon tiket akan otomatis dikirimkan ke riwayat ini dan notifikasi toko Anda.
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={sendingReply || !replyText.trim()}
                  loading={sendingReply}
                  className="self-end font-semibold shadow-xs"
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  Kirim Balasan
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : (
        /* Ticket List + Self-Service FAQs */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Tickets List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-ink-200/90 bg-white p-2.5 shadow-xs">
              {/* Segmented Filter Buttons */}
              <div className="flex items-center gap-1 overflow-x-auto p-0.5">
                {[
                  { key: "ALL", label: "Semua", count: stats.total },
                  { key: "OPEN", label: "Terbuka", count: stats.open },
                  { key: "IN_PROGRESS", label: "Diproses", count: stats.in_progress },
                  { key: "RESOLVED", label: "Selesai", count: stats.resolved },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatusFilter(item.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5",
                      statusFilter === item.key
                        ? "bg-ink-900 text-white shadow-xs"
                        : "text-ink-600 hover:bg-ink-100/70 hover:text-ink-900"
                    )}
                  >
                    <span>{item.label}</span>
                    <span
                      className={cn(
                        "text-2xs px-1.5 py-0.2 rounded-full font-mono",
                        statusFilter === item.key
                          ? "bg-white/20 text-white"
                          : "bg-ink-100 text-ink-600"
                      )}
                    >
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search with Icon & Clear */}
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari nomor atau subjek..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadTickets()}
                  className="rounded-lg border border-ink-200 pl-8 pr-7 py-1.5 text-xs focus:border-ink-900 focus:ring-1 focus:ring-ink-900 focus:outline-none w-full sm:w-56"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      loadTickets();
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700 p-0.5"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>

            {/* List / Empty State */}
            <div className="rounded-2xl border border-ink-200/90 bg-white shadow-xs overflow-hidden divide-y divide-ink-100">
              {loading ? (
                <div className="py-16 text-center text-sm text-ink-500 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin text-ink-400" />
                  <span>Memuat daftar tiket bantuan...</span>
                </div>
              ) : tickets.length === 0 ? (
                /* Purposeful Empty State with Direct Action */
                <div className="py-16 px-6 text-center flex flex-col items-center justify-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-600 mb-3 shadow-xs">
                    <LifeBuoy className="h-7 w-7" />
                  </div>
                  <h4 className="text-base font-bold text-ink-900">Belum Ada Tiket Bantuan</h4>
                  <p className="text-xs text-ink-500 mt-1.5 max-w-sm leading-relaxed">
                    Jika Anda memiliki kendala teknis bot WhatsApp, sinkronisasi katalog produk, tagihan, atau butuh bantuan integrasi, ajukan tiket bantuan langsung.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => setIsModalOpen(true)}
                    className="mt-5 shadow-xs font-semibold"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Buat Tiket Bantuan Pertama
                  </Button>
                  <p className="mt-3 text-2xs text-ink-400">
                    Atau periksa solusi instan mandiri pada kolom sebelah kanan.
                  </p>
                </div>
              ) : (
                tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className="w-full text-left p-4 sm:p-5 hover:bg-surface-sunken/60 transition-colors flex items-start justify-between gap-3 group"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-2xs font-bold text-ink-600 bg-ink-100 px-2 py-0.5 rounded border border-ink-200">
                          {t.ticket_number}
                        </span>
                        {getStatusBadge(t.status)}
                        {getPriorityBadge(t.priority)}
                        <span className="text-2xs text-ink-500 font-medium">· {getCategoryLabel(t.category)}</span>
                      </div>
                      <h4 className="text-sm font-bold text-ink-900 truncate group-hover:text-ink-950">
                        {t.subject}
                      </h4>
                      {t.last_message && (
                        <p className="text-xs text-ink-600 line-clamp-1">
                          <span className="font-medium text-ink-800">
                            {t.last_message.sender_type === "TENANT" ? "Anda" : t.last_message.sender_name}:{" "}
                          </span>
                          {t.last_message.message}
                        </p>
                      )}
                      <span className="text-2xs text-ink-400 block pt-0.5">
                        Pembaruan terakhir: {new Date(t.updated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-400 shrink-0 mt-3 group-hover:text-ink-700 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Col: Instant Self-Service Knowledge Base & SLA */}
          <div className="space-y-4">
            {/* Quick Self-Serve FAQ Card */}
            <div className="rounded-2xl border border-ink-200/90 bg-white p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-900">Solusi Cepat Mandiri</h3>
                  <p className="text-2xs text-ink-500">Selesaikan kendala umum dalam 1 menit</p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {FAQS.map((faq, idx) => (
                  <details
                    key={idx}
                    className="group rounded-xl border border-ink-100 bg-surface-sunken/40 p-3 text-xs transition-colors open:bg-surface-sunken open:border-emerald-200"
                  >
                    <summary className="font-semibold text-ink-900 cursor-pointer list-none flex items-center justify-between gap-2 select-none">
                      <span>{faq.q}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-ink-400 transition-transform group-open:rotate-90 shrink-0" />
                    </summary>
                    <p className="mt-2 text-ink-600 leading-relaxed pt-2 border-t border-ink-200/60">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>

              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("open-support-livechat"))}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 p-2 rounded-lg hover:bg-emerald-50/70 transition-colors"
              >
                <span>Masih butuh bantuan? Buka Live Chat</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* SLA Commitment Card */}
            <div className="rounded-2xl border border-ink-200/90 bg-white p-5 shadow-xs space-y-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-800">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-900">Komitmen SLA Dukungan</h3>
                  <p className="text-2xs text-ink-500">Jaminan waktu respon resmi Noewbar</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="rounded-xl border border-red-100 bg-red-50/60 p-2.5">
                  <span className="text-2xs font-semibold text-red-800 block">Prioritas Mendesak</span>
                  <span className="text-sm font-bold text-red-900 font-mono mt-0.5 block">&lt; 30 Menit</span>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-2.5">
                  <span className="text-2xs font-semibold text-blue-800 block">Prioritas Normal</span>
                  <span className="text-sm font-bold text-blue-900 font-mono mt-0.5 block">&lt; 2 Jam</span>
                </div>
              </div>

              <div className="text-2xs text-ink-600 space-y-1.5 pt-1">
                <div className="flex items-center justify-between border-b border-ink-100 pb-1.5">
                  <span className="text-ink-500">Jam Layanan:</span>
                  <span className="font-semibold text-ink-800">08:00 - 22:00 WIB</span>
                </div>
                <div className="flex items-center justify-between border-b border-ink-100 pb-1.5">
                  <span className="text-ink-500">Hari Operasional:</span>
                  <span className="font-semibold text-ink-800">Senin - Minggu (Setiap Hari)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-500">Kanal Respon:</span>
                  <span className="font-semibold text-ink-800">Tiket Bantuan & Live Chat</span>
                </div>
              </div>

              {/* Direct Contextual Live Chat Action */}
              <Button
                variant="secondary"
                onClick={() => window.dispatchEvent(new CustomEvent("open-support-livechat"))}
                className="w-full justify-center border-emerald-300 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100 font-semibold shadow-2xs mt-1"
              >
                <Headphones className="h-4 w-4 mr-2 text-emerald-600" />
                Hubungi Tim Live Support
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3.5 border-b border-ink-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white">
                  <LifeBuoy className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink-900">Buat Tiket Bantuan Baru</h3>
                  <p className="text-2xs text-ink-500">Jelaskan kendala Anda agar tim teknisi dapat segera membantu</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-colors"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createError && (
              <div className="mt-3.5 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-1.5 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-800 mb-1">
                  Subjek Kendala <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: QR Code WhatsApp tidak muncul saat dipindai"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-sm focus:border-ink-900 focus:ring-1 focus:ring-ink-900 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-800 mb-1">
                    Kategori
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as TicketCategory)}
                    className="w-full rounded-xl border border-ink-200 p-2.5 text-sm focus:border-ink-900 focus:ring-1 focus:ring-ink-900 focus:outline-none bg-white"
                  >
                    <option value="TECHNICAL">Kendala Teknis / Bug</option>
                    <option value="WHATSAPP">Integrasi WhatsApp</option>
                    <option value="BILLING">Pembayaran & Paket</option>
                    <option value="FEATURE_REQUEST">Permintaan Fitur</option>
                    <option value="GENERAL">Bantuan Umum</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-800 mb-1">
                    Prioritas
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TicketPriority)}
                    className="w-full rounded-xl border border-ink-200 p-2.5 text-sm focus:border-ink-900 focus:ring-1 focus:ring-ink-900 focus:outline-none bg-white"
                  >
                    <option value="LOW">Rendah (Pertanyaan umum)</option>
                    <option value="MEDIUM">Sedang (Kendala standar)</option>
                    <option value="HIGH">Tinggi (Mengganggu jualan)</option>
                    <option value="URGENT">Mendesak (Toko berhenti total)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-800 mb-1">
                  Deskripsi Kendala Secara Rinci <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Jelaskan apa yang terjadi, langkah yang sudah Anda coba, serta pesan error bila ada..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-sm focus:border-ink-900 focus:ring-1 focus:ring-ink-900 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-ink-100">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={creating}
                  loading={creating}
                  className="font-semibold shadow-xs"
                >
                  {creating ? "Mengirim..." : "Kirim Tiket"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
