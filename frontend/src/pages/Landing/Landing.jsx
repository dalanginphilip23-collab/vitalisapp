import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import { apiGet, apiPost } from "../../lib/apiClient.js";
import ThemeToggle from "../../components/ThemeToggle.jsx";
import {
  GYM_BG,
  FEATURES,
  STEPS,
  NAV_LINKS,
  formatCount,
} from "./landingData.js";
import {
  Icon,
  Reveal,
  SectionHeader,
  MobileMenu,
  FeatureCard,
} from "./components/LandingWidgets.jsx";
import { TermsOfUseModal, PrivacyPolicyModal } from "../../features/Auth/Register/components/LegalModals.jsx";

// Professional marketing page: Home + Features + About.
// Theme-aware (follows the app light/dark theme), system fonts only,
// one restrained reveal animation, no display type, no glow effects.
const Landing = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { user } = useAuth();
  const isAuthenticated = !!user?.id;
  const [legalView, setLegalView] = useState(null); // 'terms' | 'privacy' | null

  // Live backend status for the footer badge (falls back to "checking" offline)
  const [systemStatus, setSystemStatus] = useState("checking");
  // Real visitor count (unique IP-days, privacy-friendly). Null = still loading.
  const [visits, setVisits] = useState(null);
  // Real active users (verified accounts able to use the system). Null = loading.
  const [activeUsers, setActiveUsers] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      apiGet("/api/health", { timeoutMs: 8000 })
        .then(() => {
          if (!cancelled) setSystemStatus("operational");
        })
        .catch((e) => {
          if (!cancelled)
            setSystemStatus(
              e?.code === 'TIMEOUT' ||
                e?.code === 'UPSTREAM' ||
                e?.status === 0 ||
                e?.status === 502 ||
                e?.status === 503 ||
                e?.status === 504
                ? 'offline'
                : 'degraded',
            );
        });
      // Record one visit per browser session, then read back the real total.
      // Refresh-safe: UNIQUE(ip_hash, visit_date) dedupes on the backend.
      let shouldLog = true;
      try {
        shouldLog = !sessionStorage.getItem("vitalis:visitLogged");
      } catch { shouldLog = true; }
      const markLogged = () => {
        try { sessionStorage.setItem("vitalis:visitLogged", "1"); } catch { /* private mode */ }
      };
      const readTotal = () => {
        apiGet("/api/public/landing-stats", { timeoutMs: 8000, skipAuthRedirect: true })
          .then((d) => {
            if (cancelled) return;
            if (Number.isFinite(Number(d?.stats?.visits))) setVisits(Number(d.stats.visits));
            if (Number.isFinite(Number(d?.stats?.activeUsers))) setActiveUsers(Number(d.stats.activeUsers));
          })
          .catch(() => { /* offline — counts stay hidden */ });
      };
      if (shouldLog) {
        apiPost("/api/public/landing-visit", {}, { timeoutMs: 8000, skipAuthRedirect: true })
          .then((d) => {
            markLogged();
            if (!cancelled && Number.isFinite(Number(d?.visits))) setVisits(Number(d.visits));
            readTotal();
          })
          .catch(readTotal);
      } else {
        readTotal();
      }
    };
    let idleId = null;
    let timer = null;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      timer = setTimeout(run, 300);
    }
    return () => {
      cancelled = true;
      if (idleId && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const goPrimary = () => navigate(isAuthenticated ? "/dashboard" : "/register");

  const statusLabel =
    systemStatus === "operational" ? "All systems operational"
    : systemStatus === "checking" ? "Checking status…"
    : systemStatus === "offline" ? "Backend unreachable"
    : "Degraded — try again soon";

  return (
    <>
      <style>{`
        /* Landing-only dark-mode refinement. The global dark theme now uses
           the same muted leaf-green accent, so only Landing's neutral-gray
           text and image treatment are scoped here.
           Light theme already ships professional greens — no overrides needed. */
        :root:not(.light-theme) .landing-scope,
        .dark-theme .landing-scope {
          --text-secondary: #B9C0BB;
          --text-muted: #8E968F;
          --text-disabled: #6E7672;
        }
        :root:not(.light-theme) .landing-scope img,
        .dark-theme .landing-scope img { filter: saturate(0.92); }
      `}</style>
    <div
      className="landing-scope w-full min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-sans"
    >
      {/* ── Navigation ─────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-[100] border-b transition-colors ${
          scrolled
            ? "bg-[var(--glass-bg)] backdrop-blur-md border-[var(--border-light)]"
            : "bg-transparent border-transparent"
        }`}
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="flex items-center gap-2.5"
            aria-label="Vitalis home"
          >
            <img src="/pwa-192x192.png" alt="Vitalis logo" className="w-7 h-7 rounded-md" />
            <span
              className="text-[17px] font-extrabold tracking-tight font-display"
            >
              Vitalis
            </span>
          </button>

          <nav className="hidden lg:flex items-center gap-8" aria-label="Primary">
            {NAV_LINKS.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="text-[14px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <button
              onClick={() => navigate("/login")}
              className="hidden sm:block px-4 py-2 text-[14px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={goPrimary}
              className="hidden sm:block px-4 py-2 rounded-lg bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[14px] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
            >
              {isAuthenticated ? "Dashboard" : "Get started"}
            </button>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <Icon name={menuOpen ? "close" : "menu"} className="text-[22px]" />
            </button>
          </div>
        </div>
      </header>

      <MobileMenu open={menuOpen} onClose={closeMenu} navigate={navigate} />

      <main>
        {/* ── Home / hero ──────────────────────────────────────────── */}
        <section id="top" className="px-5 sm:px-8 pt-14 pb-16 sm:pt-20 sm:pb-24">
          <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div>
              <Reveal delay={0.05}>
                <h1
                  className="font-display font-extrabold tracking-tight text-balance text-[clamp(2.25rem,5vw,3.5rem)] leading-[1.1]"
                >
                  Training, meals, sleep, and runs — logged in one place.
                </h1>
              </Reveal>
              <Reveal delay={0.1}>
                <p className="mt-5 text-[16px] leading-relaxed text-[var(--text-muted)] max-w-xl">
                  Vitalis helps you log workouts, meals, sleep, and runs, then
                  turns those logs into readiness scores, trends, and training
                  plans. Manual-first, free, and yours.
                </p>
              </Reveal>
              <Reveal delay={0.15}>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={goPrimary}
                    className="px-6 py-3 rounded-lg bg-[var(--accent-solid)] text-[var(--accent-solid-fg)] text-[15px] font-semibold hover:bg-[var(--accent-hover)] transition-colors text-center"
                  >
                    {isAuthenticated ? "Open dashboard" : "Get started free"}
                  </button>
                  <a
                    href="#features"
                    className="px-6 py-3 rounded-lg border border-[var(--border-medium)] text-[15px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-center"
                  >
                    Explore features
                  </a>
                </div>
              </Reveal>
              <Reveal delay={0.2}>
                <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[var(--text-muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="check" className="text-[16px] text-[var(--accent)]" />
                    Free, no credit card
                  </span>
                  {visits !== null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="visibility" className="text-[16px] text-[var(--accent)]" />
                      {formatCount(visits)} site {visits === 1 ? "visit" : "visits"}
                    </span>
                  )}
                  {activeUsers !== null && (
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="group" className="text-[16px] text-[var(--accent)]" />
                      {formatCount(activeUsers)} active {activeUsers === 1 ? "user" : "users"}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5" title="Live backend status">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        systemStatus === "operational" ? "bg-[var(--accent)]"
                        : systemStatus === "checking" ? "bg-yellow-500"
                        : "bg-red-500"
                      }`}
                    />
                    {statusLabel}
                  </span>
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.1}>
              <figure className="relative mb-6 lg:mb-0">
                <div className="rounded-2xl overflow-hidden border border-[var(--border-light)] shadow-[var(--shadow-lg)]">
                  <img
                    src={GYM_BG}
                    alt="Athlete training with a barbell"
                    className="w-full aspect-[4/3] object-cover"
                    loading="eager"
                  />
                </div>
                <div className="absolute -bottom-5 left-4 right-4 sm:left-6 sm:right-auto sm:max-w-[calc(100%-3rem)] bg-[var(--bg-card)] border border-[var(--border-light)] rounded-xl shadow-[var(--shadow-md)] px-5 py-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-lg bg-[var(--accent-bg)] flex items-center justify-center shrink-0">
                    <Icon name="bedtime" className="text-[22px] text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-[var(--text-muted)]">Readiness today</p>
                    <p
                      className="text-[20px] font-extrabold text-[var(--text-primary)] leading-tight font-display"
                    >
                      82 <span className="text-[13px] font-semibold text-[var(--text-muted)]">/ 100 · Ready to train</span>
                    </p>
                  </div>
                </div>
              </figure>
            </Reveal>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────── */}
        <section id="features" className="px-5 sm:px-8 py-16 sm:py-24 bg-[var(--bg-secondary)] border-y border-[var(--border-light)] scroll-mt-16">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              eyebrow="Features"
              title="Your whole training loop, connected"
              lede="Four modules cover the full training loop. Each one reads from and writes to the same log, so nothing you enter is ever wasted."
            />
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 mt-10 sm:mt-12">
              {FEATURES.map((f, i) => (
                <FeatureCard key={f.title} {...f} index={i} />
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────── */}
        <section className="px-5 sm:px-8 py-16 sm:py-24">
          <div className="max-w-6xl mx-auto">
            <SectionHeader
              eyebrow="How it works"
              title="From signup to insights in three steps"
            />
            <ol className="grid sm:grid-cols-3 gap-4 sm:gap-5 mt-10 sm:mt-12 list-none p-0 m-0">
              {STEPS.map((s, i) => (
                <Reveal key={s.num} delay={i * 0.06} className="h-full">
                  <li className="h-full border border-[var(--border-light)] rounded-xl p-6 bg-[var(--bg-primary)]">
                    <p
                      className="text-[13px] font-extrabold text-[var(--accent)] mb-3 font-display"
                    >
                      {s.num}
                    </p>
                    <h3
                      className="text-[16px] font-bold text-[var(--text-primary)] mb-2 font-display"
                    >
                      {s.title}
                    </h3>
                    <p className="text-[14px] leading-relaxed text-[var(--text-muted)]">
                      {s.desc}
                    </p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ── About ────────────────────────────────────────────────── */}
        <section id="about" className="px-5 sm:px-8 py-16 sm:py-24 bg-[var(--bg-secondary)] border-t border-[var(--border-light)] scroll-mt-16">
          <div className="max-w-6xl mx-auto">
            <div className="max-w-2xl">
            <Reveal>
              <p className="text-[12px] font-bold text-[var(--accent)] uppercase tracking-[0.14em] mb-3">
                About
              </p>
            </Reveal>
            <Reveal delay={0.05}>
              <h2
                className="font-display font-extrabold tracking-tight text-balance text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15]"
              >
                A student-built tracker for people who log by hand
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 text-[15px] leading-relaxed text-[var(--text-muted)]">
                Vitalis is a student-built fitness companion for logging workouts,
                meals, sleep, and runs. Your entries turn into readiness scores,
                progress trends, and structured training plans — with a community
                feed and private messaging to keep you connected. Manual-first,
                free, and explainable: every insight traces back to data you
                logged yourself.
              </p>
            </Reveal>
            </div>
          </div>
        </section>

      </main>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-[var(--border-light)] bg-[var(--bg-secondary)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="py-10 sm:py-12">
            <div className="flex items-center gap-2.5 mb-3">
              <img src="/pwa-192x192.png" alt="Vitalis logo" className="w-7 h-7 rounded-md" />
              <span
                className="text-[17px] font-extrabold tracking-tight font-display"
              >
                Vitalis
              </span>
            </div>
            <p className="text-[14px] leading-relaxed text-[var(--text-muted)] max-w-sm">
              A student-built tracker for training, nutrition, and recovery.
            </p>
            <nav className="mt-5 flex items-center gap-2 text-[13px] font-medium text-[var(--text-muted)]" aria-label="Legal">
              <button
                onClick={() => setLegalView('terms')}
                className="hover:text-[var(--text-primary)] transition-colors"
              >
                Terms of Use
              </button>
              <span aria-hidden className="text-[var(--border-medium)]">·</span>
              <button
                onClick={() => setLegalView('privacy')}
                className="hover:text-[var(--text-primary)] transition-colors"
              >
                Privacy Policy
              </button>
            </nav>
          </div>

          <div className="h-px bg-[var(--border-light)]" />

          <div className="py-5 flex flex-row items-center justify-between gap-3">
            <p className="text-[13px] text-[var(--text-muted)]">
              © 2026 Vitalis Labs Inc.
            </p>
            <p className="inline-flex items-center gap-2 text-[13px] text-[var(--text-muted)]" title="Live backend status">
              <span
                className={`w-2 h-2 rounded-full ${
                  systemStatus === "operational" ? "bg-[var(--accent)]"
                  : systemStatus === "checking" ? "bg-yellow-500"
                  : "bg-red-500"
                }`}
              />
              {statusLabel}
            </p>
          </div>
        </div>
      </footer>

      <TermsOfUseModal isOpen={legalView === 'terms'} onClose={() => setLegalView(null)} />
      <PrivacyPolicyModal isOpen={legalView === 'privacy'} onClose={() => setLegalView(null)} />
    </div>
    </>
  );
};

export default Landing;
