// api/store-product.js
// GET /api/store-product?brand=gp73&slug=genesis-foundations-study
//
// STATUS: PLACEHOLDER DATA SOURCE — see api/store-products.js header for the
// full explanation. Same demo catalog, single-item lookup by slug, plus a
// "related products" list (same brand + category, excluding itself).

export const config = {
  runtime: "nodejs",
};

// NOTE: duplicated from store-products.js intentionally for now (no shared
// module resolution configured in this plain-JS Vercel functions setup).
// Once the real `products` table exists, both endpoints read from the same
// Supabase query and this duplication goes away.
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
  const slug = req.query.slug;

  if (!slug) {
    return res.status(400).json({ success: false, message: "Missing slug" });
  }

  const items = DEMO_CATALOG[brand] || [];
  const product = items.find((p) => p.slug === slug);

  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found", source: "demo_placeholder" });
  }

  const related = items.filter((p) => p.slug !== slug && p.category === product.category);

  return res.status(200).json({
    success: true,
    source: "demo_placeholder",
    product,
    related,
  });
}
