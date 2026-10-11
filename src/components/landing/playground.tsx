"use client";

/**
 * Live simulator for the landing page.
 *
 * Driven only by a real request to /api/playground. When no catalog is wired up
 * the panel says so and shows nothing invented: no sample products, no fake
 * screenshots, no decorative "connected" badge.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Badge, Button, cn } from "@/components/ui";

type ChatTurn = { role: "user" | "assistant"; text: string; meta?: string[] };
type ToolCall = { tool: string; summary: string; simulated: boolean };

const QUICK_PROMPTS = [
  "Kak, masih ada stok?",
  "Boleh minta foto aslinya?",
  "Ongkir ke Surabaya berapa?",
  "Bisa kurang ga kak?",
];

export function PlaygroundPanel() {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{
    configured: boolean;
    catalogAvailable: boolean;
    note: string | null;
    catalogSize: number | null;
  }>({ configured: false, catalogAvailable: false, note: null, catalogSize: null });

  const [probe, setProbe] = useState<{ ok: boolean; latency: number | null; text: string } | null>(
    null
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // First paint: ask the API whether a real catalog is wired up.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/playground", { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        setStatus({
          configured: Boolean(json.configured),
          catalogAvailable: Boolean(json.total),
          note: json.configured
            ? json.warning ?? (json.total ? null : "Katalog terbaca tetapi belum memiliki baris produk.")
            : "Simulator belum dihubungkan ke katalog.",
          catalogSize: typeof json.total === "number" ? json.total : null,
        });
      } catch {
        if (!cancelled) {
          setStatus({
            configured: false,
            catalogAvailable: false,
            note: "Tidak dapat menghubungi server simulator.",
            catalogSize: null,
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (!message || pending) return;

      const history = turns.slice(-6).map((t) => ({ role: t.role, content: t.text }));

      setTurns((prev) => [...prev, { role: "user", text: message }]);
      setInput("");
      setPending(true);

      const started = performance.now();

      try {
        const res = await fetch("/api/playground", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history }),
        });
        const json = await res.json();
        const elapsed = Math.round(performance.now() - started);
        setProbe({ ok: res.ok, latency: elapsed, text: `Respons diterima dalam ${elapsed} ms` });

        if (!json.configured) {
          setTurns((prev) => [
            ...prev,
            {
              role: "assistant",
              text: json.note ?? "Simulator belum dikonfigurasi.",
              meta: ["Katalog belum dihubungkan"],
            },
          ]);
          return;
        }

        if (!json.reply) {
          setTurns((prev) => [
            ...prev,
            {
              role: "assistant",
              text: json.note ?? "Katalog belum tersedia.",
              meta: ["Tanpa data katalog"],
            },
          ]);
          return;
        }

        const meta: string[] = [];
        if (Array.isArray(json.tool_calls) && json.tool_calls.length > 0) {
          for (const t of json.tool_calls as ToolCall[]) {
            meta.push(`${t.tool} ${t.simulated ? "(simulasi)" : ""} - ${t.summary}`);
          }
        } else {
          meta.push("Tanpa pemanggilan tool");
        }
        meta.push(`Latensi ${json.latency_ms} ms${json.degraded ? " - degraded" : ""}`);

        setTurns((prev) => [...prev, { role: "assistant", text: json.reply, meta }]);
      } catch {
        setTurns((prev) => [
          ...prev,
          { role: "assistant", text: "Koneksi ke simulator gagal. Coba lagi.", meta: ["Error jaringan"] },
        ]);
      } finally {
        setPending(false);
      }
    },
    [pending, turns]
  );

  const stateLabel = status.catalogAvailable
    ? "Simulator aktif"
    : status.configured
      ? "Katalog kosong"
      : "Belum dikonfigurasi";

  return (
    <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-overlay">
      {/* header */}
      <div className="flex items-center justify-between gap-3 border-b border-ink-200 bg-ink-50/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-white shadow-flat">
            <Sparkles className="h-3.5 w-3.5 text-ink-400" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-ink">Simulasi percakapan</p>
            <p className="truncate text-2xs text-ink-500">{stateLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {status.catalogSize !== null && (
            <span className="meta hidden sm:inline">{status.catalogSize} baris</span>
          )}
          <Badge tone={status.catalogAvailable ? "signal" : "neutral"}>
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                status.catalogAvailable ? "bg-signal animate-dot-pulse" : "bg-ink-400"
              )}
              aria-hidden="true"
            />
            {status.catalogAvailable ? "live" : "idle"}
          </Badge>
        </div>
      </div>

      {/* empty state (R-27) */}
      {turns.length === 0 && (
        <div className="border-b border-ink-200 bg-ink-50 px-4 py-6">
          <p className="text-sm leading-relaxed text-ink-600">
            {status.configured
              ? status.catalogAvailable
                ? "Ketik pesan seperti pembeli sungguhan. Balasan dibuat model combo-ai memakai katalog asli toko."
                : status.note ?? "Katalog tidak tersedia."
              : "Simulator belum dihubungkan ke katalog Google Sheets. Setel PLAYGROUND_SHEET_URL untuk mengaktifkannya. Tidak ada produk contoh yang ditampilkan."}
          </p>
        </div>
      )}

      {/* transcript */}
      <div ref={scrollRef} className="max-h-[336px] space-y-3 overflow-y-auto px-4 py-4">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={cn(
                "animate-bubble-in max-w-[86%] rounded-lg border px-3.5 py-2.5 text-sm",
                t.role === "user"
                  ? "border-ink-200 bg-ink-50 text-ink"
                  : "border-signal/20 bg-signal-wash text-ink"
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{t.text}</p>
              {t.meta && t.meta.length > 0 && (
                <ul className="mt-2.5 space-y-0.5 border-t border-signal/20 pt-2">
                  {t.meta.map((m, j) => (
                    <li key={j} className="font-mono text-2xs leading-relaxed text-ink-600">
                      {m}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-lg border border-signal/20 bg-signal-wash px-3.5 py-3">
              <span
                className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-signal"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-signal"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-signal"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* composer */}
      <div className="border-t border-ink-200 bg-ink-50/50 px-4 py-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              disabled={pending}
              className="rounded-sm border border-ink-200 bg-white px-2.5 py-1.5 text-2xs font-medium text-ink-600 transition-colors hover:border-ink-300 hover:text-ink disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <label htmlFor="playground-input" className="sr-only">
            Pesan percobaan
          </label>
          <input
            id="playground-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis pesan seperti pembeli..."
            className="field flex-1"
            autoComplete="off"
          />
          <Button type="submit" variant="accent" disabled={pending || !input.trim()} aria-label="Kirim pesan">
            <Send className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{pending ? "Mengirim" : "Kirim"}</span>
          </Button>
        </form>

        {probe && (
          <p className="meta mt-2">
            {probe.text}
            {probe.ok ? "" : " (permintaan gagal)"}
          </p>
        )}
      </div>
    </div>
  );
}
