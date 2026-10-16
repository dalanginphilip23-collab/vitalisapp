import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Sidebar, Topbar, BottomNav } from "../../../components/index.js";
import Icon from "../../../components/Icon.jsx";
import MacroCoachCard from "../components/MacroCoachCard.jsx";
import ScanResult from "../components/ScanResult.jsx";
import CameraScanner from "../components/CameraScanner.jsx";
import Button from "../../../components/ui/Button.jsx";
import Spinner from "../../../components/ui/Spinner.jsx";
import { useAuth } from "../../../hooks/useAuth.jsx";
import { useNutritionTracker } from "../hooks/useNutritionTracker.js";
import { apiGet } from "../../../lib/apiClient.js";
import EmptyState from "../../../components/feedback/EmptyState.jsx";
import ErrorState from "../../../components/feedback/ErrorState.jsx";
import LoadingState from "../../../components/feedback/LoadingState.jsx";
import { toLocalKey } from "../utils/dateKey.js";
import { SectionLabel, InputField } from "../components/fields.jsx";
import CalendarPopup from "../components/CalendarPopup.jsx";
import { MacroRing, TodayButton, WeekStrip } from "../components/MealWidgets.jsx";

const FALLBACK_CALORIE_GOAL = 2000;
const FALLBACK_MACRO_TARGETS = { protein: 120, carbs: 200, fat: 60 };
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];
const EMPTY_FORM = { name: "", calories: "", protein: "", carbs: "", fat: "", mealType: "Breakfast", image_url: "" };

const MEAL_ICONS = { Breakfast: "bakery_dining", Lunch: "lunch_dining", Dinner: "dinner_dining", Snack: "cookie" };

// Log actions: Scan Meal (camera) + Add Manually rows. When a photo is
// picked, a slim preview row replaces the buttons until cleared.
function ScannerCard({ preview, isAnalyzing, onCamera, onManual, onClear }) {
  if (preview || isAnalyzing) {
    return (
      <div className="glass-card rounded-[24px] border border-[var(--border-light)] p-3 flex items-center gap-3">
        {preview ? (
          <img src={preview} alt="Meal to analyze" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
        ) : (
          <span className="w-14 h-14 rounded-2xl bg-[var(--bg-hover)] flex items-center justify-center shrink-0">
            <Icon name="image" className="text-[22px] text-[var(--text-muted)]" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[var(--text-primary)]">
            {isAnalyzing ? "Analyzing…" : "Photo ready"}
          </p>
          <p className="text-[11px] text-[var(--text-muted)] truncate">
            {isAnalyzing ? "Detecting foods in your photo" : "Results appear in the panel below"}
          </p>
        </div>
        {isAnalyzing && <Spinner className="w-5 h-5 shrink-0" />}
        <button onClick={onClear} aria-label="Clear photo" className="w-11 h-11 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
          <Icon name="close" className="text-[18px]" />
        </button>
      </div>
    );
  }
  const actions = [
    { label: "Scan Meal", sub: "Use your camera to log food", icon: "photo_camera", primary: true, onPress: onCamera },
    { label: "Add Manually", sub: "Search or enter food", icon: "add", primary: false, onPress: onManual },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={a.onPress}
          className={`flex items-center gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.99] ${
            a.primary
              ? "bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] shadow-md hover:bg-[var(--accent-hover)]"
              : "glass-card border border-[var(--border-light)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          }`}
        >
          <span className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${a.primary ? "bg-black/15" : "bg-[var(--accent-bg)]"}`}>
            <Icon name={a.icon} className={`text-[22px] ${a.primary ? "" : "text-[var(--accent)]"}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold leading-tight">{a.label}</span>
            <span className={`block text-[12px] leading-tight mt-0.5 ${a.primary ? "text-[var(--text-inverse)]/70" : "text-[var(--text-muted)]"}`}>{a.sub}</span>
          </span>
          <Icon name="chevron_right" className={`text-[20px] shrink-0 ${a.primary ? "text-[var(--text-inverse)]/70" : "text-[var(--text-muted)]"}`} />
        </button>
      ))}
    </div>
  );
}

// Single "Daily Goals" card — big calorie total + ring + remaining, then
// the three macros with rings, grams, and bars. All values real.
const MACRO_META = [
  { key: "protein", label: "Protein", icon: "restaurant", color: "var(--accent)" },
  { key: "carbs", label: "Carbs", icon: "bakery_dining", color: "#5BA4E6" },
  { key: "fat", label: "Fat", icon: "water_drop", color: "#9B7EDE" },
];
function DailyGoalsCard({ calories, goal, protein, proteinGoal, carbs, carbsGoal, fat, fatGoal }) {
  const kcalPct = goal > 0 ? Math.min(100, Math.round((calories / goal) * 100)) : 0;
  const remaining = Math.max(0, Math.round(goal - calories));
  const byKey = { protein: { actual: protein, target: proteinGoal }, carbs: { actual: carbs, target: carbsGoal }, fat: { actual: fat, target: fatGoal } };
  const minis = MACRO_META.map((m) => {
    const actual = byKey[m.key].actual;
    const target = byKey[m.key].target;
    return { ...m, actual, target, pct: target > 0 ? Math.min(100, Math.round((actual / target) * 100)) : 0 };
  });
  return (
    <div className="space-y-4">
      <div className="glass-card rounded-2xl border border-[var(--border-light)] p-5">
        <div className="flex flex-col min-[380px]:flex-row items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[var(--text-muted)] font-semibold">Daily Calories</p>
            <p className="text-4xl font-black text-[var(--text-primary)] leading-none mt-1 tabular-nums">
              {Math.round(calories).toLocaleString()}
              <span className="text-[13px] font-semibold text-[var(--text-muted)]"> / {goal.toLocaleString()} kcal</span>
            </p>
            <div className="h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden mt-3">
              <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500" style={{ width: `${kcalPct}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] font-bold text-[var(--accent)] tabular-nums">{kcalPct}%</span>
              <span className="text-[11px] text-[var(--text-muted)]">
                Remaining <span className="font-bold text-[var(--text-primary)] tabular-nums">{remaining.toLocaleString()} kcal</span>
              </span>
            </div>
          </div>
          <div className="shrink-0">
            <MacroRing size={104} stroke={12} pct={kcalPct} color="var(--accent)" track="var(--bg-hover)">
              <Icon name="restaurant" className="text-[28px] text-[var(--accent)]" />
            </MacroRing>
          </div>
        </div>
      </div>
      <div className="glass-card rounded-2xl border border-[var(--border-light)] p-5">
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-[0.14em] mb-4">Macronutrients</p>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
          {minis.map((m) => (
            <div key={m.label} className="flex flex-col items-center min-w-0">
              <MacroRing size={72} stroke={8} pct={m.pct} color={m.color} track="var(--bg-hover)">
                <span className="text-[12px] font-black text-[var(--text-primary)] tabular-nums">{m.pct}%</span>
              </MacroRing>
              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--text-secondary)]">
                <Icon name={m.icon} className="text-[14px] text-[var(--text-muted)]" />
                {m.label}
              </span>
              <span className="text-[12px] font-black text-[var(--text-primary)] tabular-nums mt-0.5">
                {Math.round(m.actual)} <span className="font-semibold text-[var(--text-muted)]">/ {m.target} g</span>
              </span>
              <span className="w-full h-1 rounded-full bg-[var(--bg-hover)] overflow-hidden mt-2">
                <span className="block h-full rounded-full transition-all duration-500" style={{ width: `${m.pct}%`, background: m.color }} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MealTracker() {  const { user } = useAuth();
  const userId = user?.id;
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const { result, isAnalyzing, isLogging, history, historyLoading, historyError, loadHistory, toast, lastLoggedMeal, handleAnalyze, handleLog, handleLogSelected, toggleItem, scaleSelected, addCustomItem, clearResult, handleDeleteMeal } = useNutritionTracker(userId);
  const [preview, setPreview] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [manualForm, setManualForm] = useState(EMPTY_FORM);
  const [manualError, setManualError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => toLocalKey(new Date()));
  const fileRef = useRef(null);
  const [showScanner, setShowScanner] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep links from Quick Log: ?scan=1 opens the camera, ?manual=1 expands
  // the manual form. Consumed once so back-nav doesn't retrigger.
  useEffect(() => {
    if (searchParams.get("scan") === "1") {
      setShowScanner(true);
      searchParams.delete("scan");
      setSearchParams(searchParams, { replace: true });
    } else if (searchParams.get("manual") === "1") {
      setShowManual(true);
      searchParams.delete("manual");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Real goals: nutrient-goals API + active goal dailyKcal (fall back to constants offline).
  const [calorieGoal, setCalorieGoal] = useState(FALLBACK_CALORIE_GOAL);
  const [macroTargets, setMacroTargets] = useState(FALLBACK_MACRO_TARGETS);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([
      apiGet(`/api/nutrient-goals/${userId}`).catch(() => null),
      apiGet(`/api/goals/active/${userId}`).catch(() => null),
    ]).then(([ng, ag]) => {
      if (cancelled) return;
      const goals = ng?.goals || [];
      const find = (k) => { const g = goals.find((x) => x.nutrient === k); return g?.target_value != null ? Number(g.target_value) : null; };
      const kcal = find('CALORIES') ?? ag?.goal?.dailyKcal ?? FALLBACK_CALORIE_GOAL;
      setCalorieGoal(Number(kcal) || FALLBACK_CALORIE_GOAL);
      setMacroTargets({
        protein: find('PROTEIN') ?? ag?.goal?.proteinG ?? FALLBACK_MACRO_TARGETS.protein,
        carbs: find('CARBOHYDRATES') ?? ag?.goal?.carbsG ?? FALLBACK_MACRO_TARGETS.carbs,
        fat: find('FAT') ?? ag?.goal?.fatG ?? FALLBACK_MACRO_TARGETS.fat,
      });
    });
    return () => { cancelled = true; };
  }, [userId]);

  // Single pass over history for the selected day (was: one filter pass per macro).
  const dayStats = useMemo(() => {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const items = [];
    for (const h of history) {
      if (!(h.logged_at || "").startsWith(selectedDate)) continue;
      items.push(h);
      totals.calories += Number(h.calories) || 0;
      totals.protein += Number(h.protein) || 0;
      totals.carbs += Number(h.carbs) || 0;
      totals.fat += Number(h.fat) || 0;
    }
    return { items, ...totals };
  }, [history, selectedDate]);
  const dayHistory = dayStats.items;
  const caloriesToday = dayStats.calories;
  const proteinToday = dayStats.protein;
  const carbsToday = dayStats.carbs;
  const fatToday = dayStats.fat;
  // Diary grouping: Breakfast → Lunch → Dinner → Snack → Other, each with a
  // kcal subtotal (MyFitnessPal-style instead of one flat wall of rows).
  const mealGroups = useMemo(() => {
    const order = [...MEAL_TYPES, "Other"];
    const norm = (m) => {
      const s = String(m.serving || "").trim().toLowerCase();
      const hit = MEAL_TYPES.find((t) => t.toLowerCase() === s);
      return hit || "Other";
    };
    return order
      .map((type) => {
        const items = dayHistory.filter((m) => norm(m) === type);
        if (items.length === 0) return null;
        return { type, items, kcal: items.reduce((s, m) => s + Number(m.calories || 0), 0) };
      })
      .filter(Boolean);
  }, [dayHistory]);
  const remainingKcal = Math.max(0, Math.round(calorieGoal - caloriesToday));

  const onFile = (e) => {
    if (isAnalyzing || isLogging) { e.target.value = ''; return; }
    const file = e.target.files?.[0];
    // Reset so picking the same photo twice still fires onChange
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setPreview(reader.result); handleAnalyze(reader.result); };
    reader.readAsDataURL(file);
  };

  const onScanCapture = (dataUrl) => {
    setShowScanner(false);
    if (!dataUrl) return;
    setPreview(dataUrl);
    handleAnalyze(dataUrl);
  };

  const handleManualSave = async () => {
    if (!manualForm.name.trim()) { setManualError("Meal name is required"); return; }
    setManualError("");
    await handleLog({ food_name: manualForm.name.trim(), serving: manualForm.mealType, calories: Number(manualForm.calories)||0, protein: Number(manualForm.protein)||0, carbs: Number(manualForm.carbs)||0, fat: Number(manualForm.fat)||0, image_url: manualForm.image_url || null });
    setManualForm(EMPTY_FORM); setShowManual(false);
  };

  const handleResultSave = async () => {
    await handleLogSelected(preview);
    setPreview(null);
  };

  const onDeleteMeal = async (id) => {
    if (deletingId) return;
    setDeletingId(id);
    try { await handleDeleteMeal(id); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="min-h-dvh bg-[var(--bg-primary)] overflow-x-hidden relative">
      <div className="glass-content">
      <div className="hidden md:block"><Sidebar expanded={sidebarExpanded} setExpanded={setSidebarExpanded} /></div>
      <Topbar sidebarExpanded={sidebarExpanded} />
      <main className={`pt-[56px] pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-6 transition-all duration-200 ${sidebarExpanded ? 'md:ml-60' : 'md:ml-18'}`}>
        <div className="max-w-[1120px] 2xl:max-w-[1280px] mx-auto w-full px-4 pt-4 md:px-6 pb-6">
        <div className="flex flex-row items-center justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[var(--accent)] font-bold tracking-[0.2em] text-[10px] uppercase">Nutrition</p>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-[var(--text-primary)] truncate">Meal Tracker</h1>
            <p className="text-[13px] text-[var(--text-muted)] mt-0.5">Fuel your goals. Track your progress.</p>
          </div>
          <TodayButton selectedDate={selectedDate} today={toLocalKey(new Date())} onDateChange={setSelectedDate} />
        </div>

        {/* Week strip */}
        <WeekStrip selectedDate={selectedDate} onDateChange={setSelectedDate} />

        {/* Daily goals (single card: calories + macros with grams) */}
        <div className="mt-4">
          <DailyGoalsCard
            calories={caloriesToday} goal={calorieGoal}
            protein={proteinToday} proteinGoal={macroTargets.protein}
            carbs={carbsToday} carbsGoal={macroTargets.carbs}
            fat={fatToday} fatGoal={macroTargets.fat}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* Scanner + manual entry */}
          <div className="space-y-4">
            <ScannerCard
              preview={preview}
              isAnalyzing={isAnalyzing}
              onCamera={() => setShowScanner(true)}
              onManual={() => setShowManual((v) => !v)}
              onClear={() => { clearResult(); setPreview(null); }}
            />
            {/* sr-only (not display:none): keeps the input tappable on mobile browsers */}
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />
            {showManual && (
            <div className="glass-card rounded-[24px] border border-[var(--border-light)] p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <p className="text-[10px] sm:text-xs font-semibold text-[var(--accent)] uppercase tracking-widest">Manual Entry</p>
                <button onClick={() => { setShowManual(false); setManualError(""); }} aria-label="Close manual form" className="w-11 h-11 rounded-full bg-[var(--bg-hover)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
                  <Icon name="close" className="text-[16px]" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] text-[var(--text-muted)] mb-1.5">Meal type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {MEAL_TYPES.map((t) => {
                      const active = manualForm.mealType === t;
                      return (
                        <button
                          key={t}
                          onClick={() => setManualForm((f) => ({ ...f, mealType: t }))}
                          aria-pressed={active}
                          className={`py-2 px-1 rounded-xl text-[10px] sm:text-[11px] font-bold transition-all min-w-0 truncate ${
                            active
                              ? "bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] shadow-md"
                              : "bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <InputField label="Meal name" placeholder="e.g. Chicken adobo + rice" value={manualForm.name} onChange={e=>setManualForm({...manualForm, name:e.target.value})} error={manualError} />
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Calories" type="number" placeholder="0" value={manualForm.calories} onChange={e=>setManualForm({...manualForm, calories:e.target.value})} />
                  <InputField label="Protein (g)" type="number" placeholder="0" value={manualForm.protein} onChange={e=>setManualForm({...manualForm, protein:e.target.value})} />
                  <InputField label="Carbs (g)" type="number" placeholder="0" value={manualForm.carbs} onChange={e=>setManualForm({...manualForm, carbs:e.target.value})} />
                  <InputField label="Fat (g)" type="number" placeholder="0" value={manualForm.fat} onChange={e=>setManualForm({...manualForm, fat:e.target.value})} />
                </div>
                <Button onClick={handleManualSave} loading={isLogging} disabled={isLogging || isAnalyzing} className="w-full">{isLogging ? 'Saving…' : `Save to ${manualForm.mealType}`}</Button>
              </div>
            </div>
            )}
          </div>

          {/* Result sheet (reference style) */}
          {result ? (
            <ScanResult
              result={result}
              isLogging={isLogging}
              onToggle={toggleItem}
              onScale={scaleSelected}
              onAddCustom={addCustomItem}
              onSave={handleResultSave}
              onRescan={() => fileRef.current?.click()}
              onClear={() => { clearResult(); setPreview(null); }}
            />
          ) : (
            <div className="space-y-4">
              <div className="glass-card rounded-[24px] border border-[var(--border-light)] p-5">
                <SectionLabel text="Result" />
                <p className="text-sm text-[var(--text-muted)] py-8 text-center">Upload a photo or log manually to see results.</p>
              </div>
              <MacroCoachCard userId={userId} lastMeal={lastLoggedMeal} />
            </div>
          )}
        </div>
        {result && (
          <div className="mt-4">
            <MacroCoachCard userId={userId} lastMeal={lastLoggedMeal} />
          </div>
        )}

        {/* History — diary grouped by meal, follows the selected calendar day */}
        <div className="mt-4 glass-card rounded-[24px] border border-[var(--border-light)] p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex-1 min-w-0"><SectionLabel text="Meal History" /></div>
            {dayHistory.length > 0 && (
              <p className="text-[11px] font-bold text-[var(--text-muted)] tabular-nums">
                {Math.round(caloriesToday)} of {calorieGoal} kcal · {remainingKcal} left
              </p>
            )}
          </div>
          {historyLoading ? <LoadingState message="Loading meal history…" /> : historyError ? <ErrorState message={historyError.message || 'Could not load meal history.'} onRetry={loadHistory} /> : dayHistory.length === 0 ? <EmptyState message="No meals logged for this day. Pick another date or log one above." /> : (
            <div className="space-y-5 max-h-[460px] overflow-auto pr-1">
              {mealGroups.map((g) => (
                <section key={g.type}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-7 h-7 rounded-full bg-[var(--bg-hover)] flex items-center justify-center shrink-0">
                      <Icon name={MEAL_ICONS[g.type] || "restaurant"} className="text-[15px] text-[var(--text-muted)]" />
                    </span>
                    <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{g.type}</h3>
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                      {g.items.length} item{g.items.length > 1 ? "s" : ""}
                    </span>
                    <span className="ml-auto text-[13px] font-black tabular-nums text-[var(--text-primary)]">
                      {Math.round(g.kcal)} <span className="text-[10px] font-semibold text-[var(--text-muted)]">kcal</span>
                    </span>
                  </div>
                  <div className="space-y-2">
                    {g.items.map((m) => (
                      <div key={m.id} className="flex items-center gap-3 bg-[var(--bg-hover)] rounded-2xl px-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{m.food_name}</p>
                          <p className="text-[11px] text-[var(--text-muted)] tabular-nums mt-0.5">
                            P {Math.round(Number(m.protein) || 0)}g · C {Math.round(Number(m.carbs) || 0)}g · F {Math.round(Number(m.fat) || 0)}g
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-black tabular-nums text-[var(--text-primary)]">
                          {Math.round(Number(m.calories) || 0)}
                          <span className="text-[10px] font-semibold text-[var(--text-muted)] ml-0.5">kcal</span>
                        </span>
                        <button onClick={() => onDeleteMeal(m.id)} disabled={deletingId === m.id} aria-label={`Delete ${m.food_name}`} className="shrink-0 w-9 h-9 rounded-full bg-[var(--bg-card)] border border-[var(--border-light)] flex items-center justify-center hover:border-red-400/50 disabled:opacity-50">
                          {deletingId === m.id ? <Spinner className="w-4 h-4" /> : <Icon name="delete" className="text-[15px] text-red-400" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
        </div>
        {toast && <div className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 bg-[var(--text-primary)] text-[var(--bg-primary)] text-sm px-4 py-2 rounded-full shadow-lg z-[var(--z-toast)]">{toast}</div>}
        {showScanner && <CameraScanner onCapture={onScanCapture} onClose={() => setShowScanner(false)} />}
        <div className="md:hidden"><BottomNav variant="mealtracker" onManualLog={()=>setShowManual(true)} /></div>
      </main>
      </div>
    </div>
  );
}
