import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiFetch } from '../../../../lib/apiClient.js';
import { qk } from '../../../../lib/queries.js';
import { useToastStore } from '../../../../stores/toastStore.js';

async function compressImageToBase64(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // 1024px@0.85 keeps portion cues the estimator needs; 512px blurred them.
      const MAX_WIDTH = 1024;
      const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.onerror = () => reject(new Error("Image compression failed"));
    img.src = dataUrl;
  });
}

// dataURL → Blob so the backend receives a real multipart file (multer+sharp
// store a compressed JPEG and return a short /uploads URL instead of an 8MB
// dataURL fighting a 2000-char DB column).
function dataUrlToBlob(dataUrl) {
  const [meta = "data:image/jpeg", b64 = ""] = String(dataUrl).split(",");
  const mime = (meta.match(/data:([^;]+)/) || [null, "image/jpeg"])[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// AI scans can legitimately run ~2min (model failover + retries) — the old 60s
// abort fired while the backend was still working and looked like "AI broken".
const ANALYZE_TIMEOUT_MS = 150000;

async function apiAnalyzeFoodImage(dataUrl) {
  // Server compresses again anyway (≤1600px); client downscale just trims the
  // upload on slow connections.
  const base64 = await compressImageToBase64(dataUrl);
  const form = new FormData();
  form.append("image", dataUrlToBlob(`data:image/jpeg;base64,${base64}`), "meal.jpg");
  return apiFetch(`/api/food-logs/analyze-pic`, {
    method: "POST",
    body: form,
    timeoutMs: ANALYZE_TIMEOUT_MS,
  });
}

async function apiSaveFoodLog(userId, meal, imageBlob) {
  // With a photo (scan flow, first item): multipart. Without: plain JSON.
  if (imageBlob) {
    const form = new FormData();
    form.append("image", imageBlob, "meal.jpg");
    for (const [k, v] of Object.entries({
      food_name: meal.food_name,
      serving: meal.serving || "",
      meal_type: meal.meal_type || "",
      calories: meal.calories ?? 0,
      protein: meal.protein ?? 0,
      carbs: meal.carbs ?? 0,
      fat: meal.fat ?? 0,
      saturated_fat: meal.saturated_fat ?? 0,
      trans_fat: meal.trans_fat ?? 0,
      polyunsaturated_fat: meal.polyunsaturated_fat ?? 0,
      monounsaturated_fat: meal.monounsaturated_fat ?? 0,
    })) {
      form.append(k, String(v ?? ""));
    }
    return apiFetch(`/api/food-logs/${userId}`, { method: "POST", body: form });
  }
  return apiFetch(`/api/food-logs/${userId}`, {
    method: "POST",
    body: JSON.stringify({
      food_name: meal.food_name,
      serving:   meal.serving   || null,
      // Weight-based manual entry: the portion the user weighed.
      grams:     meal.grams     ?? null,
      // Module 4 — persisted meal slot (Breakfast/Lunch/Dinner/Snack/Other).
      meal_type: meal.meal_type || null,
      calories:  meal.calories  || 0,
      protein:   meal.protein   || 0,
      carbs:     meal.carbs     || 0,
      fat:       meal.fat       || 0,
      saturated_fat: meal.saturated_fat || 0,
      trans_fat: meal.trans_fat || 0,
      polyunsaturated_fat: meal.polyunsaturated_fat || 0,
      monounsaturated_fat: meal.monounsaturated_fat || 0,
      image_url: meal.image_url || null,
    }),
  });
}

async function apiFetchFoodLogs(userId) {
  return apiFetch(`/api/food-logs/${userId}`);
}

async function apiDeleteFoodLog(userId, mealId) {
  return apiFetch(`/api/food-logs/${userId}/${mealId}`, { method: 'DELETE' });
}

// Date.now alone collides on fast double-analyze.
function uniqueKey(prefix) {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${crypto.randomUUID()}-${prefix}`;
  } catch { /* fall through */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${prefix}`;
}

// Normalize analyze-pic payloads to the checklist shape ScanResult consumes.
function toScanResult(data) {
  if (!data) return null;
  if (Array.isArray(data.items)) {
    return {
      items: data.items.filter(Boolean).map((it, i) => ({
        key: uniqueKey(i),
        food_name: String(it.food_name || 'Unknown food'),
        serving: String(it.serving || ''),
        calories: Math.max(0, Math.round(Number(it.calories) || 0)),
        protein: Math.max(0, Math.round(Number(it.protein) || 0)),
        carbs: Math.max(0, Math.round(Number(it.carbs) || 0)),
        fat: Math.max(0, Math.round(Number(it.fat) || 0)),
        saturated_fat: Math.max(0, Number(it.saturated_fat) || 0),
        trans_fat: Math.max(0, Number(it.trans_fat) || 0),
        polyunsaturated_fat: Math.max(0, Number(it.polyunsaturated_fat) || 0),
        monounsaturated_fat: Math.max(0, Number(it.monounsaturated_fat) || 0),
        low_confidence: Boolean(it.low_confidence),
        // Allergen flag from analyze-pic: matches against your onboarding list
        allergy_matches: Array.isArray(it.allergy_matches)
          ? it.allergy_matches.filter((x) => typeof x === 'string' && x)
          : [],
        selected: true,
        corrected: false,
        custom: false,
      })),
      suggestion: typeof data.suggestion === 'string' ? data.suggestion : '',
      // Lets the UI show "busy, retry" instead of a silent 0-kcal food.
      retryable: Boolean(data.retryable),
      imageUrl: typeof data.image_url === 'string' ? data.image_url : null,
    };
  }
  // Legacy single-object shape → one-item list.
  if (data.food_name) {
    return toScanResult({ items: [data], suggestion: data.suggestion });
  }
  return null;
}

export function useNutritionTracker(USER_ID) {
  const [result,          setResult]          = useState(null);
  const [isAnalyzing,     setIsAnalyzing]     = useState(false);
  const [isLogging,       setIsLogging]       = useState(false);
  const [history,         setHistory]         = useState([]);
  const [historyLoading,  setHistoryLoading]  = useState(false);
  const [historyError,    setHistoryError]    = useState(null);
  const [toast,           setToast]           = useState(null);
  const [summarySeed,     setSummarySeed]     = useState(0);
  const [lastLoggedMeal,  setLastLoggedMeal]  = useState(null);
  const qc = useQueryClient();

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
    // eslint-disable-next-line no-misleading-character-class -- emoji strip regex is intentional
    try { useToastStore.getState().addToast(String(msg).replace(/^[✓❌🗑️]\s*/u, ''), String(msg).startsWith('❌') ? 'error' : 'success'); } catch { /* noop */ }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!USER_ID) return;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const data = await apiFetchFoodLogs(USER_ID);
      qc.setQueryData(qk.foodLogs(USER_ID), data);
      if (data.records) setHistory(data.records);
      else if (Array.isArray(data)) setHistory(data);
    } catch (err) {
      setHistoryError(err);
      if (import.meta.env.DEV) console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, [USER_ID, qc]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleAnalyze = async (dataUrl) => {
    setIsAnalyzing(true);
    setResult(null);
    try {
      const data = await apiAnalyzeFoodImage(dataUrl);
      const scan = toScanResult(data);
      if (!scan || scan.items.length === 0) throw new Error('Could not detect food in this photo.');
      // All-failures fallback: the backend answers 200 with one "Unknown food"
      // @ 0kcal. Rendering that silently looks like a broken AI — surface it.
      const emptyFallback =
        scan.items.length === 1 &&
        scan.items[0].food_name === 'Unknown food' &&
        Number(scan.items[0].calories) === 0;
      if (emptyFallback) {
        throw new Error(scan.suggestion || "Couldn't identify any food in this photo. Try a clearer, brighter shot.");
      }
      setResult(scan);
    } catch (err) {
      showToast("❌ " + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const clearResult = useCallback(() => setResult(null), []);

  const toggleItem = useCallback((key) => {
    setResult(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.map(it => it.key === key ? { ...it, selected: !it.selected } : it) };
    });
  }, []);

  // Photo can't know portion size: scale selected items, re-derive kcal (P*4+C*4+F*9).
  const scaleSelected = useCallback((factor) => {
    const f = Number(factor);
    if (!f || f <= 0 || f > 10) return;
    const scaleMacro = (v) => Math.max(0, Math.round((Number(v) || 0) * f));
    const scaleGram = (v) => Math.max(0, Number(((Number(v) || 0) * f).toFixed(1)));
    setResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(it => {
          if (!it.selected) return it;
          const protein = scaleMacro(it.protein);
          const carbs = scaleMacro(it.carbs);
          const fat = scaleMacro(it.fat);
          return {
            ...it,
            protein, carbs, fat,
            saturated_fat: scaleGram(it.saturated_fat),
            trans_fat: scaleGram(it.trans_fat),
            polyunsaturated_fat: scaleGram(it.polyunsaturated_fat),
            monounsaturated_fat: scaleGram(it.monounsaturated_fat),
            calories: protein * 4 + carbs * 4 + fat * 9,
            scaled: true,
            // Portion scaling is also a user correction — counts, not AI.
            corrected: true,
          };
        }),
      };
    });
  }, []);

  // Module 4 — tap-to-correct: user replaces the AI estimate values on one
  // item. Scaled truth: if macros change, kcal is re-derived (P*4+C*4+F*9)
  // unless the kcal itself was edited, in which case it wins.
  const editItem = useCallback((key, patch) => {
    const clampG = (v) => Math.max(0, Math.round(Number(v) || 0));
    setResult(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(it => {
          if (it.key !== key) return it;
          const next = { ...it, ...patch, key };
          const protein = clampG(next.protein);
          const carbs = clampG(next.carbs);
          const fat = clampG(next.fat);
          const kcalGiven = patch.calories !== undefined;
          next.calories = kcalGiven ? clampG(next.calories) : protein * 4 + carbs * 4 + fat * 9;
          next.protein = protein; next.carbs = carbs; next.fat = fat;
          next.corrected = true;
          return next;
        }),
      };
    });
  }, []);

  const addCustomItem = useCallback(({ food_name, calories, serving }) => {
    const name = String(food_name || '').trim();
    if (!name) return false;
    setResult(prev => {
      const item = {
        key: uniqueKey('custom'),
        food_name: name.slice(0, 150),
        serving: String(serving || '').slice(0, 100),
        calories: Math.max(0, Math.round(Number(calories) || 0)),
        protein: 0, carbs: 0, fat: 0,
        saturated_fat: 0, trans_fat: 0,
        polyunsaturated_fat: 0, monounsaturated_fat: 0,
        selected: true,
        corrected: true, // user-entered, not an AI estimate
        custom: true,
      };
      if (!prev) return { items: [item], suggestion: '' };
      return { ...prev, items: [...prev.items, item] };
    });
    return true;
  }, []);

  // Each checked item saves as its own food-log. mealType (Module 4) is the
  // slot chosen on the scan result sheet — stored per log, not jammed into
  // `serving` like the legacy flow did.
  // The scan photo rides along as a multipart file on the first item; the
  // backend compresses it with sharp and stores a /uploads URL — this used to
  // send a raw 8MB dataURL that failed the 2000-char `image_url` check.
  const handleLogSelected = async (previewUrl, mealType) => {
    const selected = (result?.items || []).filter(it => it.selected);
    if (selected.length === 0) {
      showToast('❌ Tick at least one item to log.');
      return;
    }
    setIsLogging(true);
    let saved = 0;
    let lastErr = null;
    let photoBlob = null;
    try {
      try { photoBlob = previewUrl ? dataUrlToBlob(previewUrl) : null; } catch { photoBlob = null; }
      for (let i = 0; i < selected.length; i++) {
        const it = selected[i];
        // Prefer the short /uploads URL the scan response already stored; the
        // multipart file is for scans whose analyze response lacked one.
        const imageUrl = i === 0 ? (result?.imageUrl || null) : null;
        const payload = { ...it, meal_type: mealType || null, image_url: imageUrl };
        try {
          await apiSaveFoodLog(USER_ID, payload, i === 0 && !imageUrl ? photoBlob : null);
          saved += 1;
        } catch (e) {
          lastErr = e; // keep going so one failure doesn't lose the rest
        }
      }
      if (saved === 0) throw lastErr || new Error('Failed to save. Try again.');
      const sum = (k) => selected.slice(0, saved).reduce((a, it) => a + (Number(it[k]) || 0), 0);
      const names = selected.slice(0, saved).map(it => it.food_name).join(' + ');
      showToast(saved < selected.length ? `✓ ${saved}/${selected.length} saved (${(lastErr?.message || 'one failed')}). Retry the rest.` : `✓ ${selected.length} item${selected.length > 1 ? 's' : ''} saved!`);
      setResult(null);
      setLastLoggedMeal({
        food_name: names,
        serving: `${selected.length} items`,
        calories: Math.round(sum('calories')),
        protein: Math.round(sum('protein')),
        carbs: Math.round(sum('carbs')),
        fat: Math.round(sum('fat')),
        _ts: Date.now(),
      });
      qc.invalidateQueries({ queryKey: qk.todayMeals(USER_ID) });
      qc.invalidateQueries({ queryKey: qk.dashboard(USER_ID) });
      await loadHistory();
      setSummarySeed((s) => s + 1);
    } catch (err) {
      showToast("❌ " + err.message);
    } finally {
      setIsLogging(false);
    }
  };

  // Returns true only when the log actually saved, so the manual form can keep
  // the user's typed portion on screen after a failure instead of discarding it.
  const handleLog = async (meal) => {
    setIsLogging(true);
    try {
      await apiSaveFoodLog(USER_ID, meal);
      showToast(`✓ ${meal.food_name} saved!`);
      setResult(null);
      setLastLoggedMeal({ ...meal, _ts: Date.now() });
      qc.invalidateQueries({ queryKey: qk.todayMeals(USER_ID) });
      qc.invalidateQueries({ queryKey: qk.dashboard(USER_ID) });
      await loadHistory();
      setSummarySeed((s) => s + 1);
      return true;
    } catch (err) {
      showToast("❌ " + err.message);
      return false;
    } finally {
      setIsLogging(false);
    }
  };

  const handleDeleteMeal = async (mealId) => {
    try {
      await apiDeleteFoodLog(USER_ID, mealId);
      setHistory((prev) => prev.filter((m) => m.id !== mealId));
      setSummarySeed((s) => s + 1);
      showToast("🗑️ Meal deleted");
    } catch (err) {
      showToast("❌ " + err.message);
    }
  };

  return {
    result, isAnalyzing, isLogging,
    history, historyLoading, historyError, loadHistory,
    toast, summarySeed,
    lastLoggedMeal,
    handleAnalyze, handleLog, handleLogSelected, toggleItem, scaleSelected, editItem, addCustomItem, clearResult, handleDeleteMeal, setToast,
  };
}