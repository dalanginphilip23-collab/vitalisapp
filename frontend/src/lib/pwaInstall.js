// Global PWA install-prompt capture (imported from main.jsx so it attaches
// before React hydrates). One listener for the whole app — Landing and any
// other surface subscribe here instead of adding their own listeners, which
// avoids duplicate listeners and reliably catches `beforeinstallprompt`
// even when it fires before the page's components mount.

let deferredPrompt = null;
const subscribers = new Set();

const notify = (message) => {
  subscribers.forEach((handler) => {
    try {
      handler(message);
    } catch (err) {
      // One broken subscriber must not block the others.
      console?.warn?.("[pwaInstall] subscriber error", err);
    }
  });
};

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Needed so the page (not the mini-infobar) controls when to prompt.
    event.preventDefault();
    deferredPrompt = event;
    notify({ type: "prompt-available", event });
  });

  window.addEventListener("appinstalled", () => {
    // The prompt is single-use per page load; a successful install invalidates it.
    deferredPrompt = null;
    notify({ type: "installed" });
  });
}

/**
 * Detect the install surface so the UI can show the right steps and CTA.
 * iPhone/iPad get Home Screen instructions; Android and desktop get the
 * browser install prompt plus the manual fallback.
 * @returns {{ kind: "ios", inSafari: boolean } | { kind: "android" | "desktop" }}
 */
export const detectInstallPlatform = () => {
  if (typeof navigator === "undefined") return { kind: "desktop" };
  try {
    const ua = navigator.userAgent || "";
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) {
      const inSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
      return { kind: "ios", inSafari };
    }
    return { kind: /Android/.test(ua) ? "android" : "desktop" };
  } catch {
    return { kind: "desktop" };
  }
};

/** The captured minimum beforeinstallprompt event, or null. */
export const getInstallEvent = () => deferredPrompt;

/** Install successfully started elsewhere (e.g. another surface) — drop it. */
export const clearInstallEvent = () => {
  deferredPrompt = null;
};

/**
 * Subscribe to install lifecycle messages.
 * @param {(message: {type: "prompt-available", event: Event} | {type: "installed"}) => void} handler
 * @returns {() => void} unsubscribe
 */
export const subscribeToInstall = (handler) => {
  if (typeof handler !== "function") return () => {};
  subscribers.add(handler);
  return () => subscribers.delete(handler);
};
