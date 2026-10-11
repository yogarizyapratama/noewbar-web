"use client";

/**
 * Application shell: the navigation architecture shared by the dashboard and
 * the operator console.
 *
 * Structure: grouped icon sidebar (collapsible to an icon rail, persisted),
 * a sticky topbar carrying context and a command entry point, and a command
 * palette on Cmd/Ctrl+K.
 *
 * Layout rules:
 * - The sidebar is static above `lg`, a drawer below it, and the drawer defaults
 *   CLOSED on small viewports so first paint never hides the page content.
 * - Active navigation is marked in ink, never in the accent. The accent is
 *   reserved for state that a probe confirmed.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  CornerDownLeft,
  Menu,
  Search,
  X,
} from "lucide-react";
import { Badge, IconButton, Kbd, StatusDot, cn } from "@/components/ui";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

export type NavItem<T extends string = string> = {
  id: T;
  label: string;
  icon: ReactNode;
  group?: string;
  badge?: number;
  keywords?: string;
};

export type PaletteCommand = {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  run: () => void;
};

const COLLAPSE_KEY = "noewbar.nav.collapsed";

export function AppShell<T extends string>({
  brand,
  brandNote,
  nav,
  active,
  onNavigate,
  status,
  headerActions,
  sidebarFooter,
  commands = [],
  children,
}: {
  brand: string;
  brandNote?: string;
  nav: NavItem<T>[];
  active: T;
  onNavigate: (id: T) => void;
  status?: { ok: boolean; label: string };
  headerActions?: ReactNode;
  sidebarFooter?: ReactNode;
  commands?: PaletteCommand[];
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Restore the rail preference and default the small-viewport drawer closed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
    if (window.innerWidth < 1024) setDrawerOpen(false);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      }
      return next;
    });
  }, []);

  // Cmd/Ctrl+K opens the palette from anywhere in the app.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(() => {
    const out: { name: string; items: NavItem<T>[] }[] = [];
    for (const item of nav) {
      const name = item.group ?? "";
      let bucket = out.find((g) => g.name === name);
      if (!bucket) {
        bucket = { name, items: [] };
        out.push(bucket);
      }
      bucket.items.push(item);
    }
    return out;
  }, [nav]);

  const go = useCallback(
    (id: T) => {
      onNavigate(id);
      setDrawerOpen(false);
    },
    [onNavigate]
  );

  return (
    <div className="min-h-screen bg-surface-sunken lg:flex">
      {drawerOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex shrink-0 transform flex-col border-r border-ink-200 bg-white transition-[transform,width] duration-200 w-72 lg:w-auto lg:static lg:translate-x-0",
          collapsed ? "lg:w-[68px]" : "lg:w-[248px]",
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* brand */}
        <div
          className={cn(
            "flex h-14 shrink-0 items-center gap-2.5 border-b border-ink-200",
            collapsed ? "justify-center px-0" : "px-4"
          )}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink font-mono text-xs font-bold text-white shadow-raised">
            N
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-sm font-bold leading-tight text-ink">{brand}</p>
              {brandNote && (
                <p className="truncate text-xs leading-tight text-ink-500">{brandNote}</p>
              )}
            </div>
          )}
          <IconButton
            label="Tutup menu"
            className="lg:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto p-2" aria-label="Navigasi utama">
          {groups.map((group, gi) => (
            <div key={group.name || `g${gi}`} className={cn(gi > 0 && "mt-4")}>
              {group.name && !collapsed && (
                <p className="eyebrow px-3 pb-1.5 pt-1 text-ink-400">{group.name}</p>
              )}
              {group.name && collapsed && <div className="mx-2 mb-2 border-t border-ink-200" />}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.id === active;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => go(item.id)}
                        aria-current={isActive ? "page" : undefined}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "group relative flex w-full min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-sm transition-all",
                          collapsed && "justify-center px-0",
                          isActive
                            ? "bg-ink-100 font-semibold text-ink shadow-flat"
                            : "font-medium text-ink-600 hover:bg-ink-50 hover:text-ink"
                        )}
                      >
                        <span
                          className={cn(
                            "shrink-0 transition-colors",
                            isActive ? "text-ink" : "text-ink-400 group-hover:text-ink-600"
                          )}
                        >
                          {item.icon}
                        </span>
                        {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}
                        {!collapsed && typeof item.badge === "number" && item.badge > 0 && (
                          <span className="rounded bg-warn-wash px-1.5 py-0.5 font-mono text-[10px] font-bold text-warn-strong border border-warn/20">
                            {item.badge}
                          </span>
                        )}
                        {isActive && !collapsed && (
                          <span
                            className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-signal-strong"
                            aria-hidden="true"
                          />
                        )}
                        {collapsed && typeof item.badge === "number" && item.badge > 0 && (
                          <span
                            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-warn"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* footer */}
        <div className="shrink-0 border-t border-ink-200 p-2">
          {!collapsed && (
            <div className="mb-2 px-1">
              <PwaInstallPrompt variant="compact" className="w-full justify-center" />
            </div>
          )}
          {sidebarFooter && !collapsed && <div className="mb-2">{sidebarFooter}</div>}
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn(
              "hidden w-full min-h-[44px] items-center gap-2 rounded px-3 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink lg:flex",
              collapsed && "justify-center px-0"
            )}
            aria-label={collapsed ? "Lebarkan menu" : "Kecilkan menu"}
          >
            {collapsed ? (
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
                Kecilkan
              </>
            )}
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:min-w-0 lg:flex-1">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-ink-200 bg-white/85 px-4 backdrop-blur sm:px-6">
          <div className="flex flex-1 items-center gap-3 min-w-0">
            <IconButton
              label="Buka menu"
              className="lg:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </IconButton>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex min-h-[40px] w-full max-w-xs items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 text-left text-sm text-ink-400 transition-colors hover:border-ink-300 hover:bg-white"
            >
              <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="flex-1 truncate">Cari atau jalankan perintah</span>
              <span className="hidden shrink-0 items-center gap-0.5 sm:flex">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            </button>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <PwaInstallPrompt variant="compact" className="hidden md:flex" />
            {headerActions}
            {status && (
              <Badge tone={status.ok ? "signal" : "danger"} className="hidden sm:inline-flex">
                <StatusDot ok={status.ok} />
                {status.label}
              </Badge>
            )}
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>

      {paletteOpen && (
        <CommandPalette
          nav={nav}
          commands={commands}
          onClose={() => setPaletteOpen(false)}
          onNavigate={(id) => go(id as T)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- palette */

function CommandPalette({
  nav,
  commands,
  onClose,
  onNavigate,
}: {
  nav: NavItem[];
  commands: PaletteCommand[];
  onClose: () => void;
  onNavigate: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const navEntries = nav.map((item) => ({
      key: `nav:${item.id}`,
      label: item.label,
      hint: "Buka halaman",
      icon: item.icon,
      groupLabel: "Navigasi",
      run: () => onNavigate(item.id),
      match: `${item.label} ${item.keywords ?? ""}`.toLowerCase(),
    }));
    const cmdEntries = commands.map((c) => ({
      key: `cmd:${c.id}`,
      label: c.label,
      hint: c.hint ?? "Jalankan",
      icon: c.icon,
      groupLabel: "Perintah",
      run: c.run,
      match: `${c.label} ${c.hint ?? ""}`.toLowerCase(),
    }));
    const all = [...navEntries, ...cmdEntries];
    if (!q) return all;
    return all.filter((e) => e.match.includes(q));
  }, [nav, commands, query, onNavigate]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  const commit = useCallback(
    (index: number) => {
      const entry = entries[index];
      if (!entry) return;
      onClose();
      entry.run();
    },
    [entries, onClose]
  );

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(entries.length - 1, c + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commit(cursor);
    }
  }

  let lastGroup = "";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palet perintah"
        className="card-overlay animate-palette-in relative w-full max-w-lg overflow-hidden"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-ink-200 px-3.5 py-3">
          <Search className="h-4 w-4 shrink-0 text-ink-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari halaman atau perintah..."
            className="w-full border-0 bg-transparent p-0 text-sm text-ink outline-none placeholder:text-ink-400"
            autoComplete="off"
          />
          <Kbd>Esc</Kbd>
        </div>

        <ul className="max-h-[52vh] overflow-y-auto p-1.5" role="listbox" aria-label="Hasil">
          {entries.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-ink-500">
              Tidak ada hasil untuk &ldquo;{query}&rdquo;
            </li>
          )}
          {entries.map((entry, i) => {
            const showGroup = entry.groupLabel !== lastGroup;
            lastGroup = entry.groupLabel;
            const selected = i === cursor;
            return (
              <li key={entry.key}>
                {showGroup && (
                  <p className="eyebrow px-2.5 pb-1 pt-2.5 text-ink-400">{entry.groupLabel}</p>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(i)}
                  className={cn(
                    "flex w-full min-h-[44px] items-center gap-2.5 rounded px-2.5 text-left text-sm transition-colors",
                    selected ? "bg-ink-100 text-ink" : "text-ink-600"
                  )}
                >
                  <span className={cn("shrink-0", selected ? "text-ink" : "text-ink-400")}>
                    {entry.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{entry.label}</span>
                  <span className="shrink-0 text-xs text-ink-400">{entry.hint}</span>
                  {selected && (
                    <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-ink-400" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
