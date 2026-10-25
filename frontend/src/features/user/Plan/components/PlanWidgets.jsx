import Icon from '../../../../components/Icon.jsx';
import { avatarGradient } from '../../../../lib/avatar.js';
import { TABS } from '../utils/planFormat.js';

export const PlanCover = ({ seed, title, className = '', opacity = 1 }) => (
  <div
    aria-hidden
    className={`w-full h-full flex items-center justify-center ${className}`}
    style={{ background: avatarGradient(seed || title), opacity }}
  >
    <span
      className="font-black text-white/25 select-none"
      style={{ fontSize: 'var(--fs-48)', fontFamily: 'var(--font-display)', lineHeight: 1 }}
    >
      {String(title || '?').slice(0, 1).toUpperCase()}
    </span>
  </div>
);

export const FilterPill = ({ options, active, onSelect }) => (
  <div className="flex flex-wrap gap-1.5 sm:gap-2">
    {options.map((opt) => (
      <button
        key={opt}
        onClick={() => onSelect(opt)}
        aria-pressed={active === opt}
        className="px-3 py-2 min-h-[36px] rounded-full text-[length:var(--fs-10)] sm:text-[length:var(--fs-11)] font-bold uppercase tracking-widest transition-all border active:scale-95 focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
        style={{
          background: active === opt ? 'var(--accent)' : 'var(--bg-hover)',
          color: active === opt ? 'var(--text-inverse)' : 'var(--text-muted)',
          borderColor: active === opt ? 'var(--accent)' : 'var(--border-light)',
        }}
      >
        {opt}
      </button>
    ))}
  </div>
);

export const PlanCard = ({ plan, onOpen, onEnroll, onContinue, style = {} }) => (
  <div
    role="button"
    tabIndex={0}
    aria-label={`Open plan: ${plan.title}`}
    className="group relative rounded-2xl overflow-hidden border flex flex-col h-full glass-card cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-[var(--accent-border)] focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
    style={{ borderColor: 'var(--border-light)', ...style }}
    onClick={() => onOpen(plan)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onOpen(plan);
      }
    }}
  >
    <div className="aspect-[16/10] overflow-hidden relative shrink-0">
      <PlanCover
        seed={plan.image_seed}
        title={plan.title}
        className="group-hover:scale-105 transition-transform duration-700 opacity-40"
      />
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-wrap gap-1.5 sm:gap-2 max-w-[calc(100%-24px)]">
        <span
          className="px-2 py-1 rounded-md text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-bold tracking-widest uppercase truncate max-w-[140px]"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', color: 'var(--accent)' }}
        >
          {plan.tag}
        </span>
        {plan.is_enrolled === 1 && (
          <span
            className="px-2 py-1 rounded-md text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-bold tracking-widest uppercase"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
          >
            Owned
          </span>
        )}
        {plan.is_owner === 1 && (
          <span
            className="px-2 py-1 rounded-md text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] font-bold tracking-widest uppercase"
            style={{
              background: 'var(--bg-hover)',
              backdropFilter: 'blur(6px)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
            }}
          >
            Mine
          </span>
        )}
      </div>
    </div>
    <div className="p-4 sm:p-5 flex-1 flex flex-col min-w-0">
      <h3
        className="text-base sm:text-lg font-bold mb-1 line-clamp-1 break-words"
        style={{ color: 'var(--text-primary)' }}
      >
        {plan.title}
      </h3>
      <p className="text-xs sm:text-sm mb-4 line-clamp-2 leading-relaxed break-words" style={{ color: 'var(--text-muted)' }}>
        {plan.description}
      </p>
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        {[
          { label: 'Time', value: plan.duration },
          { label: 'Strain', value: plan.intensity, colored: true },
          { label: 'Focus', value: plan.target_focus },
        ].map(({ label, value, colored }) => (
          <div key={label} className="min-w-0">
            <p className="text-[length:var(--fs-9)] sm:text-[length:var(--fs-10)] uppercase font-bold mb-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
              {label}
            </p>
            <p
              className="text-xs sm:text-sm font-semibold truncate"
              title={String(value ?? '')}
              style={{
                color: colored ? (value === 'Extreme' ? 'var(--error)' : 'var(--accent)') : 'var(--text-primary)',
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>
      <div
        className="mt-auto pt-3 flex items-center justify-between gap-2 border-t"
        style={{ borderColor: 'var(--border-light)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-base sm:text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {plan.price === 0 || plan.price === '0.00' ? 'Free' : `$${plan.price}`}
        </span>
        {plan.is_enrolled === 1 ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onContinue(plan);
            }}
            className="px-4 sm:px-5 py-2.5 min-h-[44px] rounded-xl font-bold text-xs sm:text-sm active:scale-95 transition-all shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
          >
            Continue
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEnroll(plan.id);
            }}
            className="px-4 sm:px-5 py-2.5 min-h-[44px] rounded-xl font-bold text-xs sm:text-sm active:scale-95 transition-all shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--accent)]"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
          >
            Get Access
          </button>
        )}
      </div>
    </div>
  </div>
);

export const TabBar = ({ active, onChange, enrolledCount }) => (
  <div
    role="tablist"
    aria-label="Plans sections"
    className="flex gap-1 rounded-2xl p-1 w-full overflow-x-auto mb-6 sm:mb-10 border snap-x no-scrollbar"
    style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-light)', scrollbarWidth: 'none' }}
  >
    {TABS.map((tab) => (
      <button
        key={tab.id}
        role="tab"
        aria-selected={active === tab.id}
        onClick={() => onChange(tab.id)}
        className="flex items-center justify-center gap-1 px-2 py-2.5 min-h-[44px] rounded-xl text-[length:var(--fs-9)] sm:text-xs font-bold uppercase tracking-widest transition-all shrink-0 snap-start focus-visible:outline-2 focus-visible:outline-[var(--accent)] min-w-[104px] min-[480px]:min-w-[124px] sm:min-w-0 sm:flex-1"
        style={{
          background: active === tab.id ? 'var(--accent)' : 'transparent',
          color: active === tab.id ? 'var(--text-inverse)' : 'var(--text-muted)',
        }}
      >
        <Icon name={tab.icon} className="text-[length:var(--fs-14)] sm:text-[length:var(--fs-16)] shrink-0" fill={active === tab.id ? 1 : 0} />
        <span className="truncate">{tab.label}</span>
        {tab.id === 'my-plans' && enrolledCount > 0 && (
          <span
            className="text-[length:var(--fs-9)] font-black px-1.5 py-0.5 rounded-full shrink-0 tabular-nums"
            style={{
              background: active === tab.id ? 'rgba(0,0,0,0.20)' : 'var(--accent-bg)',
              color: active === tab.id ? 'var(--text-inverse)' : 'var(--accent)',
            }}
          >
            {enrolledCount}
          </span>
        )}
      </button>
    ))}
  </div>
);
