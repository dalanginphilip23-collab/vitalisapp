import { useEffect, useRef, useState } from 'react';
import { apiGet } from '../../../../lib/apiClient.js';

// Module 4 — food catalog autocomplete for the manual meal form.
// Debounced GET /api/food-catalog?q=; picking a suggestion pre-fills name +
// macros, and when the row has a gram reference it also supplies a per-100 g
// density so the weight field can rescale the portion.
// Keyboard: ↑/↓ navigate, Enter picks, Esc closes. Clicking outside closes.
export default function CatalogNameField({
  label = 'Meal name',
  placeholder = 'e.g. Chicken adobo + rice',
  value,
  onChange,
  onPick,
  error,
  inputId = 'meal-name-input',
}) {
  const [results,   setResults]   = useState([]);
  const [open,      setOpen]      = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const boxRef = useRef(null);

  useEffect(() => {
    const q = String(value || '').trim();
    let dead = false;
    // setState only inside the async callback (never synchronously in the
    // effect body) — keeps clears and fetch results on the same path.
    const t = setTimeout(async () => {
      if (q.length < 2) {
        if (dead) return;
        setResults([]);
        setOpen(false);
        return;
      }
      try {
        const data = await apiGet(`/api/food-catalog?q=${encodeURIComponent(q)}&limit=8`);
        if (dead) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setResults(items);
        setOpen(items.length > 0);
        setHighlight(-1);
      } catch {
        if (!dead) {
          setResults([]);
          setOpen(false);
        }
      }
    }, 250);
    return () => {
      dead = true;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pick = (item) => {
    setOpen(false);
    onPick?.(item); // parent fills name + macros; value flows back via props
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => (h <= 0 ? results.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[highlight] || results[0]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showResults = open && results.length > 0;

  return (
    <div ref={boxRef} className="mt-catalog-field">
      <label htmlFor={inputId} className="mt-field-label">{label}</label>
      <input
        id={inputId}
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={showResults}
        aria-controls={`${inputId}-list`}
        aria-invalid={error ? 'true' : undefined}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        className={`mt-input mt-catalog-input ${error ? 'is-error' : ''}`}
      />
      {showResults && (
        <ul
          id={`${inputId}-list`}
          role="listbox"
          aria-label="Food catalog matches"
          className="mt-catalog-menu"
        >
          {results.map((it, i) => (
            <li key={it.name}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                onClick={() => pick(it)}
                onMouseEnter={() => setHighlight(i)}
                className={`mt-catalog-option ${i === highlight ? 'is-highlighted' : ''}`}
              >
                <span className="mt-catalog-option-copy">
                  <span className="mt-catalog-option-name">{it.name}</span>
                  <span className="mt-catalog-option-serving">
                    {it.serving_label || 'typical serving'}
                    {it.serving_grams ? ` · ${Number(it.serving_grams)} g` : ''}
                  </span>
                </span>
                <span className="mt-catalog-option-values">
                  <span className="mt-catalog-option-kcal">
                    {it.per100 ? `${it.per100.calories} kcal / 100 g` : `${it.calories} kcal`}
                  </span>
                  <span className="mt-catalog-option-macros">
                    {it.per100
                      ? `P${Number(it.per100.protein)} · C${Number(it.per100.carbs)} · F${Number(it.per100.fat)}`
                      : `P${Number(it.protein)} · C${Number(it.carbs)} · F${Number(it.fat)}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li className="mt-catalog-note">
            Per-100 g values — enter a weight to scale to your portion.
          </li>
        </ul>
      )}
      {error && <p className="mt-field-error">{error}</p>}
    </div>
  );
}
