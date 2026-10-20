/**
 * Midtrans Snap Popup Client Integration.
 * Renders the checkout payment window as an in-page modal dialog
 * rather than opening a new browser tab.
 */

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onSuccess?: (result: unknown) => void;
          onPending?: (result: unknown) => void;
          onError?: (result: unknown) => void;
          onClose?: () => void;
        }
      ) => void;
      embed?: (token: string, options?: unknown) => void;
    };
  }
}

/**
 * Dynamically loads the Midtrans Snap SDK script if not yet loaded.
 */
export function loadSnapScript(clientKey: string, isProduction = false): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") return resolve();
    if (window.snap?.pay) return resolve();

    const scriptId = "midtrans-snap-script";
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      if (window.snap?.pay) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Gagal memuat Midtrans Snap SDK")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    script.setAttribute("data-client-key", clientKey);
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat script Midtrans Snap SDK"));
    document.head.appendChild(script);
  });
}

export type SnapPayOptions = {
  snapToken: string;
  clientKey: string;
  isProduction?: boolean;
  redirectUrl?: string;
  onSuccess?: (result: unknown) => void;
  onPending?: (result: unknown) => void;
  onError?: (result: unknown) => void;
  onClose?: () => void;
};

/**
 * Triggers the Snap modal popup in-page.
 * Returns true if the modal opened, or falls back to redirect URL if blocked.
 */
export async function triggerSnapPopup(opts: SnapPayOptions): Promise<boolean> {
  try {
    await loadSnapScript(opts.clientKey, opts.isProduction ?? false);
    if (typeof window !== "undefined" && window.snap?.pay) {
      window.snap.pay(opts.snapToken, {
        onSuccess: (result) => opts.onSuccess?.(result),
        onPending: (result) => opts.onPending?.(result),
        onError: (result) => opts.onError?.(result),
        onClose: () => opts.onClose?.(),
      });
      return true;
    }
  } catch (err) {
    console.warn("Snap SDK popup failed to load, falling back to redirect:", err);
  }

  // Graceful fallback if Snap SDK is blocked (e.g. adblocker)
  if (opts.redirectUrl && typeof window !== "undefined") {
    window.location.href = opts.redirectUrl;
    return true;
  }

  return false;
}
