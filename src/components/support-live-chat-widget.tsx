"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Send,
  Minimize2,
  Maximize2,
  CheckCheck,
  ShieldCheck,
  Headphones,
} from "lucide-react";
import { Button, StatusDot, cn } from "@/components/ui";

interface LiveChatMessage {
  id: string;
  sender_type: "TENANT" | "SUPERADMIN" | "SYSTEM";
  sender_name: string;
  message: string;
  read_by_superadmin: boolean;
  read_by_tenant: boolean;
  created_at: string;
}

const QUICK_PROMPTS = [
  "Bagaimana cara reconnect WhatsApp toko?",
  "Kenapa katalog Google Sheet belum sinkron?",
  "Bagaimana cara upgrade ke paket PRO?",
];

export function SupportLiveChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  async function fetchMessages(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/support/livechat");
      const data = await res.json();
      if (data.ok && Array.isArray(data.messages)) {
        setMessages(data.messages);
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      // Ignore network hiccup
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Initial fetch for unread badge
  useEffect(() => {
    fetchMessages(true);

    // Setup SSE connection
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource("/api/realtime?scope=tenant");
      eventSource.onopen = () => setIsOnline(true);
      eventSource.onerror = () => setIsOnline(false);
      eventSource.onmessage = (e) => {
        try {
          const payload = JSON.parse(e.data);
          if (payload.type === "support_chat" || payload.type === "reload") {
            fetchMessages(true);
          }
        } catch {
          // Non-blocking
        }
      };
    } catch {
      // Fallback
    }

    // Listen for custom trigger event
    const handleOpen = () => {
      setIsOpen(true);
      setIsMinimized(false);
    };
    window.addEventListener("open-support-livechat", handleOpen);

    return () => {
      eventSource?.close();
      window.removeEventListener("open-support-livechat", handleOpen);
    };
  }, []);

  // Poll while open as fallback
  useEffect(() => {
    if (!isOpen || isMinimized) return;
    fetchMessages(false);
    const interval = setInterval(() => {
      fetchMessages(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [isOpen, isMinimized]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      setUnreadCount(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized, messages.length]);

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend || inputText).trim();
    if (!text || sending) return;

    setSending(true);
    if (!textToSend) setInputText("");

    try {
      const res = await fetch("/api/support/livechat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (data.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        scrollToBottom();
      }
    } catch {
      // Error handling
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <aside aria-label="Live Chat Support" className="fixed bottom-6 right-6 z-50">
      {/* Closed Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="relative group flex items-center gap-2.5 px-4 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 min-h-[44px] min-w-[44px]"
          aria-label="Buka Live Chat Support"
        >
          <div className="relative">
            <Headphones className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
          </div>
          <span className="text-sm font-semibold tracking-wide">Live Support</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold bg-amber-500 text-slate-950 rounded-full animate-bounce">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Open Chat Window */}
      {isOpen && (
        <div
          className={cn(
            "bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200",
            isMinimized
              ? "w-80 h-14"
              : "w-[380px] sm:w-[400px] h-[540px] max-h-[85vh]"
          )}
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="relative flex-shrink-0">
                <div className="h-9 w-9 rounded-full bg-emerald-600/30 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-sm">
                  <Headphones className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-slate-900",
                    isOnline ? "bg-emerald-400" : "bg-slate-400"
                  )}
                  title={isOnline ? "Online" : "Offline"}
                />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold flex items-center gap-1.5">
                  Live Support Noewbar
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Staf teknis siap membantu
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label={isMinimized ? "Perbesar obrolan" : "Perkecil obrolan"}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label="Tutup live chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Body when not minimized */}
          {!isMinimized && (
            <>
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/60 text-sm">
                {loading && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                    Memuat percakapan...
                  </div>
                ) : (
                  <>
                    {messages.map((m) => {
                      const isMe = m.sender_type === "TENANT";
                      const isSystem = m.sender_type === "SYSTEM";

                      if (isSystem) {
                        return (
                          <div key={m.id} className="text-center my-2">
                            <span className="inline-block px-3 py-1 bg-slate-200/80 text-slate-700 text-xs rounded-full leading-relaxed border border-slate-300/60 max-w-[90%]">
                              {m.message}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={m.id}
                          className={cn("flex flex-col", isMe ? "items-end" : "items-start")}
                        >
                          <div className="text-[11px] text-slate-400 mb-0.5 px-1 font-medium">
                            {isMe ? "Anda" : m.sender_name}
                          </div>
                          <div
                            className={cn(
                              "max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed break-words shadow-sm",
                              isMe
                                ? "bg-emerald-700 text-white rounded-tr-none"
                                : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-none"
                            )}
                          >
                            {m.message}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 px-1 flex items-center gap-1">
                            {new Date(m.created_at).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {isMe && (
                              <CheckCheck
                                className={cn(
                                  "h-3 w-3",
                                  m.read_by_superadmin ? "text-emerald-600" : "text-slate-400"
                                )}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Quick Prompt Chips (only if few messages) */}
              {messages.length <= 3 && (
                <div className="px-3 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto text-xs no-scrollbar">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="whitespace-nowrap px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 border border-slate-200 rounded-full text-slate-600 text-[11px] transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <div className="p-3 bg-white border-t border-slate-200">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tulis pesan ke tim support... (Enter untuk kirim)"
                    className="flex-1 min-h-[40px] max-h-24 p-2.5 text-xs text-slate-800 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none"
                    disabled={sending}
                  />
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={!inputText.trim() || sending}
                    size="sm"
                    className="h-10 w-10 p-0 flex items-center justify-center rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white shrink-0"
                    aria-label="Kirim pesan"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 flex justify-between items-center px-1">
                  <span>Shift+Enter untuk baris baru</span>
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <StatusDot ok /> Terhubung langsung ke Superadmin
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
