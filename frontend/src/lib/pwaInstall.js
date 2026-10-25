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
