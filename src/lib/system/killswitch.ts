/**
 * Global bot kill-switch (chapter 11.4).
 *
 * In-process flag so the effect is immediate (< 100 ms) rather than requiring a
 * database round-trip on the hot path. In a multi-instance deployment this would be
 * backed by Redis pub/sub; the single-VPS topology of chapter 3 makes the process
 * flag the correct scope, and the superadmin console reports which scope is active.
 */

type GlobalWithSwitch = typeof globalThis & {
  __noewbarBotDisabled?: boolean;
  __noewbarBotDisabledAt?: number;
  __noewbarBotDisabledBy?: string;
};

const g = globalThis as GlobalWithSwitch;

export type KillSwitchState = {
  disabled: boolean;
  disabledAt: string | null;
  disabledBy: string | null;
};

export function isBotDisabled(): boolean {
  return g.__noewbarBotDisabled === true;
}

export function getKillSwitch(): KillSwitchState {
  return {
    disabled: g.__noewbarBotDisabled === true,
    disabledAt: g.__noewbarBotDisabledAt ? new Date(g.__noewbarBotDisabledAt).toISOString() : null,
    disabledBy: g.__noewbarBotDisabledBy ?? null,
  };
}

export function setKillSwitch(disabled: boolean, by: string): KillSwitchState {
  g.__noewbarBotDisabled = disabled;
  g.__noewbarBotDisabledAt = disabled ? Date.now() : undefined;
  g.__noewbarBotDisabledBy = disabled ? by : undefined;
  return getKillSwitch();
}

/**
 * Anti-abuse trap (chapter 11.4): a store firing more than 120 messages within
 * 3 minutes is treated as a spam-blast and frozen. The counter is per instance.
 */
type SendWindow = { count: number; windowStart: number };
type GlobalWithAbuse = typeof globalThis & { __noewbarSendWindows?: Map<string, SendWindow> };

const gAbuse = globalThis as GlobalWithAbuse;
const ABUSE_LIMIT = 120;
const ABUSE_WINDOW_MS = 3 * 60 * 1000;

function windows(): Map<string, SendWindow> {
  if (!gAbuse.__noewbarSendWindows) gAbuse.__noewbarSendWindows = new Map();
  return gAbuse.__noewbarSendWindows;
}

export function recordBotSend(key: string): { exceeded: boolean; count: number; limit: number } {
  const map = windows();
  const now = Date.now();
  const entry = map.get(key);

  if (!entry || now - entry.windowStart > ABUSE_WINDOW_MS) {
    map.set(key, { count: 1, windowStart: now });
    return { exceeded: false, count: 1, limit: ABUSE_LIMIT };
  }

  entry.count += 1;
  return { exceeded: entry.count > ABUSE_LIMIT, count: entry.count, limit: ABUSE_LIMIT };
}

export function resetAbuseWindows(): void {
  windows().clear();
}
