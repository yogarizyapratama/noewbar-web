"use client";

/**
 * Live Chat Panel (WhatsApp Web Design Edition).
 *
 * Standar antislop & WhatsApp Web Fidelity:
 * - Layout dua kolom (Contacts List + Conversation Window) khas WhatsApp Web.
 * - Header WhatsApp Web dengan avatar toko, indikator status, dan tombol aksi.
 * - Search bar dan filter chip (Semua, Belum Dibalas, Takeover, Bot AI).
 * - Gelembung chat autentik:
 *   - Pesan pembeli: Putih (#ffffff) dengan timestamp dan label pembeli.
 *   - Pesan keluar toko/bot: Hijau WhatsApp (#d9fdd3) dengan status ganda centang biru (#53bdeb).
 * - Bilah respons cepat (Cek Pesanan, Rekening, Katalog, Ongkir) untuk efisiensi admin.
 * - Tombol Ambil Alih (Human Takeover) langsung di header chat dengan status jelas.
 * - Tampilan idle WhatsApp Web profesional saat belum ada percakapan yang dipilih.
 * - Responsif mobile: transisi mulus antara daftar chat dan jendela percakapan.
 * - Zero em-dash di seluruh teks.
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bell,
  Bot,
  CheckCheck,
  Download,
  ExternalLink,
  Headphones,
  Lock,
  MessageSquare,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  Settings2,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Trash2,
  User,
  UserRound,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  StatusDot,
  cn,
  rupiah,
  timeAgo,
} from "@/components/ui";
import type { ConversationRow, MessageRow } from "./types";

type CannedResponse = {
  id: string;
  label: string;
  text: string;
};

const DEFAULT_CANNED: CannedResponse[] = [
  {
    id: "greet",
    label: "👋 Salam Sapa",
    text: "Halo kak! Ada yang bisa kami bantu seputar produk hari ini? 😊",
  },
  {
    id: "ship",
    label: "📦 Info Pengiriman",
    text: "Baik kak, pesanan kakak sedang kami siapkan untuk jadwal pengiriman terdekat ya! 📦",
  },
  {
    id: "rek",
    label: "💳 Info Rekening",
    text: "Pembayaran dapat ditransfer ke rekening resmi toko kami. Mohon kirimkan bukti transfer berupa foto atau struk ya kak! 💳",
  },
  {
    id: "katalog",
    label: "🛍️ Kirim Katalog",
    text: "Kakak bisa cek katalog lengkap produk dan promo kami di link website toko ya! 🛍️",
  },
];

export function PanelChat({
  conversations,
  activeId,
  messages,
  loading,
  onSelect,
  onToggleTakeover,
  onSend,
}: {
  conversations: ConversationRow[];
  activeId: string | null;
  messages: MessageRow[];
  loading: boolean;
  onSelect: (id: string) => void;
  onToggleTakeover: (conv: ConversationRow) => Promise<void>;
  onSend: (text: string) => Promise<string>;
}) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mobileThread, setMobileThread] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatFilter, setChatFilter] = useState<"all" | "takeover" | "bot" | "unread">("all");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Custom Canned Responses
  const [cannedList, setCannedList] = useState<CannedResponse[]>(DEFAULT_CANNED);
  const [cannedModalOpen, setCannedModalOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newText, setNewText] = useState("");

  // Customer Profile & Order History Drawer
  const [customerDrawerOpen, setCustomerDrawerOpen] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Array<{
    id: string;
    order_number: string;
    order_status: string;
    payment_status: string;
    total_amount: number;
  }>>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [remindingOrder, setRemindingOrder] = useState<Record<string, boolean>>({});
  const [remindMsg, setRemindMsg] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!activeId) {
      setCustomerOrders([]);
      return;
    }
    let cancelled = false;
    setLoadingOrders(true);
    fetch(`/api/conversations?conversation_id=${activeId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.ok && Array.isArray(json.orders)) {
          setCustomerOrders(json.orders);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingOrders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeId]);

  async function generateAiSuggestion() {
    if (!activeId || suggesting) return;
    setSuggesting(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/conversations/${activeId}/suggest`, {
        method: "POST",
      });
      const json = await res.json();
      if (json.ok && json.suggestion) {
        setReply(json.suggestion);
        setFeedback("✨ Draf balasan AI berhasil dibuat! Silakan periksa atau langsung kirim.");
      } else {
        setFeedback(json.error || "Gagal membuat saran balasan AI.");
      }
    } catch {
      setFeedback("Gagal menghubungi AI Copilot.");
    } finally {
      setSuggesting(false);
    }
  }

  async function remindCustomerOrder(orderId: string) {
    setRemindingOrder((r) => ({ ...r, [orderId]: true }));
    try {
      const res = await fetch(`/api/orders/${orderId}/remind`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setRemindMsg((m) => ({ ...m, [orderId]: "Terkirim!" }));
      } else {
        setRemindMsg((m) => ({ ...m, [orderId]: json.error || "Gagal" }));
      }
    } catch {
      setRemindMsg((m) => ({ ...m, [orderId]: "Gagal" }));
    } finally {
      setRemindingOrder((r) => ({ ...r, [orderId]: false }));
    }
  }

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("noewbar_canned_responses");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCannedList(parsed);
        }
      }
    } catch {
      // fallback to default
    }
  }, []);

  function saveCannedList(items: CannedResponse[]) {
    setCannedList(items);
    try {
      localStorage.setItem("noewbar_canned_responses", JSON.stringify(items));
    } catch {
      // ignore
    }
  }

  function addCannedItem() {
    if (!newLabel.trim() || !newText.trim()) return;
    const updated = [
      ...cannedList,
      {
        id: "canned-" + Date.now(),
        label: newLabel.trim(),
        text: newText.trim(),
      },
    ];
    saveCannedList(updated);
    setNewLabel("");
    setNewText("");
  }

  function removeCannedItem(id: string) {
    const updated = cannedList.filter((item) => item.id !== id);
    saveCannedList(updated);
  }

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const filteredConversations = conversations.filter((c) => {
    if (chatFilter === "takeover" && !c.is_human_takeover) return false;
    if (chatFilter === "bot" && c.is_human_takeover) return false;
    if (chatFilter === "unread" && c.message_count === 0) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (c.buyer_name || "").toLowerCase();
    const jid = c.buyer_jid.toLowerCase();
    return name.includes(q) || jid.includes(q);
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function submit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true);
    setFeedback(null);
    try {
      const msg = await onSend(reply);
      setFeedback(msg);
      setReply("");
    } finally {
      setSending(false);
    }
  }

  function insertCannedResponse(text: string) {
    setReply((prev) => (prev ? `${prev} ${text}` : text));
  }

  // Helper formatting jam pesan
  function formatMsgTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  return (
    <div className="page space-y-4">
      {/* Header Halaman Ringkas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#00a884]/15 text-[#00a884]">
              <MessageSquare className="h-3.5 w-3.5" />
            </span>
            <h1 className="text-xl font-bold text-ink tracking-tight">WhatsApp Live Chat</h1>
            <span className="rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-200">
              Sinkronisasi Aktif
            </span>
          </div>
          <p className="text-xs text-ink-600 mt-0.5">
            Kelola dan pantau interaksi pelanggan WhatsApp secara real-time layaknya WhatsApp Web resmi.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="signal" className="text-2xs font-mono">
            <StatusDot ok />
            {conversations.length} Percakapan Terdaftar
          </Badge>
        </div>
      </div>

      {/* WHATSAPP WEB SHELL CONTAINER */}
      <div className="h-[calc(100dvh-180px)] min-h-[520px] sm:min-h-[620px] max-h-[840px] w-full rounded-2xl border border-[#d1d7db] bg-white overflow-hidden shadow-sm flex flex-col lg:flex-row">
        {/* ==================================================== 1. LEFT PANEL (CHATS LIST) */}
        <aside
          className={cn(
            "w-full lg:w-[380px] shrink-0 border-r border-[#e9edef] bg-white flex flex-col h-full",
            mobileThread ? "hidden lg:flex" : "flex"
          )}
        >
          {/* Header Kontak */}
          <div className="bg-[#f0f2f5] px-4 py-3 border-b border-[#d1d7db] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#00a884] text-white shadow-2xs font-bold text-xs">
                WA
              </div>
              <div>
                <p className="text-xs font-bold text-[#111b21] leading-tight">Daftar Percakapan</p>
                <p className="text-[10px] text-[#667781] font-mono">
                  {filteredConversations.length} dari {conversations.length} chat
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-signal-wash text-signal-strong text-[10px] font-bold px-2 py-0.5 border border-signal/20">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" />
                Bot Siap
              </span>
            </div>
          </div>

          {/* Search Box WhatsApp Web Style */}
          <div className="p-2.5 bg-white border-b border-[#e9edef] space-y-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#54656f]" />
              <input
                type="text"
                placeholder="Cari atau mulai chat baru..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg bg-[#f0f2f5] pl-9 pr-3 py-1.5 text-xs text-[#111b21] placeholder:text-[#54656f] border-none focus:outline-none focus:ring-1 focus:ring-[#00a884]"
              />
            </div>

            {/* WhatsApp Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] no-scrollbar">
              <button
                type="button"
                onClick={() => setChatFilter("all")}
                className={cn(
                  "px-3 py-1.5 min-h-[36px] flex items-center rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                  chatFilter === "all"
                    ? "bg-[#00a884] text-white font-semibold"
                    : "bg-[#f0f2f5] text-ink-700 hover:bg-[#e9edef]"
                )}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setChatFilter("takeover")}
                className={cn(
                  "px-3 py-1.5 min-h-[36px] flex items-center rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                  chatFilter === "takeover"
                    ? "bg-amber-600 text-white font-semibold"
                    : "bg-[#f0f2f5] text-ink-700 hover:bg-[#e9edef]"
                )}
              >
                Takeover Manual
              </button>
              <button
                type="button"
                onClick={() => setChatFilter("bot")}
                className={cn(
                  "px-3 py-1.5 min-h-[36px] flex items-center rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal",
                  chatFilter === "bot"
                    ? "bg-[#00a884] text-white font-semibold"
                    : "bg-[#f0f2f5] text-ink-700 hover:bg-[#e9edef]"
                )}
              >
                Bot AI
              </button>
            </div>
          </div>

          {/* List Kontak Percakapan */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#f0f2f5]">
            {loading && conversations.length === 0 && (
              <div className="p-6 text-center text-xs text-[#54656f] space-y-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00a884] border-t-transparent mx-auto" />
                <p>Memuat percakapan WhatsApp...</p>
              </div>
            )}

            {!loading && conversations.length === 0 && (
              <div className="p-8 text-center text-xs text-[#54656f] space-y-2">
                <MessageSquare className="h-8 w-8 text-[#aebac1] mx-auto mb-1" />
                <p className="font-bold text-[#111b21]">Belum Ada Percakapan Masuk</p>
                <p className="text-2xs text-[#667781] leading-relaxed">
                  Percakapan akan muncul otomatis ketika calon pembeli mengirim chat pertama ke nomor WhatsApp toko.
                </p>
              </div>
            )}

            {!loading && conversations.length > 0 && filteredConversations.length === 0 && (
              <div className="p-6 text-center text-xs text-[#54656f]">
                Tidak ada chat yang sesuai dengan filter pencarian.
              </div>
            )}

            {filteredConversations.map((c) => {
              const isActive = c.id === activeId;
              const contactName = c.buyer_name || c.buyer_jid.replace(/@s\.whatsapp\.net$/, "");
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c.id);
                    setMobileThread(true);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors cursor-pointer",
                    isActive ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"
                  )}
                >
                  {/* Avatar Kontak */}
                  <div className="relative shrink-0">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#dfe5e7] text-[#54656f] font-bold text-sm">
                      {contactName.slice(0, 2).toUpperCase()}
                    </div>
                    {c.is_human_takeover ? (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white"
                        title="Mode Balas Manual"
                      >
                        <UserRound className="h-2.5 w-2.5" />
                      </span>
                    ) : (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#00a884] text-white"
                        title="Bot AI Aktif"
                      >
                        <Bot className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </div>

                  {/* Info Chat */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-xs text-[#111b21] truncate">{contactName}</p>
                      <span className="text-[10px] text-[#667781] shrink-0 font-mono">
                        {timeAgo(c.last_interaction)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className="text-2xs text-[#667781] truncate flex items-center gap-1">
                        <CheckCheck className="h-3 w-3 text-[#53bdeb] shrink-0" />
                        <span>Tahap: {c.pipeline_stage}</span>
                      </p>
                      {c.is_human_takeover ? (
                        <span className="rounded bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 shrink-0 border border-amber-200">
                          Takeover
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.2 shrink-0 border border-emerald-200">
                          Bot AI
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ==================================================== 2. RIGHT PANEL (WHATSAPP CHAT THREAD) */}
        <section
          className={cn(
            "flex-1 flex flex-row h-full bg-[#efeae2] relative min-w-0 overflow-hidden",
            !mobileThread ? "hidden lg:flex" : "flex"
          )}
        >
          {!active ? (
            /* Idle Screen WhatsApp Web */
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#f0f2f5] text-center space-y-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#dfe5e7] text-[#00a884] shadow-sm">
                <Smartphone className="h-10 w-10" />
              </div>
              <div className="max-w-md space-y-2">
                <h2 className="text-lg font-bold text-[#111b21]">WhatsApp Web untuk Toko Anda</h2>
                <p className="text-xs text-[#667781] leading-relaxed">
                  Pilih salah satu percakapan di bilah kiri untuk membaca pesan pembeli, memeriksa alur transaksi, atau mengambil alih percakapan untuk membalas secara langsung.
                </p>
              </div>
              <div className="flex items-center gap-2 text-2xs text-[#8696a0] pt-6 border-t border-[#d1d7db]">
                <Lock className="h-3.5 w-3.5" />
                <span>Pesan terhubung langsung ke daemon WhatsMeow dan terenkripsi.</span>
              </div>
            </div>
          ) : (
            /* Active Chat Thread */
            <>
              <div className="flex-1 flex flex-col h-full relative min-w-0 overflow-hidden">
                {/* WhatsApp Chat Header */}
                <div className="bg-[#f0f2f5] px-4 py-2.5 border-b border-[#d1d7db] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileThread(false)}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-2 text-[#54656f] hover:bg-black/5 hover:text-[#111b21] active:scale-95 transition-all lg:hidden"
                      aria-label="Kembali ke daftar percakapan"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-[#54656f] font-bold text-xs">
                      {(active.buyer_name || (active.buyer_jid ? active.buyer_jid.slice(0, 2) : "WA")).slice(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold text-xs text-[#111b21] truncate">
                        {active.buyer_name || (active.buyer_jid ? active.buyer_jid.replace(/@s\.whatsapp\.net$/, "") : "-")}
                      </p>
                      <p className="text-[10px] text-[#667781] flex items-center gap-1.5 truncate">
                        <span className="font-mono">{active.buyer_jid ? active.buyer_jid.split("@")[0] : "-"}</span>
                        <span>&bull;</span>
                        <span className="text-[#00a884] font-medium">WhatsApp Online</span>
                      </p>
                    </div>
                  </div>

                {/* Takeover Control Switch */}
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    tone={active.is_human_takeover ? "warn" : "signal"}
                    className="text-[11px] hidden sm:inline-flex"
                  >
                    {active.is_human_takeover ? (
                      <>
                        <UserRound className="h-3 w-3 mr-1" />
                        Mode Manual
                      </>
                    ) : (
                      <>
                        <Bot className="h-3 w-3 mr-1" />
                        Bot AI Aktif
                      </>
                    )}
                  </Badge>

                  <Button
                    size="sm"
                    variant={active.is_human_takeover ? "primary" : "secondary"}
                    className={cn(
                      "text-xs font-semibold h-8 px-3 border-none shadow-2xs",
                      active.is_human_takeover
                        ? "bg-[#00a884] hover:bg-[#008f6f] text-white"
                        : "bg-amber-600 hover:bg-amber-500 text-white"
                    )}
                    onClick={() => onToggleTakeover(active)}
                  >
                    {active.is_human_takeover ? (
                      <>
                        <Bot className="mr-1.5 h-3.5 w-3.5" />
                        Kembalikan ke Bot
                      </>
                    ) : (
                      <>
                        <UserRound className="mr-1.5 h-3.5 w-3.5" />
                        Ambil Alih Chat
                      </>
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setCustomerDrawerOpen((v) => !v)}
                    className={cn(
                      "px-2.5 py-1.5 h-8 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs",
                      customerDrawerOpen
                        ? "bg-[#111b21] text-white border-[#111b21]"
                        : "bg-white text-ink-800 border-ink-200 hover:bg-ink-50"
                    )}
                    title="Buka ringkasan riwayat belanja & pesanan pembeli ini"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-signal" />
                    <span className="hidden md:inline">Profil &amp; Pesanan</span>
                    {customerOrders.length > 0 && (
                      <span className="rounded-full bg-signal px-1.5 py-0.2 text-[10px] font-bold text-white">
                        {customerOrders.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Status Banner jika Takeover Manual Aktif */}
              {active.is_human_takeover && (
                <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-amber-700" />
                    <span className="font-medium text-2xs sm:text-xs">
                      Mode Balas Manual Aktif: Bot dijeda untuk pembeli ini. Anda membalas pembeli secara langsung.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleTakeover(active)}
                    className="text-2xs font-bold underline text-amber-900 hover:text-amber-950 shrink-0 ml-2"
                  >
                    Aktifkan Bot Kembali
                  </button>
                </div>
              )}

              {/* Message Bubbles Area */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5"
                style={{
                  backgroundImage: `radial-gradient(#d1d7db 0.75px, transparent 0.75px)`,
                  backgroundSize: "16px 16px",
                }}
              >
                {/* Date Divider Bubble */}
                <div className="flex justify-center my-2">
                  <span className="rounded-lg bg-white/95 px-3 py-1 text-[10px] font-semibold text-[#54656f] shadow-2xs border border-[#e9edef]">
                    Pesan Terenkripsi WhatsApp
                  </span>
                </div>

                {messages.length === 0 && (
                  <div className="p-8 text-center text-xs text-[#54656f] bg-white/80 rounded-xl max-w-sm mx-auto shadow-2xs border border-[#e9edef]">
                    Belum ada riwayat pesan pada percakapan ini.
                  </div>
                )}

                {messages.map((m) => {
                  const isBuyer = m.sender_type === "BUYER";
                  const isBot = m.sender_type !== "BUYER" && m.sender_type !== "HUMAN_AGENT";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex w-full", isBuyer ? "justify-start" : "justify-end")}
                    >
                      <div
                        className={cn(
                          "relative max-w-[85%] sm:max-w-[75%] rounded-xl px-3.5 py-2.5 shadow-2xs text-xs text-[#111b21] leading-relaxed",
                          isBuyer
                            ? "bg-white rounded-tl-none border border-[#e9edef]"
                            : "bg-[#d9fdd3] rounded-tr-none border border-[#c1e8ba]"
                        )}
                      >
                        {/* Label Pengirim */}
                        <div className="flex items-center justify-between gap-3 mb-1">
                          {isBuyer ? (
                            <span className="text-[11px] font-bold text-signal-strong">
                              {active.buyer_name || "Pembeli"}
                            </span>
                          ) : isBot ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-signal-strong bg-signal-wash px-1.5 py-0.5 rounded border border-signal/20">
                              <Bot className="h-2.5 w-2.5" />
                              Bot CS (Otomatis)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-800 bg-ink-100 px-1.5 py-0.5 rounded border border-ink-300">
                              <User className="h-2.5 w-2.5" />
                              Anda (Admin Toko)
                            </span>
                          )}
                        </div>

                        {/* Multimedia Preview (Image / Audio) */}
                        {m.media_url && (
                          <div className="my-2">
                            {m.message_type === "AUDIO" ||
                            m.media_url.match(/\.(ogg|mp3|wav|m4a|aac)($|\?)/i) ? (
                              <div className="flex flex-col gap-1.5 rounded-lg border border-ink-200/80 bg-white/90 p-2 shadow-2xs">
                                <div className="flex items-center gap-1.5 text-2xs font-semibold text-ink-700">
                                  <Headphones className="h-3.5 w-3.5 text-signal-strong" />
                                  <span>Voice Note / Audio</span>
                                </div>
                                <audio
                                  controls
                                  src={m.media_url}
                                  className="h-8 w-full max-w-xs"
                                  preload="metadata"
                                />
                              </div>
                            ) : (
                              <div className="group relative overflow-hidden rounded-lg border border-ink-200/60 bg-black/5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={m.media_url}
                                  alt="Lampiran media chat"
                                  className="max-h-64 w-auto cursor-pointer rounded-lg object-contain transition-transform duration-150 hover:scale-[1.01]"
                                  onClick={() => setPreviewImage(m.media_url)}
                                  loading="lazy"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPreviewImage(m.media_url)}
                                  className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/70 px-2 py-1 text-2xs font-medium text-white opacity-0 backdrop-blur-xs transition-opacity group-hover:opacity-100"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Perbesar
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Isi Teks Pesan */}
                        {m.content && (
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        )}

                        {/* Footer Waktu & Status Checkmark */}
                        <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-[#667781] font-mono">
                          <span>{formatMsgTime(m.created_at)}</span>
                          {!isBuyer && (
                            <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Feedback Alert Bar */}
              {feedback && (
                <div className="bg-emerald-50 border-t border-emerald-200 px-4 py-1.5 text-2xs text-emerald-800 flex items-center justify-between shrink-0">
                  <span>{feedback}</span>
                  <button type="button" onClick={() => setFeedback(null)} className="p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Canned Quick Responses Toolbar */}
              <div className="bg-[#f0f2f5] px-3.5 pt-2 pb-1.5 border-t border-[#d1d7db] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <span className="text-[10px] font-bold text-ink-700 uppercase shrink-0 mr-1">
                  Balas Cepat:
                </span>
                <button
                  type="button"
                  onClick={generateAiSuggestion}
                  disabled={suggesting}
                  className="px-2.5 py-1.5 min-h-[36px] flex items-center gap-1.5 rounded-md bg-[#00a884] hover:bg-[#008f6f] text-white text-xs font-semibold whitespace-nowrap shadow-xs transition-colors disabled:opacity-50"
                  title="Minta AI merangkai draf balasan ramah & solutif berdasarkan konteks percakapan dan katalog toko"
                >
                  <Sparkles className={cn("h-3.5 w-3.5", suggesting && "animate-spin")} />
                  <span>{suggesting ? "Menulis..." : "✨ Draf AI Copilot"}</span>
                </button>
                {cannedList.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => insertCannedResponse(item.text)}
                    className="px-3 py-1.5 min-h-[36px] flex items-center rounded-md bg-white hover:bg-emerald-50 border border-ink-200 text-xs text-ink-800 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                    title={item.text}
                  >
                    {item.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCannedModalOpen(true)}
                  className="px-2.5 py-1.5 min-h-[36px] flex items-center gap-1 rounded-md bg-ink-100 hover:bg-ink-200 border border-ink-200 text-xs font-medium text-ink-700 whitespace-nowrap transition-colors"
                  title="Kelola templat balas cepat"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  <span>Kelola</span>
                </button>
              </div>

              {/* WhatsApp Web Input Bar */}
              <form
                onSubmit={submit}
                className="bg-[#f0f2f5] px-3.5 pb-3 pt-2 flex items-center gap-2.5 shrink-0"
              >
                <input
                  type="text"
                  placeholder={
                    active.is_human_takeover
                      ? "Ketik pesan untuk pembeli (Anda membalas langsung)..."
                      : "Ketik pesan (Kirim pesan akan otomatis mengambil alih percakapan)..."
                  }
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  className="flex-1 min-h-[44px] rounded-lg bg-white px-3.5 py-2.5 text-xs sm:text-sm text-ink placeholder:text-ink-500 border border-ink-300 focus:outline-none focus:ring-2 focus:ring-signal"
                />
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2",
                    reply.trim() && !sending
                      ? "bg-signal hover:bg-emerald-700 cursor-pointer"
                      : "bg-ink-300 text-ink-500 cursor-not-allowed"
                  )}
                  aria-label="Kirim Pesan WhatsApp"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>

            {/* Customer Profile & Orders Drawer */}
            {customerDrawerOpen && active && (
              <aside className="w-80 shrink-0 border-l border-[#d1d7db] bg-white flex flex-col h-full overflow-y-auto animate-fade-in shadow-lg z-10">
                <div className="bg-[#f0f2f5] px-4 py-3 border-b border-[#d1d7db] flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-ink-700" />
                    <h3 className="text-xs font-bold text-ink-900">Profil &amp; Riwayat Belanja</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCustomerDrawerOpen(false)}
                    className="p-1 rounded text-ink-500 hover:bg-ink-200"
                    title="Tutup Panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Profile Card */}
                  <div className="rounded-xl border border-ink-200 bg-ink-50/50 p-3.5 text-center space-y-2">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#00a884] text-white font-bold text-base shadow-sm">
                      {(active.buyer_name || "PL").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-ink-900">{active.buyer_name || "Pelanggan"}</p>
                      <p className="font-mono text-xs text-ink-500">{active.buyer_jid ? active.buyer_jid.split("@")[0] : "-"}</p>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 pt-1">
                      <Badge tone="signal" className="text-[10px]">
                        {active.pipeline_stage}
                      </Badge>
                    </div>
                  </div>

                  {/* Lifetime Value (LTV) Card */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-ink-200 bg-white p-2.5 text-center">
                      <span className="text-[10px] font-semibold uppercase text-ink-500 block">Total Omzet (LTV)</span>
                      <span className="font-mono text-xs font-bold text-emerald-800">
                        Rp {rupiah(
                          customerOrders
                            .filter((o) => o.payment_status === "VERIFIED")
                            .reduce((sum, o) => sum + (o.total_amount || 0), 0)
                        )}
                      </span>
                    </div>
                    <div className="rounded-lg border border-ink-200 bg-white p-2.5 text-center">
                      <span className="text-[10px] font-semibold uppercase text-ink-500 block">Total Order</span>
                      <span className="font-mono text-xs font-bold text-ink-900">
                        {customerOrders.length} transaksi
                      </span>
                    </div>
                  </div>

                  {/* Orders History List */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-2xs font-bold uppercase tracking-wider text-ink-500">
                        Riwayat Pesanan Pelanggan
                      </span>
                      <span className="text-[10px] font-mono text-ink-400">
                        {customerOrders.length} tercatat
                      </span>
                    </div>

                    {loadingOrders ? (
                      <div className="py-6 text-center text-xs text-ink-500">
                        Memuat data pesanan...
                      </div>
                    ) : customerOrders.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-ink-200 p-4 text-center text-2xs text-ink-500">
                        Belum ada transaksi pesanan dari pembeli ini.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {customerOrders.map((ord) => (
                          <div
                            key={ord.id}
                            className="rounded-lg border border-ink-200 bg-white p-2.5 space-y-1.5 shadow-2xs"
                          >
                            <div className="flex items-center justify-between gap-1 text-2xs">
                              <span className="font-bold text-ink-900">{ord.order_number}</span>
                              <Badge
                                tone={
                                  ord.payment_status === "VERIFIED"
                                    ? "signal"
                                    : ord.payment_status === "UNPAID"
                                    ? "warn"
                                    : "neutral"
                                }
                                className="text-[9px] px-1.5 py-0"
                              >
                                {ord.payment_status}
                              </Badge>
                            </div>
                            <p className="font-mono text-xs font-semibold text-ink-800">
                              Rp {rupiah(ord.total_amount)}
                            </p>

                            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-ink-100">
                              <a
                                href={`/api/orders/${ord.id}/receipt`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-ink-200 px-2 py-0.5 text-[10px] font-medium text-ink-700 hover:bg-ink-50"
                                title="Lihat Struk Nota"
                              >
                                <Receipt className="h-3 w-3" />
                                Nota
                              </a>
                              <a
                                href={`/api/orders/${ord.id}/label`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-ink-200 px-2 py-0.5 text-[10px] font-medium text-ink-700 hover:bg-ink-50"
                                title="Cetak Label Pengiriman"
                              >
                                <Printer className="h-3 w-3" />
                                Label
                              </a>

                              {ord.payment_status === "UNPAID" && (
                                <button
                                  type="button"
                                  disabled={remindingOrder[ord.id]}
                                  onClick={() => remindCustomerOrder(ord.id)}
                                  className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-800 hover:bg-amber-100 ml-auto"
                                  title="Kirim reminder tagihan via WhatsApp"
                                >
                                  <Bell className="h-3 w-3 text-amber-600" />
                                  {remindMsg[ord.id] || (remindingOrder[ord.id] ? "Kirim..." : "Ingatkan")}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            )}
          </>
        )}
      </section>
      </div>

      {/* Image Lightbox Modal */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative flex max-h-[92vh] max-w-[92vw] flex-col overflow-hidden rounded-lg bg-ink-950 p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-2 text-white">
              <span className="text-xs font-medium">Lampiran Gambar</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="flex items-center gap-1 rounded bg-white/10 px-2.5 py-1 text-xs text-white hover:bg-white/20 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="rounded p-1 text-white hover:bg-white/20 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Pratinjau Gambar"
              className="max-h-[82vh] max-w-full rounded object-contain"
            />
          </div>
        </div>
      )}

      {/* Canned Response Management Modal */}
      {cannedModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => setCannedModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-ink-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <h3 className="text-sm font-semibold text-ink">Kelola Balas Cepat</h3>
              <button
                type="button"
                onClick={() => setCannedModalOpen(false)}
                className="rounded p-1 text-ink-500 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {cannedList.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-2 rounded border border-ink-200 bg-ink-50/50 p-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink">{item.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-ink-600">{item.text}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCannedItem(item.id)}
                    className="p-1 text-ink-400 hover:text-danger"
                    title="Hapus"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 border-t border-ink-100 pt-3">
              <p className="text-xs font-semibold text-ink">Tambah Balasan Baru</p>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Label (contoh: 📍 Alamat Toko)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-xs text-ink focus:border-ink-500 focus:outline-none"
                />
                <textarea
                  placeholder="Isi pesan balasan otomatis..."
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  rows={2}
                  className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-xs text-ink focus:border-ink-500 focus:outline-none"
                />
                <Button
                  size="sm"
                  variant="accent"
                  className="w-full"
                  onClick={addCannedItem}
                  disabled={!newLabel.trim() || !newText.trim()}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Simpan Balas Cepat
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
