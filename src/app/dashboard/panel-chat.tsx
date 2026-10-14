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
  Bot,
  CheckCheck,
  Lock,
  MessageSquare,
  Search,
  Send,
  Smartphone,
  User,
  UserRound,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  StatusDot,
  cn,
  timeAgo,
} from "@/components/ui";
import type { ConversationRow, MessageRow } from "./types";

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
  const scrollRef = useRef<HTMLDivElement>(null);

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
    setReply(text);
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
            <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border border-emerald-200">
              Sinkronisasi Aktif
            </span>
          </div>
          <p className="text-xs text-ink-500 mt-0.5">
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
      <div className="h-[calc(100vh-170px)] min-h-[620px] max-h-[840px] w-full rounded-2xl border border-[#d1d7db] bg-white overflow-hidden shadow-sm flex flex-col lg:flex-row">
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
              <span className="inline-flex items-center gap-1 rounded-full bg-[#d9fdd3] text-[#00a884] text-[10px] font-bold px-2 py-0.5 border border-[#00a884]/20">
                <span className="h-1.5 w-1.5 rounded-full bg-[#00a884]" />
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
                  "px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors",
                  chatFilter === "all"
                    ? "bg-[#00a884] text-white font-semibold"
                    : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"
                )}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setChatFilter("takeover")}
                className={cn(
                  "px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors",
                  chatFilter === "takeover"
                    ? "bg-amber-600 text-white font-semibold"
                    : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"
                )}
              >
                Takeover Manual
              </button>
              <button
                type="button"
                onClick={() => setChatFilter("bot")}
                className={cn(
                  "px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-colors",
                  chatFilter === "bot"
                    ? "bg-[#00a884] text-white font-semibold"
                    : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"
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
            "flex-1 flex flex-col h-full bg-[#efeae2] relative",
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
              {/* WhatsApp Chat Header */}
              <div className="bg-[#f0f2f5] px-4 py-2.5 border-b border-[#d1d7db] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileThread(false)}
                    className="p-1 rounded text-[#54656f] hover:text-[#111b21] lg:hidden"
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
                            <span className="text-[11px] font-bold text-[#00a884]">
                              {active.buyer_name || "Pembeli"}
                            </span>
                          ) : isBot ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-1.5 py-0.2 rounded border border-emerald-300/60">
                              <Bot className="h-2.5 w-2.5" />
                              Bot CS (Otomatis)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-900 bg-indigo-100/80 px-1.5 py-0.2 rounded border border-indigo-300/60">
                              <User className="h-2.5 w-2.5" />
                              Anda (Admin Toko)
                            </span>
                          )}
                        </div>

                        {/* Isi Teks Pesan */}
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>

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
              <div className="bg-[#f0f2f5] px-3.5 pt-2 pb-1 border-t border-[#d1d7db] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <span className="text-[10px] font-bold text-[#54656f] uppercase shrink-0 mr-1">
                  Balas Cepat:
                </span>
                <button
                  type="button"
                  onClick={() => insertCannedResponse("Halo kak! Ada yang bisa kami bantu seputar produk hari ini? 😊")}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 border border-[#d1d7db] text-2xs text-[#111b21] whitespace-nowrap transition-colors"
                >
                  👋 Salam Sapa
                </button>
                <button
                  type="button"
                  onClick={() => insertCannedResponse("Baik kak, pesanan kakak sedang kami siapkan untuk pengiriman hari ini ya! 📦")}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 border border-[#d1d7db] text-2xs text-[#111b21] whitespace-nowrap transition-colors"
                >
                  📦 Info Pengiriman
                </button>
                <button
                  type="button"
                  onClick={() => insertCannedResponse("Pembayaran bisa ditransfer ke rekening BCA kami: 1234567890 a.n Toko Noewbar. Mohon kirimkan bukti fotonya ya kak! 💳")}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 border border-[#d1d7db] text-2xs text-[#111b21] whitespace-nowrap transition-colors"
                >
                  💳 Info Rekening
                </button>
                <button
                  type="button"
                  onClick={() => insertCannedResponse("Kakak bisa cek katalog lengkap produk dan promo kami di link website toko ya! 🛍️")}
                  className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 border border-[#d1d7db] text-2xs text-[#111b21] whitespace-nowrap transition-colors"
                >
                  🛍️ Kirim Katalog
                </button>
              </div>

              {/* WhatsApp Web Input Bar */}
              <form
                onSubmit={submit}
                className="bg-[#f0f2f5] px-3.5 pb-3 pt-1.5 flex items-center gap-2.5 shrink-0"
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
                  className="flex-1 rounded-lg bg-white px-3.5 py-2 text-xs text-[#111b21] placeholder:text-[#8696a0] border border-[#d1d7db] focus:outline-none focus:ring-1 focus:ring-[#00a884]"
                />
                <button
                  type="submit"
                  disabled={!reply.trim() || sending}
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-all shadow-sm",
                    reply.trim() && !sending
                      ? "bg-[#00a884] hover:bg-[#008f6f] cursor-pointer"
                      : "bg-[#8696a0] cursor-not-allowed opacity-60"
                  )}
                  aria-label="Kirim Pesan WhatsApp"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
