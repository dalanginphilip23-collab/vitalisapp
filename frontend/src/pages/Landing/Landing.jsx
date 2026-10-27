import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.jsx";
import { apiGet, apiPost } from "../../lib/apiClient.js";
import { getInstallEvent, clearInstallEvent, subscribeToInstall, detectInstallPlatform } from "../../lib/pwaInstall.js";
import { TermsOfUseModal, PrivacyPolicyModal } from "../../features/user/Auth/Register/components/LegalModals.jsx";
import ThemeToggle from "../../components/ThemeToggle.jsx";

import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "./landing.css";

import { FEATURES, SERVICES, PLANS, FOOTER_LINKS, FOOTER_INFO, SUPPORT_INFO, NAV_LINKS, formatCount } from "./landingData.js";
import {
  Icon,
  Brand,
  Reveal,
  RoundArrowPair,
  PillCta,
  QrCode,
  HeroPhoneSet,
  DownloadPhoneSet,
  ProductTour,
  InstallStepsModal,
  FooterInfoModal,
  FooterLink,
} from "./components/LandingWidgets.jsx";

// Vitalis marketing home. The layout, typography, and component proportions
// are a close recreation of the supplied NEWME landing-page reference. The
// content and destinations come from Vitalis so every action remains real.
const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = !!user?.id;

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [legalView, setLegalView] = useState(null);
  const [footerInfo, setFooterInfo] = useState(null);
  const [systemStatus, setSystemStatus] = useState("checking");
  const [visits, setVisits] = useState(null);
  const [activeUsers, setActiveUsers] = useState(null);
  const [modules, setModules] = useState(null);
  const [manualLogPct, setManualLogPct] = useState(null);
  const [installEvent, setInstallEvent] = useState(null);
  // Manual-install instructions panel (null = closed). Shown when the browser
  // can't prompt: iPhone Safari, Firefox, or a prompt already used this visit.
  const [installHelp, setInstallHelp] = useState(null);
  // iPhone/iPad vs Android vs desktop. Used for the download CTA label and
  // the initial tab inside the install modal.
  const [installPlatform] = useState(() => detectInstallPlatform().kind);
  // True when the PWA is already running as an installed app (or the user just
  // accepted the install prompt). Then "Open on Home Screen" becomes a plain
  // open-dashboard action instead of trying to install again.
  const [installed, setInstalled] = useState(() => {
    try {
      return (
        typeof window !== "undefined" &&
        (window.matchMedia?.("(display-mode: standalone)")?.matches ||
          window.matchMedia?.("(display-mode: minimal-ui)")?.matches ||
          window.navigator?.standalone === true ||
          // Persisted install marker: set when the user accepts the install
          // prompt or appinstalled fires — the browser tab keeps it on later
          // visits, so returning users see "Installed — Open Vitalis" even
          // when they open the marketing page in a normal tab.
          window.localStorage?.getItem("vitalis:installed") === "1")
      );
    } catch {
      return false;
    }
  });
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const trackRef = useRef(null);

  const goPrimary = useCallback(() => {
    navigate(isAuthenticated ? "/dashboard" : "/register");
  }, [isAuthenticated, navigate]);

  const closeTour = useCallback(() => setTourOpen(false), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const openLegal = useCallback((view) => {
    setMenuOpen(false);
    setLegalView(view);
  }, []);

  const openFooterInfo = useCallback((item) => {
    setMenuOpen(false);
    const info = item.label === "Help & support" ? SUPPORT_INFO : FOOTER_INFO[item.label];
    if (info) setFooterInfo(info);
  }, []);

  const closeFooterInfo = useCallback(() => setFooterInfo(null), []);

  const closeInstallHelp = useCallback(() => setInstallHelp(null), []);

  const actOnFooterInfo = useCallback((info) => {
    setFooterInfo(null);
    if (info.email) {
      // Anchor click (not location.href) — mailto never pushes a history entry
      // and can't be swallowed by the SPA router or a PWA window.
      try {
        const anchor = document.createElement("a");
        anchor.href = `mailto:${info.email}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } catch {
        window.location.href = `mailto:${info.email}`;
      }
      return;
    }
    if (info.to) {
      navigate(info.to);
      return;
    }
    if (info.href) {
      window.setTimeout(() => {
        document.querySelector(info.href)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  }, [navigate]);

  // Real system status + real public visitor/member counts. These are the only
  // metrics shown as statistics anywhere on the page.
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      apiGet("/api/health", { timeoutMs: 8000 })
        .then(() => {
          if (!cancelled) setSystemStatus("operational");
        })
        .catch((error) => {
          if (!cancelled) {
            setSystemStatus(
              error?.code === "TIMEOUT" ||
                error?.code === "UPSTREAM" ||
                error?.status === 0 ||
                error?.status === 502 ||
                error?.status === 503 ||
                error?.status === 504
                ? "offline"
                : "degraded"
            );
          }
        });

      let shouldLog = true;
      try {
        shouldLog = !sessionStorage.getItem("vitalis:visitLogged");
      } catch {
        shouldLog = true;
      }
      const markLogged = () => {
        try {
          sessionStorage.setItem("vitalis:visitLogged", "1");
        } catch {
          /* private mode */
        }
      };
      const readTotal = () => {
        apiGet("/api/public/landing-stats", { timeoutMs: 8000, skipAuthRedirect: true })
          .then((data) => {
            if (cancelled) return;
            if (Number.isFinite(Number(data?.stats?.visits))) setVisits(Number(data.stats.visits));
            if (Number.isFinite(Number(data?.stats?.activeUsers))) setActiveUsers(Number(data.stats.activeUsers));
            if (Number.isFinite(Number(data?.stats?.modules))) setModules(Number(data.stats.modules));
            if (Number.isFinite(Number(data?.stats?.manualLogPct))) setManualLogPct(Number(data.stats.manualLogPct));
          })
          .catch(() => {
            /* offline — counts remain hidden */
          });
      };
      if (shouldLog) {
        apiPost("/api/public/landing-visit", {}, { timeoutMs: 8000, skipAuthRedirect: true })
          .then((data) => {
            markLogged();
            if (!cancelled && Number.isFinite(Number(data?.visits))) setVisits(Number(data.visits));
            readTotal();
          })
          .catch(readTotal);
      } else {
        readTotal();
      }
    };

    let idleId = null;
    let timer = null;
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      timer = window.setTimeout(run, 300);
    }
    return () => {
      cancelled = true;
      if (idleId && window.cancelIdleCallback) window.cancelIdleCallback(idleId);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) setMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const onPromptAvailable = (event) => {
      // beforeinstallprompt only fires when the app is NOT currently installed
      // (Chrome re-fires it after an uninstall) — so clear the stale marker.
      try {
        window.localStorage?.removeItem("vitalis:installed");
      } catch {
        /* private mode */
      }
      setInstalled(false);
      setInstallEvent(event);
    };
    const onInstalled = () => {
      try {
        window.localStorage?.setItem("vitalis:installed", "1");
      } catch {
        /* private mode */
      }
      setInstalled(true);
      setInstallEvent(null);
      setInstallHelp(null);
    };
    // ONE global beforeinstallprompt/appinstalled listener pair lives in
    // lib/pwaInstall.js (attached at boot so the event can't be missed before
    // hydration) — Landing just subscribes here. No duplicate listeners.
    const unsubscribe = subscribeToInstall((message) => {
      if (message?.type === "prompt-available") onPromptAvailable(message.event);
      else if (message?.type === "installed") onInstalled();
    });

    // Pick up a prompt that fired while the route was still hydrating.
    const early = getInstallEvent();
    if (early) onPromptAvailable(early);

    // Same-origin install check for users who installed earlier but are
    // browsing in a normal tab right now (Chrome Android 84+, desktop 140+).
    // Harmless no-op ([]) where unsupported (Safari, Firefox, older Chrome).
    let cancelled = false;
    try {
      if (typeof navigator.getInstalledRelatedApps === "function") {
        navigator
          .getInstalledRelatedApps?.()
          .then((apps) => {
            if (
              !cancelled &&
              Array.isArray(apps) &&
              apps.some((app) => app?.platform === "webapp")
            ) {
              setInstalled(true);
              setInstallEvent(null);
            }
          })
          .catch(() => {
            /* unsupported or not in scope */
          });
      }
    } catch {
      /* unavailable */
    }
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Platform-aware manual install steps shown when the native prompt is
  // unavailable (iPhone Safari, Firefox, unsupported desktop browsers).
  const openInstallHelp = useCallback(() => {
    setInstallHelp(detectInstallPlatform());
  }, []);

  // Carousel controls
  const syncCarousel = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    setCanPrev(track.scrollLeft > 6);
    setCanNext(track.scrollLeft < max - 6);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    syncCarousel();
    track.addEventListener("scroll", syncCarousel, { passive: true });
    window.addEventListener("resize", syncCarousel);
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncCarousel) : null;
    observer?.observe(track);
    return () => {
      track.removeEventListener("scroll", syncCarousel);
      window.removeEventListener("resize", syncCarousel);
      observer?.disconnect();
    };
  }, [syncCarousel]);

  const moveCarousel = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector(".nn-feature-card");
    if (!card) return;
    const styles = window.getComputedStyle(track);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: "smooth" });
  };

  const handleInstall = async () => {
    // Already installed (or running standalone): just open the app.
    if (installed) {
      navigate(isAuthenticated ? "/dashboard" : "/login");
      return "installed";
    }
    if (installEvent) {
      try {
        installEvent.prompt();
      } catch {
        setInstallEvent(null);
        clearInstallEvent();
        openInstallHelp();
        return "unavailable";
      }
      const choice = await installEvent.userChoice.catch(() => null);
      setInstallEvent(null);
      // Prompt is single-use per page load — keep the module state in sync.
      clearInstallEvent();
      if (choice?.outcome === "accepted") {
        try {
          window.localStorage?.setItem("vitalis:installed", "1");
        } catch {
          /* private mode */
        }
        setInstalled(true);
        setInstallHelp(null);
        return "accepted";
      }
      // Dismissed — no fake success; offer the manual steps instead.
      openInstallHelp();
      return "dismissed";
    }
    // No prompt available (iPhone Safari, Firefox, or already used this
    // session): show manual instructions here instead of navigating away.
    openInstallHelp();
    return "unavailable";
  };

  const registerUrl =
    typeof window !== "undefined" ? `${window.location.origin}/register` : "/register";

  const statusLabel =
    systemStatus === "operational"
      ? "All systems operational"
      : systemStatus === "checking"
        ? "Checking status…"
        : systemStatus === "offline"
          ? "Backend unreachable"
          : "Degraded — try again soon";

  const statusClass =
    systemStatus === "operational"
      ? ""
      : systemStatus === "checking"
        ? " is-warn"
        : " is-error";

  const stats = [
    { value: visits == null ? "—" : formatCount(visits), label: "Site visits" },
    { value: activeUsers == null ? "—" : formatCount(activeUsers), label: "Active members" },
    { value: modules == null ? "—" : formatCount(modules), label: "Integrated modules" },
    { value: manualLogPct == null ? "—" : `${manualLogPct}%`, label: "Manual-first logging" },
  ];

  return (
    <div className="nn-root" id="top">
      <header className={`nn-header ${scrolled ? "is-scrolled" : ""}`}>
        <div className="nn-frame nn-header-inner">
          <Brand />
          <nav className="nn-nav" aria-label="Primary">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="nn-nav-link">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="nn-header-actions">
            <ThemeToggle variant="landing" />
            <button type="button" className="nn-contact" onClick={goPrimary}>
              {isAuthenticated ? "Dashboard" : "Get Started"}
            </button>
            <button
              type="button"
              className="nn-menu-toggle"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="landing-mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <Icon name={menuOpen ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className="nn-hero" aria-labelledby="landing-hero-title">
          <div className="nn-frame">
            <div className="nn-hero-inner">
              <div className="nn-hero-copy">
                <Reveal>
                  <h1 id="landing-hero-title" className="nn-display nn-hero-title">
                    <span className="nn-line">Your Health,</span>
                    <span className="nn-line">
                      Our App<span className="nn-lime-dot" aria-hidden="true" />
                    </span>
                  </h1>
                </Reveal>
                <Reveal delay={0.06}>
                  <p className="nn-lede">
                    Training, nutrition, and recovery in one place. Vitalis turns the
                    workouts, meals, sleep, and runs you log into clear readiness
                    scores, trends, and plans — free and manual-first.
                  </p>
                </Reveal>
                <Reveal delay={0.1}>
                  <div className="nn-hero-cta-row">
                    <PillCta onClick={goPrimary}>
                      {isAuthenticated ? "Open Dashboard" : "Join Us Now"}
                    </PillCta>
                  </div>
                </Reveal>

                <Reveal delay={0.14}>
                  <div className="nn-download-card">
                    <a
                      className="nn-qr"
                      href={registerUrl}
                      aria-label="Open the Vitalis registration page"
                    >
                      <QrCode />
                    </a>
                    <div className="nn-download-top">
                      <h3>Install Our App</h3>
                      <button
                        type="button"
                        className="nn-mini-arrow"
                        onClick={goPrimary}
                        aria-label={isAuthenticated ? "Open dashboard" : "Create an account"}
                      >
                        <Icon name="arrow_forward" />
                      </button>
                    </div>
                    <div>
                      <p className="nn-download-note">
                        Scan the code to create a free account and add Vitalis to
                        your home screen.
                      </p>
                      <div className="nn-download-stats">
                        <div className="nn-download-stat">
                          <strong>{modules == null ? "—" : modules}</strong>
                          <span>App<br />modules</span>
                        </div>
                        <div className="nn-download-stat">
                          <strong>Free</strong>
                          <span>To get<br />started</span>
                        </div>
                        <div className="nn-avatars" aria-hidden="true">
                          <span
                            className="nn-avatar"
                            style={{ backgroundImage: "url('/landing/hero-dumbbell.jpg')" }}
                          />
                          <span
                            className="nn-avatar"
                            style={{ backgroundImage: "url('/landing/service-nutrition.jpg')" }}
                          />
                          <span
                            className="nn-avatar"
                            style={{ backgroundImage: "url('/landing/service-hydration.jpg')" }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>

              <div className="nn-hero-orbit">
                <div className="nn-hero-panel" aria-hidden="true" />
                <HeroPhoneSet />
                <img
                  className="nn-hero-photo"
                  src="/auth-gym.jpg"
                  alt=""
                  aria-hidden="true"
                  fetchPriority="high"
                />
                <button type="button" className="nn-play" onClick={() => setTourOpen(true)}>
                  <span className="nn-play-ring">
                    <Icon name="play_arrow" />
                  </span>
                  <span className="nn-play-label">See How It Works</span>
                </button>
                <p className="nn-hero-panel-copy">
                  Real-time reps and form feedback, right in your browser.
                </p>
                <div className="nn-available-card">
                  <p>Your health plan, on every device.</p>
                  <a href="#download">
                    Open Vitalis
                    <span className="nn-available-arrow">
                      <Icon name="arrow_forward" />
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="nn-stats-wrap">
            <div className="nn-frame">
              <Reveal>
                <div className="nn-stats" aria-label="Vitalis at a glance">
                  {stats.map((stat) => (
                    <div className="nn-stat" key={stat.label}>
                      <strong>{stat.value}</strong>
                      <span>{stat.label}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ── Features ──────────────────────────────────────────────────── */}
        <section id="features" className="nn-section nn-features" aria-labelledby="features-heading">
          <div className="nn-frame">
            <div className="nn-section-head">
              <Reveal>
                <h2 id="features-heading" className="nn-h2">
                  Everything You Need<br />To Keep Moving
                </h2>
              </Reveal>
              <div className="nn-section-aside">
                <Reveal delay={0.06}>
                  <p className="nn-lede">
                    Four modules work as one system. Each reads from and writes to
                    the same daily log, so nothing you track is ever wasted.
                  </p>
                </Reveal>
                <Reveal delay={0.1}>
                  <RoundArrowPair
                    onPrev={() => moveCarousel(-1)}
                    onNext={() => moveCarousel(1)}
                    prevDisabled={!canPrev}
                    nextDisabled={!canNext}
                    prevLabel="Previous features"
                    nextLabel="Next features"
                  />
                </Reveal>
              </div>
            </div>

            <div
              className="nn-feature-track"
              ref={trackRef}
              role="region"
              aria-roledescription="carousel"
              aria-label="Vitalis features"
            >
              {FEATURES.map((feature) => (
                <article
                  key={feature.title}
                  className={`nn-feature-card ${feature.featured ? "is-featured" : ""}`}
                >
                  <div className="nn-feature-icon">
                    <Icon name={feature.icon} />
                  </div>
                  <div className="nn-feature-spacer" />
                  <h3>{feature.title}</h3>
                  <p>{feature.desc}</p>
                  {feature.featured && (
                    <button type="button" className="nn-discover" onClick={goPrimary}>
                      Discover More
                    </button>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ── Services / about the toolkit ──────────────────────────────── */}
        <section id="about" className="nn-section nn-services" aria-labelledby="services-heading">
          <div className="nn-frame">
            <div className="nn-section-head">
              <Reveal>
                <h2 id="services-heading" className="nn-h2">
                  The Whole Toolkit<br />Inside Vitalis
                </h2>
              </Reveal>
              <Reveal delay={0.06}>
                <p className="nn-lede">
                  Nutrition, movement, sleep, and recovery are treated as one
                  routine. Every screen is built around the data you actually log,
                  not a generic dashboard.
                </p>
              </Reveal>
            </div>
            <div className="nn-service-grid">
              {SERVICES.map((service, index) => (
                <Reveal key={service.title} delay={index * 0.05}>
                  <Link className="nn-service-card" to={service.to} aria-label={`${service.title} — open in Vitalis`}>
                    <div className={`nn-service-media tone-${service.tone}`}>
                      <img src={service.img} alt={service.alt} loading="lazy" />
                    </div>
                    <div className="nn-service-title-row">
                      <h3>{service.title}</h3>
                      <span className="nn-service-arrow">
                        <Icon name="arrow_forward" />
                      </span>
                    </div>
                    <p>{service.desc}</p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ───────────────────────────────────────────────────── */}
        <section id="pricing" className="nn-section" aria-labelledby="pricing-heading">
          <div className="nn-frame">
            <div className="nn-section-head">
              <Reveal>
                <h2 id="pricing-heading" className="nn-h2">
                  One Simple Plan<br />Free For Everyone
                </h2>
              </Reveal>
              <Reveal delay={0.06}>
                <p className="nn-lede">
                  No trial timer, no credit card, and no locked features. Start
                  with everything Vitalis offers and keep every insight you earn.
                </p>
              </Reveal>
            </div>
            <div className="nn-pricing-grid">
              {PLANS.map((plan, index) => (
                <Reveal key={plan.title} delay={index * 0.05}>
                  <Link className="nn-plan-card" to={plan.to}>
                    <div className="nn-plan-top">
                      <span className="nn-plan-num">{plan.num}</span>
                      <h3>{plan.title}</h3>
                      <p>{plan.desc}</p>
                    </div>
                    <div className="nn-plan-footer">
                      <span>
                        <span className="nn-plan-price-label">{plan.label}</span>
                        <span className="nn-plan-price">{plan.price}</span>
                      </span>
                      <span className="nn-plan-arrow">
                        <Icon name="arrow_forward" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ── Download ──────────────────────────────────────────────────── */}
        <section id="download" className="nn-section nn-download-section" aria-labelledby="download-heading">
          <div className="nn-frame">
            <Reveal>
              <div className="nn-download-panel">
                <div className="nn-download-copy">
                  <h2 id="download-heading">
                    Available Wherever<br />You Train
                  </h2>
                  <div className="nn-store-row">
                    <button type="button" className="nn-store-badge is-lime" onClick={handleInstall}>
                      <Icon
                        name={
                          installed
                            ? "check_circle"
                            : installPlatform === "ios"
                              ? "add_to_home_screen"
                              : "download"
                        }
                      />
                      <span className="nn-store-copy">
                        <small>
                          {installEvent
                            ? "Install now"
                            : installed
                              ? "Installed —"
                              : installPlatform === "ios"
                                ? "Open on"
                                : "Download"}
                        </small>
                        <strong>
                          {installed
                            ? "Open Vitalis"
                            : installPlatform === "ios"
                              ? "Home Screen"
                              : "Vitalis app"}
                        </strong>
                      </span>
                    </button>
                    <button type="button" className="nn-store-badge is-outline" onClick={goPrimary}>
                      <Icon name="language" />
                      <span className="nn-store-copy">
                        <small>Works on</small>
                        <strong>Any browser</strong>
                      </span>
                    </button>
                  </div>
                </div>
                <div className="nn-download-art">
                  <DownloadPhoneSet />
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="nn-footer">
        <div className="nn-frame">
          <div className="nn-footer-main">
            <div className="nn-footer-brand">
              <Brand />
              <p>
                A student-built fitness companion for training, nutrition, and
                recovery. Every insight traces back to something you logged.
              </p>
            </div>

            {FOOTER_LINKS.map((group) => (
              <nav className="nn-footer-col" key={group.title} aria-label={group.title}>
                <h3>{group.title}</h3>
                <div className="nn-footer-links">
                  {group.links.map((item) => (
                    <FooterLink item={item} key={item.label} onLegal={openLegal} onInfo={openFooterInfo} />
                  ))}
                </div>
              </nav>
            ))}

            <div className="nn-footer-action">
              <PillCta onClick={goPrimary}>
                {isAuthenticated ? "Dashboard" : "Join Us Now"}
              </PillCta>
              <div className="nn-socials">
                <button
                  type="button"
                  className="nn-social"
                  aria-label="Contact customer service"
                  title="Contact customer service"
                  onClick={() => setFooterInfo(SUPPORT_INFO)}
                >
                  <Icon name="support_agent" />
                </button>
                <button
                  type="button"
                  className="nn-social"
                  aria-label="Terms of Use"
                  onClick={() => openLegal("terms")}
                >
                  <Icon name="description" />
                </button>
                <button
                  type="button"
                  className="nn-social"
                  aria-label="Privacy Policy"
                  onClick={() => openLegal("privacy")}
                >
                  <Icon name="shield" />
                </button>
              </div>
            </div>
          </div>

          <div className="nn-footer-bottom">
            <div className="nn-footer-bottom-left">
              <span>© 2026 Vitalis Labs</span>
              <button type="button" onClick={() => openLegal("terms")}>Terms of Use</button>
              <button type="button" onClick={() => openLegal("privacy")}>Privacy Policy</button>
            </div>
            <div className="nn-footer-bottom-right">
              <span className="nn-status" title="Live backend status" aria-live="polite">
                <span className={`nn-status-dot${statusClass}`} />
                {statusLabel}
              </span>
            </div>
          </div>
        </div>
      </footer>

      {menuOpen && (
        <div
          className="nn-mobile-menu"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeMenu();
          }}
        >
          <div
            className="nn-mobile-sheet"
            id="landing-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
          >
            <div className="nn-mobile-top">
              <Brand href="#top" />
              <button type="button" className="nn-mobile-close" onClick={closeMenu} aria-label="Close menu">
                <Icon name="close" />
              </button>
            </div>
            <nav className="nn-mobile-links" aria-label="Mobile primary">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} onClick={closeMenu}>
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="nn-mobile-actions">
              <ThemeToggle variant="landing-mobile" />
              <button
                type="button"
                className="nn-mobile-signin"
                onClick={() => {
                  closeMenu();
                  navigate("/login");
                }}
              >
                Sign in
              </button>
              <button
                type="button"
                className="nn-contact"
                onClick={() => {
                  closeMenu();
                  goPrimary();
                }}
              >
                {isAuthenticated ? "Open Dashboard" : "Get Started"}
              </button>
            </div>
          </div>
        </div>
      )}

      {tourOpen && (
        <ProductTour
          open={tourOpen}
          onClose={closeTour}
          onPrimary={() => {
            closeTour();
            goPrimary();
          }}
          isAuthenticated={isAuthenticated}
        />
      )}

      <InstallStepsModal
        key={installHelp ? `${installHelp.kind}-${installHelp.inSafari ? "safari" : "other"}` : "closed"}
        help={installHelp}
        onClose={closeInstallHelp}
        onInstall={handleInstall}
        canAutoInstall={!!installEvent}
        onPrimary={() => {
          closeInstallHelp();
          goPrimary();
        }}
        isAuthenticated={isAuthenticated}
      />

      <FooterInfoModal info={footerInfo} onClose={closeFooterInfo} onAction={actOnFooterInfo} />

      <TermsOfUseModal isOpen={legalView === "terms"} onClose={() => setLegalView(null)} />
      <PrivacyPolicyModal isOpen={legalView === "privacy"} onClose={() => setLegalView(null)} />
    </div>
  );
};

export default Landing;
