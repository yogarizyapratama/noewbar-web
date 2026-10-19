import { waDaemon } from "@/lib/wa/daemon-client";
import { sendTelegramAlert } from "@/lib/alerts/telegram";

type HealthState = {
  consecutiveFailures: number;
  lastAlertSentAt: number | null;
  isCurrentlyDegraded: boolean;
};

const state: HealthState = {
  consecutiveFailures: 0,
  lastAlertSentAt: null,
  isCurrentlyDegraded: false,
};

/**
 * Probes the Whatsmeow daemon health and triggers emergency Telegram alerts
 * if the WhatsApp gateway goes offline for more than 3 consecutive checks (~3 mins).
 */
export async function monitorDaemonHeartbeat(): Promise<{
  status: "ok" | "degraded" | "recovered";
  failures: number;
}> {
  const res = await waDaemon.health();

  if (res.ok) {
    if (state.isCurrentlyDegraded) {
      // Send recovery notification
      state.isCurrentlyDegraded = false;
      state.consecutiveFailures = 0;
      await sendTelegramAlert(
        "✅ *RECOVERY: WhatsApp Gateway Pulih*\n\nWhatsmeow daemon di port 8088 telah kembali merespons dan aktif normal."
      );
      return { status: "recovered", failures: 0 };
    }
    state.consecutiveFailures = 0;
    return { status: "ok", failures: 0 };
  }

  // Gateway check failed
  state.consecutiveFailures++;

  // After 3 consecutive failed probes (approx 3 minutes), fire emergency Telegram alert
  if (state.consecutiveFailures >= 3 && !state.isCurrentlyDegraded) {
    state.isCurrentlyDegraded = true;
    state.lastAlertSentAt = Date.now();

    const alertMessage = [
      "🚨 *CRITICAL ALERT: WhatsApp Daemon Terputus!*",
      "",
      `Layanan Whatsmeow daemon di port 8088 tidak merespons selama ${state.consecutiveFailures} kali pengecekan berturut-turut.`,
      `*Error detail:* ${res.error}`,
      "",
      "⚠️ *Dampak:* Pesan masuk WhatsApp pembeli dan notifikasi toko tertunda.",
      "Tindakan yang disarankan: Periksa proses `./whatsmeow-daemon` di server.",
    ].join("\n");

    await sendTelegramAlert(alertMessage);
    return { status: "degraded", failures: state.consecutiveFailures };
  }

  return { status: state.isCurrentlyDegraded ? "degraded" : "ok", failures: state.consecutiveFailures };
}
