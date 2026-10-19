import { env } from "@/lib/env";

/**
 * Client for the self-hosted Whatsmeow daemon (Go microservice, chapter 5).
 * The daemon owns the WhatsApp Web socket; this client only issues HTTP commands.
 * Every call is guarded by the shared internal secret.
 */

export type InstanceStatus = "CONNECTED" | "PAIRING" | "OFFLINE";

export type DaemonResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type QrState = {
  instance_key: string;
  status: InstanceStatus;
  qr_base64: string;
  phone_number: string;
};

export type SendResult = {
  success: boolean;
  message_id: string;
  timestamp: string;
};

const BASE = env.WHATSMEOW_URL.replace(/\/$/, "");
const SECRET = env.WHATSMEOW_SECRET;

async function call<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 10000
): Promise<DaemonResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Noewbar-Secret": SECRET,
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });

    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const detail =
        parsed && typeof parsed === "object" && "error" in parsed
          ? String((parsed as { error: unknown }).error)
          : text || `HTTP ${res.status}`;
      return { ok: false, error: detail };
    }

    return { ok: true, data: parsed as T };
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? "Whatsmeow daemon timed out"
        : `Whatsmeow daemon unreachable: ${err instanceof Error ? err.message : "unknown"}`;
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export const waDaemon = {
  baseUrl: BASE,

  async health(): Promise<DaemonResult<{ status: string; active_instances: number; time: string }>> {
    return call("/health", { method: "GET" }, 4000);
  },

  async initInstance(instanceKey: string, webhookUrl: string): Promise<DaemonResult<QrState>> {
    return call("/instances/init", {
      method: "POST",
      body: JSON.stringify({ instance_key: instanceKey, webhook_url: webhookUrl }),
    });
  },

  async getQr(instanceKey: string): Promise<DaemonResult<QrState>> {
    return call(`/instances/qr?key=${encodeURIComponent(instanceKey)}`, { method: "GET" });
  },

  async pairPhone(params: {
    instanceKey: string;
    phone: string;
  }): Promise<DaemonResult<{ success: boolean; pairing_code: string; phone: string }>> {
    return call(
      "/instances/pair-phone",
      {
        method: "POST",
        body: JSON.stringify({
          instance_key: params.instanceKey,
          phone: params.phone,
        }),
      },
      25000
    );
  },

  async getStatus(
    instanceKey: string
  ): Promise<DaemonResult<{ instance_key: string; connection_status: InstanceStatus; phone_number: string }>> {
    return call(`/instances/status?key=${encodeURIComponent(instanceKey)}`, { method: "GET" }, 5000);
  },

  async sendText(params: {
    instanceKey: string;
    to: string;
    message: string;
    simulateTyping?: boolean;
  }): Promise<DaemonResult<SendResult>> {
    return call(
      "/instances/send",
      {
        method: "POST",
        body: JSON.stringify({
          instance_key: params.instanceKey,
          to: params.to,
          message: params.message,
          simulate_typing: params.simulateTyping ?? true,
        }),
      },
      30000 // typing simulation holds the request ~1.8s plus network
    );
  },

  async sendMedia(params: {
    instanceKey: string;
    to: string;
    url: string;
    caption?: string;
    kind?: "image" | "video" | "document";
    simulateTyping?: boolean;
  }): Promise<DaemonResult<SendResult>> {
    return call("/instances/send-media", {
      method: "POST",
      body: JSON.stringify({
        instance_key: params.instanceKey,
        to: params.to,
        url: params.url,
        caption: params.caption ?? "",
        kind: params.kind ?? "image",
        simulate_typing: params.simulateTyping ?? true,
      }),
    });
  },

  async logout(instanceKey: string): Promise<DaemonResult<{ success: boolean }>> {
    return call(`/instances/logout?key=${encodeURIComponent(instanceKey)}`, { method: "GET" });
  },
};

/**
 * Fetch a raw file (e.g. transient inbound media) from the daemon with the
 * shared secret. Returns an ArrayBuffer-compatible Uint8Array, or null when the
 * daemon is unreachable / the file is gone. Used by the media ingest pipeline.
 */
export async function safeFetchWithSecret(path: string, secret: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(path, {
      headers: { "X-Noewbar-Secret": secret },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}
