# DESIGN.md - Noewbar CS Pro

Authoritative visual direction for every surface in this product. The anti-slop
rules are the filter applied on top of this file, never a substitute for it.

Rewritten alongside the full UI refactor. It now describes what actually ships:
a numeric ink ramp, three elevation levels, a typography scale, and one accent
reserved for states a probe confirmed.

## Dials

- **ENERGY: medium.** The landing page sells; the console operates. The sales
  surface is allowed one gradient wash and generous vertical rhythm. The console
  stays calm and dense. Both use the same tokens.
- **RHYTHM: layered, not uniform.** Three radii (4 / 8 / 12px + 16px for sheets),
  three elevation levels, and a spacing ladder of 4 / 8 / 12 / 16 / 24 / 32.
  Uniformity is not the goal; a legible hierarchy is.
- **MOTION: minimal and functional.** Motion is permitted in exactly three
  places: the anti-ghosting countdown, the live status dot, and transient
  feedback (palette open, skeleton shimmer). Every one of them respects
  `prefers-reduced-motion`. Nothing loops for decoration.

## Theme decision

**Light theme.** R-21 requires a written reason for a dark theme, and this
product has none: it is a storefront marketplace surface plus an operations
console used in daylight by shop owners on phones.

- Public landing: white with one neutral-to-green `ambient` wash behind the hero.
- Dashboard and console: white page, `ink-wash` chrome for sidebars and topbar,
  so data tables and the buyer proof gallery stay legible.

## Palette (2 core + 1 accent)

| Token | Value | Role |
| --- | --- | --- |
| `ink-900` / `ink-800` / `ink-700` | `#0B0B0C` / `#1A1B1E` / `#2C2D31` | Headings, primary text, solid primary buttons |
| `ink-600` / `ink-500` | `#4A4B50` / `#6B6C72` | Secondary text, labels, icon strokes |
| `ink-400` / `ink-300` | `#8E8F96` / `#B4B5BA` | Placeholder and disabled text (never meaningful copy) |
| `ink-200` / `ink-100` / `ink-50` | `#E4E4E7` / `#EFEFF1` / `#F6F6F7` | Hairlines, dividers, surface tint, page wash |
| `surface` | `#FFFFFF` | Cards, sheets, inputs |
| `signal` | `#12805C` | THE single accent. Live, connected, verified states only |
| `warn` | `#9A5B00` | Pending, grace period, estimate notice |
| `danger` | `#B3261E` | Kill-switch, reject, destructive actions |

The old shorthand keys (`ink`, `ink-soft`, `ink-mute`, `ink-line`, `ink-wash`)
remain as aliases inside the same `ink` color object, so pre-refactor classes
still compile while they are migrated out.

The accent is spent deliberately: a green value on screen always means "this
state was confirmed by a real probe". It is never decorative. Blue and purple
gradients are retired (R-01); the only gradient in the product is `ambient`, a
neutral-to-green wash used once behind the landing hero.

## Elevation (three levels)

| Level | Class | Use |
| --- | --- | --- |
| flat | `.card-flat` | Grouping inside an existing card, table rows |
| raised | `.card` | Default card surface |
| overlay | `.card-overlay` | Command palette, drawer, modal, dropdown |

Elevation is always paired with a 1px hairline border. A card is never
borderless and floating. `shadow-card` is retained as an alias of the raised
level for code written before the refactor.

## Typography

| Token | Use |
| --- | --- |
| `text-display` / `text-display-lg` | Landing hero only |
| `text-section` | Panel and section headings |
| `text-2xs` | Dense console metadata, table captions |

Body copy is `text-sm` in the console and `text-base` on the landing page. The
`text-2xs` step is the floor: anything smaller is unreadable on a phone. Numeric
data (prices, counts, latencies) uses tabular figures so columns stay aligned.

## Contrast

All body and secondary text meets WCAG AA on white. `ink-500` is the lightest
value permitted for meaningful text; `ink-400` and `ink-300` are placeholder and
disabled states only, and never carry information on their own.

## Component rules

- Radius: 8px default for cards and inputs, 4px for badges, 12px for panels,
  16px for sheets and the palette. No pill buttons anywhere, including CTAs.
- Border: 1px hairline in every card. No borderless floating cards.
- Shadow: only the three values above. No shadow invented inline.
- Touch targets: every interactive element is at least 44x44px on touch, 36px in
  dense desktop console rows (with negative margin so density is preserved).
- Icons: `lucide-react` at 16-18px, always alongside a text label unless the
  control is an icon-only toggle, which then needs `aria-label`.
- Focus: `:focus-visible` renders a 2px accent outline with a 2px offset on every
  interactive element. The outline is never removed without a replacement.

## Data-view contract (R-27)

Every view that reads live data renders three states: empty, loading, error. The
shared `EmptyState`, `LoadingState`, and `ErrorState` components are the only
permitted implementations; an unreachable dependency renders an explicit failure
message naming the dependency. A green status is only ever rendered from a probe
result, never from a hardcoded constant (R-38).

## Copy rules

- No em dash (U+2014) anywhere, including comments written into code.
- No "seamless", "leverage", "empower", "revolutionary", "game-changing".
- Numbers always pair with their unit and source: "Rp 199.000 / bulan",
  "latensi 812 ms (probe sekarang)".
- An unbuilt capability is either absent from the UI or visibly labelled
  "Segera hadir". A button always maps to a real behavior (R-26).
