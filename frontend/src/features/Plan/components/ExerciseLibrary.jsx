import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../../components/Icon.jsx';
import Dropdown from '../../../components/ui/Dropdown.jsx';
import {
  frameUrl,
  getAllGuideExercises,
  guideFilterOptions,
  isHoldExercise,
  prescriptionForGuide,
  searchGuideExercises,
} from '../../CameraWorkout/constants/workoutGuide.js';

const ExerciseLibrary = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [equipment, setEquipment] = useState('');
  const [muscle, setMuscle] = useState('');
  const [type, setType] = useState('');
  const [openSlug, setOpenSlug] = useState(null);
  const filters = useMemo(() => guideFilterOptions(), []);
  const results = useMemo(
    () => searchGuideExercises(query, {
      ...(equipment ? { equipment } : {}),
      ...(muscle ? { primaryMuscle: muscle } : {}),
      ...(type ? { exerciseType: type } : {}),
    }),
    [query, equipment, muscle, type]
  );
  const total = getAllGuideExercises().length;
  const open = openSlug ? getAllGuideExercises().find(e => e.slug === openSlug) : null;
  const openRx = open ? prescriptionForGuide(open) : null;
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-2 text-[var(--text-muted)]">Search</p>
      <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Name, equipment, or muscle"
        className="w-full h-12 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-light)] px-4 text-[13px] outline-none focus:border-[var(--accent)] placeholder:text-[var(--text-disabled)]" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
        {[
          { label: 'Equipment', value: equipment, set: setEquipment, options: filters.equipment, all: 'All equipment' },
          { label: 'Muscle', value: muscle, set: setMuscle, options: filters.muscles, all: 'All muscles' },
          { label: 'Type', value: type, set: setType, options: filters.types, all: 'All types' },
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
      <p className="text-[11px] mt-3 mb-3 text-[var(--text-muted)]">
        {results.length === total && !query && !equipment && !muscle && !type
          ? `Showing all ${total} exercises`
          : `Showing ${results.length} of ${total} exercises`}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 items-stretch">
        {results.map(ex => {
          return (
          <button key={ex.slug} onClick={() => setOpenSlug(ex.slug)}
            className="text-left rounded-[20px] border border-[var(--border-light)] overflow-hidden transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:border-[var(--accent-border)] focus-visible:outline-2 focus-visible:outline-[var(--accent)] glass-card h-full">
            <span className="block aspect-[4/3] w-full bg-[#1E1E1E]">
              {frameUrl(ex.slug, 1)
                ? <img src={frameUrl(ex.slug, 1)} alt={ex.name} className="w-full h-full object-contain p-4" loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                : <span className="w-full h-full flex items-center justify-center material-symbols-outlined text-[40px] text-white">fitness_center</span>}
            </span>
            <span className="block p-4">
              <span className="block text-[15px] font-black text-[var(--text-primary)]">{ex.name}</span>
              <span className="block text-[12px] mt-0.5 text-[var(--text-muted)]">{ex.primaryMuscle} - {ex.equipment}</span>
            </span>
          </button>
          );
        })}
      </div>
      {open && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4 overflow-y-auto bg-[var(--bg-overlay)]"
          onClick={() => setOpenSlug(null)}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl bg-[var(--bg-secondary)] border border-[var(--border-medium)]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <span className="w-14 h-14 rounded-xl overflow-hidden flex items-center justify-center shrink-0 bg-[#1E1E1E]">
                {frameUrl(open.slug, 1)
                  ? <img src={frameUrl(open.slug, 1)} alt={open.name} className="w-full h-full object-contain p-1"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  : <Icon name="fitness_center" className="text-[22px] text-white" />}
              </span>
              <div className="min-w-0">
                <h3 className="text-lg font-black truncate text-[var(--text-primary)]">{open.name}</h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  {open.primaryMuscle} · {open.equipment} · {isHoldExercise(open) ? 'Hold (timer)' : 'Reps (camera count)'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              {[1, 2, 3].map(f => (
                frameUrl(open.slug, f)
                  ? <img key={f} src={frameUrl(open.slug, f)} alt={`${open.name} frame ${f}`} className="w-1/3 aspect-square object-contain rounded-xl border border-[var(--border-light)] p-1 bg-[#1E1E1E]" loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                  : null
              ))}
            </div>
            <p className="text-[11px] font-black uppercase tracking-widest mb-1 text-[var(--text-muted)]">
              {isHoldExercise(open) ? 'Hold steady in frame to time' : 'Full range counts a rep'}
            </p>
            <p className="text-sm leading-relaxed mb-4 text-[var(--text-secondary)]">
              {(open.secondaryMuscles || []).length ? `Also works: ${open.secondaryMuscles.join(', ')}.` : 'Follow the guide frames and keep your form.'}
            </p>
            <div className="grid grid-cols-3 gap-2 mb-5 text-center">
              {[['Sets', openRx.sets], ['Target', openRx.reps], ['Gear', openRx.weight]].map(([l, v]) => (
                <div key={l} className="rounded-xl p-3 border bg-[var(--bg-hover)] border-[var(--border-light)]">
                  <p className="text-[9px] font-black uppercase text-[var(--text-muted)]">{l}</p>
                  <p className="text-sm font-black truncate text-[var(--text-primary)]">{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setOpenSlug(null)}
                className="flex-1 py-3 rounded-xl font-bold text-sm border border-[var(--border-medium)] text-[var(--text-muted)]">
                Close
              </button>
              <button onClick={() => navigate('/dashboard/workouts', { state: { exerciseId: open.slug } })}
                className="flex-1 py-3 rounded-xl font-black text-sm uppercase bg-[var(--accent-solid)] text-[var(--accent-solid-fg)]">
                Start {isHoldExercise(open) ? 'Hold' : 'Workout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExerciseLibrary;
