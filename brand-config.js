// brand-config.js
// Creator Commerce Core — multi-brand configuration.
// Every brand-facing component (store grid, universal sales page) reads from
// this object instead of hard-coding colors/logos/copy. Adding a new creator
// client means adding one entry here (plus a brand_slug row in creator_brands
// once the DB migration below is approved) — no component code changes.
//
// This file is intentionally framework-agnostic (plain JS object) so it can be
// inlined into the existing static-HTML + Vercel-serverless architecture used
// by this repo (no Next.js / build step present today).

const BRAND_CONFIG = {
  gp73: {
    slug: "gp73",
    name: "GP73",
    tagline: "Biblical Clarity by Apostle Sedrick Davis",
    logo: "/GPlogo.png",
    favicon: "/GPlogo.png",
    colors: {
      bg: "#080808",
      surface: "#111111",
      border: "#1a1a1a",
      text: "#efefef",
      textMuted: "#aaaaaa",
      accent: "#FFD600",
      accentText: "#000000"
    },
    font: "'Arial', sans-serif",
    homeUrl: "/",
    supportEmail: "members@iamgodsprisoner.com"
  },

  "angela-davis-live": {
    slug: "angela-davis-live",
    name: "Angela Davis Live",
    tagline: "Coaching & Courses with Angela Davis",
    logo: "/brands/angela-davis-live/logo.png",
    favicon: "/brands/angela-davis-live/favicon.png",
    colors: {
      bg: "#0c0a10",
      surface: "#161320",
      border: "#241f30",
      text: "#f5f0ff",
      textMuted: "#b9aecf",
      accent: "#C9A7FF",
      accentText: "#0c0a10"
    },
    font: "'Arial', sans-serif",
    homeUrl: "/",
    supportEmail: "support@angeladavislive.com"
  },

  // Fallback used for any future creator client that hasn't been configured
  // yet, or if a brand_slug is missing/unrecognized. Keeps the store/sales
  // page from breaking instead of hard-failing.
  default: {
    slug: "default",
    name: "Creator Store",
    tagline: "",
    logo: "/GPlogo.png",
    favicon: "/GPlogo.png",
    colors: {
      bg: "#0a0a0a",
      surface: "#141414",
      border: "#222222",
      text: "#eeeeee",
      textMuted: "#999999",
      accent: "#FFD600",
      accentText: "#000000"
    },
    font: "'Arial', sans-serif",
    homeUrl: "/",
    supportEmail: "support@example.com"
  }
};

function getBrand(slug) {
  return BRAND_CONFIG[slug] || BRAND_CONFIG.default;
}

function applyBrandTheme(brand) {
  const c = brand.colors;
  document.documentElement.style.setProperty("--brand-bg", c.bg);
  document.documentElement.style.setProperty("--brand-surface", c.surface);
  document.documentElement.style.setProperty("--brand-border", c.border);
  document.documentElement.style.setProperty("--brand-text", c.text);
  document.documentElement.style.setProperty("--brand-text-muted", c.textMuted);
  document.documentElement.style.setProperty("--brand-accent", c.accent);
  document.documentElement.style.setProperty("--brand-accent-text", c.accentText);
  document.documentElement.style.setProperty("--brand-font", brand.font);

  const titleEl = document.querySelector("title");
  if (titleEl && brand.name) {
    document.title = document.title.replace(/^.*? — /, "") ;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BRAND_CONFIG, getBrand, applyBrandTheme };
}
