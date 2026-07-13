// api/store-products.js
// GET /api/store-products?brand=gp73&category=studies
//
// STATUS: PLACEHOLDER DATA SOURCE.
// The real `products` / `creator_brands` tables proposed in
// creator_commerce_migration.sql do NOT exist yet (pending approval — see
// task CC1 in the dashboard). Until that migration is approved and applied,
// this endpoint returns a small hardcoded demo catalog per brand so the
// /store and /store/[slug] vertical slice is genuinely clickable end to end
// today. Once the migration lands, replace the DEMO_CATALOG block below with
// a Supabase REST fetch against the `products` table, filtered by
// brand_slug + status='active' — the response shape below is already the
// target shape so the frontend will not need to change.
//
// This file does NOT touch study_catalog, documents, match_documents, or any
// membership table. It is fully additive and read-only (in-memory constant).

export const config = {
  runtime: "nodejs",
};

const DEMO_CATALOG = {
  gp73: [
    {
      slug: "genesis-foundations-study",
      brand_slug: "gp73",
      kind: "study",
      display_name: "Genesis Foundations Study",
      short_description: "A 5-part written study walking through the foundational chapters of Genesis.",
      long_description: "A 5-part written study walking through the foundational chapters of Genesis, built for Starter members who want a guided, credit-based entry point into deeper study. Demo product — mirrors the real study_catalog test fixture pending real content.",
      benefits: [
        "Five short, focused lessons",
        "Written for first-time Bible students",
        "Delivered as a downloadable PDF"
      ],
      price_usd: 0,
      price_label: "Included with Starter membership",
      product_type: "digital_download",
      cover_image: "/bible.png",
      preview_asset: null,
      category: "studies",
      status: "active"
    },
    {
      slug: "discipleship-coaching-intro",
      brand_slug: "gp73",
      kind: "coaching",
      display_name: "Discipleship Coaching — Intro Session",
      short_description: "A one-time coaching session to help you build a personal discipleship plan.",
      long_description: "A one-time coaching session to help you build a personal discipleship plan. Demo product illustrating the 'coaching offer' product type for the universal sales page template.",
      benefits: [
        "45-minute 1:1 session",
        "Personalized growth plan",
        "Follow-up resource list"
      ],
      price_usd: 4900,
      price_label: "$49.00",
      product_type: "coaching",
      cover_image: "/apostle.jpg",
      preview_asset: null,
      category: "coaching",
      status: "active"
    },
    {
      slug: "gp73-membership-growth",
      brand_slug: "gp73",
      kind: "membership",
      display_name: "Growth Membership",
      short_description: "Monthly membership with expanded study credits and coaching access.",
      long_description: "Monthly membership with expanded study credits and coaching access — the next tier above Starter. Demo product mapping to the existing commerce_plans row for tier_slug=growth.",
      benefits: [
        "More monthly study credits",
        "Priority coaching booking",
        "Access to the Growth-tier bot"
      ],
      price_usd: 2900,
      price_label: "$29.00/mo",
      product_type: "membership",
      cover_image: "/GPlogo.png",
      preview_asset: null,
      category: "memberships",
      status: "coming_soon"
    }
  ],

  "angela-davis-live": [
    {
      slug: "adl-signature-course",
      brand_slug: "angela-davis-live",
      kind: "course",
      display_name: "Signature Course — Coming Soon",
      short_description: "Angela Davis Live's flagship course. Demo placeholder for the multi-brand slice.",
      long_description: "Angela Davis Live's flagship course. This is a placeholder product used only to prove the store/sales-page template is genuinely brand-agnostic — no real Angela Davis Live product data has been loaded yet.",
      benefits: [
        "Multi-module video course",
        "Downloadable workbook",
        "Private community access"
      ],
      price_usd: 19900,
      price_label: "$199.00",
      product_type: "course",
      cover_image: "/GPlogo.png",
      preview_asset: null,
      category: "courses",
      status: "coming_soon"
    }
  ]
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const brand = (req.query.brand || "gp73").toLowerCase();
  const category = req.query.category ? String(req.query.category).toLowerCase() : null;

  const items = DEMO_CATALOG[brand] || [];
  const filtered = category ? items.filter((p) => p.category === category) : items;

  return res.status(200).json({
    success: true,
    source: "demo_placeholder",
    brand,
    category: category || "all",
    count: filtered.length,
    products: filtered,
  });
}
