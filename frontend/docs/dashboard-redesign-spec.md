# Dashboard Redesign — Visual Specification (References A & B)

Scope: authenticated `/dashboard` only. Light theme is the primary comparison target;
dark mode must remain coherent. Public/landing/auth pages and other authenticated
pages are out of scope.

References inspected at full resolution:

- A — https://dribbble.com/shots/26453132-AI-Health-Fitness-App-Design
  (cdn.dribbble.com/userupload/44674643/file/0deb4e33a5517074b95cf50510d64dea.png)
- B — https://dribbble.com/shots/27674730-Fitness-Tracker-Saa-S-Dashbaord-UI
  (cdn.dribbble.com/userupload/48813079/file/f74c205ed4e0c20e13102a5742037611.jpg)

---

## Audit baseline (before redesign)

- Stack: Vite 8, React 19, React Router 7, Tailwind 4 (CSS-first), Chart.js (Analytics only).
- Dashboard: `frontend/src/features/Dashboard/pages/Dashboard.jsx`, self-rendered
  Sidebar/Topbar/BottomNav/FAB. Shared chrome is used by other authed pages.
- Theme: CSS variables on `:root` (dark default) and `.light-theme`; brand is
  forest-green surfaces with a lime/emerald accent. Fonts already loaded: Inter,
  Manrope. Icons: Material Symbols Outlined.
- Real dashboard data: today stats (steps, calories burned, workout minutes,
  water, sleep), check-in, goal + weight progress, today's foods/macros,
  nutrient goals, workout logs, enrolled plans, AI summary, today's sleep series.
- Main visual problems observed in the rendered baseline:
  1. One stacked column on desktop — no 2-D composition or hierarchy.
  2. Hero card is a dark photo band with dark text in light theme, low contrast.
  3. Steps/metrics duplicated across two separate sections.
  4. No weekly visualisation or proportional data display; AI text block dominates.
  5. Typography nearly uniform heavy weights; weak display/label contrast.
  6. Mobile has competing CTAs (hero buttons, Quick Log, FAB) and a clipped
     horizontal stat row.

---

## Desktop specification (Reference B)

Canvas
- Full-bleed soft page background (green-tinted in our theme), main dashboard
  content begins after a compact permanent icon-and-label rail.
- Top header row spans the content: pill navigation on the left (active = solid
  accent/dark pill), utility actions on the right.
- Page gutter: 28–32 px; column gap 16 px; content max ≈ 1360 px.

Composition (12-column grid, top to bottom)
1. Header/intro band: display headline (2 lines, accent word) + supporting copy
   and Quick Log on the left; pill nav is in the top bar.
2. Row 1 — 5 / 4 / 3 columns:
   - Hero feature card (~420 px tall), image-led, gradient overlay, eyebrow,
     title, meta, primary + secondary CTA.
   - Weekly Activity card (chart) + compact "Next Workout" strip below it.
   - Today's Plan card: tinted active-calorie banner, three progress rows,
     full-width primary action, enrolled plan line.
3. Row 2 — four equal stat cards (2 cols each) + wide Macro Focus card (4 cols).
   Stat card: 44 px icon tile, 32 px value, 12 px label, thin progress/delta.
   Macro Focus: macro ring on the left (like the reference's body figure block),
   labelled progress rows on the right.
4. Row 3 — four equal cards: Workout Progress (donut), Sleep Trend (line/area),
   image motivation card, This Week summary with three icon-backed stats.
5. Row 4 (below the fold) — Today's Workouts list, AI Coach, Recovery and Goal
   cards arranged in a balanced 2-column grid. Nothing is removed.

Cards & typography
- Cards: surface = existing `--bg-card`; 1 px `--border-light`; radius 18–20 px
  (`--radius-lg/xl`); padding 20–24 px; no heavy shadows. Section titles 16–17 px
  semibold (Manrope 700); values 28–34 px Manrope 700/800, tabular numerals;
  labels 11–12 px Inter, muted; chart labels 10–11 px.
- All colours from existing tokens. Accent used for active nav, primary CTAs,
  primary series, one accent word. No gradients beyond the hero image overlay,
  small accent chart fills, and macro ring.

Charts
- Weekly Activity: capsule bars, 7 days, real workout minutes from existing
  workout logs; dashed average line; today highlighted with a small value pill;
  day + date labels; legend-free.
- Sleep Trend: real sleep series from today's sleep logs (fallback: empty state),
  area/line with average pill. No invented data.

Navigation
- Dashboard-only sidebar variant: permanent 104 px rail, icon over a 9–10 px
  label, tinted active tile, same destinations/active states/logout/feedback.
  Default Sidebar output for every other page is unchanged.
- Top bar: brand hidden on dashboard; replaced by the pill nav (desktop) or the
  greeting (mobile). All existing notification/theme/account actions stay.
- Pill nav: Dashboard, Training, Nutrition, Progress (existing routes only).

---

## Mobile specification (Reference A)

- Background: existing light theme wash; content side margins 16–20 px.
- Header: avatar + two-line greeting ("Morning" / real first name), circular
  outlined notification action aligned right (kept inside the existing Topbar).
- Hero card: full-width photo card, radius ~24 px, label + large calorie value,
  companion stats, circular arrow action bottom-right and two compact CTAs.
- Section heading directly below hero: "Quick Actions" (reference's "Select
  Exercise Type") — five white circular buttons with accent icons:
  Meal, Workout, Activity, Sleep, Check-in. All map to existing actions.
- Weekly Activity card (reference's Total Sleep card role): white card, large
  total/workout value, circular arrow to Progress, 7 capsule bars from real
  workout minutes.
- Two tinted compact metric cards side by side (Steps + Active Calories), plus
  a compact Workout card — reference's pastel metric pair.
- Today's Plan card: active-calorie tile, progress rows, Log Activity.
- Macro Focus, Today's Workouts, Recovery + Goal, AI Coach stack below.
- Bottom navigation: existing floating pill nav (already visually close to the
  reference); keep all destinations and behaviours. No duplicate FAB.
- No horizontal overflow; text wraps, values use tabular numerals, charts resize.

---

## Reference-to-implementation mapping

| Reference element | Existing dashboard equivalent | Implementation |
|---|---|---|
| Persistent icon+label rail (B) | Sidebar (72 px, hover-expand) | Dashboard-only 104 px rail variant; default pages untouched |
| Pill nav + utility icons (B) | Topbar brand + actions | Topbar gains optional left slot; dashboard shows pill nav desktop / greeting mobile |
| Big statement headline + accent word (B) | "Today" + date | Real greeting headline + supporting copy, accent first name |
| Image-led primary card (B) | FeaturedHeroCard | Rebuilt as image hero with today's focus/real plan, calories and CTAs |
| Weekly Activity chart (B) | WeekStrip / workout logs | Real 7-day workout-minute bars; dates integrated into labels |
| Next Workout strip (B) | Today's Workouts | Latest/next real session or plan CTA under chart |
| Today's Plan panel (B) | Calories ring, logs, QuickLog | Active-calories banner + Workout/Steps/Protein progress + Log Activity |
| Four metric cards (B) | Steps/Calories/Workout cards + nutrient grid | Four stat cards (Steps, Calories, Workout, Sleep), no duplicates |
| Muscle Focus card (B) | Macros card + nutrient goals | "Macro Focus" with macro ring + real nutrient progress rows |
| Workout Progress donut (B) | Hero ring / goal progress | Donut of today's workout goal + weekly real aggregates |
| Heart Rate card (B) | Sleep series (`sleep_trend`) | Sleep Trend line/area using real data only |
| Motivation photo card (B) | Existing hero image asset | Image CTA to workouts; no fabricated claims |
| Achievements card (B) | Existing workout/goal data | "This Week": real streak/sessions/minutes/active plans |
| Bottom row cards (B) | AI Coach, plans, recovery, goal | Balanced 2-column grid; all existing features retained |
| Greeting header (A) | Topbar brand row | Mobile greeting: avatar + Morning + name |
| Full-bleed calorie hero (A) | FeaturedHeroCard | Photo hero with large value and circular arrow CTA |
| Exercise type circles (A) | QuickLog items | Five circular quick actions wired to existing destinations/modals |
| Sleep chart card (A) | WeekStrip / no chart | Weekly Activity capsule-bar card with real workout data |
| Tinted metric pair (A) | Steps/Calories/Workout | Tinted Steps + Active Calories cards, compact Workout card |
| Floating pill nav (A) | BottomNav | Reused unchanged |

---

## Guardrails for implementation

- No backend files, routes, API contracts, auth, calculations or data hooks changed.
- No new fake data in the app; preview seeding exists only in the local test user's rows.
- No edits to Landing/Auth pages; shared components only gain opt-in props/variants
  whose defaults reproduce current output exactly.
- New dashboard CSS lives in `features/Dashboard/dashboard.css` scoped under `.vdash`;
  global `index.css` is left untouched.
- All charts derive from already-fetched data; no new API endpoints.
