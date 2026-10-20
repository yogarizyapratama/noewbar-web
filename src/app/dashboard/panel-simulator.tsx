"use client";

/**
 * AI Persona settings and Real WhatsApp Simulator tab.
 * Allows store owners to customize the bot's identity, tone, and specific instructions,
 * then test the real AI responses against their live catalog and knowledge base in real-time.
 */

import { useState } from "react";
import {
  Bot,
  Check,
  CheckCheck,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Sparkles,
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
  telemetry?: {
    model?: string;
    latency_ms?: number;
    tools?: Array<{ tool: string; summary?: string }>;
    catalog_source?: string;
  };
};

function cleanAiText(raw: string): string {
  if (!raw) return "";
  let text = raw;
  text = text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "");
  text = text.replace(/<think>[\s\S]*$/gi, "");
  text = text.replace(/^[\s\S]*?<\/think>\s*/gi, "");
  text = text.replace(
    /\[(?:thinking|reasoning|pikirkan|analisis)\][\s\S]*?\[\/(?:thinking|reasoning|pikirkan|analisis)\]\s*/gi,
    ""
  );
  text = text.replace(/\[(?:thinking|reasoning|pikirkan|analisis)\][\s\S]*$/gi, "");
  text = text.replace(/^[\s\S]*?\[\/(?:thinking|reasoning|pikirkan|analisis)\]\s*/gi, "");
  text = text.replace(/<\/?think>/gi, "");
  text = text.replace(/<pesan_pembeli>[\s\S]*?<\/pesan_pembeli>/gi, "");
  text = text.replace(/<\/?pesan_pembeli>/gi, "");
  text = text.replace(/\[JID pembeli:[^\]]*\]/gi, "");
  text = text.replace(/(?:Sekarang,?\s+)?saya\s+(?:perlu|harus|akan)\s+(?:mencari|mengecek|memanggil|menggunakan)[\s\S]*?(?:tool_[a-z_]+)[\s\S]*?\.\s*/gi, "");
  text = text.replace(/^\s*\[(?:jawaban|balasan|response|answer|chat|cs|pesan)\]\s*:?\s*/i, "");
  text = text.replace(/\[(?:jawaban|balasan|response|answer)\]/gi, "");
  return text.trim();
}

const TONE_OPTIONS = [
  {
    id: "RAMAH",
    label: "Ramah & Hangat",
    icon: "😊",
    badge: "Paling Populer",
    desc: "Menyapa dengan 'Kak / Kakak', ramah, hangat, emoji santun secukupnya.",
  },
  {
    id: "FORMAL",
    label: "Formal & Profesional",
    icon: "💼",
    badge: "B2B & Resmi",
    desc: "Menyapa dengan 'Bapak/Ibu' atau 'Kakak', kalimat tertata rapi tanpa singkatan.",
  },
  {
    id: "ISLAMI",
    label: "Islami & Syar'i",
    icon: "🕌",
    badge: "Syar'i",
    desc: "Salam santun di awal, sapa 'Ukhti/Akhi', sertakan doa berkah dan rasa syukur.",
  },
  {
    id: "SANTAI",
    label: "Santai & Akrab",
    icon: "⚡",
    badge: "Fast Closing",
    desc: "Gaya bicara luwes, akrab dan responsif, cocok untuk anak muda & promo.",
  },
];

const SUGGESTIONS = [
  "Halo kak, produk yang lagi promo apa aja?",
  "Ada gamis ukuran L warna hitam?",
  "Berapa estimasi ongkir ke Pasar Minggu, Jakarta Selatan?",
  "Bisa retur atau tukar ukuran kalau tidak pas?",
  "Saya mau pesan 2 pcs kak, minta nomor rekeningnya",
];

const PERSONA_PRESETS = [
  {
    id: "friendly",
    label: "Ramah & Konsultatif",
    desc: "Cocok untuk Skincare, Fashion, & Produk Konsultasi",
    icon: "🌸",
    botName: "Siti (Beauty Advisor)",
    tone: "RAMAH",
    prompt:
      "Panggil pembeli dengan sebutan 'Kakak' atau 'Bunda'. Berikan edukasi singkat tentang manfaat bahan/kandungan produk sebelum menawarkan varian yang cocok. Bersikap sabar dan tawarkan rekomendasi produk komplementer.",
    greeting:
      "Halo Kak! Selamat datang di toko kami. Ada produk atau keluhan tertentu yang ingin dikonsultasikan?",
  },
  {
    id: "flash_sale",
    label: "Flash Sale & Closing",
    desc: "Dorong checkout segera & amankan kuota promo terbatas",
    icon: "🔥",
    botName: "Admin Promo",
    tone: "SANTAI",
    prompt:
      "Fokus pada konversi dan closing cepat. Ingatkan bahwa kuota promo dan stok terbatas hari ini. Jelaskan diskon bertingkat atau gratis ongkir jika beli lebih dari 1 pcs. Dorong pembeli segera konfirmasi transfer.",
    greeting:
      "Halo Kak! Promo spesial hari ini masih ada kuota terbatas. Mau pesan varian apa biar kami amankan stoknya?",
  },
  {
    id: "formal",
    label: "Formal & Profesional",
    desc: "Bahasa baku rapi untuk B2B, Elektronik, & Bisnis Resmi",
    icon: "👔",
    botName: "Customer Service",
    tone: "FORMAL",
    prompt:
      "Gunakan bahasa Indonesia baku yang sopan dan profesional. Panggil pelanggan dengan sebutan 'Bapak/Ibu' atau 'Kakak'. Berikan detail spesifikasi lengkap, garansi keaslian, dan prosedur pengiriman terasuransi.",
    greeting:
      "Selamat datang. Terima kasih telah menghubungi kami. Ada yang dapat kami bantu terkait katalog produk kami?",
  },
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
  const [messages, setMessages] = useState<SimMessage[]>([]);
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
      const history = nextMessages
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
          telemetry: {
            model: json.model,
            latency_ms: json.latency_ms,
            tools: json.tools ?? [],
            catalog_source: json.catalog_source,
          },
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
    setMessages([]);
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
            <Badge tone={health?.catalog?.configured ? "signal" : "warn"}>
              {health?.catalog?.configured ? "Katalog Aktif" : "Katalog Belum Diatur"}
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
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    Preset Persona Siap Pakai (1-Klik)
                  </span>
                  <span className="text-[10px] text-slate-400">Pilih untuk isi otomatis</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {PERSONA_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setBotName(p.botName);
                        setBotTone(p.tone);
                        setCustomPrompt(p.prompt);
                        setGreetingMessage(p.greeting);
                      }}
                      className="group relative flex flex-col justify-between rounded-xl border border-slate-200/90 bg-slate-50/60 p-3 text-left transition-all duration-200 hover:border-emerald-400 hover:bg-white hover:shadow-xs hover:-translate-y-0.5"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg">{p.icon}</span>
                          <span className="rounded-full bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                            1-KLIK
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                          {p.label}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {p.desc}
                        </p>
                      </div>
                      <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-emerald-600 group-hover:text-emerald-700">
                        <span>Terapkan</span>
                        <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <TextField
                id="bot_name"
                label="Nama Panggilan CS / Bot"
                placeholder="Mis. Siti, CS Kayla, Rania, Admin Budi"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                autoComplete="off"
              />

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Gaya Bahasa (Tone of Voice)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TONE_OPTIONS.map((t) => {
                    const isSelected = botTone === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setBotTone(t.id)}
                        className={cn(
                          "relative flex flex-col text-left p-3.5 rounded-xl border transition-all duration-200",
                          isSelected
                            ? "border-emerald-500 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 shadow-sm shadow-emerald-500/10 ring-2 ring-emerald-500/20"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <span className="text-base">{t.icon}</span>
                            <span>{t.label}</span>
                          </span>
                          {isSelected && (
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500 text-white shadow-xs">
                              <Check className="h-3 w-3 stroke-[3]" />
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="custom_prompt"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Instruksi Khusus & Catatan Toko
                </label>
                <p className="mt-0.5 text-2xs text-slate-500">
                  Tulis aturan spesifik toko yang wajib ditaati bot dalam melayani pelanggan.
                </p>
                <textarea
                  id="custom_prompt"
                  rows={4}
                  placeholder="Misal: Panggil pembeli dengan sebutan 'Bunda'. Jangan pernah berikan diskon tambahan. Ingatkan bahwa promo terbatas hari ini. Selalu doakan berkah dan tutup dengan ucapan terima kasih."
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white p-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                />
              </div>

              <div>
                <label
                  htmlFor="greeting_message"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600"
                >
                  Sapaan Pembuka Standar (Opsional)
                </label>
                <input
                  id="greeting_message"
                  type="text"
                  placeholder="Mis. Halo Kak! Selamat datang di Toko Kami. Ada yang bisa kami bantu?"
                  value={greetingMessage}
                  onChange={(e) => setGreetingMessage(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all"
                />
              </div>

              <div className="pt-2">
                <Button variant="accent" onClick={savePersona} loading={saving} className="w-full">
                  <Save className="h-4 w-4 mr-2" aria-hidden="true" />
                  {saving ? "Menyimpan Persona..." : "Simpan Pengaturan Persona"}
                </Button>
                {saveMsg && (
                  <p className="mt-2 text-center text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
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
          <div className="flex flex-col h-[calc(100dvh-200px)] min-h-[540px] lg:h-[760px] rounded-3xl border-2 border-slate-800/10 shadow-2xl overflow-hidden bg-[#EFEAE2] transition-all">
            {/* Header WhatsApp Bar */}
            <div className="flex items-center justify-between bg-gradient-to-r from-[#005C4B] via-[#075E54] to-[#128C7E] px-4 py-3.5 text-white shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative grid h-10 w-10 place-items-center rounded-full bg-white/20 text-white font-bold text-sm shadow-inner backdrop-blur-xs">
                  <Bot className="h-5 w-5" />
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-[#075E54]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold tracking-tight text-white leading-none">{botName || "Admin CS"}</p>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-2xs text-emerald-200/90 font-medium">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    <span>online &middot; {health?.tenant?.business_name ?? "Toko Anda"}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-black/20 border border-white/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider text-emerald-100 uppercase">
                  Mode Simulasi
                </span>
                <button
                  type="button"
                  onClick={resetChat}
                  title="Bersihkan percakapan simulator"
                  className="rounded-xl p-2 text-emerald-100 hover:bg-white/15 hover:text-white transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Chat Body Container with subtle WhatsApp wallpaper styling */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#efeae2]/95 bg-[radial-gradient(#00000008_1px,transparent_1px)] [background-size:16px_16px]">
              {/* Security Banner */}
              <div className="mx-auto max-w-sm rounded-xl bg-[#FFF9D2]/95 border border-amber-300/60 px-3.5 py-1.5 text-center text-2xs font-medium text-amber-900 shadow-2xs">
                🔒 Data katalog & basis pengetahuan toko digunakan secara aman tanpa memotong stok sungguhan.
              </div>

              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                  <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-100/80 text-emerald-600 shadow-xs">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Simulator AI Siap Digunakan</p>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Pilih pertanyaan cepat di bawah atau ketik pesan untuk menguji balasan cerdas bot CS Anda.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isUser = m.role === "user";
                  return (
                    <div
                      key={m.id}
                      className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
                    >
                      <div
                        className={cn(
                          "relative max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs sm:max-w-[75%] transition-all",
                          isUser
                            ? "rounded-tr-xs bg-[#D9FDD3] text-slate-900 border border-emerald-200/50"
                            : "rounded-tl-xs bg-white text-slate-900 border border-slate-200/70"
                        )}
                      >
                        {/* Attached Media */}
                        {!isUser && m.media && m.media.length > 0 && (
                          <div className="mb-2 space-y-2">
                            {m.media.map((med, idx) => (
                              <div
                                key={idx}
                                className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-2xs"
                              >
                                <img
                                  src={med.url}
                                  alt={med.caption || "Lampiran produk"}
                                  className="max-h-52 w-full object-cover"
                                />
                                {med.caption && (
                                  <p className="p-2 text-2xs font-medium text-slate-600">{med.caption}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="whitespace-pre-wrap leading-relaxed text-[13px]">{m.content}</p>

                        {/* Telemetry pill */}
                        {!isUser && m.telemetry && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1 text-[10px] text-slate-500 font-mono">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {m.telemetry.latency_ms !== undefined && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5 font-bold border border-emerald-200 shadow-2xs">
                                  ⚡ {m.telemetry.latency_ms}ms
                                </span>
                              )}
                              {m.telemetry.model && (
                                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-700 font-medium">
                                  {m.telemetry.model}
                                </span>
                              )}
                              {m.telemetry.catalog_source && (
                                <span className="text-slate-400">
                                  {m.telemetry.catalog_source}
                                </span>
                              )}
                            </div>
                            {m.telemetry.tools && m.telemetry.tools.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {m.telemetry.tools.map((t, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="inline-flex items-center gap-1 rounded-md bg-sky-50 text-sky-800 px-2 py-0.5 border border-sky-200/80 font-medium"
                                    title={t.summary || t.tool}
                                  >
                                    🛠️ {t.tool}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono">
                          <span>{m.time}</span>
                          {isUser && <CheckCheck className="h-3.5 w-3.5 text-sky-500" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing indicator */}
              {simBusy && (
                <div className="flex items-start">
                  <div className="rounded-2xl rounded-tl-xs bg-white px-4 py-2 text-xs text-slate-500 shadow-xs border border-slate-200/60 flex items-center gap-2">
                    <span className="font-bold text-slate-700">{botName}</span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <span>mengetik</span>
                      <span className="inline-flex gap-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                      </span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Suggestions Chips */}
            <div className="border-t border-slate-200/80 bg-white/95 px-3 py-2.5 backdrop-blur-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  Pertanyaan Cepat:
                </span>
                <span className="text-[10px] text-slate-400">Klik untuk kirim</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={simBusy}
                    onClick={() => sendSimMessage(s)}
                    className="min-h-[32px] flex items-center rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1 text-xs text-slate-700 transition-all hover:border-emerald-400 hover:bg-emerald-50/80 hover:text-emerald-800 hover:shadow-2xs disabled:opacity-50"
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
              className="border-t border-slate-200 bg-white p-3"
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
                  className="flex-1 min-h-[44px] rounded-full border border-slate-300 bg-slate-50/80 px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/15 transition-all"
                />
                <button
                  type="submit"
                  disabled={!inputMessage.trim() || simBusy}
                  className="rounded-full h-11 w-11 p-0 flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/25 hover:shadow-lg hover:from-emerald-500 hover:to-teal-400 disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
                  title="Kirim pesan simulasi"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
