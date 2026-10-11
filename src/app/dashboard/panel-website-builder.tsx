"use client";

/**
 * AI Website Builder & Online Store Generator (USP 2 & 4).
 *
 * Provides:
 * - List of tenant websites with Live/Draft indicators.
 * - AI Website Generation from natural language prompts & business context.
 * - Ready-to-use Template Library (Skincare, Fashion, UMKM, etc.).
 * - Visual Block-Based Editor:
 *   - Sections canvas preview (Responsive Desktop & Mobile).
 *   - Per-block "Edit dengan AI" with contextual structured output.
 *   - Reorder, toggle visibility, and customize content.
 *   - Instant Publish / Unpublish to public /store/[slug] URL.
 *   - Toggle as AI Customer Service Knowledge Source (USP 3).
 */

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  Globe,
  Layers,
  Layout,
  Monitor,
  Save,
  Smartphone,
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
  InlineLoading,
  cn,
} from "@/components/ui";
import { TEMPLATES, type WebsiteSection, type WebsiteTemplate } from "@/lib/website/builder";

type WebsiteRecord = {
  id: string;
  name: string;
  slug: string;
  template_id: string | null;
  title: string | null;
  description: string | null;
  theme_config: any;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  published_at: string | null;
  sections: WebsiteSection[];
  is_knowledge_source: boolean;
  updated_at: string;
};

export function PanelWebsiteBuilder() {
  const [websites, setWebsites] = useState<WebsiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"list" | "create_ai" | "templates" | "editor">("list");

  // Selected website for editor
  const [currentSite, setCurrentSite] = useState<WebsiteRecord | null>(null);
  const [sections, setSections] = useState<WebsiteSection[]>([]);
  const [selectedSecId, setSelectedSecId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // AI Prompt generation state
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTemplateId, setAiTemplateId] = useState("skincare-glow");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGenError, setAiGenError] = useState<string | null>(null);

  // Per-block AI editing state
  const [blockAiPrompt, setBlockAiPrompt] = useState("");
  const [blockAiBusy, setBlockAiBusy] = useState(false);
  const [blockAiMsg, setBlockAiMsg] = useState<string | null>(null);

  // Editor saving state
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editorMsg, setEditorMsg] = useState<string | null>(null);

  useEffect(() => {
    loadWebsites();
  }, []);

  async function loadWebsites() {
    setLoading(true);
    try {
      const res = await fetch("/api/websites");
      const json = await res.json();
      if (json.ok) {
        setWebsites(json.websites || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function startEditor(site: WebsiteRecord) {
    setCurrentSite(site);
    const secs = Array.isArray(site.sections) ? site.sections : [];
    setSections(secs);
    setSelectedSecId(secs[0]?.id || null);
    setActiveTab("editor");
    setEditorMsg(null);
  }

  async function handleCreateWithAi() {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiGenError(null);
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_ai",
          prompt: aiPrompt.trim(),
          template_id: aiTemplateId,
        }),
      });
      const json = await res.json();
      if (json.ok && json.website) {
        await loadWebsites();
        startEditor(json.website);
      } else {
        setAiGenError(json.error || "Gagal membuat website dengan AI.");
      }
    } catch {
      setAiGenError("Gagal menghubungi server AI.");
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleUseTemplate(template: WebsiteTemplate) {
    setLoading(true);
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: `${template.name} Store`,
          template_id: template.id,
        }),
      });
      const json = await res.json();
      if (json.ok && json.website) {
        await loadWebsites();
        startEditor(json.website);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!currentSite) return;
    setSavingDraft(true);
    setEditorMsg(null);
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_draft",
          id: currentSite.id,
          name: currentSite.name,
          title: currentSite.title,
          description: currentSite.description,
          sections,
          is_knowledge_source: currentSite.is_knowledge_source,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setEditorMsg("Draft berhasil disimpan!");
        await loadWebsites();
      }
    } catch {
      setEditorMsg("Gagal menyimpan draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handlePublish() {
    if (!currentSite) return;
    setPublishing(true);
    setEditorMsg(null);
    try {
      await handleSaveDraft();
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish", id: currentSite.id }),
      });
      const json = await res.json();
      if (json.ok) {
        setEditorMsg(`Website berhasil dipublikasikan! Dapat diakses di /store/${currentSite.slug}`);
        setCurrentSite({ ...currentSite, status: "PUBLISHED" });
        await loadWebsites();
      }
    } catch {
      setEditorMsg("Gagal mempublikasikan website.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleEditBlockWithAi() {
    if (!currentSite || !selectedSecId || !blockAiPrompt.trim()) return;
    const target = sections.find((s) => s.id === selectedSecId);
    if (!target) return;

    setBlockAiBusy(true);
    setBlockAiMsg(null);
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_section_ai",
          website_id: currentSite.id,
          section: target,
          prompt: blockAiPrompt.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok && json.updatedSection) {
        setSections((prev) =>
          prev.map((s) => (s.id === selectedSecId ? json.updatedSection : s))
        );
        setBlockAiMsg("Section berhasil diperbarui oleh AI!");
        setBlockAiPrompt("");
      } else {
        setBlockAiMsg(json.error || "Gagal mengubah section dengan AI.");
      }
    } catch {
      setBlockAiMsg("Gagal menghubungi AI editor.");
    } finally {
      setBlockAiBusy(false);
    }
  }

  function moveSection(idx: number, dir: "up" | "down") {
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === sections.length - 1) return;
    const targetIdx = dir === "up" ? idx - 1 : idx + 1;
    const next = [...sections];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    setSections(next);
  }

  function toggleSectionVisibility(id: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visibility: !s.visibility } : s))
    );
  }

  const selectedSection = sections.find((s) => s.id === selectedSecId);

  return (
    <div className="page space-y-6">
      {/* Tab Header Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-ink-100 pb-4 gap-4">
        <div>
          <p className="eyebrow text-ink-500">Website Toko Online</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            AI Website Builder & Store Generator
          </h1>
          <p className="mt-1 text-xs text-ink-600 sm:text-sm">
            Bangun toko online dan landing page profesional menggunakan prompt AI. Terhubung otomatis dengan katalog produk dan customer service WhatsApp Anda.
          </p>
        </div>

        {activeTab !== "editor" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={activeTab === "list" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveTab("list")}
            >
              <Globe className="mr-1.5 h-3.5 w-3.5" />
              Website Saya ({websites.length})
            </Button>
            <Button
              variant={activeTab === "create_ai" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveTab("create_ai")}
            >
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              Buat dengan AI
            </Button>
            <Button
              variant={activeTab === "templates" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setActiveTab("templates")}
            >
              <Layout className="mr-1.5 h-3.5 w-3.5" />
              Galeri Template
            </Button>
          </div>
        )}
      </div>

      {/* VIEW 1: DAFTAR WEBSITE */}
      {activeTab === "list" && (
        <div className="space-y-4">
          {loading ? (
            <InlineLoading label="Memuat website..." />
          ) : websites.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-ink-200 p-12 text-center bg-white">
              <Globe className="mx-auto h-12 w-12 text-ink-300 mb-3" />
              <h3 className="text-base font-bold text-ink">Belum Ada Website yang Dibuat</h3>
              <p className="mt-1 text-xs text-ink-500 max-w-sm mx-auto leading-relaxed">
                Buat toko online resmi Anda sekarang dengan bantuan AI dalam hitungan detik atau pilih dari template siap pakai.
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button size="sm" variant="primary" onClick={() => setActiveTab("create_ai")}>
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" />
                  Buat dengan AI Sekarang
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setActiveTab("templates")}>
                  <Layout className="mr-1.5 h-3.5 w-3.5" />
                  Pilih Template
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {websites.map((w) => {
                const isPub = w.status === "PUBLISHED";
                return (
                  <Card key={w.id} className="flex flex-col justify-between p-5 hover:shadow-raised transition-all">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge tone={isPub ? "signal" : "neutral"}>
                          {isPub ? "Dipublikasikan" : "Draft"}
                        </Badge>
                        {w.is_knowledge_source && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <Bot className="h-3 w-3" />
                            Sumber AI
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-ink">{w.name}</h3>
                      <p className="mt-1 text-xs text-ink-500 line-clamp-2">
                        {w.description || "Toko online resmi terhubung ke WhatsApp."}
                      </p>

                      <div className="mt-4 rounded-lg bg-ink-50 p-2.5 font-mono text-2xs text-ink-600 flex items-center justify-between">
                        <span className="truncate">/store/{w.slug}</span>
                        {isPub && (
                          <a
                            href={`/store/${w.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-signal-strong hover:underline inline-flex items-center gap-1 font-semibold"
                          >
                            Buka <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-ink-100 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        className="flex-1 text-xs"
                        onClick={() => startEditor(w)}
                      >
                        Buka Visual Editor
                      </Button>
                      {isPub && (
                        <a
                          href={`/store/${w.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-ink-200 p-2 text-ink-600 hover:bg-ink-50"
                          title="Lihat Website Publik"
                        >
                          <Eye className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: BUAT DENGAN AI */}
      {activeTab === "create_ai" && (
        <Card className="max-w-3xl mx-auto">
          <CardHeader
            icon={<Wand2 className="h-5 w-5 text-signal-strong" />}
            title="Generate Website Toko dengan AI"
            description="Tulis instruksi dalam bahasa Indonesia bebas. AI akan merancang struktur section, copywriting, headline, dan menghubungkan katalog produk Anda."
          />
          <CardBody className="space-y-5">
            {aiGenError && <ErrorState title="Gagal membuat website" description={aiGenError} compact />}

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-600">
                Pilih Kategori Gaya Toko
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAiTemplateId(t.id)}
                    className={cn(
                      "rounded-xl border p-3.5 text-left transition-all",
                      aiTemplateId === t.id
                        ? "border-signal bg-signal-wash/50 shadow-flat ring-1 ring-signal"
                        : "border-ink-200 bg-white hover:border-ink-300"
                    )}
                  >
                    <p className="text-xs font-bold text-ink">{t.name}</p>
                    <p className="text-2xs text-ink-500 mt-0.5">{t.category}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-600">
                Instruksi Prompt untuk AI *
              </label>
              <textarea
                rows={5}
                placeholder="Misal: Buatkan landing page premium untuk brand gamis syari saya. Gunakan warna hijau sage dan putih, tonjolkan bahan sutra adem, garansi tukar ukuran 3 hari, FAQ lengkap, dan tombol pesanan via WhatsApp."
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                className="w-full rounded-xl border border-ink-200 bg-white p-3 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none"
              />
              <p className="mt-1 text-2xs text-ink-500">
                AI akan membaca data produk toko yang sudah ada untuk mengisi showcase katalog secara nyata.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-ink-100">
              <Button variant="ghost" onClick={() => setActiveTab("list")}>
                Batal
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateWithAi}
                loading={aiGenerating}
                disabled={!aiPrompt.trim()}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Generate Website Sekarang
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* VIEW 3: TEMPLATE GALLERY */}
      {activeTab === "templates" && (
        <div className="space-y-4">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((tmpl) => (
              <Card key={tmpl.id} className="flex flex-col justify-between overflow-hidden">
                <div className={cn("h-36 bg-gradient-to-br p-5 flex flex-col justify-between", tmpl.preview_bg)}>
                  <span className="self-start rounded bg-white/90 px-2.5 py-0.5 text-2xs font-bold text-ink shadow-sm">
                    {tmpl.category}
                  </span>
                  <div>
                    <h3 className="text-lg font-extrabold text-ink">{tmpl.name}</h3>
                    <p className="text-xs text-ink-600 font-medium">{tmpl.default_sections.length} Section Siap Pakai</p>
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-ink-600 leading-relaxed">{tmpl.description}</p>

                  <div className="mt-5 pt-3 border-t border-ink-100">
                    <Button
                      variant="primary"
                      size="sm"
                      className="w-full text-xs font-semibold"
                      onClick={() => handleUseTemplate(tmpl)}
                    >
                      Gunakan Template Ini
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 4: VISUAL BLOCK EDITOR */}
      {activeTab === "editor" && currentSite && (
        <div className="space-y-4">
          {/* Top Bar Editor */}
          <div className="rounded-xl border border-ink-200 bg-white p-3 shadow-flat flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button size="sm" variant="ghost" onClick={() => setActiveTab("list")}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Kembali
              </Button>
              <div className="h-5 w-px bg-ink-200" />
              <div>
                <span className="text-xs font-bold text-ink">{currentSite.name}</span>
                <span className="ml-2 font-mono text-2xs text-ink-500">
                  /store/{currentSite.slug}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Responsive Device Switch */}
              <div className="flex items-center rounded-lg border border-ink-200 bg-ink-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewDevice("desktop")}
                  className={cn(
                    "rounded px-2.5 py-1 text-2xs font-semibold transition-colors flex items-center gap-1",
                    previewDevice === "desktop" ? "bg-white text-ink shadow-flat" : "text-ink-500"
                  )}
                >
                  <Monitor className="h-3 w-3" />
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice("mobile")}
                  className={cn(
                    "rounded px-2.5 py-1 text-2xs font-semibold transition-colors flex items-center gap-1",
                    previewDevice === "mobile" ? "bg-white text-ink shadow-flat" : "text-ink-500"
                  )}
                >
                  <Smartphone className="h-3 w-3" />
                  Mobile
                </button>
              </div>

              <Button size="sm" variant="secondary" onClick={handleSaveDraft} loading={savingDraft}>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Simpan Draft
              </Button>

              <Button size="sm" variant="primary" onClick={handlePublish} loading={publishing}>
                <Globe className="mr-1.5 h-3.5 w-3.5" />
                Publikasikan Toko
              </Button>

              {currentSite.status === "PUBLISHED" && (
                <a
                  href={`/store/${currentSite.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  title="Buka Website Publik"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>

          {editorMsg && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-medium">
              {editorMsg}
            </div>
          )}

          {/* Editor Grid: Left = Section Tree & AI Editor, Right = Live Canvas Preview */}
          <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
            {/* Panel Kiri: Section List & Block AI Editor */}
            <div className="space-y-4">
              <Card>
                <CardHeader
                  icon={<Layers className="h-4 w-4" />}
                  title="Daftar Section"
                  description="Pilih section untuk diedit atau diubah instruksi AI-nya."
                />
                <CardBody className="p-2 space-y-1">
                  {sections.map((sec, idx) => (
                    <div
                      key={sec.id}
                      onClick={() => setSelectedSecId(sec.id)}
                      className={cn(
                        "flex items-center justify-between rounded-lg p-2.5 text-xs font-semibold cursor-pointer transition-all border",
                        selectedSecId === sec.id
                          ? "border-signal bg-signal-wash text-signal-strong shadow-flat"
                          : "border-transparent hover:bg-ink-50 text-ink"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-mono text-2xs text-ink-400 w-4">{idx + 1}</span>
                        <span className="capitalize">{sec.type.replace("_", " ")}</span>
                        {!sec.visibility && (
                          <span className="text-[10px] text-ink-400 font-normal">(tersembunyi)</span>
                        )}
                      </div>

                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => moveSection(idx, "up")}
                          disabled={idx === 0}
                          className="p-1 text-ink-400 hover:text-ink disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(idx, "down")}
                          disabled={idx === sections.length - 1}
                          className="p-1 text-ink-400 hover:text-ink disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              {/* Edit Block dengan AI */}
              {selectedSection && (
                <Card className="border-signal/30 bg-signal-wash/20">
                  <CardHeader
                    icon={<Wand2 className="h-4 w-4 text-signal-strong" />}
                    title={`Edit ${selectedSection.type.toUpperCase()} dengan AI`}
                    description="Instruksikan AI untuk mengubah copywriting, keunggulan, atau headline pada section terpilih."
                  />
                  <CardBody className="space-y-3">
                    <textarea
                      rows={3}
                      placeholder={`Misal: Ubah headline agar lebih ramah, gunakan kata sapaan Kak, dan sebutkan gratis ongkir.`}
                      value={blockAiPrompt}
                      onChange={(e) => setBlockAiPrompt(e.target.value)}
                      className="w-full rounded-lg border border-ink-200 bg-white p-2.5 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none"
                    />

                    {blockAiMsg && (
                      <p className="text-2xs font-semibold text-signal-strong">{blockAiMsg}</p>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSectionVisibility(selectedSection.id)}
                        className="text-2xs font-semibold text-ink-600 hover:underline"
                      >
                        {selectedSection.visibility ? "Sembunyikan Section" : "Tampilkan Section"}
                      </button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleEditBlockWithAi}
                        loading={blockAiBusy}
                        disabled={!blockAiPrompt.trim()}
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        Terapkan Perubahan
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>

            {/* Panel Kanan: Canvas Live Preview */}
            <div className="rounded-xl border border-ink-200 bg-ink-100/60 p-4 min-h-[600px] flex items-start justify-center overflow-x-auto">
              <div
                className={cn(
                  "bg-white shadow-overlay transition-all duration-300 rounded-xl overflow-hidden border border-ink-200",
                  previewDevice === "desktop" ? "w-full max-w-4xl" : "w-[375px]"
                )}
              >
                {/* Mock Browser Header */}
                <div className="border-b border-ink-200 bg-ink-50 px-4 py-2.5 flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 mx-3 rounded bg-white border border-ink-200 px-3 py-1 font-mono text-[10px] text-ink-500 truncate">
                    https://noewbar.com/store/{currentSite.slug}
                  </div>
                </div>

                {/* Render Sections in Canvas */}
                <div className="divide-y divide-ink-100 max-h-[700px] overflow-y-auto">
                  {sections.map((sec) => {
                    if (!sec.visibility) return null;
                    const isSelected = sec.id === selectedSecId;

                    return (
                      <div
                        key={sec.id}
                        onClick={() => setSelectedSecId(sec.id)}
                        className={cn(
                          "relative cursor-pointer transition-all",
                          isSelected && "ring-2 ring-signal ring-inset"
                        )}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 z-10 rounded bg-signal-strong text-white px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                            Aktif: {sec.type}
                          </div>
                        )}

                        {sec.type === "announcement" && (
                          <div
                            style={{ backgroundColor: sec.style?.bg_color || "#065F46", color: sec.style?.text_color || "#FFFFFF" }}
                            className="py-2 px-4 text-center text-xs font-semibold"
                          >
                            {sec.content?.text}
                          </div>
                        )}

                        {sec.type === "hero" && (
                          <div className="p-8 text-center bg-slate-50">
                            {sec.content?.badge && (
                              <span className="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800 mb-2">
                                {sec.content.badge}
                              </span>
                            )}
                            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
                              {sec.content?.headline}
                            </h2>
                            <p className="mt-2 text-xs text-slate-600 max-w-md mx-auto">
                              {sec.content?.subheadline}
                            </p>
                            <div className="mt-4 flex justify-center gap-2">
                              <span className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white">
                                {sec.content?.cta_primary_text || "Pesan via WA"}
                              </span>
                            </div>
                          </div>
                        )}

                        {sec.type === "benefits" && (
                          <div className="p-6 bg-white">
                            <h3 className="text-sm font-bold text-center text-slate-900 mb-4">
                              {sec.content?.title || "Keunggulan"}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {(sec.content?.items || []).map((it: any, i: number) => (
                                <div key={i} className="rounded-lg border border-slate-200 p-3 bg-slate-50 text-xs">
                                  <p className="font-bold text-slate-900">{it.title}</p>
                                  <p className="text-[11px] text-slate-500 mt-1">{it.desc}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {sec.type === "product_grid" && (
                          <div className="p-6 bg-slate-50 text-center">
                            <h3 className="text-sm font-bold text-slate-900">{sec.content?.title || "Katalog Produk"}</h3>
                            <p className="text-xs text-slate-500 mt-1">Produk sinkron langsung dari database katalog toko Anda.</p>
                            <div className="mt-3 flex justify-center gap-2">
                              <span className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                                4+ Produk Aktif Terhubung
                              </span>
                            </div>
                          </div>
                        )}

                        {sec.type === "testimonials" && (
                          <div className="p-6 bg-white">
                            <h3 className="text-sm font-bold text-center text-slate-900 mb-3">{sec.content?.title || "Testimoni"}</h3>
                            <div className="space-y-2">
                              {(sec.content?.items || []).map((it: any, i: number) => (
                                <div key={i} className="rounded border border-slate-100 p-2 text-xs italic text-slate-600 bg-slate-50">
                                  &ldquo;{it.text}&rdquo; - <span className="font-bold not-italic text-slate-800">{it.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {sec.type === "faq" && (
                          <div className="p-6 bg-slate-50">
                            <h3 className="text-sm font-bold text-center text-slate-900 mb-3">{sec.content?.title || "FAQ"}</h3>
                            <div className="space-y-1.5 max-w-md mx-auto">
                              {(sec.content?.items || []).map((it: any, i: number) => (
                                <div key={i} className="rounded border border-slate-200 bg-white p-2.5 text-xs">
                                  <p className="font-semibold text-slate-900">{it.q}</p>
                                  <p className="text-slate-500 mt-0.5 text-[11px]">{it.a}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {sec.type === "whatsapp_cta" && (
                          <div
                            style={{ backgroundColor: sec.style?.bg_color || "#065F46", color: "#FFFFFF" }}
                            className="p-6 text-center"
                          >
                            <h3 className="text-base font-bold">{sec.content?.title}</h3>
                            <p className="text-xs mt-1 opacity-90">{sec.content?.subtitle}</p>
                            <span className="mt-3 inline-block rounded-lg bg-white px-4 py-1.5 text-xs font-bold text-emerald-900">
                              {sec.content?.button_text || "Chat WA"}
                            </span>
                          </div>
                        )}

                        {sec.type === "footer" && (
                          <div className="p-4 bg-slate-900 text-center text-[10px] text-slate-400">
                            {sec.content?.brand_name} &bull; {sec.content?.copyright}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
