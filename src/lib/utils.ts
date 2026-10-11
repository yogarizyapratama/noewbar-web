/**
 * Shared utility functions safe for both Server and Client Components.
 */

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function rupiah(n: number): string {
  return new Intl.NumberFormat("id-ID").format(Math.round(n));
}

export function timeAgo(iso: string | Date): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 0) return "baru saja";
  if (s < 60) return `${s} detik lalu`;
  if (s < 3600) return `${Math.floor(s / 60)} menit lalu`;
  if (s < 86400) return `${Math.floor(s / 3600)} jam lalu`;
  return `${Math.floor(s / 86400)} hari lalu`;
}
