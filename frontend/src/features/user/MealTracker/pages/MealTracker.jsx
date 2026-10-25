import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BottomNav } from "../../../../components/index.js";
import AppShell from "../../../../components/AppShell.jsx";
import PageHeader from "../../../../components/app/PageHeader.jsx";
import Icon from "../../../../components/Icon.jsx";
import MacroCoachCard from "../components/MacroCoachCard.jsx";
import ScanResult from "../components/ScanResult.jsx";
import CameraScanner from "../components/CameraScanner.jsx";
import MealDiary from "../components/MealTrackerDiary.jsx";
import {
  DailySummaryCard,
  MacroCards,
} from "../components/MealTrackerSummary.jsx";
import {
  ManualMealForm,
  QuickLogCard,
} from "../components/MealTrackerQuickLog.jsx";
import { useAuth } from "../../../../hooks/useAuth.jsx";
import { useNutritionTracker } from "../hooks/useNutritionTracker.js";
import { apiGet } from "../../../../lib/apiClient.js";
import "../MealTracker.css";

const FALLBACK_CALORIE_GOAL = 2000;
const FALLBACK_MACRO_TARGETS = { protein: 120, carbs: 200, fat: 60 };
const MEAL_TYPES = ["Breakfast", "Lunch", "Dinner", "Snack"];
const EMPTY_FORM = {
  name: "",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
  mealType: "Breakfast",
  image_url: "",
};
const WEEK_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Local YYYY-MM-DD key — never toISOString() (UTC shifts the day in +UTC timezones).
function toLocalKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Month grid cells (null = leading blank). Week starts Sunday.
function buildMonthGrid(year, month) {
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDay; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  return cells;
}

// App-styled calendar dropdown (replaces the unstyled native picker popup).
function CalendarPopup({ currentDate, today, onPick }) {
  const [view, setView] = useState(() => {
    const [year, month] = currentDate.split("-").map(Number);
    return { y: year, m: month - 1 };
  });
  const now = new Date();
  const maxY = now.getFullYear();
  const maxM = now.getMonth();
  const canNext = view.y < maxY || (view.y === maxY && view.m < maxM);
  const shiftMonth = (delta) =>
    setView((current) => {
      let year = current.y;
      let month = current.m + delta;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      if (month > 11) {
        month = 0;
        year += 1;
      }
      if (year > maxY || (year === maxY && month > maxM)) return current;
      return { y: year, m: month };
    });
  const label = new Date(view.y, view.m, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const pick = (day) => {
    const key = toLocalKey(new Date(view.y, view.m, day));
    if (key > today) return;
    onPick(key);
  };

  return (
    <div
      className="mt-calendar"
      role="dialog"
      aria-modal="true"
      aria-label="Choose date"
    >
      <div className="mt-calendar-head">
        <p className="mt-calendar-title">{label}</p>
        <div className="mt-calendar-nav">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
            className="mt-icon-button mt-calendar-nav-button"
          >
            <Icon name="chevron_left" className="mt-icon-symbol" />
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={!canNext}
            aria-label="Next month"
            className="mt-icon-button mt-calendar-nav-button"
          >
            <Icon name="chevron_right" className="mt-icon-symbol" />
          </button>
        </div>
      </div>

      <div className="mt-calendar-weekdays" aria-hidden="true">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <span key={day} className="mt-calendar-weekday">
            {day}
          </span>
        ))}
      </div>

      <div className="mt-calendar-grid">
        {buildMonthGrid(view.y, view.m).map((day, index) => {
          if (day === null) return <span key={`blank-${index}`} />;
          const key = toLocalKey(new Date(view.y, view.m, day));
          const future = key > today;
          const isSelected = key === currentDate;
          const isToday = key === today;
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => pick(day)}
              aria-label={new Date(view.y, view.m, day).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              aria-current={isSelected ? "date" : undefined}
              className={`mt-calendar-day ${isSelected ? "is-selected" : ""} ${isToday && !isSelected ? "is-today" : ""} ${future ? "is-future" : ""}`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="mt-calendar-foot">
        <button
          type="button"
          onClick={() => {
            const [year, month] = currentDate.split("-").map(Number);
            setView({ y: year, m: month - 1 });
          }}
          className="mt-calendar-link"
        >
          Reset view
        </button>
        <button
          type="button"
          onClick={() => onPick(today)}
          className="mt-calendar-link mt-calendar-link--accent"
        >
          Today
        </button>
      </div>
    </div>
  );
}

// Header date picker (calendar popup + Today shortcut).
function TodayButton({ selectedDate, today, onDateChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const isToday = selectedDate === today;
  const label = isToday
    ? "Today"
    : (() => {
        const [year, month, day] = selectedDate.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      })();

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="mt-date-wrap">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Pick a date"
        aria-expanded={open}
        className="mt-date-trigger"
      >
        <span className="mt-date-trigger-icon">
          <Icon name="calendar_month" className="mt-date-icon" />
        </span>
        <span className="mt-date-trigger-label">{label}</span>
        <Icon name="expand_more" className="mt-date-chevron" />
      </button>
      {open && (
        <CalendarPopup
          currentDate={selectedDate}
          today={today}
          onPick={(key) => {
            onDateChange(key);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

// Week strip (Sun–Sat, selected day filled) with compact week navigation.
function WeekStrip({ selectedDate, onDateChange }) {
  const today = toLocalKey(new Date());
  const parseDate = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const selected = parseDate(selectedDate);
  const weekStart = new Date(selected);
  weekStart.setDate(selected.getDate() - selected.getDay());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
  const shiftWeek = (delta) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta);
    if (delta > 0 && toLocalKey(next) > today) return;
    const key = toLocalKey(
      new Date(next.getFullYear(), next.getMonth(), next.getDate() + selected.getDay()),
    );
    onDateChange(key > today ? today : key);
  };
  const monthLabel = weekStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const nextWeekBlocked =
    toLocalKey(new Date(weekStart.getTime() + 7 * 864e5)) > today;

  return (
    <section className="mt-week mt-panel" aria-label="Week date selector">
      <div className="mt-week-head">
        <button
          type="button"
          onClick={() => shiftWeek(-7)}
          aria-label="Previous week"
          className="mt-week-nav"
        >
          <Icon name="chevron_left" className="mt-week-nav-icon" />
        </button>
        <p className="mt-week-month">{monthLabel}</p>
        <button
          type="button"
          onClick={() => shiftWeek(7)}
          aria-label="Next week"
          className="mt-week-nav"
          disabled={nextWeekBlocked}
        >
          <Icon name="chevron_right" className="mt-week-nav-icon" />
        </button>
      </div>

      <div className="mt-week-grid" role="tablist" aria-label="Week days">
        {days.map((date) => {
          const key = toLocalKey(date);
          const future = key > today;
          const isSelected = key === selectedDate;
          const isToday = key === today;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-label={`${WEEK_LABELS[date.getDay()]} ${date.getDate()}`}
              disabled={future}
              onClick={() => onDateChange(key)}
              className={`mt-week-day ${isSelected ? "is-selected" : ""} ${isToday ? "is-today" : ""}`}
            >
              <span className="mt-week-day-label">{WEEK_LABELS[date.getDay()]}</span>
              <span className="mt-week-day-number">{date.getDate()}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function MealTracker() {
  const { user } = useAuth();
  const userId = user?.id;
  const {
    result,
    isAnalyzing,
    isLogging,
    history,
    historyLoading,
    historyError,
    loadHistory,
    lastLoggedMeal,
    handleAnalyze,
    handleLog,
    handleLogSelected,
    toggleItem,
    scaleSelected,
    editItem,
    addCustomItem,
    clearResult,
    handleDeleteMeal,
  } = useNutritionTracker(userId);

  const [preview, setPreview] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [manualForm, setManualForm] = useState(EMPTY_FORM);
  const [manualError, setManualError] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => toLocalKey(new Date()));
  const [showScanner, setShowScanner] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef(null);
  const manualRef = useRef(null);
  const today = toLocalKey(new Date());

  const openManualFor = useCallback((mealType) => {
    if (mealType) {
      setManualForm((current) => ({ ...current, mealType }));
    }
    setManualError("");
    setShowManual(true);
    window.setTimeout(() => {
      manualRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      document.getElementById("meal-name-input")?.focus({ preventScroll: true });
    }, 80);
  }, []);

  // Deep links from Quick Log: ?scan=1 opens the camera, ?manual=1 opens the
  // manual form. Consumed once so back-nav doesn't retrigger.
  useEffect(() => {
    if (searchParams.get("scan") === "1") {
      setShowScanner(true);
      searchParams.delete("scan");
      setSearchParams(searchParams, { replace: true });
    } else if (searchParams.get("manual") === "1") {
      openManualFor();
      searchParams.delete("manual");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real goals: nutrient-goals API + active goal dailyKcal (fall back to constants offline).
  const [calorieGoal, setCalorieGoal] = useState(FALLBACK_CALORIE_GOAL);
  const [macroTargets, setMacroTargets] = useState(FALLBACK_MACRO_TARGETS);
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    Promise.all([
      apiGet(`/api/nutrient-goals/${userId}`).catch(() => null),
      apiGet(`/api/goals/active/${userId}`).catch(() => null),
    ]).then(([nutrientGoals, activeGoal]) => {
      if (cancelled) return;
      const goals = nutrientGoals?.goals || [];
      const find = (key) => {
        const goal = goals.find((entry) => entry.nutrient === key);
        return goal?.target_value != null ? Number(goal.target_value) : null;
      };
      const kcal = find("CALORIES") ?? activeGoal?.goal?.dailyKcal ?? FALLBACK_CALORIE_GOAL;
      setCalorieGoal(Number(kcal) || FALLBACK_CALORIE_GOAL);
      setMacroTargets({
        protein: find("PROTEIN") ?? activeGoal?.goal?.proteinG ?? FALLBACK_MACRO_TARGETS.protein,
        carbs: find("CARBOHYDRATES") ?? activeGoal?.goal?.carbsG ?? FALLBACK_MACRO_TARGETS.carbs,
        fat: find("FAT") ?? activeGoal?.goal?.fatG ?? FALLBACK_MACRO_TARGETS.fat,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Single pass over history for the selected day.
  const dayStats = useMemo(() => {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    const items = [];
    for (const entry of history) {
      if (!(entry.logged_at || "").startsWith(selectedDate)) continue;
      items.push(entry);
      totals.calories += Number(entry.calories) || 0;
      totals.protein += Number(entry.protein) || 0;
      totals.carbs += Number(entry.carbs) || 0;
      totals.fat += Number(entry.fat) || 0;
    }
    return { items, ...totals };
  }, [history, selectedDate]);

  const dayHistory = dayStats.items;
  const caloriesToday = dayStats.calories;
  const proteinToday = dayStats.protein;
  const carbsToday = dayStats.carbs;
  const fatToday = dayStats.fat;

  // Diary grouping: Breakfast → Lunch → Dinner → Snack, plus Other for legacy
  // rows. Empty core slots stay visible so every meal can be added from the diary.
  const mealGroups = useMemo(() => {
    const order = [...MEAL_TYPES, "Other"];
    const grouped = new Map(order.map((type) => [type, []]));
    for (const entry of dayHistory) {
      const normalized = String(entry.meal_type || entry.serving || "").trim().toLowerCase();
      const match = MEAL_TYPES.find((type) => type.toLowerCase() === normalized) || "Other";
      grouped.get(match).push(entry);
    }
    return order
      .map((type) => {
        const items = grouped.get(type);
        return {
          type,
          items,
          kcal: items.reduce((total, entry) => total + Number(entry.calories || 0), 0),
        };
      })
      .filter((group) => group.type !== "Other" || group.items.length > 0);
  }, [dayHistory]);

  const dateLabel = useMemo(() => {
    if (selectedDate === today) return "Today";
    const [year, month, day] = selectedDate.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [selectedDate, today]);

  const onFile = (event) => {
    if (isAnalyzing || isLogging) {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result);
      handleAnalyze(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const onScanCapture = (dataUrl) => {
    setShowScanner(false);
    if (!dataUrl) return;
    setPreview(dataUrl);
    handleAnalyze(dataUrl);
  };

  const handleManualSave = async () => {
    if (!manualForm.name.trim()) {
      setManualError("Meal name is required");
      return;
    }
    setManualError("");
    await handleLog({
      food_name: manualForm.name.trim(),
      serving: null,
      meal_type: manualForm.mealType,
      calories: Number(manualForm.calories) || 0,
      protein: Number(manualForm.protein) || 0,
      carbs: Number(manualForm.carbs) || 0,
      fat: Number(manualForm.fat) || 0,
      image_url: manualForm.image_url || null,
    });
    setManualForm(EMPTY_FORM);
    setShowManual(false);
  };

  const handleResultSave = async ({ mealType } = {}) => {
    await handleLogSelected(preview, mealType);
    setPreview(null);
  };

  const onDeleteMeal = async (id) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      await handleDeleteMeal(id);
    } finally {
      setDeletingId(null);
    }
  };

  const toggleManual = () => {
    if (showManual) {
      setShowManual(false);
      setManualError("");
      return;
    }
    openManualFor(manualForm.mealType);
  };

  return (
    <AppShell
      userId={userId}
      mobileTitle="Nutrition"
      contentClassName="app-container meal-tracker"
      bottomNav={
        <BottomNav
          variant="mealtracker"
          onManualLog={() => openManualFor(manualForm.mealType)}
        />
      }
    >
      <div className="mt-page">
        <PageHeader
          className="mt-page-head"
          eyebrow="Nutrition"
          title="Meal Tracker"
          description="Fuel your goals. Log meals, watch your macros and keep the day on target."
          actions={
            <TodayButton
              selectedDate={selectedDate}
              today={today}
              onDateChange={setSelectedDate}
            />
          }
        />

        <WeekStrip selectedDate={selectedDate} onDateChange={setSelectedDate} />

        <div className="mt-dashboard">
          <div className="mt-primary">
            <DailySummaryCard
              calories={caloriesToday}
              goal={calorieGoal}
              protein={proteinToday}
              proteinGoal={macroTargets.protein}
              carbs={carbsToday}
              carbsGoal={macroTargets.carbs}
              fat={fatToday}
              fatGoal={macroTargets.fat}
              dateLabel={dateLabel}
            />

            <MacroCards
              protein={proteinToday}
              proteinGoal={macroTargets.protein}
              carbs={carbsToday}
              carbsGoal={macroTargets.carbs}
              fat={fatToday}
              fatGoal={macroTargets.fat}
            />


          </div>

          <aside className="mt-rail" aria-label="Meal logging and nutrition insight">
            <QuickLogCard
              preview={preview}
              isAnalyzing={isAnalyzing}
              manualOpen={showManual}
              onCamera={() => setShowScanner(true)}
              onUpload={() => fileRef.current?.click()}
              onManual={toggleManual}
              onClear={() => {
                clearResult();
                setPreview(null);
              }}
            />

            {showManual && (
              <ManualMealForm
                form={manualForm}
                setForm={setManualForm}
                error={manualError}
                onClose={() => {
                  setShowManual(false);
                  setManualError("");
                }}
                onSave={handleManualSave}
                isLogging={isLogging}
                isAnalyzing={isAnalyzing}
                panelRef={manualRef}
              />
            )}

            {result && (
              <div className="mt-result-slot">
                <ScanResult
                  result={result}
                  isLogging={isLogging}
                  onToggle={toggleItem}
                  onScale={scaleSelected}
                  onEditItem={editItem}
                  onAddCustom={addCustomItem}
                  onSave={handleResultSave}
                  onRescan={() => fileRef.current?.click()}
                  onClear={() => {
                    clearResult();
                    setPreview(null);
                  }}
                />
              </div>
            )}

            <div className="mt-coach-slot">
              <MacroCoachCard userId={userId} lastMeal={lastLoggedMeal} />
            </div>
          </aside>

          <MealDiary
            groups={mealGroups}
            loading={historyLoading}
            error={historyError}
            onRetry={loadHistory}
            onAdd={openManualFor}
            onDelete={onDeleteMeal}
            deletingId={deletingId}
            dateLabel={dateLabel}
            caloriesToday={caloriesToday}
            calorieGoal={calorieGoal}
          />
        </div>
      </div>

      {/* sr-only (not display:none): keeps the input tappable on mobile browsers */}
      <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onFile} />

      {showScanner && (
        <CameraScanner onCapture={onScanCapture} onClose={() => setShowScanner(false)} />
      )}
    </AppShell>
  );
}
