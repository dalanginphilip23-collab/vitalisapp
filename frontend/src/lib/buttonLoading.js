// Opt-in click flash for plain <button type="submit"> / .btn-flash only.
// <Button/> owns its own spinner (see data-managed-loading); nav, chips,
// toggles never flash — a fake spinner there looked like a bug.

let installed = false;

export function installGlobalButtonLoading() {
  if (installed || typeof document === 'undefined') return;
  installed = true;

  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  document.addEventListener(
    'click',
    (e) => {
      const btn = /** @type {any} */ (e.target)?.closest?.('button');
      if (!btn || btn.disabled) return;
      if (btn.closest?.('[data-no-flash]')) return;
      if (btn.hasAttribute?.('data-managed-loading')) return;
      if (!btn.matches?.('button[type="submit"], .btn-flash')) return;

      btn.classList.add('btn-click-flash');
      window.setTimeout(() => {
        btn.classList.remove('btn-click-flash');
      }, 600);
    },
    { capture: true, passive: true },
  );
}

export default installGlobalButtonLoading;
