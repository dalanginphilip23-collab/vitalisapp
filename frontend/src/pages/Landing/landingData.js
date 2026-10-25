export const EASE_EXPO = /** @type {[number, number, number, number]} */ ([0.16, 1, 0.3, 1]);

export const NAV_LINKS = [
  { href: "#top", label: "Home" },
  { href: "#about", label: "About" },
  { href: "#features", label: "Features" },
  { href: "#download", label: "Download" },
  { href: "#pricing", label: "Pricing" },
];

// The three feature cards visible in the reference, plus one more that can be
// reached with the carousel arrows. All four are real Vitalis modules.
export const FEATURES = [
  {
    icon: "bedtime",
    title: "Sleep & recovery",
    desc: "Log sleep, water, and daily check-ins. Your readiness score is built from the data you enter each morning.",
  },
  {
    icon: "fitness_center",
    title: "Training plans",
    desc: "Follow structured plans day by day, enroll with one tap, and watch each completed session move you forward.",
  },
  {
    icon: "query_stats",
    title: "Progress analytics",
    desc: "Weight, BMI, and training-volume trends drawn live from the workouts, meals, and rest you have already logged.",
    featured: true,
  },
  {
    icon: "forum",
    title: "Community & chat",
    desc: "Share milestones on the community feed and keep your training partners close with private messages.",
  },
];

// Three image-led service cards. The visual treatment follows the reference,
// while the copy and destinations describe real parts of the app.
export const SERVICES = [
  {
    title: "Meal tracking",
    desc: "Log meals by hand or scan a plate for an AI macro estimate. Calories, protein, carbs, and fats stay in one daily view.",
    img: "/landing/service-nutrition.jpg",
    alt: "Athlete holding a green apple after a workout",
    tone: "lime",
    to: "/dashboard/meal-tracker",
  },
  {
    title: "Activity & sleep",
    desc: "Capture GPS runs and daily rest, then see how both shape your readiness. Your timeline keeps every entry together.",
    img: "/landing/service-hydration.jpg",
    alt: "Athlete drinking water during a training session",
    tone: "grey",
    to: "/dashboard/activity-map",
  },
  {
    title: "Camera workouts",
    desc: "Move with on-screen guidance, automatic rep counting, and live form feedback. No extra equipment required.",
    img: "/landing/service-training.jpg",
    alt: "Athlete training with a dumbbell in a bright studio",
    tone: "white",
    to: "/dashboard/workouts",
  },
];

// Pricing is intentionally honest: Vitalis is free. These three cards keep the
// reference's 01 / 02 / 03 composition without inventing paid tiers.
export const PLANS = [
  {
    num: "01",
    title: "FREE FOREVER",
    desc: "Every tracking module, plan, and insight. No trial timer and no paywall.",
    label: "Start from",
    price: "Free",
    to: "/register",
  },
  {
    num: "02",
    title: "NO CARD NEEDED",
    desc: "Create an account in under a minute with just your name and email.",
    label: "Always",
    price: "$0",
    to: "/register",
  },
  {
    num: "03",
    title: "YOUR DATA",
    desc: "Export your complete log history whenever you want. Nothing is locked in.",
    label: "Included",
    price: "Always",
    to: "/dashboard/logs",
  },
];

export const FOOTER_LINKS = [
  {
    title: "Product",
    links: [
      { label: "Overview", href: "#about" },
      { label: "Features", href: "#features" },
      { label: "Download", href: "#download" },
      { label: "Pricing", href: "#pricing" },
    ],
  },
  {
    title: "Track",
    links: [
      { label: "Nutrition", to: "/dashboard/meal-tracker" },
      { label: "Workouts", to: "/dashboard/workouts" },
      { label: "Activity", to: "/dashboard/activity-map" },
      { label: "Progress", to: "/dashboard/logs" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "Feed", to: "/dashboard/community" },
      { label: "Messages", to: "/dashboard/messenger" },
      { label: "Plans", to: "/dashboard/plans" },
      { label: "Notifications", to: "/dashboard/notifications" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Profile", to: "/dashboard/profile" },
      { label: "Preferences", to: "/dashboard/preferences" },
      { label: "Help & support", contact: true },
      { label: "Sign in", to: "/login" },
    ],
  },
];

// Footer destinations open a focused product sheet rather than dropping a
// logged-out visitor straight onto a protected route. Each entry keeps the
// promise of the label and then offers the real next step.
export const SUPPORT_EMAIL = "vitalisapp1@gmail.com";

export const SUPPORT_INFO = {
  group: "Support",
  icon: "support_agent",
  title: "Talk to a real person.",
  description:
    "Questions about your account, a workout, or something that does not look right? Email the Vitalis team and we will get back to you.",
  points: [
    "Account, sign-in, and privacy questions",
    "Training, nutrition, and product feedback",
    "Bug reports and feature requests",
  ],
  email: SUPPORT_EMAIL,
  ctaLabel: "Email support",
};

export const FOOTER_INFO = {
  Overview: {
    group: "Product",
    icon: "dashboard",
    title: "One calm home for your health.",
    description:
      "Vitalis brings training, nutrition, recovery, and community into one connected timeline. Everything you see is built from what you log.",
    points: ["Manual-first by design", "Free for everyone", "Installable on any device"],
    ctaLabel: "Explore the app",
    href: "#about",
  },
  Features: {
    group: "Product",
    icon: "apps",
    title: "Four modules. One system.",
    description:
      "Sleep, training, nutrition, and progress share the same daily record. Log once and every relevant screen updates with you.",
    points: ["Sleep and recovery check-ins", "Structured training plans", "Nutrition and progress in one view"],
    ctaLabel: "See the features",
    href: "#features",
  },
  Download: {
    group: "Product",
    icon: "install_mobile",
    title: "Vitalis goes where you train.",
    description:
      "Install Vitalis to your home screen or keep using it in any modern browser. There is no app-store gate and no separate account.",
    points: ["Add to home screen from your browser", "Works offline as a PWA", "Same account on every device"],
    ctaLabel: "View download options",
    href: "#download",
  },
  Pricing: {
    group: "Product",
    icon: "sell",
    title: "Free. Not a trial.",
    description:
      "Every tracking module, plan, and insight is included from day one. No credit card, no locked features, and no countdown.",
    points: ["No paywall", "No card required", "Export your history whenever you want"],
    ctaLabel: "See the full plan",
    href: "#pricing",
  },
  Nutrition: {
    group: "Track",
    icon: "restaurant",
    title: "Every meal, in one clear view.",
    description:
      "Log food by hand or scan a plate for an AI-assisted macro estimate. Calories, protein, carbs, and fats stay together in your daily log.",
    points: ["Photo-assisted meal estimates", "Daily calorie and macro targets", "Breakfast-to-dinner history"],
    ctaLabel: "Open nutrition",
    to: "/dashboard/meal-tracker",
  },
  Workouts: {
    group: "Track",
    icon: "fitness_center",
    title: "Plans that meet you where you are.",
    description:
      "Follow structured plans, log each set and rep, or move through a camera-guided session with live feedback.",
    points: ["Structured weekly plans", "Set and rep logging", "Camera-guided form cues"],
    ctaLabel: "Open workouts",
    to: "/dashboard/workouts",
  },
  Activity: {
    group: "Track",
    icon: "directions_run",
    title: "Movement and rest, connected.",
    description:
      "Capture GPS runs, daily movement, water, and sleep. Vitalis turns those entries into a readiness score you can act on.",
    points: ["GPS run tracking", "Sleep and hydration check-ins", "Readiness from your own data"],
    ctaLabel: "Open activity",
    to: "/dashboard/activity-map",
  },
  Progress: {
    group: "Track",
    icon: "query_stats",
    title: "Proof of the work you put in.",
    description:
      "See weight, BMI, training volume, and your complete timeline without building a report by hand.",
    points: ["Weight and BMI trends", "Training-volume history", "A complete, exportable log"],
    ctaLabel: "Open progress",
    to: "/dashboard/logs",
  },
  Feed: {
    group: "Community",
    icon: "forum",
    title: "Progress is better shared.",
    description:
      "Post milestones, follow other members, and keep the encouragement close. Your feed is built around real activity, not vanity metrics.",
    points: ["Share milestones", "Follow other members", "A supportive training community"],
    ctaLabel: "Open the feed",
    to: "/dashboard/community",
  },
  Messages: {
    group: "Community",
    icon: "chat_bubble",
    title: "Keep your training circle close.",
    description:
      "Private conversations with training partners, accountability friends, and the people who keep you moving.",
    points: ["Private one-to-one chats", "Training-partner accountability", "Notification controls"],
    ctaLabel: "Open messages",
    to: "/dashboard/messenger",
  },
  Plans: {
    group: "Community",
    icon: "event_note",
    title: "A plan for the week ahead.",
    description:
      "Browse shared plans, enroll in a structured programme, and keep every session aligned with your goal.",
    points: ["Structured weekly plans", "Enrol with one tap", "Sessions saved to your history"],
    ctaLabel: "Explore plans",
    to: "/dashboard/plans",
  },
  Notifications: {
    group: "Community",
    icon: "notifications",
    title: "Stay in the loop, on your terms.",
    description:
      "Messages, plan updates, and community activity arrive in one calm place. Read what matters and clear the rest.",
    points: ["Messages and plan updates", "Community activity", "Mark one or all as read"],
    ctaLabel: "Open notifications",
    to: "/dashboard/notifications",
  },
  Profile: {
    group: "Account",
    icon: "person",
    title: "Your account, your context.",
    description:
      "Manage your profile, avatar, and personal details so your plans and insights stay relevant to you.",
    points: ["Profile and avatar", "Account details", "Privacy controls"],
    ctaLabel: "Open profile",
    to: "/dashboard/profile",
  },
  Preferences: {
    group: "Account",
    icon: "tune",
    title: "Make Vitalis feel like yours.",
    description:
      "Choose your theme, units, and reminder preferences. Your setup follows you across devices.",
    points: ["Light or dark theme", "Metric or imperial units", "Notification preferences"],
    ctaLabel: "Open preferences",
    to: "/dashboard/preferences",
  },
  "Help & support": SUPPORT_INFO,
  "Sign in": {
    group: "Account",
    icon: "login",
    title: "Pick up where you left off.",
    description:
      "Sign in to reach your plans, meals, activity, and progress. Your session is protected and your data stays private.",
    points: ["Email and password sign-in", "Google sign-in where enabled", "Secure session handling"],
    ctaLabel: "Sign in to Vitalis",
    to: "/login",
  },
};


export const formatCount = (n) => {
  const v = Number(n || 0);
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(v);
};
