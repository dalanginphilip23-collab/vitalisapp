import { useState, useMemo } from 'react';
import Dropdown from '../../../components/ui/Dropdown.jsx';
import {
  getPickerOptions,
  searchGuideExercises,
  frameUrl,
  guideFilterOptions,
  getAllGuideExercises,
} from '../constants/workoutGuide.js';

// Workout chooser: pick an exercise first, camera opens after.
export default function WorkoutChooser({ query, onQuery, onPick, onBack }) {
  const [equipment, setEquipment] = useState('');
  const [muscle, setMuscle] = useState('');
  const [type, setType] = useState('');
  const filterOpts = useMemo(() => guideFilterOptions(), []);
  const q = query.trim();
  const hasFilters = Boolean(q || equipment || muscle || type);
  const libraryTotal = useMemo(() => getAllGuideExercises().length, []);
  const list = useMemo(() => {
    if (q || equipment || muscle || type) {
      return searchGuideExercises(q, {
        ...(equipment ? { equipment } : {}),
        ...(muscle ? { primaryMuscle: muscle } : {}),
        ...(type ? { exerciseType: type } : {}),
      }).slice(0, 48);
    }
    return getPickerOptions();
  }, [q, equipment, muscle, type]);
  const clearFilters = () => {
    onQuery('');
    setEquipment('');
    setMuscle('');
    setType('');
  };
  return (
    <main className="p-4 sm:p-6 md:p-8 pb-28 md:pb-8 max-w-7xl 2xl:max-w-[1400px] mx-auto w-full">
      <div className="glass-card border border-[var(--border-light)] rounded-3xl p-4 sm:p-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              aria-label="Back to dashboard"
              className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] flex items-center justify-center shrink-0 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px] text-[var(--text-primary)]">arrow_back</span>
            </button>
          )}
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--accent)]">Workouts</p>
            <h2 className="text-[18px] sm:text-[20px] font-black tracking-tight leading-tight">Choose your workout</h2>
            <p className="text-[12px] text-[var(--text-muted)] mt-0.5 leading-snug">Choose an exercise — camera opens after you pick one.</p>
          </div>
        </div>
        <div className="relative mt-4">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-[var(--text-muted)] pointer-events-none">search</span>
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Name, equipment, or muscle"
            aria-label="Search exercises"
            className="w-full h-12 min-h-[48px] rounded-2xl bg-[var(--bg-hover)] border border-[var(--border-light)] pl-11 pr-11 text-[16px] sm:text-[13px] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-disabled)]" />
          {query && (
            <button
              onClick={() => onQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between mt-4 mb-2">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
            Filters{hasFilters && <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-[var(--accent-bg)] text-[var(--accent)]">{[equipment, muscle, type].filter(Boolean).length + (q ? 1 : 0)}</span>}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="text-[11px] font-bold text-[var(--accent)] hover:underline">
              Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-3 gap-2">
          {[
            { label: 'Equipment', value: equipment, set: setEquipment, options: filterOpts.equipment, all: 'All' },
            { label: 'Muscle', value: muscle, set: setMuscle, options: filterOpts.muscles, all: 'All' },
            { label: 'Type', value: type, set: setType, options: filterOpts.types, all: 'All' },
          ].map(f => (
            <Dropdown
              key={f.label}
              label={f.label}
              value={f.value}
              onChange={f.set}
              options={f.options}
              allLabel={f.all}
            />
          ))}
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-3">
          {hasFilters ? (
            <><span className="font-bold text-[var(--text-primary)] tabular-nums">{list.length}</span> of <span className="font-bold text-[var(--text-primary)] tabular-nums">{libraryTotal}</span> exercises found</>
          ) : (
            <><span className="font-bold text-[var(--text-primary)] tabular-nums">{list.length}</span> quick picks · <span className="font-bold text-[var(--accent)] tabular-nums">{libraryTotal}</span> in full library</>
          )}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3 items-stretch">
          {list.map((opt) => {
            const slug = opt.slug ?? opt.id;
            const img = frameUrl(slug, 1);
            const label = opt.name ?? opt.label ?? slug;
            const isHold = (opt.mode ?? (opt.exerciseType === 'duration' || opt.exerciseType === 'distance_duration' || opt.isStretch ? 'hold' : 'rep')) === 'hold';
            return (
              <button key={slug} type="button" onClick={() => onPick(slug)}
                className="text-left rounded-2xl border border-[var(--border-light)] bg-[var(--bg-hover)]/50 hover:border-[var(--accent-border)] hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-[var(--accent)] transition-all duration-300 overflow-hidden h-full">
                <span className="relative block aspect-square bg-[#1E1E1E]">
                  {img
                    ? <img src={img} alt={label} loading="lazy" className="w-full h-full object-contain p-2"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    : <span className="w-full h-full flex items-center justify-center material-symbols-outlined text-[28px] text-white">fitness_center</span>}
                  <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${isHold ? 'bg-sky-500/90 text-white' : 'bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]'}`}>
                    {isHold ? 'Hold' : 'Reps'}
                  </span>
                </span>
                <span className="block p-2.5">
                  <span className="block text-[12px] font-bold truncate">{label}</span>
                  <span className="block text-[10px] text-[var(--text-muted)] mt-0.5">{isHold ? 'Hold · timer' : 'Reps · camera count'}</span>
                </span>
              </button>
            );
          })}
        </div>
        {list.length === 0 && (
          <div className="text-center py-10">
            <p className="text-[13px] font-bold text-[var(--text-primary)]">No matches</p>
            <p className="text-[12px] text-[var(--text-muted)] mt-1">Try another search or clear the filters.</p>
            <button onClick={clearFilters} className="mt-3 h-11 px-5 rounded-xl bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[12px] font-bold active:scale-95 transition-all">
              Clear filters
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
