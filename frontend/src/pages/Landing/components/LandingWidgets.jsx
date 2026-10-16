import { useRef, useState, useEffect, useCallback } from "react";
import {
  // eslint-disable-next-line no-unused-vars -- false positive: `motion` is used as <motion.*> JSX namespace throughout
  motion,
  AnimatePresence,
} from "framer-motion";
import { EASE_EXPO, NAV_LINKS } from "../landingData.js";

export const Icon = ({ name, className = "" }) => (
  <span
    className={`material-symbols-outlined select-none leading-none ${className}`}
  >
    {name}
  </span>
);

// Single restrained scroll reveal used by every section. One pattern,
// one timing — no staggered theatrics.
export const Reveal = ({ children, delay = 0, className = "" }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-40px" }}
    transition={{ duration: 0.5, delay, ease: EASE_EXPO }}
    className={className}
  >
    {children}
  </motion.div>
);

// Consistent section header: eyebrow, title, optional lede.
export const SectionHeader = ({ eyebrow, title, lede }) => (
  <div className="max-w-2xl">
    <Reveal>
      <p className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-[0.14em] mb-3">
        {eyebrow}
      </p>
    </Reveal>
    <Reveal delay={0.05}>
      <h2
        className="text-[var(--text-primary)] font-display font-extrabold tracking-tight text-balance text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15]"
      >
        {title}
      </h2>
    </Reveal>
    {lede && (
      <Reveal delay={0.1}>
        <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)]">
          {lede}
        </p>
      </Reveal>
    )}
  </div>
);

export const MobileMenu = ({ open, onClose, navigate }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="lg:hidden fixed inset-0 z-[99] bg-[var(--bg-overlay)]"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
      >
        <div
          className="absolute top-0 left-0 right-0 bg-[var(--bg-primary)] border-b border-[var(--border-light)] px-5 pt-24 pb-6 max-h-[calc(100dvh-1rem)] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <nav className="flex flex-col">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                onClick={onClose}
                className="py-3.5 text-[15px] font-semibold text-[var(--text-primary)] border-b border-[var(--border-light)] last:border-0"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <button
              onClick={() => {
                navigate("/login");
                onClose();
              }}
              className="py-3 rounded-lg text-[13px] font-bold text-[var(--text-primary)] border border-[var(--border-medium)]"
            >
              Sign in
            </button>
            <button
              onClick={() => {
                navigate("/register");
                onClose();
              }}
              className="py-3 rounded-lg bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[13px] font-bold"
            >
              Get started
            </button>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const FeatureCard = ({ icon, title, desc, index }) => (
  <Reveal delay={(index % 2) * 0.06} className="h-full">
    <div className="h-full bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl p-6 transition-colors hover:border-[var(--border-medium)]">
      <div className="w-10 h-10 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center mb-5">
        <Icon name={icon} className="text-[20px] text-[var(--accent)]" />
      </div>
      <h3
        className="text-[16px] font-bold text-[var(--text-primary)] mb-2 font-display"
      >
        {title}
      </h3>
      <p className="text-[14px] leading-relaxed text-[var(--text-muted)]">
        {desc}
      </p>
    </div>
  </Reveal>
);

// Swipeable product tour: one feature per slide, photo + copy.
// Native scroll-snap (no dependency), arrows + dots, edge-aware buttons.
export const FeatureCarousel = ({ features, shots }) => {
  const trackRef = useRef(null);
  const [index, setIndex] = useState(0);
  const total = features.length;

  const goTo = useCallback((i) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(total - 1, i));
    const slide = track.children[clamped];
    if (slide) slide.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  }, [total]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const first = track.children[0];
        // Include the flex gap (16px) in the slide stride — offsetWidth alone
        // ignores it, desyncing dots/arrows after slide 1.
        const gap = first && track.children[1]
          ? Math.max(0, track.children[1].offsetLeft - first.offsetLeft - first.offsetWidth)
          : 16;
        const w = (first?.offsetWidth || 1) + gap;
        setIndex(Math.max(0, Math.min(total - 1, Math.round(track.scrollLeft / w))));
        ticking = false;
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, [total]);

  return (
    <div>
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-5 px-5 sm:mx-0 sm:px-0 no-scrollbar"
      >
        {features.map((f, i) => {
          const shot = shots[i % shots.length];
          return (
            <article
              key={f.title}
              className="w-[85%] sm:w-[70%] lg:w-[calc(50%-0.5rem)] shrink-0 snap-start bg-[var(--bg-card)] border border-[var(--border-light)] rounded-2xl overflow-hidden"
            >
              <div className="relative">
                <img
                  src={shot.img}
                  alt={shot.alt}
                  loading="lazy"
                  className="w-full aspect-[16/9] object-cover"
                />
                <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/55 text-white text-[11px] font-bold tracking-wide backdrop-blur-sm">
                  {f.num} · {f.title}
                </span>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center shrink-0">
                    <Icon name={f.icon} className="text-[18px] text-[var(--accent)]" />
                  </div>
                  <h3
                    className="text-[16px] font-bold text-[var(--text-primary)] font-display"
                  >
                    {f.title}
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed text-[var(--text-muted)]">
                  {f.desc}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <div className="flex gap-1.5" role="tablist" aria-label="Feature slides">
          {features.map((f, i) => (
            <button
              key={f.title}
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to ${f.title}`}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === index ? "w-6 bg-[var(--accent)]" : "w-1.5 bg-[var(--border-medium)] hover:bg-[var(--text-muted)]"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => goTo(index - 1)}
            disabled={index === 0}
            aria-label="Previous feature"
            className="w-10 h-10 rounded-lg border border-[var(--border-medium)] flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[var(--border-medium)] disabled:hover:text-[var(--text-secondary)] transition-all"
          >
            <Icon name="chevron_left" className="text-[20px]" />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            disabled={index === total - 1}
            aria-label="Next feature"
            className="w-10 h-10 rounded-lg border border-[var(--border-medium)] flex items-center justify-center text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[var(--border-medium)] disabled:hover:text-[var(--text-secondary)] transition-all"
          >
            <Icon name="chevron_right" className="text-[20px]" />
          </button>
        </div>
      </div>
    </div>
  );
};
