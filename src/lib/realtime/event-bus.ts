/**
 * Realtime event bus for the web dashboards (SSE).
 *
 * In-memory pub/sub: every broadcast is fanned out to connected server-sent
 * event streams. Channels are tenant-scoped (`tenant:<id>`) plus a global
 * `admin` channel for the superadmin console. In a multi-instance deployment
 * this would be lifted onto Redis pub/sub; the bus interface stays the same.
 *
 * The bus never holds message history: a client that connects after an event
 * missed it, which is fine because every consumer reloads from the API on
 * connect and on each event (the event is a "something changed" signal).
 */

export type RealtimeEvent =
  | { type: "chat" }
  | { type: "order" }
  | { type: "proof" }
  | { type: "verified" }
  | { type: "billing" }
  | { type: "wa_status" }
  | { type: "killswitch" }
  | { type: "fleet" }
  | { type: "alert" }
  | { type: "reload" };

type Listener = (event: RealtimeEvent) => void;

class EventBus {
  private channels = new Map<string, Set<Listener>>();

  /** Subscribe to a channel; returns an unsubscribe function. */
  subscribe(channel: string, listener: Listener): () => void {
    let set = this.channels.get(channel);
    if (!set) {
      set = new Set();
      this.channels.set(channel, set);
    }
    set.add(listener);
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.channels.delete(channel);
    };
  }

  /** Fan an event out to every listener on a channel (no await, fire-and-forget). */
  publish(channel: string, event: RealtimeEvent): void {
    const set = this.channels.get(channel);
    if (!set || set.size === 0) return;
    for (const listener of set) {
      try {
        listener(event);
      } catch {
        // A dying listener must not crash the publisher.
      }
    }
  }

  channelCount(): number {
    return this.channels.size;
  }
}

export const eventBus = new EventBus();

export const tenantChannel = (tenantId: string) => `tenant:${tenantId}`;
export const adminChannel = "admin";

/** Notify the tenant's dashboard (and superadmin when relevant). */
export function notifyTenant(
  tenantId: string,
  event: Omit<RealtimeEvent, "type"> & { type: RealtimeEvent["type"] }
): void {
  eventBus.publish(tenantChannel(tenantId), event);
  // Operational events are useful in the master console too.
  if (event.type === "alert" || event.type === "wa_status") {
    eventBus.publish(adminChannel, event);
  }
}

export function notifyAdmin(event: RealtimeEvent): void {
  eventBus.publish(adminChannel, event);
}