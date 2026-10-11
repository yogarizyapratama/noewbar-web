"use client";

/**
 * AI Persona settings and Real WhatsApp Simulator tab.
 * Allows store owners to customize the bot's identity, tone, and specific instructions,
 * then test the real AI responses against their live catalog and knowledge base in real-time.
 */

import { useState } from "react";
import {
  Bot,
  CheckCheck,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Wand2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ErrorState,
  PageHeader,
  TextField,
  cn,
} from "@/components/ui";
import type { Health } from "./types";

type SimMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  media?: { url: string; caption?: string; kind: "image" | "video" }[];
  time: string;
};

function cleanAiText(raw: string): string {
  if (!raw) return "";
  let text = raw;
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.replace(/<think>[\s\S]*$/gi, "");
  text = text.replace(
    /\[(?:thinking|reasoning|pikirkan|analisis)\][\s\S]*?\[\/(?:thinking|reasoning|pikirkan|analisis)\]/gi,
    ""
  );
  text = text.replace(/\[(?:thinking|reasoning|pikirkan|analisis)\][\s\S]*$/gi, "");
  text = text.replace(/^\s*\[(?:jawaban|balasan|response|answer|chat|cs|pesan)\]\s*:?\s*/i, "");
  text = text.replace(/\[(?:jawaban|balasan|response|answer)\]/gi, "");
  return text.trim();
}

const TONE_OPTIONS = [
  {
    id: "RAMAH",
    label: "Ramah & Hangat",
    desc: "Menyapa dengan 'Kak / Kakak', ramah, emoji santun secukupnya.",
  },
  {
    id: "FORMAL",
    label: "Formal & Profesional",
    desc: "Menyapa dengan 'Bapak/Ibu' atau 'Kakak', kalimat tertata rapi.",
  },
  {
    id: "ISLAMI",
    label: "Islami & Syar'i",
    desc: "Awali 'Assalamu'alaikum', sapa 'Ukhti/Akhi', sertakan doa berkah.",
  },
  {
    id: "SANTAI",
    label: "Santai & Akrab",
    desc: "Gaya bicara luwes, santai, tetap sopan dan responsif.",
  },
];

const SUGGESTIONS = [
  "Halo kak, produk yang lagi promo apa aja?",
  "Ada gamis ukuran L warna hitam?",
  "Berapa estimasi ongkir ke Pasar Minggu, Jakarta Selatan?",
  "Bisa retur atau tukar ukuran kalau tidak pas?",
  "Saya mau pesan 2 pcs kak, minta nomor rekeningnya",
];

export function PanelSimulator({
  health,
  onRefreshHealth,
}: {
  health: Health | null;
  onRefreshHealth: () => void;
}) {
  const initialSettings = health?.catalog;

  // Persona form state
  const [botName, setBotName] = useState(initialSettings?.bot_name ?? "Admin CS");
  const [botTone, setBotTone] = useState(initialSettings?.bot_tone ?? "RAMAH");
  const [customPrompt, setCustomPrompt] = useState(
    initialSettings?.custom_persona_prompt ?? ""
  );
  const [greetingMessage, setGreetingMessage] = useState(
    initialSettings?.greeting_message ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Simulator state
  const [messages, setMessages] = useState<SimMessage[]>([
    {
      id: "initial-greeting",
      role: "assistant",
      content:
        greetingMessage.trim() ||
        `Halo Kak! Selamat datang di ${health?.tenant?.business_name ?? "toko kami"}. Ada yang bisa kami bantu seputar produk atau pesanan hari ini? 😊`,
      time: "Baru saja",
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [simBusy, setSimBusy] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);

  async function savePersona() {
    setSaving(true);
    setSaveMsg(null);
    setSaveError(null);
    try {
      const res = await fetch("/api/dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_persona",
          bot_name: botName.trim(),
          bot_tone: botTone,
          custom_persona_prompt: customPrompt.trim(),
          greeting_message: greetingMessage.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setSaveMsg("Pengaturan AI Persona berhasil disimpan dan aktif untuk WhatsApp.");
        onRefreshHealth();
      } else {
        setSaveError(json.error ?? "Gagal menyimpan persona.");
      }
    } catch {
      setSaveError("Gagal menghubungi server.");
    } finally {
      setSaving(false);
    }
  }

  async function sendSimMessage(textToSend?: string) {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || simBusy) return;

    setInputMessage("");
    setSimError(null);

    const now = new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: SimMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: text,
      time: now,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setSimBusy(true);

    try {
      // Build history excluding initial static greeting if it's the only one
      const history = nextMessages
        .filter((m) => m.id !== "initial-greeting")
        .slice(-8)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await fetch("/api/simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history.slice(0, -1), // history before current message
          persona_override: {
            bot_name: botName.trim(),
            bot_tone: botTone,
            custom_persona_prompt: customPrompt.trim(),
          },
        }),
      });

      const json = await res.json();
      if (json.ok) {
        const botReply: SimMessage = {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: cleanAiText(json.reply) || "(Tidak ada balasan teks)",
          media: json.media ?? [],
          time: new Date().toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };
        setMessages((prev) => [...prev, botReply]);
      } else {
        setSimError(json.error ?? "Simulator gagal merespons.");
      }
    } catch {
      setSimError("Gagal menghubungi simulator AI.");
    } finally {
      setSimBusy(false);
    }
  }

  function resetChat() {
    setMessages([
      {
        id: `initial-greeting-${Date.now()}`,
        role: "assistant",
        content:
          greetingMessage.trim() ||
          `Halo Kak! Selamat datang di ${health?.tenant?.business_name ?? "toko kami"}. Ada yang bisa kami bantu seputar produk atau pesanan hari ini? 😊`,
        time: "Baru saja",
      },
    ]);
    setSimError(null);
  }

  return (
    <div className="page space-y-6">
      <PageHeader
        eyebrow="Kustomisasi & Pengujian"
        title="AI Persona & Simulator WhatsApp"
        description="Atur nama, gaya bicara, dan instruksi khusus untuk asisten toko Anda. Uji coba langsung di simulator untuk memastikan jawaban bot sudah sesuai keinginan sebelum melayani pembeli sungguhan."
        icon={<Bot className="h-4 w-4" aria-hidden="true" />}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={health?.catalog.configured ? "signal" : "warn"}>
              {health?.catalog.configured ? "Katalog Aktif" : "Katalog Belum Diatur"}
            </Badge>
            <Button variant="secondary" size="sm" onClick={onRefreshHealth}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Segarkan
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-12">
        {/* KOLOM KIRI: PENGATURAN PERSONA */}
        <div className="space-y-4 lg:col-span-5">
          <Card>
            <CardHeader
              icon={<Wand2 className="h-4 w-4" aria-hidden="true" />}
              title="Karakter & Gaya Bicara CS"
              description="Bot akan meniru persona ini di setiap obrolan dengan pembeli."
            />
            <CardBody className="space-y-4">
              <TextField
                id="bot_name"
                label="Nama Panggilan CS / Bot"
                placeholder="Mis. Siti, CS Kayla, Rania, Admin Budi"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                autoComplete="off"
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-ink-600 mb-2">
                  Gaya Bahasa (Tone of Voice)
                </label>
                <div className="grid gap-2">
                  {TONE_OPTIONS.map((t) => (
                    <label
                      key={t.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded border p-3 transition-colors",
                        botTone === t.id
                          ? "border-ink-900 bg-ink-50/70"
                          : "border-ink-200 bg-white hover:border-ink-300"
                      )}
                    >
                      <input
                        type="radio"
                        name="bot_tone"
                        value={t.id}
                        checked={botTone === t.id}
                        onChange={() => setBotTone(t.id)}
                        className="mt-0.5 text-ink focus:ring-ink"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-ink">{t.label}</p>
                        <p className="mt-0.5 text-2xs text-ink-500 leading-relaxed">
                          {t.desc}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="custom_prompt"
                  className="block text-xs font-semibold uppercase tracking-wide text-ink-600"
                >
                  Instruksi Khusus & Catatan Toko
                </label>
                <p className="mt-0.5 text-2xs text-ink-500">
                  Tulis aturan spesifik toko yang wajib ditaati bot dalam melayani pelanggan.
                </p>
                <textarea
                  id="custom_prompt"
                  rows={4}
                  placeholder="Misal: Panggil pembeli dengan sebutan 'Bunda'. Jangan pernah berikan diskon tambahan. Ingatkan bahwa promo terbatas hari ini. Selalu doakan berkah dan tutup dengan ucapan terima kasih."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="mt-1.5 block w-full rounded border border-ink-300 bg-white p-3 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="greeting_message"
                  className="block text-xs font-semibold uppercase tracking-wide text-ink-600"
                >
                  Sapaan Pembuka Standar (Opsional)
                </label>
                <input
                  id="greeting_message"
                  type="text"
                  placeholder="Mis. Halo Kak! Selamat datang di Toko Kami. Ada yang bisa kami bantu?"
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  className="mt-1 block w-full rounded border border-ink-300 bg-white px-3 py-2 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
                />
              </div>

              <div className="pt-2">
                <Button variant="primary" onClick={savePersona} loading={saving} className="w-full">
                  <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                  {saving ? "Menyimpan Persona..." : "Simpan Pengaturan Persona"}
                </Button>
                {saveMsg && (
                  <p className="mt-2 text-center text-xs text-signal-strong font-medium">
                    {saveMsg}
                  </p>
                )}
                {saveError && (
                  <div className="mt-2">
                    <ErrorState title="Gagal menyimpan" description={saveError} compact />
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* KOLOM KANAN: SIMULATOR WHATSAPP INTERAKTIF */}
        <div className="space-y-4 lg:col-span-7">
          <Card className="flex flex-col h-[740px] overflow-hidden border-ink-300 bg-[#EFEAE2]">
            {/* Header WhatsApp Bar */}
            <div className="flex items-center justify-between bg-[#075E54] px-4 py-3 text-white">
              <div className="flex items-center gap-3">
                <div className="relative grid h-9 w-9 place-items-center rounded-full bg-emerald-700 text-white font-bold text-sm">
                  <Bot className="h-5 w-5" />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-none">{botName || "Admin CS"}</p>
                  <p className="mt-1 text-2xs text-emerald-200">
                    online &middot; {health?.tenant?.business_name ?? "Toko Anda"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-emerald-800/80 px-2 py-0.5 font-mono text-2xs text-emerald-100">
                  MODE SIMULASI
                </span>
                <button
                  type="button"
                  onClick={resetChat}
                  title="Bersihkan obrolan simulator"
                  className="rounded p-1.5 text-emerald-200 hover:bg-emerald-700 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Chat Body Container */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#E5DDD5]">
              {/* Security Notification Banner */}
              <div className="mx-auto max-w-xs rounded bg-[#FCF4CB] px-3 py-1.5 text-center text-2xs text-ink-700 shadow-2xs">
                🔒 Pesan di simulator ini menggunakan data katalog & basis pengetahuan asli toko Anda secara aman tanpa memotong stok sungguhan.
              </div>

              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div
                    key={m.id}
                    className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
                  >
                    <div
                      className={cn(
                        "relative max-w-[85%] rounded-lg px-3.5 py-2 text-xs shadow-xs sm:max-w-[75%]",
                        isUser
                          ? "rounded-tr-none bg-[#D9FDD3] text-ink"
                          : "rounded-tl-none bg-white text-ink"
                      )}
                    >
                      {/* Attached Media (Product photos/videos from tools) */}
                      {!isUser && m.media && m.media.length > 0 && (
                        <div className="mb-2 space-y-2">
                          {m.media.map((med, idx) => (
                            <div
                              key={idx}
                              className="overflow-hidden rounded border border-ink-200 bg-ink-50"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={med.url}
                                alt={med.caption || "Lampiran produk"}
                                className="max-h-48 w-full object-cover"
                              />
                              {med.caption && (
                                <p className="p-1.5 text-2xs text-ink-600">{med.caption}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>

                      <div className="mt-1 flex items-center justify-end gap-1 text-2xs text-ink-400">
                        <span>{m.time}</span>
                        {isUser && <CheckCheck className="h-3.5 w-3.5 text-sky-500" />}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {simBusy && (
                <div className="flex items-start">
                  <div className="rounded-lg rounded-tl-none bg-white px-3.5 py-2 text-xs text-ink-500 shadow-xs flex items-center gap-1.5">
                    <span className="font-semibold text-ink-700">{botName}</span>
                    <span className="italic">sedang mengetik...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Suggestions Chips */}
            <div className="border-t border-ink-200 bg-[#F0F2F5] px-3 py-2">
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
                Uji Coba Cepat:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={simBusy}
                    onClick={() => sendSimMessage(s)}
                    className="rounded border border-ink-300 bg-white px-2.5 py-1 text-2xs text-ink-700 transition-colors hover:border-ink-500 hover:bg-ink-100 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendSimMessage();
              }}
              className="border-t border-ink-200 bg-[#F0F2F5] p-3"
            >
              {simError && (
                <div className="mb-2">
                  <ErrorState title="Simulasi gagal" description={simError} compact />
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ketik pesan pembeli di sini untuk menguji bot..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  disabled={simBusy}
                  className="flex-1 rounded-full border border-ink-300 bg-white px-4 py-2.5 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!inputMessage.trim() || simBusy}
                  loading={simBusy}
                  className="rounded-full h-10 w-10 p-0 flex items-center justify-center shrink-0"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
