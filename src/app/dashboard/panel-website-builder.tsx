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

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  GripVertical,
  Layers,
  Layout,
  MessageCircle,
  Monitor,
  Palette,
  Pencil,
  Plus,
  QrCode,
  Save,
  Settings,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  Video,
  Wand2,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmModal,
  ErrorState,
  InlineLoading,
  Modal,
  cn,
} from "@/components/ui";
import {
  TEMPLATES,
  getEmbedVideoUrl,
  getSectionTheme,
  getCanvasPadding,
  type WebsiteSection,
  type WebsiteTemplate,
} from "@/lib/website/types";
import { WebsiteInspector } from "./website-inspector";
import { WebsiteSectionModal } from "./website-section-modal";

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

export const COLOR_THEMES = [
  {
    id: "emerald",
    name: "Emerald WhatsApp",
    badge: "Populer",
    previewBg: "#ECFDF5",
    previewAccent: "#059669",
    heroBg: "#ECFDF5",
    heroText: "#064E3B",
    heroBtn: "#059669",
    ctaBg: "#059669",
    ctaText: "#FFFFFF",
    announcementBg: "#065F46",
    announcementText: "#FFFFFF",
    footerBg: "#0F172A",
    footerText: "#94A3B8",
  },
  {
    id: "slate",
    name: "Minimalist Slate",
    badge: "Elegan",
    previewBg: "#F8FAFC",
    previewAccent: "#0F172A",
    heroBg: "#F8FAFC",
    heroText: "#0F172A",
    heroBtn: "#0F172A",
    ctaBg: "#0F172A",
    ctaText: "#FFFFFF",
    announcementBg: "#1E293B",
    announcementText: "#FFFFFF",
    footerBg: "#020617",
    footerText: "#94A3B8",
  },
  {
    id: "rose",
    name: "Blush Rose",
    badge: "Beauty",
    previewBg: "#FFF1F2",
    previewAccent: "#E11D48",
    heroBg: "#FFF1F2",
    heroText: "#881337",
    heroBtn: "#E11D48",
    ctaBg: "#E11D48",
    ctaText: "#FFFFFF",
    announcementBg: "#9F1239",
    announcementText: "#FFFFFF",
    footerBg: "#4C0519",
    footerText: "#FECDD3",
  },
  {
    id: "amber",
    name: "Warm Amber",
    badge: "Kuliner",
    previewBg: "#FFFBEB",
    previewAccent: "#D97706",
    heroBg: "#FFFBEB",
    heroText: "#78350F",
    heroBtn: "#D97706",
    ctaBg: "#D97706",
    ctaText: "#FFFFFF",
    announcementBg: "#B45309",
    announcementText: "#FFFFFF",
    footerBg: "#1C1917",
    footerText: "#A8A29E",
  },
  {
    id: "indigo",
    name: "Modern Indigo",
    badge: "Fashion",
    previewBg: "#EEF2FF",
    previewAccent: "#4F46E5",
    heroBg: "#EEF2FF",
    heroText: "#1E1B4B",
    heroBtn: "#4F46E5",
    ctaBg: "#4F46E5",
    ctaText: "#FFFFFF",
    announcementBg: "#3730A3",
    announcementText: "#FFFFFF",
    footerBg: "#0F172A",
    footerText: "#94A3B8",
  },
];

const IMAGE_PRESETS = [
  { label: "Skincare Glow Serum", url: "https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=800&q=80" },
  { label: "Organic Cream Bottle", url: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80" },
  { label: "Aesthetic Cosmetic Pack", url: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&w=800&q=80" },
  { label: "Fashion Outfit Minimal", url: "https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=800&q=80" },
  { label: "Modern Bag & Shoes", url: "https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=800&q=80" },
  { label: "Fresh Coffee & Cafe", url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80" },
  { label: "Gourmet Snack & Food", url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80" },
  { label: "Gadget & Minimal Tech", url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80" },
  { label: "Storefront / Toko UMKM", url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80" },
];

const VIDEO_PRESETS = [
  { label: "Sample Teaser YouTube", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { label: "Product Demo YouTube", url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" },
];

function InlineCanvasText({
  value,
  fallback = "",
  onSave,
  onSelectSec,
  multiline = false,
  className = "",
  style,
  badgeLabel = "Klik untuk Edit",
  as: Component = "span",
}: {
  value?: string;
  fallback?: string;
  onSave: (val: string) => void;
  onSelectSec?: () => void;
  multiline?: boolean;
  className?: string;
  style?: React.CSSProperties;
  badgeLabel?: string;
  as?: any;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? fallback);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value ?? fallback);
    }
  }, [value, fallback, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commit = () => {
    setIsEditing(false);
    if (draft !== (value ?? fallback)) {
      onSave(draft);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      commit();
    } else if (e.key === "Enter" && multiline && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraft(value ?? fallback);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div
        className="relative inline-block w-full max-w-full my-1 z-30"
        onClick={(e) => e.stopPropagation()}
      >
        {multiline ? (
          <textarea
            ref={inputRef as any}
            value={draft}
            rows={3}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            style={style}
            className={cn(
              "w-full rounded-lg border-2 border-emerald-500 bg-white p-2 text-ink shadow-lg outline-none ring-2 ring-emerald-500/20 text-xs sm:text-sm resize-y leading-normal font-sans",
              className
            )}
          />
        ) : (
          <input
            ref={inputRef as any}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            style={style}
            className={cn(
              "w-full rounded-md border-2 border-emerald-500 bg-white px-2 py-1 text-ink shadow-lg outline-none ring-2 ring-emerald-500/20 leading-tight font-sans",
              className
            )}
          />
        )}
        <div className="flex items-center gap-1.5 mt-1 bg-slate-900/90 text-white text-[10px] px-2 py-1 rounded shadow-md w-max z-40 backdrop-blur-xs">
          <span>{multiline ? "Ctrl+Enter simpan : Esc batal" : "Enter simpan : Esc batal"}</span>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              commit();
            }}
            className="rounded bg-emerald-600 px-1.5 py-0.5 text-white font-bold hover:bg-emerald-500 text-[10px]"
          >
            Simpan
          </button>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              setDraft(value ?? fallback);
              setIsEditing(false);
            }}
            className="rounded bg-slate-700 px-1.5 py-0.5 text-slate-200 hover:bg-slate-600 text-[10px]"
          >
            Batal
          </button>
        </div>
      </div>
    );
  }

  const displayText = value !== undefined && value !== null && value !== "" ? value : fallback;

  return (
    <Component
      style={style}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        onSelectSec?.();
        setDraft(displayText);
        setIsEditing(true);
      }}
      title="Klik untuk mengedit langsung"
      className={cn(
        "group/inline relative cursor-text rounded transition-all hover:outline hover:outline-2 hover:outline-dashed hover:outline-emerald-500 hover:bg-emerald-500/10 hover:shadow-xs px-1 -mx-1",
        className
      )}
    >
      {displayText}
      <span className="pointer-events-none absolute -top-3.5 right-0 hidden group-hover/inline:inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.2 text-[9px] font-bold text-white shadow-xs z-20">
        <Pencil className="h-2 w-2" />
        {badgeLabel}
      </span>
    </Component>
  );
}

function InlineCanvasImage({
  src,
  alt,
  className = "",
  containerClassName = "",
  onEditClick,
  onSelectSec,
  label = "Ganti Foto",
}: {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  onEditClick: () => void;
  onSelectSec?: () => void;
  label?: string;
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelectSec?.();
      }}
      className={cn("group/img relative overflow-hidden", containerClassName)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={className} />

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-2xs z-10 p-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectSec?.();
            onEditClick();
          }}
          className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-lg hover:bg-emerald-50 hover:text-emerald-700 transition-all cursor-pointer"
        >
          <Camera className="h-3.5 w-3.5 text-emerald-600" />
          {label}
        </button>
      </div>

      {/* Always-visible Mini Badge */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelectSec?.();
          onEditClick();
        }}
        className="absolute top-2 right-2 rounded-full bg-slate-950/80 p-1.5 text-white shadow-md hover:bg-emerald-600 transition-colors z-20 cursor-pointer"
        title={label}
      >
        <Camera className="h-3 w-3" />
      </button>
    </div>
  );
}

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
  const [blockAiBusy, setBlockAiBusy] = useState(false);
  const [blockAiMsg, setBlockAiMsg] = useState<string | null>(null);
  const [blockAiError, setBlockAiError] = useState<string | null>(null);

  // Editor saving state
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editorMsg, setEditorMsg] = useState<string | null>(null);

  // Template Preview Modal state
  const [previewTemplate, setPreviewTemplate] = useState<WebsiteTemplate | null>(null);
  const [templatePreviewDevice, setTemplatePreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const [sectionNotice, setSectionNotice] = useState<string | null>(null);

  // Theme & Utility Modals
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Site Settings Modal state
  const [showSiteSettingsModal, setShowSiteSettingsModal] = useState(false);
  const [siteSettingsForm, setSiteSettingsForm] = useState({
    name: "",
    title: "",
    description: "",
    is_knowledge_source: false,
  });

  // Delete Website Modal state
  const [siteToDelete, setSiteToDelete] = useState<WebsiteRecord | null>(null);
  const [deletingSite, setDeletingSite] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Replace Website Modal state (enforcing 1 store = 1 website)
  const [confirmReplaceModal, setConfirmReplaceModal] = useState<{
    open: boolean;
    type: "ai" | "template";
    template?: WebsiteTemplate;
  } | null>(null);

  // Direct On-View Media Modal state
  const [mediaModalTarget, setMediaModalTarget] = useState<{
    type: "image" | "video";
    secId: string;
    field: string;
    itemIndex?: number;
    currentUrl: string;
    title: string;
  } | null>(null);
  const [mediaUrlInput, setMediaUrlInput] = useState("");

  // Drag and drop section reordering state
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);

  function openMediaModal(target: {
    type: "image" | "video";
    secId: string;
    field: string;
    itemIndex?: number;
    currentUrl: string;
    title: string;
  }) {
    setMediaModalTarget(target);
    setMediaUrlInput(target.currentUrl || "");
  }

  function openSiteSettingsModal() {
    if (!currentSite) return;
    setSiteSettingsForm({
      name: currentSite.name,
      title: currentSite.title || "",
      description: currentSite.description || "",
      is_knowledge_source: Boolean(currentSite.is_knowledge_source),
    });
    setShowSiteSettingsModal(true);
  }

  async function handleSaveSiteSettings() {
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
          name: siteSettingsForm.name.trim(),
          title: siteSettingsForm.title.trim(),
          description: siteSettingsForm.description.trim(),
          is_knowledge_source: siteSettingsForm.is_knowledge_source,
          sections,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setCurrentSite((prev) =>
          prev
            ? {
                ...prev,
                name: siteSettingsForm.name.trim(),
                title: siteSettingsForm.title.trim(),
                description: siteSettingsForm.description.trim(),
                is_knowledge_source: siteSettingsForm.is_knowledge_source,
              }
            : prev
        );
        setShowSiteSettingsModal(false);
        setEditorMsg("Pengaturan toko berhasil diperbarui!");
        await loadWebsites();
      } else {
        setEditorMsg(json.error || "Gagal menyimpan pengaturan toko.");
      }
    } catch {
      setEditorMsg("Gagal menyimpan pengaturan toko.");
    } finally {
      setSavingDraft(false);
    }
  }

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

  async function handleDeleteWebsite(site: WebsiteRecord) {
    setDeletingSite(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id: site.id }),
      });
      const json = await res.json();
      if (json.ok) {
        setSiteToDelete(null);
        if (currentSite?.id === site.id) {
          setCurrentSite(null);
          setSections([]);
          setActiveTab("list");
        }
        await loadWebsites();
      } else {
        setDeleteError(json.error || "Gagal menghapus website.");
      }
    } catch {
      setDeleteError("Gagal menghubungi server untuk menghapus website.");
    } finally {
      setDeletingSite(false);
    }
  }

  async function handleCreateWithAi(replaceExisting = false) {
    if (!aiPrompt.trim()) return;

    if (websites.length >= 1 && !replaceExisting) {
      setConfirmReplaceModal({ open: true, type: "ai" });
      return;
    }

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
          replace_existing: replaceExisting,
        }),
      });
      const json = await res.json();
      if (json.ok && json.website) {
        setConfirmReplaceModal(null);
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

  async function handleUseTemplate(template: WebsiteTemplate, replaceExisting = false) {
    if (websites.length >= 1 && !replaceExisting) {
      setConfirmReplaceModal({ open: true, type: "template", template });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: `${template.name} Store`,
          template_id: template.id,
          replace_existing: replaceExisting,
        }),
      });
      const json = await res.json();
      if (json.ok && json.website) {
        setConfirmReplaceModal(null);
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

  async function handleRunSectionAi(promptText: string) {
    if (!currentSite || !selectedSecId || !promptText.trim()) return;
    const target = sections.find((s) => s.id === selectedSecId);
    if (!target) return;

    setBlockAiBusy(true);
    setBlockAiMsg(null);
    setBlockAiError(null);
    try {
      const res = await fetch("/api/websites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit_section_ai",
          website_id: currentSite.id,
          section: target,
          prompt: promptText.trim(),
        }),
      });
      const json = await res.json();
      if (json.ok && json.updatedSection) {
        setSections((prev) =>
          prev.map((s) => (s.id === selectedSecId ? json.updatedSection : s))
        );
        setBlockAiMsg("Section berhasil diperbarui oleh AI!");
        setBlockAiError(null);
      } else {
        setBlockAiError(json.error || "Gagal mengubah section dengan AI.");
        setBlockAiMsg(null);
      }
    } catch {
      setBlockAiError("Gagal menghubungi AI editor.");
      setBlockAiMsg(null);
    } finally {
      setBlockAiBusy(false);
    }
  }

  function handleUpdateSectionContent(newContent: Record<string, any>, targetSecId?: string) {
    const idToUpdate = targetSecId || selectedSecId;
    if (!idToUpdate) return;
    setSections((prev) =>
      prev.map((s) =>
        s.id === idToUpdate ? { ...s, content: { ...s.content, ...newContent } } : s
      )
    );
  }

  function handleUpdateSectionItem(
    secId: string,
    itemIndex: number,
    itemKey: string,
    newValue: any
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const currentItems = Array.isArray(s.content?.items) ? [...s.content.items] : [];
        if (!currentItems[itemIndex]) return s;
        currentItems[itemIndex] = {
          ...currentItems[itemIndex],
          [itemKey]: newValue,
        };
        return {
          ...s,
          content: {
            ...s.content,
            items: currentItems,
          },
        };
      })
    );
  }

  function handleUpdateSectionBulletPoint(
    secId: string,
    bulletIndex: number,
    newValue: string
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const pts = Array.isArray(s.content?.bullet_points) ? [...s.content.bullet_points] : [];
        pts[bulletIndex] = newValue;
        return {
          ...s,
          content: {
            ...s.content,
            bullet_points: pts,
          },
        };
      })
    );
  }

  function handleUpdateSectionStyle(newStyle: Record<string, any>) {
    if (!selectedSecId) return;
    setSections((prev) =>
      prev.map((s) =>
        s.id === selectedSecId ? { ...s, style: { ...s.style, ...newStyle } } : s
      )
    );
  }

  function handleDuplicateSection(id: string) {
    const idx = sections.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const target = sections[idx];
    const clone: WebsiteSection = {
      ...target,
      id: `sec-${target.type}-${Date.now()}`,
      position: idx + 1,
      content: JSON.parse(JSON.stringify(target.content)),
      style: JSON.parse(JSON.stringify(target.style)),
    };
    const next = [...sections];
    next.splice(idx + 1, 0, clone);
    setSections(next);
    setSelectedSecId(clone.id);
  }

  function requestDeleteSection(id: string) {
    if (sections.length <= 1) {
      setSectionNotice("Halaman harus memiliki minimal 1 section.");
      return;
    }
    setSectionNotice(null);
    setDeleteSectionId(id);
  }

  function confirmDeleteSection() {
    if (!deleteSectionId) return;
    const id = deleteSectionId;
    const next = sections.filter((s) => s.id !== id);
    setSections(next);
    if (selectedSecId === id) {
      setSelectedSecId(next[0]?.id || null);
    }
    setDeleteSectionId(null);
  }

  function handleAddSection(newSec: WebsiteSection) {
    setSections((prev) => [...prev, newSec]);
    setSelectedSecId(newSec.id);
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

  function reorderSection(sourceIdx: number, destIdx: number) {
    if (sourceIdx === destIdx) return;
    setSections((prev) => {
      const next = [...prev];
      const [removed] = next.splice(sourceIdx, 1);
      next.splice(destIdx, 0, removed);
      return next;
    });
  }

  function handleMoveSectionItem(
    secId: string,
    fromIndex: number,
    toIndex: number
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const currentItems = Array.isArray(s.content?.items) ? [...s.content.items] : [];
        if (fromIndex < 0 || fromIndex >= currentItems.length) return s;
        if (toIndex < 0 || toIndex >= currentItems.length) return s;
        const [removed] = currentItems.splice(fromIndex, 1);
        currentItems.splice(toIndex, 0, removed);
        return {
          ...s,
          content: {
            ...s.content,
            items: currentItems,
          },
        };
      })
    );
  }

  function handleDuplicateSectionItem(
    secId: string,
    index: number
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const currentItems = Array.isArray(s.content?.items) ? [...s.content.items] : [];
        if (!currentItems[index]) return s;
        const clone = JSON.parse(JSON.stringify(currentItems[index]));
        currentItems.splice(index + 1, 0, clone);
        return {
          ...s,
          content: {
            ...s.content,
            items: currentItems,
          },
        };
      })
    );
  }

  function handleDeleteSectionItem(
    secId: string,
    index: number
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const currentItems = Array.isArray(s.content?.items) ? [...s.content.items] : [];
        if (currentItems.length <= 1) return s;
        currentItems.splice(index, 1);
        return {
          ...s,
          content: {
            ...s.content,
            items: currentItems,
          },
        };
      })
    );
  }

  function handleAddSectionItem(
    secId: string,
    templateItem: any
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const currentItems = Array.isArray(s.content?.items) ? [...s.content.items] : [];
        currentItems.push(templateItem);
        return {
          ...s,
          content: {
            ...s.content,
            items: currentItems,
          },
        };
      })
    );
  }

  function handleMoveBulletPoint(
    secId: string,
    fromIndex: number,
    toIndex: number
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const pts = Array.isArray(s.content?.bullet_points) ? [...s.content.bullet_points] : [];
        if (fromIndex < 0 || fromIndex >= pts.length) return s;
        if (toIndex < 0 || toIndex >= pts.length) return s;
        const [removed] = pts.splice(fromIndex, 1);
        pts.splice(toIndex, 0, removed);
        return {
          ...s,
          content: {
            ...s.content,
            bullet_points: pts,
          },
        };
      })
    );
  }

  function handleDeleteBulletPoint(
    secId: string,
    index: number
  ) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const pts = Array.isArray(s.content?.bullet_points) ? [...s.content.bullet_points] : [];
        if (pts.length <= 1) return s;
        pts.splice(index, 1);
        return {
          ...s,
          content: {
            ...s.content,
            bullet_points: pts,
          },
        };
      })
    );
  }

  function handleAddBulletPoint(secId: string) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== secId) return s;
        const pts = Array.isArray(s.content?.bullet_points) ? [...s.content.bullet_points] : [];
        pts.push(`Poin keunggulan #${pts.length + 1}`);
        return {
          ...s,
          content: {
            ...s.content,
            bullet_points: pts,
          },
        };
      })
    );
  }

  function toggleSectionVisibility(id: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, visibility: !s.visibility } : s))
    );
  }

  function handleApplyTheme(t: (typeof COLOR_THEMES)[0]) {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.type === "hero") {
          return {
            ...sec,
            style: {
              ...sec.style,
              bg_color: t.heroBg,
              text_color: t.heroText,
              btn_bg: t.heroBtn,
              btn_text: "#FFFFFF",
            },
          };
        }
        if (sec.type === "whatsapp_cta") {
          return {
            ...sec,
            style: {
              ...sec.style,
              bg_color: t.ctaBg,
              text_color: t.ctaText,
              btn_bg: "#FFFFFF",
              btn_text: t.ctaBg,
            },
          };
        }
        if (sec.type === "announcement") {
          return {
            ...sec,
            style: {
              ...sec.style,
              bg_color: t.announcementBg,
              text_color: t.announcementText,
            },
          };
        }
        if (sec.type === "footer") {
          return {
            ...sec,
            style: {
              ...sec.style,
              bg_color: t.footerBg,
              text_color: t.footerText,
            },
          };
        }
        return sec;
      })
    );
    setShowThemeModal(false);
    setEditorMsg(`Tema warna "${t.name}" berhasil diterapkan ke seluruh section!`);
  }

  function handleExportLayoutJson() {
    if (!currentSite) return;
    const data = {
      site_name: currentSite.name,
      slug: currentSite.slug,
      exported_at: new Date().toISOString(),
      sections: sections,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `layout-toko-${currentSite.slug}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setEditorMsg("File layout JSON berhasil diunduh.");
  }

  function handleImportLayoutJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (Array.isArray(json.sections) && json.sections.length > 0) {
          setSections(json.sections);
          setSelectedSecId(json.sections[0]?.id || null);
          setEditorMsg(`Layout berhasil diimpor (${json.sections.length} section dimuat).`);
        } else {
          setEditorMsg("File JSON tidak memiliki struktur section yang valid.");
        }
      } catch {
        setEditorMsg("Gagal membaca file JSON.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleDownloadBackup(w: WebsiteRecord) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(w, null, 2));
    const link = document.createElement("a");
    link.setAttribute("href", dataStr);
    link.setAttribute("download", `website_${w.slug}_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
              Website Saya ({websites.length > 0 ? "1/1" : "0/1"})
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
            <div className="space-y-4">
              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs text-sky-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2.5">
                  <Globe className="h-4 w-4 text-sky-600 mt-0.5 sm:mt-0 shrink-0" />
                  <span>
                    <strong>Aturan Toko Resmi:</strong> Setiap toko memiliki 1 website resmi terintegrasi (1 toko = 1 website). Anda dapat mengedit visual, mengubah isi, atau menghapus website jika ingin merancang ulang dari awal.
                  </span>
                </div>
                <span className="shrink-0 rounded-full bg-sky-100 border border-sky-300 px-2.5 py-0.5 text-2xs font-bold text-sky-800 self-start sm:self-auto">
                  {websites.length}/1 Website
                </span>
              </div>

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
                        <Button
                          size="sm"
                          variant="secondary"
                          className="px-2.5 text-ink-600 hover:text-ink"
                          onClick={() => handleDownloadBackup(w)}
                          title="Unduh Cadangan JSON Website"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-2.5"
                          onClick={() => {
                            setDeleteError(null);
                            setSiteToDelete(w);
                          }}
                          title="Hapus Website"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
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

            {websites.length >= 1 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
                <Globe className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">Perhatian: Toko Anda sudah memiliki website aktif ({websites[0].name})</p>
                  <p className="text-2xs text-amber-800 mt-0.5 leading-relaxed">
                    Kebijakan toko menetapkan 1 website resmi per akun. Jika Anda melanjutkan generate dengan AI, website saat ini akan digantikan dengan rancangan baru. Anda juga dapat langsung mengeditnya di Visual Editor.
                  </p>
                </div>
              </div>
            )}

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
                onClick={() => handleCreateWithAi(false)}
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
        <div className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((tmpl) => (
              <Card key={tmpl.id} className="flex flex-col justify-between overflow-hidden shadow-flat hover:shadow-overlay transition-all">
                {/* Mini Browser Web Frame */}
                <div className="border-b border-ink-200 bg-ink-50">
                  {/* Browser Bar */}
                  <div className="flex items-center gap-1.5 border-b border-ink-200 bg-ink-100/70 px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    <div className="ml-1.5 flex-1 rounded bg-white px-2 py-0.5 font-mono text-[9px] text-ink-500 truncate border border-ink-200">
                      https://toko.noewbar.id/{tmpl.id}
                    </div>
                    <span className="rounded bg-white/90 px-1.5 py-0.5 text-[8px] font-bold text-ink-600 shadow-xs">
                      {tmpl.category}
                    </span>
                  </div>

                  {/* Render Miniature Website Content */}
                  <div className="h-44 overflow-hidden bg-white text-[10px] leading-tight select-none border-b border-ink-100">
                    {/* Mini Announcement */}
                    <div
                      style={{
                        backgroundColor: tmpl.default_sections[0]?.style?.bg_color || tmpl.theme.primary_color,
                        color: tmpl.default_sections[0]?.style?.text_color || "#FFFFFF",
                      }}
                      className="px-2 py-1 text-center font-medium text-[8px] truncate"
                    >
                      {tmpl.default_sections[0]?.content?.text || "Gratis Ongkir ke seluruh Indonesia!"}
                    </div>

                    {/* Mini Hero */}
                    <div
                      style={{ backgroundColor: tmpl.default_sections[1]?.style?.bg_color || "#F8FAFC" }}
                      className="p-3 text-center border-b border-ink-100"
                    >
                      {tmpl.default_sections[1]?.content?.badge && (
                        <span className="inline-block rounded-full bg-emerald-100 px-1.5 py-0.5 text-[8px] font-bold text-emerald-800 mb-1">
                          {tmpl.default_sections[1].content.badge}
                        </span>
                      )}
                      <h4 className="font-extrabold text-ink line-clamp-1 text-xs">
                        {tmpl.default_sections[1]?.content?.headline || tmpl.name}
                      </h4>
                      <p className="text-[9px] text-ink-500 line-clamp-1 mt-0.5 max-w-xs mx-auto">
                        {tmpl.default_sections[1]?.content?.subheadline || tmpl.description}
                      </p>
                      <div className="mt-2 flex justify-center">
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[8px] font-bold text-white shadow-xs">
                          <MessageCircle className="h-2.5 w-2.5" />
                          Beli via WhatsApp
                        </span>
                      </div>
                    </div>

                    {/* Mini Products Grid Mock */}
                    <div className="p-2.5 bg-ink-50/50">
                      <p className="text-[9px] font-bold text-ink mb-1.5 text-center">Katalog Produk Pilihan</p>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[1, 2, 3].map((idx) => (
                          <div key={idx} className="rounded border border-ink-200 bg-white p-1 text-center shadow-xs">
                            <div className="aspect-square w-full rounded bg-ink-100 mb-1 overflow-hidden">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src="/placeholder-product.svg"
                                alt="Produk"
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <p className="text-[8px] font-semibold text-ink truncate">Item {idx}</p>
                            <p className="font-mono text-[7px] text-emerald-700 font-bold">Rp 150rb</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-ink">{tmpl.name}</h3>
                    <p className="text-2xs text-ink-500 font-medium">
                      {tmpl.category} &bull; {tmpl.default_sections.length} Section Siap Pakai
                    </p>
                    <p className="text-xs text-ink-600 leading-relaxed mt-2 line-clamp-2">{tmpl.description}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-ink-100 flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1 text-xs font-semibold"
                      onClick={() => setPreviewTemplate(tmpl)}
                    >
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      Pratinjau Web
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1 text-xs font-semibold"
                      onClick={() => handleUseTemplate(tmpl)}
                    >
                      Gunakan
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* MODAL TEMPLATE WEB PREVIEW */}
          <Modal open={Boolean(previewTemplate)} onClose={() => setPreviewTemplate(null)}>
            {previewTemplate && (
              <div
                className="flex h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-ink-200 bg-ink-100 shadow-overlay overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Top Bar Preview Modal */}
                <div className="flex items-center justify-between border-b border-ink-200 bg-white px-5 py-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink flex items-center gap-2">
                      Pratinjau Desain Web: {previewTemplate.name}
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-2xs font-semibold text-emerald-800">
                        {previewTemplate.category}
                      </span>
                    </h3>
                    <p className="text-2xs text-ink-500">
                      Toko WhatsApp responsif siap pakai dengan tombol pemesanan langsung
                    </p>
                  </div>

                  {/* Device Switcher & Actions */}
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center rounded-lg border border-ink-200 bg-ink-50 p-0.5">
                      <button
                        type="button"
                        onClick={() => setTemplatePreviewDevice("desktop")}
                        className={cn(
                          "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
                          templatePreviewDevice === "desktop"
                            ? "bg-white text-ink shadow-sm font-bold"
                            : "text-ink-500 hover:text-ink font-medium"
                        )}
                      >
                        <Monitor className="h-3.5 w-3.5" />
                        Desktop
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplatePreviewDevice("mobile")}
                        className={cn(
                          "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
                          templatePreviewDevice === "mobile"
                            ? "bg-white text-ink shadow-sm font-bold"
                            : "text-ink-500 hover:text-ink font-medium"
                        )}
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                        Mobile
                      </button>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const t = previewTemplate;
                        setPreviewTemplate(null);
                        handleUseTemplate(t);
                      }}
                    >
                      Gunakan Template Ini
                      <ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>

                    <button
                      type="button"
                      onClick={() => setPreviewTemplate(null)}
                      className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink transition-colors"
                      title="Tutup pratinjau"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Canvas Area */}
                <div className="flex-1 overflow-y-auto p-4 flex items-start justify-center">
                  <div
                    className={cn(
                      "bg-white shadow-md transition-all duration-300 rounded-xl overflow-hidden border border-ink-200",
                      templatePreviewDevice === "desktop" ? "w-full max-w-4xl" : "w-[375px]"
                    )}
                  >
                    {/* Browser Address Bar */}
                    <div className="border-b border-ink-200 bg-ink-50 px-4 py-2 flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-400" />
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        <span className="h-2 w-2 rounded-full bg-green-400" />
                      </div>
                      <div className="flex-1 mx-3 rounded bg-white border border-ink-200 px-3 py-0.5 font-mono text-2xs text-ink-500 truncate">
                        https://toko.noewbar.com/store/{previewTemplate.id}
                      </div>
                    </div>

                    {/* Live Rendered Template Sections */}
                    <div className="divide-y divide-ink-100">
                      {previewTemplate.default_sections.map((sec) => (
                        <div key={sec.id}>
                          {sec.type === "announcement" && (
                            <div
                              style={{
                                backgroundColor: sec.style?.bg_color || "#065F46",
                                color: sec.style?.text_color || "#FFFFFF",
                              }}
                              className="py-2.5 px-4 text-center text-xs font-semibold"
                            >
                              {sec.content?.text}
                            </div>
                          )}

                          {sec.type === "hero" && (
                            <div
                              style={{ backgroundColor: sec.style?.bg_color || "#F8FAFC" }}
                              className="p-8 sm:p-12 text-center border-b border-slate-100"
                            >
                              {sec.content?.badge && (
                                <span className="inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 mb-3 shadow-xs">
                                  {sec.content.badge}
                                </span>
                              )}
                              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 max-w-xl mx-auto">
                                {sec.content?.headline}
                              </h1>
                              <p className="mt-3 text-xs sm:text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                                {sec.content?.subheadline}
                              </p>
                              <div className="mt-6 flex flex-wrap justify-center gap-3">
                                <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm">
                                  <MessageCircle className="h-4 w-4" />
                                  {sec.content?.cta_primary_text || "Pesan via WhatsApp"}
                                </span>
                                {sec.content?.cta_secondary_text && (
                                  <span className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-xs">
                                    {sec.content?.cta_secondary_text}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {sec.type === "benefits" && (
                            <div className="p-8 bg-white border-b border-slate-100">
                              <h2 className="text-base sm:text-lg font-bold text-center text-slate-900 mb-6">
                                {sec.content?.title || "Keunggulan Kami"}
                              </h2>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                                {(sec.content?.items || []).map((it: any, i: number) => (
                                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs">
                                    <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2.5">
                                      <CheckCircle2 className="h-4 w-4" />
                                    </div>
                                    <p className="font-bold text-slate-900">{it.title}</p>
                                    <p className="text-2xs text-slate-600 mt-1 leading-relaxed">{it.desc}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {sec.type === "product_grid" && (
                            <div className="p-8 bg-slate-50/80 border-b border-slate-100">
                              <div className="text-center max-w-md mx-auto mb-6">
                                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                                  {sec.content?.title || "Katalog Produk Pilihan"}
                                </h2>
                                <p className="text-2xs text-slate-500 mt-1">
                                  {sec.content?.subtitle || "Pesan langsung dengan respon cepat WhatsApp 24 jam"}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
                                {[1, 2, 3].map((idx) => (
                                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
                                    <div className="aspect-square w-full rounded-lg bg-slate-100 mb-2.5 overflow-hidden border border-slate-100">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src="/placeholder-product.svg"
                                        alt="Contoh Produk"
                                        className="h-full w-full object-cover"
                                      />
                                    </div>
                                    <p className="text-xs font-bold text-slate-900 truncate">Produk Unggulan {idx}</p>
                                    <p className="font-mono text-2xs font-extrabold text-emerald-700 mt-0.5">Rp 185.000</p>
                                    <span className="mt-2.5 w-full inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 py-1.5 text-2xs font-bold text-white">
                                      <MessageCircle className="h-3 w-3" />
                                      Beli via WA
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {sec.type === "testimonials" && (
                            <div className="p-8 bg-white border-b border-slate-100">
                              <h2 className="text-base sm:text-lg font-bold text-center text-slate-900 mb-4">
                                {sec.content?.title || "Kata Pembeli Kami"}
                              </h2>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                                {(sec.content?.items || []).map((it: any, i: number) => (
                                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                                    <p className="italic text-slate-700 leading-relaxed">&ldquo;{it.text}&rdquo;</p>
                                    <p className="mt-2 font-bold text-slate-900 text-2xs">{it.name} - <span className="text-slate-500 font-normal">{it.role}</span></p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {sec.type === "faq" && (
                            <div className="p-8 bg-slate-50/60 border-b border-slate-100">
                              <h2 className="text-base sm:text-lg font-bold text-center text-slate-900 mb-4">
                                {sec.content?.title || "Pertanyaan yang Sering Diajukan"}
                              </h2>
                              <div className="max-w-xl mx-auto space-y-2.5">
                                {(sec.content?.items || []).map((it: any, i: number) => (
                                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-3.5 text-xs">
                                    <p className="font-bold text-slate-900">{it.q}</p>
                                    <p className="text-2xs text-slate-600 mt-1 leading-relaxed">{it.a}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {sec.type === "whatsapp_cta" && (
                            <div
                              style={{
                                backgroundColor: sec.style?.bg_color || "#059669",
                                color: sec.style?.text_color || "#FFFFFF",
                              }}
                              className="p-8 sm:p-10 text-center"
                            >
                              <h2 className="text-lg sm:text-2xl font-extrabold max-w-lg mx-auto">
                                {sec.content?.title || "Pesan Mudah Langsung via WhatsApp"}
                              </h2>
                              <p className="mt-2 text-xs sm:text-sm opacity-90 max-w-md mx-auto leading-relaxed">
                                {sec.content?.subtitle || "Customer service AI kami siap membalas dalam 2 detik."}
                              </p>
                              <div className="mt-5 flex justify-center">
                                <span className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-emerald-800 shadow-sm">
                                  <MessageCircle className="h-4 w-4 text-emerald-600" />
                                  {sec.content?.button_text || "Chat WhatsApp Sekarang"}
                                </span>
                              </div>
                            </div>
                          )}

                          {sec.type === "footer" && (
                            <div
                              style={{
                                backgroundColor: sec.style?.bg_color || "#0F172A",
                                color: sec.style?.text_color || "#94A3B8",
                              }}
                              className="py-6 px-4 text-center text-2xs"
                            >
                              <p className="font-bold text-white text-xs">{sec.content?.brand_name || "Toko Online"}</p>
                              <p className="mt-1 opacity-80">{sec.content?.tagline}</p>
                              <p className="mt-3 opacity-60">{sec.content?.copyright}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Modal>
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

              <button
                type="button"
                onClick={() => setShowThemeModal(true)}
                className="btn btn-secondary btn-sm"
                title="Pilih Palet Tema Warna Toko"
              >
                <Palette className="mr-1.5 h-3.5 w-3.5 text-signal" />
                Tema Warna
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="btn btn-secondary btn-sm"
                title="Scan QR untuk Pratinjau di HP"
              >
                <QrCode className="mr-1.5 h-3.5 w-3.5 text-ink-600" />
                Tes di HP
              </button>

              <input
                type="file"
                ref={jsonInputRef}
                onChange={handleImportLayoutJson}
                accept=".json"
                className="hidden"
              />

              <button
                type="button"
                onClick={handleExportLayoutJson}
                className="btn btn-secondary btn-sm"
                title="Cadangkan layout halaman ke format JSON"
              >
                <Download className="mr-1 h-3.5 w-3.5 text-ink-500" />
                Ekspor
              </button>

              <button
                type="button"
                onClick={() => jsonInputRef.current?.click()}
                className="btn btn-secondary btn-sm"
                title="Pulihkan layout halaman dari file JSON"
              >
                <Upload className="mr-1 h-3.5 w-3.5 text-ink-500" />
                Impor
              </button>

              <Button size="sm" variant="secondary" onClick={openSiteSettingsModal}>
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Pengaturan
              </Button>

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

              <Button
                size="sm"
                variant="secondary"
                className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
                onClick={() => {
                  setDeleteError(null);
                  setSiteToDelete(currentSite);
                }}
                title="Hapus website toko ini"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Hapus Web
              </Button>
            </div>
          </div>

          {editorMsg && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-medium">
              {editorMsg}
            </div>
          )}

          {/* Editor Grid: Left = Section Tree & Elementor Inspector, Right = Live Canvas Preview */}
          <div className="grid gap-4 lg:grid-cols-[360px_1fr] items-start">
            {/* Panel Kiri: Section List & Elementor Inspector */}
            <div className="space-y-4">
              {/* Card Section Tree */}
              <Card>
                <div className="flex items-center justify-between border-b border-ink-100 p-3 bg-ink-50/50">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-signal-strong" />
                    <span className="text-xs font-bold text-ink">Struktur Halaman</span>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    type="button"
                    onClick={() => setShowAddSectionModal(true)}
                    className="text-2xs font-bold"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Tambah Section
                  </Button>
                </div>
                <CardBody className="p-2 space-y-1 max-h-56 overflow-y-auto">
                  {sections.map((sec, idx) => (
                    <div
                      key={sec.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", String(idx));
                        e.dataTransfer.effectAllowed = "move";
                        setDraggedSectionIndex(idx);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (dragOverSectionIndex !== idx) {
                          setDragOverSectionIndex(idx);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverSectionIndex === idx) {
                          setDragOverSectionIndex(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const srcIdx =
                          draggedSectionIndex ??
                          parseInt(e.dataTransfer.getData("text/plain"), 10);
                        if (!isNaN(srcIdx) && srcIdx !== idx) {
                          reorderSection(srcIdx, idx);
                        }
                        setDraggedSectionIndex(null);
                        setDragOverSectionIndex(null);
                      }}
                      onDragEnd={() => {
                        setDraggedSectionIndex(null);
                        setDragOverSectionIndex(null);
                      }}
                      onClick={() => setSelectedSecId(sec.id)}
                      className={cn(
                        "flex items-center justify-between rounded-lg p-2 text-xs font-semibold cursor-pointer transition-all border select-none",
                        selectedSecId === sec.id
                          ? "border-signal bg-signal-wash text-signal-strong shadow-flat"
                          : "border-transparent hover:bg-ink-50 text-ink",
                        dragOverSectionIndex === idx &&
                          draggedSectionIndex !== idx &&
                          "border-signal bg-signal-wash/40 scale-[0.99]",
                        draggedSectionIndex === idx && "opacity-40"
                      )}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <GripVertical className="h-3.5 w-3.5 text-ink-300 hover:text-ink-600 cursor-grab active:cursor-grabbing shrink-0" />
                        <span className="font-mono text-2xs text-ink-400 w-4">{idx + 1}</span>
                        <span className="capitalize text-2xs">{sec.type.replace("_", " ")}</span>
                        {!sec.visibility && (
                          <span className="text-[9px] text-ink-400 font-normal">(sembunyi)</span>
                        )}
                      </div>

                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => moveSection(idx, "up")}
                          disabled={idx === 0}
                          title="Naikkan"
                          className="p-1 text-ink-400 hover:text-ink disabled:opacity-30"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateSection(sec.id)}
                          title="Duplikat section ini"
                          className="p-1 text-ink-400 hover:text-signal transition-colors"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(idx, "down")}
                          disabled={idx === sections.length - 1}
                          title="Turunkan"
                          className="p-1 text-ink-400 hover:text-ink disabled:opacity-30"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>

              {/* Elementor-Style Inspector Panel */}
              {selectedSection && (
                <WebsiteInspector
                  section={selectedSection}
                  onUpdateContent={handleUpdateSectionContent}
                  onUpdateStyle={handleUpdateSectionStyle}
                  onMoveUp={() => {
                    const idx = sections.findIndex((s) => s.id === selectedSecId);
                    if (idx > 0) moveSection(idx, "up");
                  }}
                  onMoveDown={() => {
                    const idx = sections.findIndex((s) => s.id === selectedSecId);
                    if (idx < sections.length - 1) moveSection(idx, "down");
                  }}
                  onDuplicate={() => handleDuplicateSection(selectedSection.id)}
                  onDelete={() => requestDeleteSection(selectedSection.id)}
                  onToggleVisibility={() => toggleSectionVisibility(selectedSection.id)}
                  isFirst={sections.findIndex((s) => s.id === selectedSecId) === 0}
                  isLast={sections.findIndex((s) => s.id === selectedSecId) === sections.length - 1}
                  onRunAi={handleRunSectionAi}
                  aiBusy={blockAiBusy}
                  aiMsg={blockAiMsg}
                  aiError={blockAiError}
                />
              )}
            </div>

            {/* Panel Kanan: Canvas Live Preview */}
            <div className="rounded-xl border border-ink-200 bg-ink-100/60 p-4 min-h-[640px] flex flex-col items-center justify-start overflow-x-auto space-y-4">
              <div
                className={cn(
                  "bg-white shadow-overlay transition-all duration-300 rounded-xl overflow-hidden border border-ink-200 w-full",
                  previewDevice === "desktop" ? "max-w-4xl" : "max-w-[375px]"
                )}
              >
                {/* Mock Browser Header */}
                <div className="border-b border-ink-200 bg-ink-50 px-4 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                      <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 mx-1 rounded bg-white border border-ink-200 px-2.5 py-1 font-mono text-[10px] text-ink-500 truncate">
                      https://noewbar.com/store/{currentSite.slug}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-signal-wash border border-signal/30 px-2.5 py-0.5 text-[10px] font-semibold text-signal-strong">
                    <Sparkles className="h-3 w-3 shrink-0" />
                    <span>Mode Direct Edit Aktif (Klik Teks / Foto)</span>
                  </div>
                </div>

                {/* Render Sections in Canvas */}
                <div className="divide-y divide-ink-100 max-h-[720px] overflow-y-auto">
                  {sections.map((sec, secIdx) => {
                    const isSelected = sec.id === selectedSecId;

                    if (!sec.visibility) {
                      return (
                        <div
                          key={sec.id}
                          onClick={() => setSelectedSecId(sec.id)}
                          className={cn(
                            "p-4 bg-ink-100/70 border-2 border-dashed border-ink-300 text-center cursor-pointer transition-all m-2 rounded-xl",
                            isSelected && "ring-2 ring-signal ring-inset"
                          )}
                        >
                          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-ink-500">
                            <EyeOff className="h-3.5 w-3.5 text-danger" />
                            Section Disembunyikan: <span className="font-bold text-ink uppercase">{sec.type.replace("_", " ")}</span>
                          </div>
                          <p className="text-2xs text-ink-400 mt-0.5">
                            Klik untuk memilih dan aktifkan ikon mata pada panel inspector jika ingin menampilkan kembali.
                          </p>
                        </div>
                      );
                    }

                    const theme = getSectionTheme(sec.style);
                    const padClass = getCanvasPadding(sec.style?.padding);

                    return (
                      <div
                        key={sec.id}
                        onClick={() => setSelectedSecId(sec.id)}
                        className={cn(
                          "group relative cursor-pointer transition-all",
                          isSelected && "ring-2 ring-signal ring-inset shadow-md"
                        )}
                      >
                        {/* Floating Action Toolbar on Canvas Section */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-lg bg-black/80 px-2 py-1 text-white shadow-md backdrop-blur-xs">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mr-1.5">
                              {sec.type.replace("_", " ")}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSection(secIdx, "up");
                              }}
                              disabled={secIdx === 0}
                              title="Naikkan"
                              className="rounded p-1 hover:bg-white/20 disabled:opacity-30"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSection(secIdx, "down");
                              }}
                              disabled={secIdx === sections.length - 1}
                              title="Turunkan"
                              className="rounded p-1 hover:bg-white/20 disabled:opacity-30"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateSection(sec.id);
                              }}
                              title="Duplikat section"
                              className="rounded p-1 hover:bg-white/20"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                requestDeleteSection(sec.id);
                              }}
                              title="Hapus section"
                              className="rounded p-1 text-danger hover:bg-white/20"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}

                        {/* 1. ANNOUNCEMENT */}
                        {sec.type === "announcement" && (
                          <div
                            style={{
                              backgroundColor: theme.bg,
                              color: theme.text,
                            }}
                            className={cn(
                              "text-center font-semibold transition-all",
                              sec.style?.padding === "sm"
                                ? "py-1.5 px-3 text-2xs"
                                : sec.style?.padding === "lg"
                                ? "py-3.5 px-5 text-sm"
                                : "py-2.5 px-4 text-xs"
                            )}
                          >
                            <InlineCanvasText
                              value={sec.content?.text}
                              fallback="Pengumuman promo toko"
                              onSave={(val) => handleUpdateSectionContent({ text: val }, sec.id)}
                              onSelectSec={() => setSelectedSecId(sec.id)}
                              badgeLabel="Edit Pengumuman"
                            />
                          </div>
                        )}

                        {/* 2. HERO */}
                        {sec.type === "hero" && (
                          <div
                            style={{ backgroundColor: theme.bg, color: theme.text }}
                            className={cn("text-center border-b border-black/10 transition-colors", padClass)}
                          >
                            <div className="max-w-2xl mx-auto">
                              <div className="mb-3">
                                <span
                                  className={cn(
                                    "inline-block rounded-full px-3 py-1 text-xs font-bold shadow-xs border",
                                    theme.isDark
                                      ? "bg-white/10 text-emerald-300 border-white/20"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  )}
                                >
                                  <InlineCanvasText
                                    value={sec.content?.badge}
                                    fallback="Badge Hero"
                                    onSave={(val) => handleUpdateSectionContent({ badge: val }, sec.id)}
                                    onSelectSec={() => setSelectedSecId(sec.id)}
                                    badgeLabel="Edit Badge"
                                  />
                                </span>
                              </div>
                              <h1
                                style={{ color: theme.text }}
                                className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight"
                              >
                                <InlineCanvasText
                                  value={sec.content?.headline}
                                  fallback="Headline Produk Toko"
                                  onSave={(val) => handleUpdateSectionContent({ headline: val }, sec.id)}
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  badgeLabel="Edit Headline"
                                />
                              </h1>
                              <p
                                style={{ color: theme.mutedText }}
                                className="mt-3 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed"
                              >
                                <InlineCanvasText
                                  value={sec.content?.subheadline}
                                  fallback="Penjelasan penawaran produk..."
                                  multiline
                                  onSave={(val) => handleUpdateSectionContent({ subheadline: val }, sec.id)}
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  badgeLabel="Edit Subheadline"
                                />
                              </p>

                              {/* Hero Media Preview */}
                              <div className="mt-6 mx-auto max-w-md">
                                <InlineCanvasImage
                                  src={sec.content?.image_url || "/placeholder-product.svg"}
                                  alt="Hero"
                                  containerClassName="rounded-xl border border-black/10 shadow-md max-h-60"
                                  className="h-full w-full object-cover max-h-60"
                                  label="Ganti Foto Hero"
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  onEditClick={() =>
                                    openMediaModal({
                                      type: "image",
                                      secId: sec.id,
                                      field: "image_url",
                                      currentUrl: sec.content?.image_url || "",
                                      title: "Ganti Foto Hero Produk",
                                    })
                                  }
                                />
                              </div>

                              <div className="mt-6 flex flex-wrap justify-center items-center gap-3">
                                <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm">
                                  <MessageCircle className="h-4 w-4 shrink-0" />
                                  <InlineCanvasText
                                    value={sec.content?.cta_primary_text}
                                    fallback="Pesan via WA"
                                    onSave={(val) => handleUpdateSectionContent({ cta_primary_text: val }, sec.id)}
                                    onSelectSec={() => setSelectedSecId(sec.id)}
                                    badgeLabel="Edit Tombol WA"
                                  />
                                </span>
                                <span
                                  className={cn(
                                    "rounded-xl border px-4 py-2.5 text-xs font-semibold shadow-xs",
                                    theme.isDark
                                      ? "border-white/20 bg-white/10 text-white"
                                      : "border-slate-300 bg-white text-slate-700"
                                  )}
                                >
                                  <InlineCanvasText
                                    value={sec.content?.cta_secondary_text}
                                    fallback="Pelajari Lebih Lanjut"
                                    onSave={(val) => handleUpdateSectionContent({ cta_secondary_text: val }, sec.id)}
                                    onSelectSec={() => setSelectedSecId(sec.id)}
                                    badgeLabel="Edit Tombol Sekunder"
                                  />
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 3. VIDEO SHOWCASE */}
                        {sec.type === "video_showcase" && (() => {
                          const vid = getEmbedVideoUrl(sec.content?.video_url);
                          return (
                            <div
                              style={{
                                backgroundColor: theme.bg,
                                color: theme.text,
                              }}
                              className={cn("text-center border-b border-black/10 transition-colors", padClass)}
                            >
                              <div className="mb-2">
                                <span
                                  className={cn(
                                    "inline-block rounded-full px-3 py-1 text-xs font-bold border",
                                    theme.isDark
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                      : "bg-emerald-100 text-emerald-800 border-emerald-200"
                                  )}
                                >
                                  <InlineCanvasText
                                    value={sec.content?.badge}
                                    fallback="Video Showcase"
                                    onSave={(val) => handleUpdateSectionContent({ badge: val }, sec.id)}
                                    onSelectSec={() => setSelectedSecId(sec.id)}
                                    badgeLabel="Edit Badge"
                                  />
                                </span>
                              </div>
                              <h3
                                style={{ color: theme.text }}
                                className="text-xl font-extrabold max-w-xl mx-auto"
                              >
                                <InlineCanvasText
                                  value={sec.content?.title}
                                  fallback="Video Showcase Produk"
                                  onSave={(val) => handleUpdateSectionContent({ title: val }, sec.id)}
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  badgeLabel="Edit Judul Video"
                                />
                              </h3>
                              <p
                                style={{ color: theme.mutedText }}
                                className="mt-2 text-xs max-w-md mx-auto"
                              >
                                <InlineCanvasText
                                  value={sec.content?.description}
                                  fallback="Tonton Video"
                                  multiline
                                  onSave={(val) => handleUpdateSectionContent({ description: val }, sec.id)}
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  badgeLabel="Edit Deskripsi"
                                />
                              </p>
                              <div className="group/vid relative mt-6 overflow-hidden rounded-xl border border-slate-700 bg-black aspect-video max-w-xl mx-auto shadow-md">
                                {vid.isEmbed && vid.url ? (
                                  <iframe
                                    src={vid.url}
                                    title="Video"
                                    className="h-full w-full border-0 pointer-events-none"
                                  />
                                ) : (
                                  <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 p-4">
                                    <Video className="h-8 w-8 mb-2 text-slate-500" />
                                    <p className="text-xs font-bold">Video Player Interaktif</p>
                                    <p className="text-[10px] mt-0.5">{sec.content?.video_url || "Belum ada tautan video"}</p>
                                  </div>
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/vid:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-2xs z-10">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedSecId(sec.id);
                                      openMediaModal({
                                        type: "video",
                                        secId: sec.id,
                                        field: "video_url",
                                        currentUrl: sec.content?.video_url || "",
                                        title: "Ganti Link Video Showcase",
                                      });
                                    }}
                                    className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-lg hover:bg-emerald-50 hover:text-emerald-700 transition-all cursor-pointer"
                                  >
                                    <Video className="h-3.5 w-3.5 text-emerald-600" />
                                    Ganti Link Video
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSecId(sec.id);
                                    openMediaModal({
                                      type: "video",
                                      secId: sec.id,
                                      field: "video_url",
                                      currentUrl: sec.content?.video_url || "",
                                      title: "Ganti Link Video Showcase",
                                    });
                                  }}
                                  className="absolute top-2 right-2 rounded-full bg-slate-950/80 p-1.5 text-white shadow-md hover:bg-emerald-600 transition-colors z-20 cursor-pointer"
                                  title="Ganti Link Video"
                                >
                                  <Video className="h-3 w-3" />
                                </button>
                              </div>
                              <div className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm">
                                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                                <InlineCanvasText
                                  value={sec.content?.button_text}
                                  fallback="Tanya via WA"
                                  onSave={(val) => handleUpdateSectionContent({ button_text: val }, sec.id)}
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  badgeLabel="Edit Tombol"
                                />
                              </div>
                            </div>
                          );
                        })()}

                        {/* 4. GALLERY MEDIA */}
                        {sec.type === "gallery_media" && (
                          <div
                            style={{ backgroundColor: theme.bg, color: theme.text }}
                            className={cn("text-center border-b border-black/10 transition-colors", padClass)}
                          >
                            <h3
                              style={{ color: theme.text }}
                              className="text-base font-bold mb-1"
                            >
                              <InlineCanvasText
                                value={sec.content?.title}
                                fallback="Galeri Foto"
                                onSave={(val) => handleUpdateSectionContent({ title: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Judul Galeri"
                              />
                            </h3>
                            <p
                              style={{ color: theme.mutedText }}
                              className="text-xs mb-6"
                            >
                              <InlineCanvasText
                                value={sec.content?.subtitle}
                                fallback="Dokumentasi & Portofolio"
                                onSave={(val) => handleUpdateSectionContent({ subtitle: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Subjudul"
                              />
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                              {(sec.content?.items || []).map((it: any, i: number) => (
                                <div
                                  key={i}
                                  style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                                  className="group/card relative rounded-xl border overflow-hidden shadow-xs transition-all text-left"
                                >
                                  {/* Floating Card Actions Pill */}
                                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 bg-slate-900/90 backdrop-blur-xs text-white rounded-lg p-1 shadow-md border border-white/20">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveSectionItem(sec.id, i, i - 1);
                                      }}
                                      disabled={i === 0}
                                      title="Geser ke kiri"
                                      className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <ChevronLeft className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveSectionItem(sec.id, i, i + 1);
                                      }}
                                      disabled={i === (sec.content?.items || []).length - 1}
                                      title="Geser ke kanan"
                                      className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <ChevronRight className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicateSectionItem(sec.id, i);
                                      }}
                                      title="Duplikat foto ini"
                                      className="p-1 rounded hover:bg-white/20 text-white transition-colors"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSectionItem(sec.id, i);
                                      }}
                                      disabled={(sec.content?.items || []).length <= 1}
                                      title="Hapus foto ini"
                                      className="p-1 rounded hover:bg-rose-500/30 text-rose-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>

                                  <div className="aspect-square w-full bg-black/10">
                                    <InlineCanvasImage
                                      src={it.image_url || "/placeholder-product.svg"}
                                      alt="Galeri"
                                      className="h-full w-full object-cover"
                                      label="Ganti Foto"
                                      onSelectSec={() => setSelectedSecId(sec.id)}
                                      onEditClick={() =>
                                        openMediaModal({
                                          type: "image",
                                          secId: sec.id,
                                          field: "image_url",
                                          itemIndex: i,
                                          currentUrl: it.image_url || "",
                                          title: `Ganti Foto Galeri #${i + 1}`,
                                        })
                                      }
                                    />
                                  </div>
                                  <div className="p-2">
                                    <InlineCanvasText
                                      value={it.caption}
                                      fallback="Keterangan foto..."
                                      style={{ color: theme.cardText }}
                                      className="text-[10px] font-semibold truncate block"
                                      onSave={(val) => handleUpdateSectionItem(sec.id, i, "caption", val)}
                                      onSelectSec={() => setSelectedSecId(sec.id)}
                                      badgeLabel="Edit Keterangan"
                                    />
                                  </div>
                                </div>
                              ))}

                              {(sec.content?.items || []).length < 6 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddSectionItem(sec.id, {
                                      image_url: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80",
                                      caption: "Foto Baru",
                                    });
                                  }}
                                  className="rounded-xl border-2 border-dashed border-ink-300 hover:border-signal p-4 flex flex-col items-center justify-center gap-2 text-ink-500 hover:text-signal hover:bg-signal-wash/30 transition-all min-h-[140px]"
                                >
                                  <Plus className="h-5 w-5" />
                                  <span className="text-2xs font-bold">+ Tambah Foto</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 5. TEXT BANNER / ABOUT */}
                        {sec.type === "text_banner" && (
                          <div
                            style={{ backgroundColor: theme.bg, color: theme.text }}
                            className={cn("border-b border-black/10 transition-colors", padClass)}
                          >
                            <div className="grid gap-6 sm:grid-cols-2 sm:items-center max-w-3xl mx-auto">
                              <div>
                                <div className="mb-2">
                                  <span
                                    className={cn(
                                      "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold border",
                                      theme.isDark
                                        ? "bg-white/10 text-white border-white/20"
                                        : "bg-slate-200 text-slate-700 border-slate-300"
                                    )}
                                  >
                                    <InlineCanvasText
                                      value={sec.content?.badge}
                                      fallback="Cerita Brand"
                                      onSave={(val) => handleUpdateSectionContent({ badge: val }, sec.id)}
                                      onSelectSec={() => setSelectedSecId(sec.id)}
                                      badgeLabel="Edit Badge"
                                    />
                                  </span>
                                </div>
                                <h3
                                  style={{ color: theme.text }}
                                  className="text-lg font-bold"
                                >
                                  <InlineCanvasText
                                    value={sec.content?.title}
                                    fallback="Cerita Toko"
                                    onSave={(val) => handleUpdateSectionContent({ title: val }, sec.id)}
                                    onSelectSec={() => setSelectedSecId(sec.id)}
                                    badgeLabel="Edit Judul"
                                  />
                                </h3>
                                <p
                                  style={{ color: theme.mutedText }}
                                  className="mt-2 text-xs leading-relaxed"
                                >
                                  <InlineCanvasText
                                    value={sec.content?.paragraph}
                                    fallback="Paragraf cerita toko..."
                                    multiline
                                    onSave={(val) => handleUpdateSectionContent({ paragraph: val }, sec.id)}
                                    onSelectSec={() => setSelectedSecId(sec.id)}
                                    badgeLabel="Edit Paragraf"
                                  />
                                </p>
                                {Array.isArray(sec.content?.bullet_points) && (
                                  <div className="mt-3 space-y-1 text-2xs">
                                    {sec.content.bullet_points.map((pt: string, idx: number) => (
                                      <div
                                        key={idx}
                                        className="group/pt flex items-center justify-between gap-1.5 rounded-md px-1.5 py-1 hover:bg-black/5 transition-colors"
                                        style={{ color: theme.text }}
                                      >
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                          <InlineCanvasText
                                            value={pt}
                                            fallback={`Poin keunggulan ${idx + 1}`}
                                            onSave={(val) => handleUpdateSectionBulletPoint(sec.id, idx, val)}
                                            onSelectSec={() => setSelectedSecId(sec.id)}
                                            badgeLabel="Edit Poin"
                                          />
                                        </div>
                                        <div className="opacity-0 group-hover/pt:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 shrink-0 bg-slate-900/80 text-white rounded p-0.5">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMoveBulletPoint(sec.id, idx, idx - 1);
                                            }}
                                            disabled={idx === 0}
                                            title="Naikkan poin"
                                            className="p-0.5 hover:bg-white/20 rounded disabled:opacity-30 transition-colors"
                                          >
                                            <ChevronUp className="h-2.5 w-2.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleMoveBulletPoint(sec.id, idx, idx + 1);
                                            }}
                                            disabled={idx === sec.content.bullet_points.length - 1}
                                            title="Turunkan poin"
                                            className="p-0.5 hover:bg-white/20 rounded disabled:opacity-30 transition-colors"
                                          >
                                            <ChevronDown className="h-2.5 w-2.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteBulletPoint(sec.id, idx);
                                            }}
                                            disabled={sec.content.bullet_points.length <= 1}
                                            title="Hapus poin"
                                            className="p-0.5 hover:bg-rose-500/40 text-rose-300 rounded disabled:opacity-30 transition-colors"
                                          >
                                            <Trash2 className="h-2.5 w-2.5" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAddBulletPoint(sec.id);
                                      }}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline pt-1"
                                    >
                                      <Plus className="h-3 w-3" />
                                      + Tambah Poin Baru
                                    </button>
                                  </div>
                                )}
                                <div className="mt-4">
                                  <span
                                    className={cn(
                                      "inline-block rounded-lg px-4 py-2 text-xs font-bold shadow-xs",
                                      theme.isDark
                                        ? "bg-white text-slate-900"
                                        : "bg-slate-900 text-white"
                                    )}
                                  >
                                    <InlineCanvasText
                                      value={sec.content?.button_text}
                                      fallback="Pelajari Selengkapnya"
                                      onSave={(val) => handleUpdateSectionContent({ button_text: val }, sec.id)}
                                      onSelectSec={() => setSelectedSecId(sec.id)}
                                      badgeLabel="Edit Tombol"
                                    />
                                  </span>
                                </div>
                              </div>
                              <div>
                                <InlineCanvasImage
                                  src={sec.content?.image_url || "/placeholder-product.svg"}
                                  alt="Story"
                                  containerClassName="rounded-xl border border-black/10 overflow-hidden shadow-xs max-h-48"
                                  className="h-full w-full object-cover max-h-48"
                                  label="Ganti Foto Cerita"
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  onEditClick={() =>
                                    openMediaModal({
                                      type: "image",
                                      secId: sec.id,
                                      field: "image_url",
                                      currentUrl: sec.content?.image_url || "",
                                      title: "Ganti Foto Cerita Toko",
                                    })
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 6. COUNTDOWN PROMO */}
                        {sec.type === "countdown_promo" && (
                          <div
                            style={{
                              backgroundColor: theme.bg,
                              color: theme.text,
                            }}
                            className={cn("text-center border-b border-black/10 transition-colors", padClass)}
                          >
                            <div className="mb-2">
                              <span className="inline-block rounded-full bg-amber-400 text-slate-950 px-3 py-0.5 text-2xs font-extrabold uppercase">
                                <InlineCanvasText
                                  value={sec.content?.badge}
                                  fallback="Promo Terbatas"
                                  onSave={(val) => handleUpdateSectionContent({ badge: val }, sec.id)}
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  badgeLabel="Edit Badge Promo"
                                />
                              </span>
                            </div>
                            <h3
                              style={{ color: theme.text }}
                              className="text-xl font-extrabold max-w-lg mx-auto"
                            >
                              <InlineCanvasText
                                value={sec.content?.title}
                                fallback="Promo Flash Sale"
                                onSave={(val) => handleUpdateSectionContent({ title: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Judul Promo"
                              />
                            </h3>
                            <p
                              style={{ color: theme.mutedText }}
                              className="mt-1 text-xs max-w-md mx-auto"
                            >
                              <InlineCanvasText
                                value={sec.content?.subtitle}
                                fallback="Hanya berlaku hari ini untuk 50 pembeli pertama"
                                onSave={(val) => handleUpdateSectionContent({ subtitle: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Subjudul Promo"
                              />
                            </p>
                            <div className="mt-4 flex items-center justify-center gap-2 font-mono text-xs">
                              <span className="rounded bg-white/20 px-3 py-1 font-bold">
                                <InlineCanvasText
                                  value={sec.content?.discount_tag}
                                  fallback="DISKON 30%"
                                  onSave={(val) => handleUpdateSectionContent({ discount_tag: val }, sec.id)}
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  badgeLabel="Edit Tag Diskon"
                                />
                              </span>
                              <span className="rounded bg-white px-3 py-1 font-extrabold text-slate-900 shadow-xs flex items-center gap-1">
                                <span>Sisa:</span>
                                <InlineCanvasText
                                  value={String(sec.content?.countdown_hours || "12")}
                                  fallback="12"
                                  onSave={(val) => handleUpdateSectionContent({ countdown_hours: parseInt(val) || 12 }, sec.id)}
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  badgeLabel="Edit Jam"
                                />
                                <span>Jam</span>
                              </span>
                            </div>
                            <div className="mt-5">
                              <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-bold text-slate-950 shadow-md">
                                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                                <InlineCanvasText
                                  value={sec.content?.button_text}
                                  fallback="Klaim Promo"
                                  onSave={(val) => handleUpdateSectionContent({ button_text: val }, sec.id)}
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  badgeLabel="Edit Tombol Promo"
                                />
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 7. BENEFITS */}
                        {sec.type === "benefits" && (
                          <div
                            style={{ backgroundColor: theme.bg, color: theme.text }}
                            className={cn("border-b border-black/10 transition-colors", padClass)}
                          >
                            <h3
                              style={{ color: theme.text }}
                              className="text-base font-bold text-center mb-6"
                            >
                              <InlineCanvasText
                                value={sec.content?.title}
                                fallback="Keunggulan Layanan"
                                onSave={(val) => handleUpdateSectionContent({ title: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Judul Keunggulan"
                              />
                            </h3>
                            <p
                              style={{ color: theme.mutedText }}
                              className="text-xs text-center -mt-4 mb-6"
                            >
                              <InlineCanvasText
                                value={sec.content?.subtitle}
                                fallback="Mengapa memilih produk & layanan kami"
                                onSave={(val) => handleUpdateSectionContent({ subtitle: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Subjudul"
                              />
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto">
                              {(sec.content?.items || []).map((it: any, i: number) => (
                                <div
                                  key={i}
                                  style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                                  className="group/card relative rounded-xl border p-3.5 text-xs shadow-xs transition-all text-left"
                                >
                                  {/* Floating Card Actions Pill */}
                                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 bg-slate-900/90 backdrop-blur-xs text-white rounded-lg p-1 shadow-md border border-white/20">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveSectionItem(sec.id, i, i - 1);
                                      }}
                                      disabled={i === 0}
                                      title="Geser ke kiri / urutan sebelumnya"
                                      className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <ChevronLeft className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveSectionItem(sec.id, i, i + 1);
                                      }}
                                      disabled={i === (sec.content?.items || []).length - 1}
                                      title="Geser ke kanan / urutan berikutnya"
                                      className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <ChevronRight className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicateSectionItem(sec.id, i);
                                      }}
                                      title="Duplikat keunggulan ini"
                                      className="p-1 rounded hover:bg-white/20 text-white transition-colors"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSectionItem(sec.id, i);
                                      }}
                                      disabled={(sec.content?.items || []).length <= 1}
                                      title="Hapus keunggulan ini"
                                      className="p-1 rounded hover:bg-rose-500/30 text-rose-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>

                                  <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center font-bold mb-2">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  </div>
                                  <div style={{ color: theme.cardText }} className="font-bold pr-14">
                                    <InlineCanvasText
                                      value={it.title}
                                      fallback={`Keunggulan #${i + 1}`}
                                      onSave={(val) => handleUpdateSectionItem(sec.id, i, "title", val)}
                                      onSelectSec={() => setSelectedSecId(sec.id)}
                                      badgeLabel="Edit Judul"
                                    />
                                  </div>
                                  <div style={{ color: theme.cardMuted }} className="text-2xs mt-1 leading-relaxed">
                                    <InlineCanvasText
                                      value={it.desc}
                                      fallback="Deskripsi singkat keunggulan..."
                                      multiline
                                      onSave={(val) => handleUpdateSectionItem(sec.id, i, "desc", val)}
                                      onSelectSec={() => setSelectedSecId(sec.id)}
                                      badgeLabel="Edit Deskripsi"
                                    />
                                  </div>
                                </div>
                              ))}

                              {/* + Tambah Card Keunggulan Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddSectionItem(sec.id, {
                                    title: "Keunggulan Baru",
                                    desc: "Jelaskan manfaat atau garansi yang didapat pembeli...",
                                  });
                                }}
                                className="rounded-xl border-2 border-dashed border-ink-300 hover:border-signal p-4 flex flex-col items-center justify-center gap-2 text-ink-500 hover:text-signal hover:bg-signal-wash/30 transition-all min-h-[110px]"
                              >
                                <Plus className="h-5 w-5" />
                                <span className="text-2xs font-bold">+ Tambah Keunggulan</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 8. PRODUCT GRID */}
                        {sec.type === "product_grid" && (
                          <div
                            style={{ backgroundColor: theme.bg, color: theme.text }}
                            className={cn("text-center border-b border-black/10 transition-colors", padClass)}
                          >
                            <h3
                              style={{ color: theme.text }}
                              className="text-base font-bold"
                            >
                              <InlineCanvasText
                                value={sec.content?.title}
                                fallback="Katalog Produk Pilihan"
                                onSave={(val) => handleUpdateSectionContent({ title: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Judul Katalog"
                              />
                            </h3>
                            <p
                              style={{ color: theme.mutedText }}
                              className="text-xs mt-1 max-w-md mx-auto"
                            >
                              <InlineCanvasText
                                value={sec.content?.subtitle}
                                fallback="Temukan produk terbaik untuk kebutuhan harian Anda"
                                onSave={(val) => handleUpdateSectionContent({ subtitle: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Subjudul Katalog"
                              />
                            </p>
                            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                              {[1, 2, 3].map((num) => (
                                <div
                                  key={num}
                                  style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                                  className="rounded-xl border p-3 text-left shadow-xs transition-all"
                                >
                                  <div className="aspect-square w-full rounded-lg bg-black/10 mb-2 overflow-hidden">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src="/placeholder-product.svg" alt="P" className="h-full w-full object-cover" />
                                  </div>
                                  <p style={{ color: theme.cardText }} className="font-bold text-xs truncate">
                                    Sample Produk #{num}
                                  </p>
                                  <p className="font-mono text-emerald-500 font-extrabold text-xs mt-1">Rp 175.000</p>
                                  <span
                                    className={cn(
                                      "mt-2 block rounded py-1 text-center text-[10px] font-bold shadow-xs",
                                      theme.isDark
                                        ? "bg-emerald-600 text-white"
                                        : "bg-slate-900 text-white"
                                    )}
                                  >
                                    Pesan via WA
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 9. TESTIMONIALS */}
                        {sec.type === "testimonials" && (
                          <div
                            style={{ backgroundColor: theme.bg, color: theme.text }}
                            className={cn("border-b border-black/10 transition-colors", padClass)}
                          >
                            <h3
                              style={{ color: theme.text }}
                              className="text-base font-bold text-center mb-4"
                            >
                              <InlineCanvasText
                                value={sec.content?.title}
                                fallback="Ulasan Pembeli"
                                onSave={(val) => handleUpdateSectionContent({ title: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Judul Ulasan"
                              />
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
                              {(sec.content?.items || []).map((it: any, i: number) => (
                                <div
                                  key={i}
                                  style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                                  className="group/card relative rounded-xl border p-3.5 text-xs shadow-xs transition-all text-left"
                                >
                                  {/* Floating Card Actions Pill */}
                                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 bg-slate-900/90 backdrop-blur-xs text-white rounded-lg p-1 shadow-md border border-white/20">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveSectionItem(sec.id, i, i - 1);
                                      }}
                                      disabled={i === 0}
                                      title="Geser ke kiri / urutan sebelumnya"
                                      className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <ChevronLeft className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveSectionItem(sec.id, i, i + 1);
                                      }}
                                      disabled={i === (sec.content?.items || []).length - 1}
                                      title="Geser ke kanan / urutan berikutnya"
                                      className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <ChevronRight className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicateSectionItem(sec.id, i);
                                      }}
                                      title="Duplikat testimoni ini"
                                      className="p-1 rounded hover:bg-white/20 text-white transition-colors"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSectionItem(sec.id, i);
                                      }}
                                      disabled={(sec.content?.items || []).length <= 1}
                                      title="Hapus testimoni ini"
                                      className="p-1 rounded hover:bg-rose-500/30 text-rose-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>

                                  <div style={{ color: theme.cardMuted }} className="italic pr-12">
                                    &ldquo;
                                    <InlineCanvasText
                                      value={it.text}
                                      fallback="Produk sangat memuaskan dan respon cepat!"
                                      multiline
                                      onSave={(val) => handleUpdateSectionItem(sec.id, i, "text", val)}
                                      onSelectSec={() => setSelectedSecId(sec.id)}
                                      badgeLabel="Edit Ulasan"
                                    />
                                    &rdquo;
                                  </div>
                                  <div style={{ color: theme.cardText }} className="mt-2 font-bold not-italic text-2xs flex items-center gap-1">
                                    <InlineCanvasText
                                      value={it.name}
                                      fallback="Nama Pelanggan"
                                      onSave={(val) => handleUpdateSectionItem(sec.id, i, "name", val)}
                                      onSelectSec={() => setSelectedSecId(sec.id)}
                                      badgeLabel="Edit Nama"
                                    />
                                    <span style={{ color: theme.cardMuted }} className="font-normal">-</span>
                                    <span style={{ color: theme.cardMuted }} className="font-normal">
                                      <InlineCanvasText
                                        value={it.role}
                                        fallback="Verified Buyer"
                                        onSave={(val) => handleUpdateSectionItem(sec.id, i, "role", val)}
                                        onSelectSec={() => setSelectedSecId(sec.id)}
                                        badgeLabel="Edit Peran"
                                      />
                                    </span>
                                  </div>
                                </div>
                              ))}

                              {/* + Tambah Card Testimoni Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddSectionItem(sec.id, {
                                    name: "Pelanggan Baru",
                                    role: "Pelanggan Terverifikasi",
                                    text: "Kualitas barang sangat bagus dan pengiriman super cepat!",
                                    rating: 5,
                                  });
                                }}
                                className="rounded-xl border-2 border-dashed border-ink-300 hover:border-signal p-4 flex flex-col items-center justify-center gap-2 text-ink-500 hover:text-signal hover:bg-signal-wash/30 transition-all min-h-[100px]"
                              >
                                <Plus className="h-5 w-5" />
                                <span className="text-2xs font-bold">+ Tambah Testimoni</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 10. FAQ */}
                        {sec.type === "faq" && (
                          <div
                            style={{ backgroundColor: theme.bg, color: theme.text }}
                            className={cn("border-b border-black/10 transition-colors", padClass)}
                          >
                            <h3
                              style={{ color: theme.text }}
                              className="text-base font-bold text-center mb-4"
                            >
                              <InlineCanvasText
                                value={sec.content?.title}
                                fallback="FAQ"
                                onSave={(val) => handleUpdateSectionContent({ title: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Judul FAQ"
                              />
                            </h3>
                            <div className="space-y-2 max-w-md mx-auto text-left">
                              {(sec.content?.items || []).map((it: any, i: number) => (
                                <div
                                  key={i}
                                  style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder }}
                                  className="group/card relative rounded-xl border p-3 text-xs shadow-xs transition-all"
                                >
                                  {/* Floating Card Actions Pill */}
                                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-0.5 bg-slate-900/90 backdrop-blur-xs text-white rounded-lg p-1 shadow-md border border-white/20">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveSectionItem(sec.id, i, i - 1);
                                      }}
                                      disabled={i === 0}
                                      title="Naikkan urutan pertanyaan"
                                      className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMoveSectionItem(sec.id, i, i + 1);
                                      }}
                                      disabled={i === (sec.content?.items || []).length - 1}
                                      title="Turunkan urutan pertanyaan"
                                      className="p-1 rounded hover:bg-white/20 text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDuplicateSectionItem(sec.id, i);
                                      }}
                                      title="Duplikat pertanyaan ini"
                                      className="p-1 rounded hover:bg-white/20 text-white transition-colors"
                                    >
                                      <Copy className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSectionItem(sec.id, i);
                                      }}
                                      disabled={(sec.content?.items || []).length <= 1}
                                      title="Hapus pertanyaan ini"
                                      className="p-1 rounded hover:bg-rose-500/30 text-rose-300 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>

                                  <div style={{ color: theme.cardText }} className="font-bold pr-16">
                                    <InlineCanvasText
                                      value={it.q}
                                      fallback="Pertanyaan yang sering diajukan?"
                                      onSave={(val) => handleUpdateSectionItem(sec.id, i, "q", val)}
                                      onSelectSec={() => setSelectedSecId(sec.id)}
                                      badgeLabel="Edit Pertanyaan"
                                    />
                                  </div>
                                  <div style={{ color: theme.cardMuted }} className="mt-1 text-2xs leading-relaxed">
                                    <InlineCanvasText
                                      value={it.a}
                                      fallback="Jawaban atas pertanyaan pembeli..."
                                      multiline
                                      onSave={(val) => handleUpdateSectionItem(sec.id, i, "a", val)}
                                      onSelectSec={() => setSelectedSecId(sec.id)}
                                      badgeLabel="Edit Jawaban"
                                    />
                                  </div>
                                </div>
                              ))}

                              {/* + Tambah FAQ Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddSectionItem(sec.id, {
                                    q: "Pertanyaan baru?",
                                    a: "Jawaban penjelasan...",
                                  });
                                }}
                                className="w-full rounded-xl border-2 border-dashed border-ink-300 hover:border-signal p-3 flex items-center justify-center gap-1.5 text-ink-500 hover:text-signal hover:bg-signal-wash/30 transition-all text-2xs font-bold"
                              >
                                <Plus className="h-4 w-4" />
                                <span>+ Tambah Tanya Jawab (FAQ)</span>
                              </button>
                            </div>
                          </div>
                        )}

                        {/* 11. WHATSAPP CTA */}
                        {sec.type === "whatsapp_cta" && (
                          <div
                            style={{
                              backgroundColor: theme.bg,
                              color: theme.text,
                            }}
                            className={cn("text-center border-b border-black/10 transition-colors", padClass)}
                          >
                            <h3 style={{ color: theme.text }} className="text-lg font-extrabold max-w-md mx-auto">
                              <InlineCanvasText
                                value={sec.content?.title}
                                fallback="Pesan Sekarang via WhatsApp"
                                onSave={(val) => handleUpdateSectionContent({ title: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Judul CTA"
                              />
                            </h3>
                            <p style={{ color: theme.mutedText }} className="text-xs mt-1.5 max-w-sm mx-auto leading-relaxed">
                              <InlineCanvasText
                                value={sec.content?.subtitle}
                                fallback="Konsultasi gratis & respon cepat dari customer service kami."
                                onSave={(val) => handleUpdateSectionContent({ subtitle: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Subjudul CTA"
                              />
                            </p>
                            <div className="mt-4">
                              <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-emerald-900 shadow-md">
                                <MessageCircle className="h-4 w-4 text-emerald-700 shrink-0" />
                                <InlineCanvasText
                                  value={sec.content?.button_text}
                                  fallback="Chat WhatsApp"
                                  onSave={(val) => handleUpdateSectionContent({ button_text: val }, sec.id)}
                                  onSelectSec={() => setSelectedSecId(sec.id)}
                                  badgeLabel="Edit Tombol WA"
                                />
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 12. FOOTER */}
                        {sec.type === "footer" && (
                          <div
                            style={{
                              backgroundColor: theme.bg,
                              color: theme.text,
                            }}
                            className={cn("text-center border-t border-black/10 text-2xs transition-colors", padClass)}
                          >
                            <div style={{ color: theme.text }} className="font-bold text-xs">
                              <InlineCanvasText
                                value={sec.content?.brand_name}
                                fallback="Toko Online"
                                onSave={(val) => handleUpdateSectionContent({ brand_name: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Nama Toko"
                              />
                            </div>
                            <div style={{ color: theme.mutedText }} className="mt-0.5">
                              <InlineCanvasText
                                value={sec.content?.tagline}
                                fallback="Solusi belanja terpercaya Anda"
                                onSave={(val) => handleUpdateSectionContent({ tagline: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Slogan"
                              />
                            </div>
                            <div style={{ color: theme.mutedText }} className="mt-2 opacity-60">
                              <InlineCanvasText
                                value={sec.content?.copyright}
                                fallback="© 2026 Toko Online. All rights reserved."
                                onSave={(val) => handleUpdateSectionContent({ copyright: val }, sec.id)}
                                onSelectSec={() => setSelectedSecId(sec.id)}
                                badgeLabel="Edit Hak Cipta"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Canvas Button: Add Section */}
              <button
                type="button"
                onClick={() => setShowAddSectionModal(true)}
                className="w-full max-w-xl rounded-xl border-2 border-dashed border-ink-300 bg-white/70 p-3.5 text-center transition-all hover:border-signal hover:bg-signal-wash/20"
              >
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-ink">
                  <Plus className="h-4 w-4 text-signal-strong" />
                  Tambah Section Baru ke Halaman
                </div>
                <p className="text-[10px] text-ink-500 mt-0.5">
                  Pilih dari galeri foto, video showcase, promo flash sale, review, dan lainnya
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL SECTION CATALOG LIBRARY */}
      <WebsiteSectionModal
        isOpen={showAddSectionModal}
        onClose={() => setShowAddSectionModal(false)}
        onAddSection={handleAddSection}
      />

      {/* MODAL PENGATURAN TOKO (WEBSITE SETTINGS) */}
      <Modal open={Boolean(showSiteSettingsModal && currentSite)} onClose={() => setShowSiteSettingsModal(false)}>
        {showSiteSettingsModal && currentSite && (
          <div
            className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 bg-ink-50/70 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-signal-wash text-signal-strong">
                  <Settings className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Pengaturan Website Toko</h3>
                  <p className="text-2xs text-ink-500">Konfigurasi identitas toko, SEO, dan integrasi AI</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSiteSettingsModal(false)}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">
                  Nama Toko / Brand *
                </label>
                <input
                  type="text"
                  value={siteSettingsForm.name}
                  onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, name: e.target.value })}
                  placeholder="Misal: Glow Natural Official Store"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink focus:border-signal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">
                  Tautan Toko (Storefront URL)
                </label>
                <div className="flex items-center rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 font-mono text-2xs text-ink-600">
                  <span className="text-ink-400">https://noewbar.com/store/</span>
                  <span className="font-bold text-ink">{currentSite.slug}</span>
                </div>
                <p className="text-[10px] text-ink-400 mt-1">
                  Slug URL toko terdaftar otomatis dan dapat diakses publik setelah toko dipublikasikan.
                </p>
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">
                  Judul SEO Halaman (Meta Title)
                </label>
                <input
                  type="text"
                  value={siteSettingsForm.title}
                  onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, title: e.target.value })}
                  placeholder="Misal: Glow Natural - Skincare Alami BPOM & Halal"
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink focus:border-signal focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-2xs font-bold uppercase text-ink-600 mb-1">
                  Deskripsi SEO (Meta Description)
                </label>
                <textarea
                  rows={2}
                  value={siteSettingsForm.description}
                  onChange={(e) => setSiteSettingsForm({ ...siteSettingsForm, description: e.target.value })}
                  placeholder="Deskripsi singkat toko yang muncul pada hasil pencarian Google..."
                  className="w-full rounded-lg border border-ink-200 bg-white p-2.5 text-xs text-ink focus:border-signal focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={siteSettingsForm.is_knowledge_source}
                    onChange={(e) =>
                      setSiteSettingsForm({
                        ...siteSettingsForm,
                        is_knowledge_source: e.target.checked,
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-ink-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-bold text-xs text-emerald-900 block">
                      Sinkronkan sebagai Sumber AI Knowledge Base
                    </span>
                    <span className="text-2xs text-emerald-800 leading-relaxed block mt-0.5">
                      Jika dicentang, seluruh informasi profil toko, FAQ, keunggulan, dan katalog produk di website ini otomatis diindeks agar chatbot WhatsApp AI dapat menjawab pertanyaan pelanggan dengan tepat.
                    </span>
                  </div>
                </label>
              </div>

              <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-xs text-red-950 block">Zona Bahaya: Hapus Website</span>
                  <span className="text-2xs text-red-700 leading-relaxed block mt-0.5">
                    Hapus website toko ini secara permanen. Tautan publik tidak akan dapat diakses lagi.
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  type="button"
                  className="border-red-300 bg-white text-red-600 hover:bg-red-50 shrink-0 font-semibold"
                  onClick={() => {
                    setShowSiteSettingsModal(false);
                    setDeleteError(null);
                    setSiteToDelete(currentSite);
                  }}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Hapus Web
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-3.5">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setShowSiteSettingsModal(false)}
                disabled={savingDraft}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={handleSaveSiteSettings}
                loading={savingDraft}
                disabled={!siteSettingsForm.name.trim()}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Simpan Pengaturan
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL KONFIRMASI HAPUS WEBSITE */}
      <Modal open={Boolean(siteToDelete)} onClose={() => setSiteToDelete(null)}>
        {siteToDelete && (
          <div
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-red-100 bg-red-50/70 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-100 text-red-700">
                  <Trash2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-red-950">Hapus Website Toko</h3>
                  <p className="text-2xs text-red-700">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!deletingSite) setSiteToDelete(null);
                }}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-ink-700 leading-relaxed">
                Apakah Anda yakin ingin menghapus website <strong>&ldquo;{siteToDelete.name}&rdquo;</strong>?
              </p>
              <div className="rounded-lg bg-ink-50 p-2.5 font-mono text-2xs text-ink-600">
                Tautan: /store/{siteToDelete.slug}
              </div>
              <p className="text-2xs text-ink-500 leading-relaxed">
                Seluruh halaman, struktur section, dan tampilan publik website ini akan dihapus permanen. Setelah dihapus, Anda dapat membuat website baru dari awal.
              </p>

              {deleteError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-2 text-2xs text-red-700 font-medium">
                  {deleteError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-3.5">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setSiteToDelete(null)}
                disabled={deletingSite}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                className="bg-red-600 hover:bg-red-700 text-white border-transparent"
                onClick={() => handleDeleteWebsite(siteToDelete)}
                loading={deletingSite}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Ya, Hapus Permanen
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL KONFIRMASI TIMPA / GANTI WEBSITE (1 STORE = 1 WEBSITE) */}
      <Modal open={Boolean(confirmReplaceModal && confirmReplaceModal.open)} onClose={() => setConfirmReplaceModal(null)}>
        {confirmReplaceModal && confirmReplaceModal.open && (
          <div
            className="w-full max-w-md rounded-2xl border border-amber-200 bg-white shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-amber-100 bg-amber-50/70 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-amber-950">
                    {confirmReplaceModal.type === "ai"
                      ? "Konfirmasi Generate Ulang dengan AI"
                      : "Konfirmasi Ganti Template Website"}
                  </h3>
                  <p className="text-2xs text-amber-700">Aturan: 1 Akun Toko = 1 Website Resmi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmReplaceModal(null)}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <p className="text-ink-700 leading-relaxed">
                Toko Anda sudah memiliki website aktif <strong>&ldquo;{websites[0]?.name}&rdquo;</strong>.
              </p>
              <p className="text-2xs text-ink-600 leading-relaxed">
                Untuk menjaga konsistensi katalog produk dan chatbot AI WhatsApp, setiap akun toko hanya memiliki 1 website resmi. Melanjutkan tindakan ini akan <strong>menimpa dan menggantikan website yang ada saat ini</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-ink-100 bg-ink-50/50 px-5 py-3.5">
              <Button
                variant="ghost"
                size="sm"
                type="button"
                onClick={() => setConfirmReplaceModal(null)}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={() => {
                  if (confirmReplaceModal.type === "ai") {
                    handleCreateWithAi(true);
                  } else if (confirmReplaceModal.template) {
                    handleUseTemplate(confirmReplaceModal.template, true);
                  }
                }}
                loading={confirmReplaceModal.type === "ai" ? aiGenerating : loading}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                Ya, Timpa & Buat Baru
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL PALET TEMA WARNA BRAND */}
      <Modal open={showThemeModal} onClose={() => setShowThemeModal(false)}>
        <div
          className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white shadow-2xl overflow-hidden p-5 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-ink-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-signal-wash text-signal-strong">
                <Palette className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-ink">Palet Tema Warna Brand</h3>
                <p className="text-2xs text-ink-500">
                  Terapkan harmoni warna seketika ke seluruh hero, CTA, banner, dan footer
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowThemeModal(false)}
              className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
            {COLOR_THEMES.map((th) => (
              <div
                key={th.id}
                onClick={() => handleApplyTheme(th)}
                className="group cursor-pointer rounded-xl border border-ink-200 p-3 hover:border-signal hover:shadow-flat transition-all space-y-2.5 bg-white"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink group-hover:text-signal transition-colors">
                    {th.name}
                  </span>
                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-semibold text-ink-600">
                    {th.badge}
                  </span>
                </div>
                {/* Visual Palette Swatch Preview */}
                <div className="flex h-7 w-full overflow-hidden rounded-lg border border-ink-200">
                  <div className="flex-1" style={{ backgroundColor: th.heroBg }} title="Warna Latar Hero" />
                  <div className="w-12" style={{ backgroundColor: th.heroBtn }} title="Tombol Aksen" />
                  <div className="w-8" style={{ backgroundColor: th.ctaBg }} title="Warna CTA WhatsApp" />
                  <div className="w-8" style={{ backgroundColor: th.footerBg }} title="Footer Toko" />
                </div>
                <p className="text-[10px] text-ink-400">Klik untuk menyelaraskan warna toko</p>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-ink-100">
            <Button size="sm" variant="ghost" onClick={() => setShowThemeModal(false)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL SCAN QR CODE UNTUK TES DI HP */}
      <Modal open={showQrModal} onClose={() => setShowQrModal(false)}>
        {currentSite && (
          <div
            className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white shadow-2xl overflow-hidden p-6 text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div className="flex items-center gap-2 text-left">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-signal-wash text-signal-strong">
                  <QrCode className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">Pratinjau di Smartphone</h3>
                  <p className="text-2xs text-ink-500">Scan via kamera HP Anda</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col items-center justify-center p-4 bg-ink-50/70 rounded-xl border border-ink-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                  typeof window !== "undefined"
                    ? `${window.location.origin}/store/${currentSite.slug}`
                    : `https://noewbar.com/store/${currentSite.slug}`
                )}`}
                alt="QR Code Toko"
                className="h-48 w-48 rounded-lg bg-white p-2 shadow-flat"
              />
              <p className="mt-3 font-mono text-2xs text-ink-600 break-all select-all">
                /store/{currentSite.slug}
              </p>
            </div>

            <p className="text-2xs text-ink-500 leading-relaxed">
              Buka kamera ponsel Anda dan arahkan ke kode QR di atas untuk menguji alur checkout dan tata letak toko secara langsung di HP.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
              <Button size="sm" variant="ghost" onClick={() => setShowQrModal(false)}>
                Tutup
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL GANTI FOTO / VIDEO LANGSUNG (ON-VIEW) */}
      <Modal open={Boolean(mediaModalTarget)} onClose={() => setMediaModalTarget(null)}>
        {mediaModalTarget && (
          <div
            className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white shadow-2xl overflow-hidden p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-100 pb-3">
              <div className="flex items-center gap-2 text-left">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-signal-wash text-signal-strong">
                  {mediaModalTarget.type === "video" ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink">
                    {mediaModalTarget.title || (mediaModalTarget.type === "video" ? "Ganti Video" : "Ganti Foto")}
                  </h3>
                  <p className="text-2xs text-ink-500">
                    {mediaModalTarget.type === "video"
                      ? "Tempel URL YouTube atau file MP4"
                      : "Pilih foto preset siap pakai atau tempel URL kustom"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMediaModalTarget(null)}
                className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  URL {mediaModalTarget.type === "video" ? "Video" : "Gambar"}
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    placeholder={
                      mediaModalTarget.type === "video"
                        ? "https://www.youtube.com/watch?v=..."
                        : "https://images.unsplash.com/..."
                    }
                    className="flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs text-ink placeholder:text-ink-400 focus:border-signal focus:outline-none"
                  />
                  {mediaUrlInput && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setMediaUrlInput("")}
                      className="text-xs"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Live Preview Box */}
              {mediaModalTarget.type === "image" && mediaUrlInput && (
                <div className="rounded-xl border border-ink-200 p-2 bg-ink-50">
                  <p className="text-[10px] font-bold text-ink-500 mb-1 uppercase tracking-wider">
                    Pratinjau Foto:
                  </p>
                  <div className="max-h-40 overflow-hidden rounded-lg flex items-center justify-center bg-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrlInput}
                      alt="Pratinjau"
                      className="max-h-40 w-auto object-contain rounded"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Presets Grid */}
              {mediaModalTarget.type === "image" && (
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                    Koleksi Foto Komersial Siap Pakai:
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 border border-ink-100 rounded-xl bg-ink-50/50">
                    {IMAGE_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMediaUrlInput(preset.url)}
                        className={cn(
                          "flex flex-col text-left rounded-lg border p-1.5 transition-all text-xs hover:border-signal cursor-pointer",
                          mediaUrlInput === preset.url
                            ? "border-signal bg-signal-wash/40 ring-1 ring-signal"
                            : "border-ink-200 bg-white"
                        )}
                      >
                        <div className="aspect-video w-full rounded overflow-hidden bg-ink-100 mb-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="text-[10px] font-semibold text-ink truncate">
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {mediaModalTarget.type === "video" && (
                <div>
                  <label className="block text-2xs font-bold uppercase tracking-wider text-ink-500 mb-2">
                    Contoh Tautan Video:
                  </label>
                  <div className="space-y-1.5">
                    {VIDEO_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setMediaUrlInput(preset.url)}
                        className="w-full flex items-center justify-between rounded-lg border border-ink-200 p-2 text-xs hover:border-signal text-left bg-white cursor-pointer"
                      >
                        <span className="font-semibold text-ink">{preset.label}</span>
                        <span className="text-[10px] text-ink-400 font-mono truncate max-w-xs">
                          {preset.url}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-ink-100">
              <Button size="sm" variant="secondary" onClick={() => setMediaModalTarget(null)}>
                Batal
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  if (mediaModalTarget.itemIndex !== undefined) {
                    handleUpdateSectionItem(
                      mediaModalTarget.secId,
                      mediaModalTarget.itemIndex,
                      mediaModalTarget.field,
                      mediaUrlInput
                    );
                  } else {
                    handleUpdateSectionContent(
                      { [mediaModalTarget.field]: mediaUrlInput },
                      mediaModalTarget.secId
                    );
                  }
                  setMediaModalTarget(null);
                }}
              >
                Gunakan {mediaModalTarget.type === "video" ? "Video" : "Foto"} Ini
              </Button>
            </div>
          </div>
        )}
      </Modal>
      {sectionNotice && (
        <p className="mt-3 rounded border border-warn/25 bg-warn-wash px-3 py-2 text-xs text-warn" role="status">
          {sectionNotice}
        </p>
      )}
      <ConfirmModal
        open={!!deleteSectionId}
        title="Hapus section?"
        description="Section dihapus dari halaman dan tidak bisa dikembalikan."
        confirmLabel="Hapus section"
        danger
        onConfirm={confirmDeleteSection}
        onClose={() => setDeleteSectionId(null)}
      />
    </div>
  );
}
