import type { Config } from "tailwindcss";

/**
 * Design tokens for Noewbar CS Pro. See DESIGN.md for the direction and the
 * reason behind each dial.
 *
 * Two surfaces share one token set:
 * - Public landing: editorial, large type, generous rhythm.
 * - Dashboard + operator console: dense, crisp, one accent for real state.
 *
 * The `ink.*` shorthand keys (soft/mute/line/wash) are kept as aliases of the
 * numeric scale so both old and new class names resolve to the same colors.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0F172A",
          50: "#F8FAFC",
          100: "#F1F5F9",
          200: "#E2E8F0",
          300: "#CBD5E1",
          400: "#94A3B8",
          500: "#64748B",
          600: "#475569",
          700: "#334155",
          800: "#1E293B",
          900: "#0F172A",
          // aliases: keep every existing class compiling
          soft: "#334155",
          mute: "#64748B",
          line: "#E2E8F0",
          wash: "#F8FAFC",
        },
        // Surfaces that are not pure white, so panels can layer without shadows.
        surface: {
          DEFAULT: "#FFFFFF",
          sunken: "#F8FAFC",
          raised: "#FFFFFF",
        },
        // THE accent. A green value on screen always means "confirmed by a real
        // probe": live, verified, connected. Never decorative.
        signal: {
          DEFAULT: "#10B981", // Fresh emerald for WhatsApp feel
          strong: "#059669",
          wash: "#ECFDF5",
        },
        warn: { DEFAULT: "#F59E0B", strong: "#D97706", wash: "#FFFBEB" },
        danger: { DEFAULT: "#EF4444", strong: "#DC2626", wash: "#FEF2F2" },
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        // Console scale: a touch tighter than stock so tables read as data.
        // 12px floor: anything smaller is unreadable on a phone (measured at 11px before).
        "2xs": ["0.75rem", { lineHeight: "1.0625rem" }],
        display: ["3rem", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
        "display-lg": ["4rem", { lineHeight: "1", letterSpacing: "-0.032em" }],
        section: ["1.875rem", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        md: "10px",
        lg: "14px",
        xl: "18px",
      },
      boxShadow: {
        // Three levels, each with exactly one job.
        flat: "0 1px 2px 0 rgba(15, 23, 42, 0.04)",
        raised: "0 4px 12px -2px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.04)",
        overlay:
          "0 20px 40px -8px rgba(15, 23, 42, 0.12), 0 10px 16px -6px rgba(15, 23, 42, 0.08)",
        // legacy alias
        card: "0 4px 12px -2px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.04)",
      },
      backgroundImage: {
        // Ambient warmth for hero surfaces only. No blue/purple gradients.
        ambient:
          "radial-gradient(100% 100% at 50% 0%, #F1F5F9 0%, #FFFFFF 100%)",
      },
      keyframes: {
        "dot-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
        "bubble-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "typing-dot": {
          "0%, 60%, 100%": { transform: "translateY(0)", opacity: "0.4" },
          "30%": { transform: "translateY(-3px)", opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "palette-in": {
          "0%": { opacity: "0", transform: "translateY(-6px) scale(0.985)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "dot-pulse": "dot-pulse 2s ease-in-out infinite",
        "bubble-in": "bubble-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        "typing-dot": "typing-dot 1.1s ease-in-out infinite",
        "fade-up": "fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        "palette-in": "palette-in 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
        shimmer: "shimmer 1.6s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
