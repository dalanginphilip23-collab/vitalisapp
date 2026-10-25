import React from 'react';
import { useTheme } from '../hooks/useTheme.js';
import Icon from './Icon.jsx';

// Shared animated theme switch used across the app.
//
//   variant="app"            → user dashboard / admin topbar pill (default)
//   variant="landing"        → circular button in the marketing-page header
//   variant="landing-mobile" → full-width labelled row in the landing sheet
//
// The animation is intentionally identical everywhere: the sun rotates/scales
// out while the moon rotates/scales in, plus a one-shot expanding ripple while
// the theme context is transitioning. Keep it in this component so every
// surface gets the same motion for free.
const VARIANTS = {
  app: {
    button:
      'theme-toggle relative p-2 rounded-xl transition-all duration-300 cursor-pointer border-none bg-[var(--bg-hover)] hover:bg-[var(--bg-active)] text-[var(--text-muted)] hover:text-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed group',
    iconBox: 'relative w-5 h-5 flex items-center justify-center',
    icon: 'text-[length:var(--fs-20)]',
    ripple: 'rounded-xl',
    labelled: false,
  },
  landing: {
    button: 'nn-theme-toggle',
    iconBox: 'nn-theme-iconbox',
    icon: 'nn-theme-icon',
    ripple: '',
    labelled: false,
  },
  'landing-mobile': {
    button: 'nn-mobile-theme',
    iconBox: 'nn-theme-iconbox',
    icon: 'nn-theme-icon',
    ripple: '',
    labelled: true,
  },
};

const ThemeToggle = ({ variant = 'app', className = '' }) => {
  const { theme, toggleTheme, isTransitioning } = useTheme();
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  const config = VARIANTS[variant] || VARIANTS.app;

  const ripple = isTransitioning ? (
    <span className={`nn-theme-ripple ${config.ripple}`.trim()} aria-hidden="true" />
  ) : null;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={isTransitioning}
      className={`${config.button} ${className}`.trim()}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
    >
      {/* Animated icon container — sun out / moon in (and back). */}
      <span className={config.iconBox} aria-hidden="true">
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'
          }`}
        >
          <Icon name="light_mode" className={config.icon} />
        </span>
        <span
          className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${
            isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'
          }`}
        >
          <Icon name="dark_mode" className={config.icon} />
        </span>
        {/* In labelled rows the ripple pulses around the icon, not the whole pill. */}
        {config.labelled ? ripple : null}
      </span>

      {config.labelled ? (
        <span className="nn-theme-label">{isDark ? 'Light mode' : 'Dark mode'}</span>
      ) : null}

      {!config.labelled ? ripple : null}
    </button>
  );
};

export default ThemeToggle;
