"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, MessageSquare, Send, ShieldCheck, Smartphone, Users } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Badge } from "@/components/ui";

export function BroadcastCard() {
  const [segment, setSegment] = useState<"all" | "unpaid" | "inquiry">("all");
  const [message, setMessage] = useState(
    "Halo Kak! Ada promo spesial dan diskon ongkir terbatas untuk belanja hari ini di toko kami. Yuk cek katalog terbaru kami ya! ✨"
  );
  const [testPhone, setTestPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    note?: string;
    total_targets?: number;
    sent_count?: number;
    failed_count?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestSend = async () => {
    if (!testPhone.trim()) {
      setError("Masukkan nomor WhatsApp uji coba Anda.");
      return;
    }
    setError(null);
    setResult(null);
    setTestLoading(true);
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          segment,
          test_phone: testPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengirim pesan uji coba.");
      }
      setResult({
        success: true,
        note: `Pesan uji coba terkirim ke ${testPhone}!`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setTestLoading(false);
    }
  };

  const handleBroadcast = async () => {
    if (message.trim().length < 5) {
      setError("Isi pesan minimal 5 karakter.");
      return;
    }
    const confirmed = window.confirm(
      `Kirim broadcast ke segmen "${segment.toUpperCase()}"? Sistem akan mengirimkan pesan dengan jeda anti-ban otomatis.`
    );
    if (!confirmed) return;

    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          segment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menjalankan broadcast.");
      }
      setResult({
        success: true,
        total_targets: data.total_targets,
        sent_count: data.sent_count,
        failed_count: data.failed_count,
        note: data.note || `Broadcast selesai: ${data.sent_count} kontak berhasil menerima pesan.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-ink-200">
      <CardHeader
        title="Broadcast & Re-Engagement Kampanye"
        description="Kirim promosi WhatsApp tertarget dengan jeda pengetikan acak (jitter) dan proteksi opt-out STOP otomatis."
        icon={<MessageSquare className="h-4 w-4 text-signal-strong" />}
        actions={
          <Badge tone="signal" className="w-fit">
            <ShieldCheck className="h-3 w-3 mr-1" /> Anti-Spam Safe
          </Badge>
        }
      />
      <CardBody className="space-y-4">
        {/* Segmen Penerima */}
        <div>
          <label className="text-xs font-semibold text-ink-700 flex items-center gap-1.5 mb-1.5">
            <Users className="h-3.5 w-3.5" /> Pilih Segmen Kontak Target
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: "all", label: "Semua Pelanggan", desc: "Kontak yang pernah berinteraksi" },
              { id: "unpaid", label: "Belum Bayar", desc: "Ada order UNPAID aktif" },
              { id: "inquiry", label: "Baru Bertanya", desc: "Pernah chat tapi belum checkout" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSegment(s.id as any)}
                className={`rounded-lg border p-2.5 text-left transition-all ${
                  segment === s.id
                    ? "border-ink-900 bg-ink-900 text-white shadow-flat"
                    : "border-ink-200 bg-white text-ink hover:border-ink-300"
                }`}
              >
                <p className="text-xs font-bold leading-tight">{s.label}</p>
                <p className={`mt-0.5 text-[11px] ${segment === s.id ? "text-ink-300" : "text-ink-500"}`}>
                  {s.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Message Input & Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-ink-700">Isi Pesan Promosi</label>
              <span className="text-[11px] font-mono text-ink-400">{message.length}/1000</span>
            </div>
            <textarea
              rows={5}
              maxLength={1000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tulis pesan promosi atau kabar toko..."
              className="w-full rounded-lg border border-ink-300 bg-white p-3 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-ink-500">
              *Footer proteksi <em>&quot;Balas STOP untuk berhenti&quot;</em> ditambahkan otomatis demi kepatuhan anti-spam.
            </p>
          </div>

          {/* WhatsApp Chat Preview */}
          <div>
            <p className="text-xs font-semibold text-ink-700 mb-1.5">Pratinjau Gelembung Chat WhatsApp</p>
            <div className="rounded-xl border border-ink-200 bg-[#EFEAE2] p-4 min-h-[130px] flex flex-col justify-end">
              <div className="max-w-[85%] self-end rounded-lg bg-[#E7FFDB] p-3 text-xs text-ink-900 shadow-flat space-y-2">
                <p className="whitespace-pre-wrap leading-relaxed">{message}</p>
                <p className="text-[10px] text-ink-500 italic border-t border-emerald-900/10 pt-1">
                  Balas STOP untuk berhenti menerima info promo.
                </p>
                <div className="text-right text-[10px] text-ink-400">10:00 ✓✓</div>
              </div>
            </div>
          </div>
        </div>

        {/* Test Send Row */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-ink-100">
          <div className="relative w-full sm:w-64">
            <Smartphone className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink-400" />
            <input
              type="text"
              placeholder="08123456789 (Uji nomor pribadi)"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="w-full rounded-lg border border-ink-200 bg-white pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-400 focus:border-ink-500 focus:outline-none"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            loading={testLoading}
            onClick={handleTestSend}
            className="w-full sm:w-auto text-xs"
          >
            Kirim Tes Uji Coba
          </Button>

          <div className="sm:ml-auto w-full sm:w-auto">
            <Button
              variant="primary"
              size="sm"
              loading={loading}
              onClick={handleBroadcast}
              className="w-full sm:w-auto text-xs"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Kirim Broadcast Segmen
            </Button>
          </div>
        </div>

        {/* Results / Alerts */}
        {result && (
          <div className="rounded-xl bg-signal-wash border border-signal/30 p-3 text-xs text-signal-strong flex items-start gap-2 animate-fade-up">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{result.note}</p>
              {result.total_targets !== undefined && (
                <p className="mt-0.5 text-[11px] text-ink-600">
                  Target: {result.total_targets} | Terkirim: {result.sent_count} | Gagal: {result.failed_count}
                </p>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-danger-wash border border-danger/30 p-3 text-xs text-danger-strong flex items-center gap-2 animate-fade-up">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
