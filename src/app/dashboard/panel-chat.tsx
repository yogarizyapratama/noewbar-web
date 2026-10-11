"use client";

/**
 * Live chat tab: conversation list, thread, and manual takeover.
 *
 * Layout follows the docked-panel rule: two columns on desktop, and on phones
 * the thread replaces the list with an explicit back control, so neither view is
 * crammed into half a screen.
 */

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Bot,
  MessageSquare,
  Send,
  UserRound,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  PageHeader,
  cn,
  timeAgo,
} from "@/components/ui";
import type { ConversationRow, MessageRow } from "./types";

function senderLabel(t: string): string {
  if (t === "BUYER") return "Pembeli";
  if (t === "HUMAN_AGENT") return "Anda";
  return "Bot";
}

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
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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

  return (
    <div className="page">
      <PageHeader
        eyebrow="Percakapan"
        title="Live chat"
        description="Pantau percakapan bot dengan pembeli. Ambil alih kapan saja untuk membalas sendiri, dan kembalikan ke bot setelah selesai."
        icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* conversation list */}
        <Card className={cn("flex max-h-[560px] flex-col overflow-hidden", mobileThread && "hidden lg:flex")}>
          <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-600">
              Percakapan
            </p>
            <span className="meta">{conversations.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading && conversations.length === 0 && <LoadingState rows={4} className="p-3" />}

            {!loading && conversations.length === 0 && (
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
                title="Belum ada percakapan"
                description="Percakapan muncul setelah pembeli mengirim chat pertama ke nomor toko."
              />
            )}

            {conversations.map((c) => {
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onSelect(c.id);
                    setMobileThread(true);
                  }}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex w-full min-h-[56px] flex-col items-start gap-1 border-b border-ink-200 px-4 py-3 text-left transition-colors last:border-b-0",
                    isActive ? "bg-ink-100" : "hover:bg-ink-50"
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      {c.buyer_name ?? c.buyer_jid.split("@")[0]}
                    </span>
                    <span className="meta shrink-0">{timeAgo(c.last_interaction)}</span>
                  </div>
                  <div className="flex w-full items-center gap-2">
                    <span className="meta truncate">{c.pipeline_stage}</span>
                    <span className="meta shrink-0">{c.message_count} pesan</span>
                  </div>
                  {c.is_human_takeover && (
                    <Badge tone="warn" className="mt-0.5">
                      <UserRound className="h-2.5 w-2.5" aria-hidden="true" />
                      Diambil alih manusia
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* thread */}
        <Card className={cn("flex max-h-[560px] flex-col overflow-hidden", !mobileThread && "hidden lg:flex")}>
          {!active ? (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" aria-hidden="true" />}
              title="Pilih percakapan"
              description="Pilih salah satu percakapan di kiri untuk membaca riwayat dan membalas."
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-ink-200 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden"
                    onClick={() => setMobileThread(false)}
                    aria-label="Kembali ke daftar percakapan"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {active.buyer_name ?? active.buyer_jid.split("@")[0]}
                    </p>
                    <p className="meta truncate">
                      {active.pipeline_stage} - {active.message_count} pesan
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={active.is_human_takeover ? "warn" : "signal"}>
                    {active.is_human_takeover ? (
                      <>
                        <UserRound className="h-2.5 w-2.5" aria-hidden="true" />
                        Anda yang balas
                      </>
                    ) : (
                      <>
                        <Bot className="h-2.5 w-2.5" aria-hidden="true" />
                        Bot aktif
                      </>
                    )}
                  </Badge>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onToggleTakeover(active)}
                  >
                    {active.is_human_takeover ? "Kembalikan ke bot" : "Ambil alih"}
                  </Button>
                </div>
              </div>

              {active.is_human_takeover && (
                <div className="flex items-center justify-between border-b border-warn/30 bg-warn-wash px-4 py-2 text-xs text-ink-700">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-3.5 w-3.5 text-warn" aria-hidden="true" />
                    <span>Mode Balas Manual Aktif &middot; Bot dijeda untuk pembeli ini.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleTakeover(active)}
                    className="font-semibold text-ink underline hover:text-ink-900"
                  >
                    Kembalikan ke bot
                  </button>
                </div>
              )}

              <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-ink-50/40 p-4">
                {messages.length === 0 && (
                  <p className="py-8 text-center text-xs text-ink-500">Belum ada pesan pada percakapan ini.</p>
                )}
                {messages.map((m) => {
                  const mine = m.sender_type !== "BUYER";
                  const bot = m.sender_type !== "BUYER" && m.sender_type !== "HUMAN_AGENT";
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[82%] rounded-lg border px-3.5 py-2.5",
                          !mine
                            ? "border-ink-200 bg-white"
                            : bot
                              ? "border-signal/20 bg-signal-wash"
                              : "border-ink-200 bg-ink-100"
                        )}
                      >
                        <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
                          {senderLabel(m.sender_type)}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                          {m.content}
                        </p>
                        {m.media_url && (
                          <a
                            href={m.media_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-block text-2xs font-semibold text-signal-strong underline"
                          >
                            Lihat lampiran
                          </a>
                        )}
                        <p className="meta mt-1.5">
                          {new Date(m.created_at).toLocaleString("id-ID")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={submit} className="border-t border-ink-200 p-3">
                <div className="flex gap-2">
                  <label htmlFor="reply" className="sr-only">
                    Balasan manual
                  </label>
                  <input
                    id="reply"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={
                      active.is_human_takeover
                        ? "Balas sebagai manusia..."
                        : "Balas manual (bot otomatis berhenti untuk pembeli ini)"
                    }
                    className="field flex-1"
                    autoComplete="off"
                  />
                  <Button
                    type="submit"
                    variant="accent"
                    loading={sending}
                    disabled={!reply.trim()}
                    aria-label="Kirim balasan"
                  >
                    {!sending && <Send className="h-4 w-4" aria-hidden="true" />}
                    <span className="hidden sm:inline">Kirim</span>
                  </Button>
                </div>
                {feedback && <p className="meta mt-2">{feedback}</p>}
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
