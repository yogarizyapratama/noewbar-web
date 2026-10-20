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
    a: "Buka menu 'Koneksi WhatsApp' di sidebar, klik Disconnect bila sesi hang, lalu lakukan scan ulang kode QR melalui aplikasi WhatsApp di ponsel toko Anda.",
  },
  {
    q: "Pembayaran Langganan Berhasil tapi Akun Masih Trial?",
    a: "Webhook Midtrans memproses otomatis dalam 1-3 menit. Jika lebih dari 5 menit status belum berubah, buat tiket kategori Billing dengan mencantumkan Order ID.",
  },
  {
    q: "Katalog Google Sheets Tidak Terupdate di AI?",
    a: "Pastikan akses spreadsheet disetel ke 'Siapa saja yang memiliki link dapat melihat' (Viewer), lalu klik tombol 'Sinkronkan Sekarang' di menu Basis Dokumen & Sheets.",
  },
  {
    q: "AI Chatbot Tidak Merespons Pesan Masuk?",
    a: "Periksa saklar 'Auto-Reply' di menu Basis Dokumen & Sheets. Pastikan juga percakapan tidak sedang dalam status 'Human Takeover' aktif di menu Live Chat.",
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
      // Ignore
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
      // Ignore
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
        setCreateError(json.error || "Gagal membuat tiket");
      }
    } catch {
      setCreateError("Gagal menghubungi server");
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
      setReplyError("Gagal mengirim balasan");
    } finally {
      setSendingReply(false);
    }
  }

  async function handleResolveTicket() {
    if (!activeTicket) return;
    if (!confirm("Tandai tiket ini sebagai selesai?")) return;
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
      // Ignore
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
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Mendesak</span>;
      case "HIGH":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">Tinggi</span>;
      case "MEDIUM":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-yellow-100 text-yellow-800">Sedang</span>;
      case "LOW":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">Rendah</span>;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-ink-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900 text-white">
              <LifeBuoy className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold text-ink-900 tracking-tight">Pusat Bantuan & Tiket Support</h2>
          </div>
          <p className="mt-1 text-sm text-ink-600">
            Kirimkan pertanyaan atau kendala operasional toko Anda langsung ke Tim Rekayasa & Dukungan Noewbar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={loadTickets}
            aria-label="Muat ulang tiket"
          >
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            Segarkan
          </Button>
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Buat Tiket Baru
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-medium text-ink-500">Total Tiket</span>
          <p className="mt-1 text-2xl font-bold text-ink-900">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <span className="text-xs font-medium text-emerald-800">Tiket Terbuka</span>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{stats.open}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
          <span className="text-xs font-medium text-blue-800">Sedang Ditangani</span>
          <p className="mt-1 text-2xl font-bold text-blue-700">{stats.in_progress}</p>
        </div>
        <div className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-medium text-ink-500">Selesai Dituntaskan</span>
          <p className="mt-1 text-2xl font-bold text-ink-700">{stats.resolved}</p>
        </div>
      </div>

      {/* Main Content Area: Split View or Thread View */}
      {selectedTicketId && activeTicket ? (
        /* Ticket Thread View */
        <div className="rounded-2xl border border-ink-200 bg-white shadow-sm overflow-hidden">
          {/* Thread Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 bg-surface-sunken/40 px-6 py-4 gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedTicketId(null)}
                aria-label="Kembali ke daftar tiket"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Kembali
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-ink-500">{activeTicket.ticket_number}</span>
                  {getStatusBadge(activeTicket.status)}
                  {getPriorityBadge(activeTicket.priority)}
                </div>
                <h3 className="text-lg font-bold text-ink-900 mt-0.5">{activeTicket.subject}</h3>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTicket.status !== "RESOLVED" && activeTicket.status !== "CLOSED" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleResolveTicket}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
                  Tandai Selesai
                </Button>
              )}
            </div>
          </div>

          {/* Messages Stream */}
          <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
            {detailLoading ? (
              <div className="py-12 text-center text-sm text-ink-500">Memuat percakapan tiket...</div>
            ) : (
              activeTicket.messages.map((m) => {
                const isTenant = m.sender_type === "TENANT";
                const isSystem = m.sender_type === "SYSTEM";

                if (isSystem) {
                  return (
                    <div key={m.id} className="flex justify-center my-2">
                      <span className="text-xs bg-ink-100 text-ink-600 px-3 py-1 rounded-full font-medium">
                        {m.message}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed",
                      isTenant
                        ? "ml-auto bg-ink-900 text-white rounded-br-none"
                        : "mr-auto bg-surface-sunken border border-ink-200 text-ink-900 rounded-bl-none"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3 text-xs opacity-75 mb-1.5">
                      <span className="font-semibold flex items-center gap-1">
                        {!isTenant && <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 inline" />}
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

          {/* Reply Form */}
          <div className="border-t border-ink-100 bg-surface-sunken/20 p-4 sm:p-6">
            {replyError && (
              <div className="mb-3 text-xs text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {replyError}
              </div>
            )}
            <form onSubmit={handleSendReply} className="flex flex-col gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Ketik balasan Anda atau berikan info tambahan kepada tim support..."
                rows={3}
                className="w-full resize-none rounded-xl border border-ink-200 p-3 text-sm focus:border-ink-900 focus:outline-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-500">
                  Tim bantuan membalas rata-rata dalam 15 - 30 menit pada jam kerja.
                </span>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={sendingReply || !replyText.trim()}
                >
                  <Send className="h-4 w-4 mr-1.5" />
                  {sendingReply ? "Mengirim..." : "Kirim Balasan"}
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
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-200 bg-white p-3 shadow-sm">
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED"].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                      statusFilter === st
                        ? "bg-ink-900 text-white"
                        : "text-ink-600 hover:bg-surface-sunken hover:text-ink-900"
                    )}
                  >
                    {st === "ALL" ? "Semua Tiket" : st === "OPEN" ? "Terbuka" : st === "IN_PROGRESS" ? "Diproses" : "Selesai"}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Cari nomor atau subjek..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadTickets()}
                  className="rounded-lg border border-ink-200 px-3 py-1.5 text-xs focus:border-ink-900 focus:outline-none w-48"
                />
              </div>
            </div>

            {/* List */}
            <div className="rounded-2xl border border-ink-200 bg-white shadow-sm overflow-hidden divide-y divide-ink-100">
              {loading ? (
                <div className="py-12 text-center text-sm text-ink-500">Memuat daftar tiket bantuan...</div>
              ) : tickets.length === 0 ? (
                <div className="py-16 text-center">
                  <LifeBuoy className="h-10 w-10 text-ink-300 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-ink-900">Belum Ada Tiket Bantuan</h4>
                  <p className="text-xs text-ink-500 mt-1 max-w-sm mx-auto">
                    Jika Anda memiliki kendala teknis, pertanyaan billing, atau integrasi WhatsApp, buat tiket bantuan di atas.
                  </p>
                </div>
              ) : (
                tickets.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className="w-full text-left p-4 hover:bg-surface-sunken/60 transition-colors flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-ink-500">{t.ticket_number}</span>
                        {getStatusBadge(t.status)}
                        {getPriorityBadge(t.priority)}
                        <span className="text-xs text-ink-400">· {getCategoryLabel(t.category)}</span>
                      </div>
                      <h4 className="text-sm font-bold text-ink-900 truncate">{t.subject}</h4>
                      {t.last_message && (
                        <p className="text-xs text-ink-600 line-clamp-1">
                          <span className="font-medium text-ink-800">{t.last_message.sender_name}: </span>
                          {t.last_message.message}
                        </p>
                      )}
                      <span className="text-[11px] text-ink-400 block">
                        Diperbarui: {new Date(t.updated_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-ink-400 shrink-0 mt-2" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Col: Instant Self-Service Knowledge Base */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-ink-900">Solusi Cepat Mandiri</h3>
              </div>
              <p className="text-xs text-ink-600 leading-relaxed">
                Sebelum mengajukan tiket, beberapa kendala umum di bawah dapat diselesaikan dalam 1 menit:
              </p>
              <div className="space-y-2.5 pt-1">
                {FAQS.map((faq, idx) => (
                  <details
                    key={idx}
                    className="group rounded-xl border border-ink-100 bg-surface-sunken/30 p-3 text-xs transition-colors open:bg-surface-sunken"
                  >
                    <summary className="font-semibold text-ink-900 cursor-pointer list-none flex items-center justify-between gap-2">
                      <span>{faq.q}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-ink-400 transition-transform group-open:rotate-90 shrink-0" />
                    </summary>
                    <p className="mt-2 text-ink-600 leading-relaxed pt-1 border-t border-ink-200/50">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-ink-200 bg-white p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-bold text-ink-900">Komitmen SLA Dukungan</h3>
              </div>
              <p className="text-xs text-ink-600 leading-relaxed">
                Tim Support Noewbar siap melayani Anda setiap hari:
              </p>
              <ul className="text-xs text-ink-600 space-y-1 pt-1 list-disc list-inside">
                <li>Prioritas Mendesak: Respon &lt; 30 menit</li>
                <li>Prioritas Tinggi: Respon &lt; 2 jam</li>
                <li>Hari Kerja: 08:00 - 22:00 WIB</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-ink-100">
              <div className="flex items-center gap-2">
                <LifeBuoy className="h-5 w-5 text-ink-900" />
                <h3 className="text-base font-bold text-ink-900">Buat Tiket Bantuan Baru</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-ink-400 hover:text-ink-700"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {createError && (
              <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateTicket} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-800 mb-1">
                  Subjek Kendala *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: QR Code WhatsApp tidak muncul saat dipindai"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-sm focus:border-ink-900 focus:outline-none"
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
                    className="w-full rounded-xl border border-ink-200 p-2.5 text-sm focus:border-ink-900 focus:outline-none bg-white"
                  >
                    <option value="TECHNICAL">Kendala Teknis</option>
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
                    className="w-full rounded-xl border border-ink-200 p-2.5 text-sm focus:border-ink-900 focus:outline-none bg-white"
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
                  Deskripsi Kendala Secara Rinci *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Jelaskan apa yang terjadi, langkah yang sudah Anda coba, serta pesan error bila ada..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 p-2.5 text-sm focus:border-ink-900 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-100">
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
