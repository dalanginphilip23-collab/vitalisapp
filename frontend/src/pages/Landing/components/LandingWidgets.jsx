import { useEffect, useRef, useState } from "react";

export const Icon = ({ name, className = "", style }) => (
  <span
    aria-hidden="true"
    className={`material-symbols-outlined select-none leading-none ${className}`}
    style={style}
  >
    {name}
  </span>
);

export const Brand = ({ href = "#top" }) => (
  <a className="nn-brand" href={href} aria-label="Vitalis home">
    <svg
      className="nn-brand-mark"
      viewBox="0 0 32 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M0 0H10.7L16 21.1L21.3 0H32L20.9 36H11.1L0 0Z" fill="#CDFB47" />
    </svg>
    <span className="nn-brand-word">ITALIS</span>
  </a>
);

// Single restrained reveal used across the page. Content stays visible when
// IntersectionObserver is unavailable or the visitor prefers reduced motion.
export const Reveal = ({ children, className = "", delay = 0 }) => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    );
  });

  useEffect(() => {
    const node = ref.current;
    if (!node || visible) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0.05 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div
      ref={ref}
      className={`nn-reveal ${visible ? "is-visible" : ""} ${className}`.trim()}
      style={{ transitionDelay: visible ? `${delay}s` : "0s" }}
    >
      {children}
    </div>
  );
};

export const RoundArrowPair = ({ onPrev, onNext, prevDisabled, nextDisabled, prevLabel, nextLabel }) => (
  <div className="nn-arrow-pair">
    <button
      type="button"
      className="nn-round-button"
      onClick={onPrev}
      disabled={prevDisabled}
      aria-label={prevLabel}
    >
      <Icon name="arrow_back" />
    </button>
    <button
      type="button"
      className="nn-round-button is-primary"
      onClick={onNext}
      disabled={nextDisabled}
      aria-label={nextLabel}
    >
      <Icon name="arrow_forward" />
    </button>
  </div>
);

export const PillCta = ({ children, onClick, href, type = "button", className = "" }) => {
  const content = (
    <>
      <span>{children}</span>
      <span className="nn-arrow-bubble">
        <Icon name="arrow_forward" />
      </span>
    </>
  );
  if (href) {
    return (
      <a href={href} className={`nn-pill-cta ${className}`.trim()}>
        {content}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} className={`nn-pill-cta ${className}`.trim()}>
      {content}
    </button>
  );
};

// QR slot rules:
//  • PRIMARY_SRC is where the real QR will live: frontend/public/landing/qr-code.png.
//    Drop that file in before shipping production and this slot shows it — no
//    code changes needed.
//  • While qr-code.png is absent (404 / non-image response), onError swaps to
//    the styled template placeholder so the layout never breaks or goes blank.
const QR_PRIMARY_SRC = "/landing/qr-code.png";
const QR_PLACEHOLDER_SRC = "/landing/qr-code-placeholder.svg";

export const QrCode = () => {
  const [src, setSrc] = useState(QR_PRIMARY_SRC);
  const handleError = () => {
    if (src !== QR_PLACEHOLDER_SRC) setSrc(QR_PLACEHOLDER_SRC);
  };
  return (
    <img
      src={src}
      onError={handleError}
      width={124}
      height={124}
      alt="QR code linking to the Vitalis app"
      loading="eager"
      decoding="async"
    />
  );
};

const PhoneStatus = () => (
  <div className="nn-phone-status">
    <span>9:41</span>
    <span className="nn-phone-status-bars">▮▮▮</span>
  </div>
);

const MiniArrow = () => <Icon name="arrow_forward" style={{ fontSize: "1em" }} />;

// Compact versions of the two primary Vitalis screens. Typography, surface
// colours and components mirror the real dashboard and meal tracker.
export const HeroPhoneSet = () => (
  <div className="nn-phone-set" aria-hidden="true">
    <div className="nn-phone nn-phone-a">
      <div className="nn-phone-screen u-screen">
        <PhoneStatus />
        <div className="u-top">
          <span className="u-avatar" />
          <span className="u-greeting">
            <small>Morning</small>
            <strong>Welcome back</strong>
          </span>
          <span className="u-icon-btn"><Icon name="notifications" /></span>
        </div>

        <div className="u-hero">
          <div className="u-hero-media" />
          <div className="u-hero-inner">
            <span className="u-chip">Today · Goal</span>
            <strong className="u-hero-value">
              1,960<small>kcal remaining today</small>
            </strong>
            <div className="u-hero-meta">
              <span><Icon name="restaurant" />450 eaten</span>
              <span><Icon name="local_fire_department" />310 burned</span>
            </div>
            <span className="u-btn">Log activity <MiniArrow /></span>
          </div>
        </div>

        <div className="u-card u-weekly">
          <div className="u-card-head">
            <strong>Weekly Activity</strong>
            <em>155 min</em>
          </div>
          <div className="u-bars">
            {[42, 68, 28, 84, 56, 95, 62].map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} className={index === 5 ? "is-today" : ""} />
            ))}
          </div>
          <div className="u-days">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span key={index} className={index === 5 ? "is-today" : ""}>{day}</span>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div className="nn-phone nn-phone-b">
      <div className="nn-phone-screen u-screen">
        <PhoneStatus />
        <div className="u-top u-top-title">
          <span className="u-page-title">Nutrition</span>
          <span className="u-icon-btn"><Icon name="photo_camera" /></span>
        </div>

        <div className="u-week">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span key={index} className={index === 5 ? "is-active" : ""}>
              <small>{day}</small>
              <strong>{22 + index}</strong>
            </span>
          ))}
        </div>

        <div className="u-card u-summary">
          <div className="u-ring">
            <strong>450</strong>
            <span>of 1,960 kcal</span>
          </div>
          <div className="u-macro-list">
            {[
              { label: "Protein", value: "45 / 140g", pct: 38 },
              { label: "Carbs", value: "52 / 220g", pct: 28 },
              { label: "Fat", value: "14 / 65g", pct: 24 },
            ].map((macro) => (
              <div className="u-macro" key={macro.label}>
                <div className="u-macro-top"><span>{macro.label}</span><strong>{macro.value}</strong></div>
                <div className="u-progress"><span style={{ width: `${macro.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="u-scan">
          <span className="u-scan-icon"><Icon name="photo_camera" /></span>
          <span><strong>Log a meal</strong><small>Scan or add by hand</small></span>
          <span className="u-arrow"><MiniArrow /></span>
        </div>

        <div className="u-card u-meals">
          <div className="u-card-head">
            <strong>Today&apos;s meals</strong>
            <em>See all</em>
          </div>
          <div className="u-meal-row">
            <span className="u-meal-thumb" />
            <span className="u-meal-copy"><strong>Breakfast</strong><small>Oats · berries · yogurt</small></span>
            <strong className="u-meal-kcal">420</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const DownloadPhoneStatus = () => (
  <div className="nn-phone-status">
    <span>9:41</span>
    <span className="nn-phone-status-bars">▮▮▮</span>
  </div>
);

// Larger previews used inside the dark install panel. Same screens, expanded
// to the real dashboard/widget proportions used in the app.
export const DownloadPhoneSet = () => (
  <div className="nn-phone-stage" aria-hidden="true">
    <div className="nn-download-phone nn-download-phone-a">
      <div className="nn-download-screen u-lg u-screen">
        <DownloadPhoneStatus />
        <div className="u-lg-top">
          <span className="u-lg-back"><Icon name="arrow_back" /></span>
          <span className="u-lg-page-title">Meal Tracker</span>
          <span className="u-icon-btn"><Icon name="notifications" /></span>
        </div>
        <p className="u-lg-eyebrow">Nutrition</p>
        <div className="u-lg-week">
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
            <span key={index} className={index === 5 ? "is-active" : ""}>
              <small>{day}</small>
              <strong>{22 + index}</strong>
            </span>
          ))}
        </div>
        <div className="u-lg-card u-lg-summary">
          <div className="u-lg-ring">
            <strong>450</strong>
            <span>of 1,960 kcal</span>
          </div>
          <div className="u-lg-macros">
            {[
              { label: "Protein", value: "45/140g", pct: 38 },
              { label: "Carbs", value: "52/220g", pct: 28 },
              { label: "Fat", value: "14/65g", pct: 24 },
            ].map((macro) => (
              <div className="u-lg-macro" key={macro.label}>
                <span>{macro.label}</span>
                <strong>{macro.value}</strong>
                <div className="u-progress"><span style={{ width: `${macro.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="u-lg-scan">
          <span className="u-lg-scan-icon"><Icon name="photo_camera" /></span>
          <span><strong>Log a meal</strong><small>Camera scan or manual entry</small></span>
          <span className="u-lg-arrow"><MiniArrow /></span>
        </div>
        <div className="u-lg-section-head"><span>Today&apos;s meals</span><small>See all</small></div>
        <div className="u-lg-meal">
          <span className="u-lg-meal-thumb" />
          <span><strong>Breakfast</strong><small>Oats · berries · yogurt</small></span>
          <strong className="u-lg-kcal">420</strong>
        </div>
        <div className="u-lg-meal">
          <span className="u-lg-meal-thumb is-lunch" />
          <span><strong>Lunch</strong><small>Chicken · rice · greens</small></span>
          <strong className="u-lg-kcal">610</strong>
        </div>
      </div>
    </div>

    <div className="nn-download-phone nn-download-phone-b">
      <div className="nn-download-screen u-lg u-screen">
        <DownloadPhoneStatus />
        <div className="u-lg-top">
          <span className="u-lg-avatar" />
          <span className="u-greeting">
            <small>Morning</small>
            <strong>Welcome back</strong>
          </span>
          <span className="u-icon-btn"><Icon name="notifications" /></span>
        </div>
        <div className="u-lg-hero">
          <div className="u-lg-hero-media" />
          <div className="u-lg-hero-inner">
            <span className="u-chip">Today · Goal</span>
            <strong className="u-hero-value">
              1,960<small>kcal remaining today</small>
            </strong>
            <div className="u-hero-meta">
              <span><Icon name="restaurant" />450 eaten</span>
              <span><Icon name="local_fire_department" />310 burned</span>
              <span><Icon name="timer" />25 / 45 min</span>
            </div>
            <div className="u-lg-hero-actions">
              <span className="u-btn">Log activity <MiniArrow /></span>
              <span className="u-btn is-ghost"><Icon name="fitness_center" /> Start workout</span>
            </div>
          </div>
        </div>
        <div className="u-lg-card">
          <div className="u-card-head">
            <strong>Weekly Activity</strong>
            <em>155 min</em>
          </div>
          <div className="u-lg-bars">
            {[38, 63, 22, 80, 51, 94, 57].map((height, index) => (
              <span key={index} style={{ height: `${height}%` }} className={index === 5 ? "is-today" : ""} />
            ))}
          </div>
          <div className="u-days">
            {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => (
              <span key={index} className={index === 5 ? "is-today" : ""}>{day}</span>
            ))}
          </div>
        </div>
        <div className="u-lg-section-head"><span>Today&apos;s Plan</span><small>Goal</small></div>
        <div className="u-lg-plan">
          {[
            { icon: "restaurant", label: "Calories", value: "450 / 2,410", pct: 19 },
            { icon: "fitness_center", label: "Workout", value: "25 / 45 min", pct: 56 },
            { icon: "water_drop", label: "Water", value: "1.8 / 2.5 L", pct: 72 },
          ].map((row) => (
            <div className="u-lg-plan-row" key={row.label}>
              <span className="u-lg-plan-icon"><Icon name={row.icon} /></span>
              <span className="u-lg-plan-copy">
                <span><small>{row.label}</small><strong>{row.value}</strong></span>
                <span className="u-progress"><span style={{ width: `${row.pct}%` }} /></span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export const ProductTour = ({ open, onClose, onPrimary, isAuthenticated }) => {
  const closeRef = useRef(null);
  const [step, setStep] = useState(0);
  const steps = [
    {
      icon: "restaurant",
      kicker: "01 · Nutrition",
      title: "Log a meal in seconds",
      copy: "Add food by hand or use a photo to estimate macros. Calories, protein, carbs, and fats all land in the same daily log.",
    },
    {
      icon: "fitness_center",
      kicker: "02 · Training",
      title: "Move with live feedback",
      copy: "Guided camera workouts count your reps and surface form cues in real time, with every session saved to your history.",
    },
    {
      icon: "insights",
      kicker: "03 · Progress",
      title: "See the whole picture",
      copy: "Readiness, trends, plans, and your complete timeline update from the data you already logged. No manual reports.",
    },
  ];
  const active = steps[step];

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 30);
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="nn-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="nn-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nn-tour-title"
      >
        <div className="nn-modal-top">
          <p className="nn-modal-eyebrow">A quick look inside Vitalis</p>
          <button
            ref={closeRef}
            type="button"
            className="nn-modal-close"
            onClick={onClose}
            aria-label="Close product tour"
          >
            <Icon name="close" />
          </button>
        </div>
        <h2 id="nn-tour-title">One app.<br />Your whole day.</h2>

        <div className="nn-tour">
          <div className="nn-tour-visual">
            <Icon name={active.icon} />
            <small>{active.kicker}</small>
          </div>
          <div className="nn-tour-copy">
            <div className="nn-tour-steps" aria-label={`Step ${step + 1} of ${steps.length}`}>
              {steps.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  className={`nn-tour-step ${index === step ? "is-active" : ""}`}
                  onClick={() => setStep(index)}
                  aria-label={`Show ${item.title}`}
                  aria-current={index === step ? "step" : undefined}
                />
              ))}
            </div>
            <h3>{active.title}</h3>
            <p>{active.copy}</p>
          </div>
        </div>

        <div className="nn-tour-actions">
          <button type="button" className="nn-tour-cta" onClick={onPrimary}>
            <span>{isAuthenticated ? "Open dashboard" : "Start free"}</span>
            <span><Icon name="arrow_forward" /></span>
          </button>
          <div className="nn-tour-nav">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
              style={{ opacity: step === 0 ? 0.4 : 1 }}
            >
              Back
            </button>
            {step < steps.length - 1 ? (
              <button type="button" onClick={() => setStep((current) => current + 1)}>
                Next <Icon name="arrow_forward" style={{ fontSize: 16 }} />
              </button>
            ) : (
              <button type="button" onClick={onClose}>Done</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const FooterInfoModal = ({ info, onClose, onAction }) => {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!info) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 40);
    const handleKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey);
      window.clearTimeout(focusTimer);
    };
  }, [info, onClose]);

  if (!info) return null;

  return (
    <div
      className="nn-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="nn-modal nn-info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nn-info-title"
      >
        <div className="nn-modal-top">
          <p className="nn-modal-eyebrow">Vitalis · {info.group || "Product"}</p>
          <button
            ref={closeRef}
            type="button"
            className="nn-modal-close"
            onClick={onClose}
            aria-label="Close this panel"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="nn-info-heading">
          <span className="nn-info-icon" aria-hidden="true">
            <Icon name={info.icon || "north_east"} />
          </span>
          <h2 id="nn-info-title">{info.title}</h2>
        </div>

        <p className="nn-info-description">{info.description}</p>

        {info.points?.length ? (
          <ul className="nn-info-points">
            {info.points.map((point) => (
              <li key={point}>
                <span aria-hidden="true"><Icon name="check" /></span>
                {point}
              </li>
            ))}
          </ul>
        ) : null}

        {info.email ? (
          <a className="nn-info-email" href={`mailto:${info.email}`}>
            <span className="nn-info-email-icon" aria-hidden="true"><Icon name="mail" /></span>
            <span className="nn-info-email-copy">
              <small>Customer service</small>
              <strong>{info.email}</strong>
            </span>
            <span className="nn-info-email-arrow" aria-hidden="true"><Icon name="north_east" /></span>
          </a>
        ) : null}

        <div className="nn-info-actions">
          {info.email ? (
            // Native mailto anchor: the most reliable way to hand off to the
            // OS mail client (works in browsers + PWA windows). The sheet
            // closes on click; the default mailto action is NOT prevented.
            <a className="nn-info-primary" href={`mailto:${info.email}`} onClick={onClose}>
              <span>{info.ctaLabel || "Continue"}</span>
              <span aria-hidden="true"><Icon name="mail" /></span>
            </a>
          ) : (
            <button
              type="button"
              className="nn-info-primary"
              onClick={() => onAction(info)}
            >
              <span>{info.ctaLabel || "Continue"}</span>
              <span aria-hidden="true"><Icon name="arrow_forward" /></span>
            </button>
          )}
          <button type="button" className="nn-info-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const FooterLink = ({ item, onInfo, onLegal }) => {
  if (item.legal) {
    return <button type="button" onClick={() => onLegal(item.legal)}>{item.label}</button>;
  }
  return (
    <button type="button" onClick={() => onInfo(item)}>
      {item.label}
    </button>
  );
};
