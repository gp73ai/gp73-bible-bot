// api/store-products.js
// GET /api/store-products?brand=gp73&category=studies
//
// Reads the real `products` (+ `offers`) tables created by
// creator_commerce_migration_v2_PROPOSED_NOT_APPLIED.sql, applied 2026-07-13.
// No hardcoded catalog remains. Uses the same Supabase REST pattern already
// used elsewhere in this repo (see api/answer.js): plain fetch() against the
// PostgREST endpoint with SUPABASE_URL / SUPABASE_ANON_KEY, both already
// configured as protected Vercel environment variables. No keys are placed
// in browser JavaScript and none are committed here.
//
// This file does NOT touch study_catalog, documents, match_documents, or any
// membership table.

export const config = {
  runtime: "nodejs",
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const brand = (req.query.brand || "gp73").toLowerCase();
  const category = req.query.category ? String(req.query.category).toLowerCase() : null;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({
      success: false,
      message: "Supabase environment variables are not configured",
    });
  }

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  try {
    let url =
      `${SUPABASE_URL}/rest/v1/products?select=id,brand_slug,slug,category,product_type,display_name,short_description,long_description,benefits,cover_image,preview_asset,status,ordinal,offers(price_usd,price_label,offer_type,active)` +
      `&brand_slug=eq.${encodeURIComponent(brand)}` +
      `&status=in.(active,coming_soon)` +
            `&category=neq.internal_test` +
      `&order=ordinal.asc`;

    if (category) {
      url += `&category=eq.${encodeURIComponent(category)}`;
    }

    const r = await fetch(url, { headers });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({
        success: false,
        message: "Supabase query failed",
        detail,
      });
    }

    const rows = await r.json();

    const products = rows.map((p) => {
      const offers = p.offers || [];
      const offer = offers.find((o) => o.active) || offers[0] || null;
      return {
        slug: p.slug,
        brand_slug: p.brand_slug,
        display_name: p.display_name,
        short_description: p.short_description,
        long_description: p.long_description,
        benefits: p.benefits || [],
        price_usd: offer ? offer.price_usd : 0,
        price_label: offer ? offer.price_label : null,
        product_type: p.product_type,
        cover_image: p.cover_image,
        preview_asset: p.preview_asset,
        category: p.category,
        status: p.status,
        landing_path: null,
        is_free_resource: false,
      };
    });

    const resourcesUrl =
      `${SUPABASE_URL}/rest/v1/free_resources?select=brand_slug,slug,title,short_description,category,cover_image_path,landing_path,active` +
      `&brand_slug=eq.${encodeURIComponent(brand)}` +
      `&active=eq.true` +
      `&order=created_at.desc`;

    const resourcesResponse = await fetch(resourcesUrl, { headers });
    if (resourcesResponse.ok) {
      const resources = await resourcesResponse.json();
      resources.forEach((resource) => {
        products.push({
          slug: resource.slug,
          brand_slug: resource.brand_slug,
          display_name: resource.title,
          short_description: resource.short_description,
          long_description: resource.short_description,
          benefits: [],
          price_usd: 0,
          price_label: "Free",
          product_type: "free_resource",
          cover_image: resource.cover_image_path,
          preview_asset: null,
          category: resource.category,
          status: "active",
          landing_path: resource.landing_path,
          is_free_resource: true,
        });
      });
    }

    return res.status(200).json({
      success: true,
      source: "supabase",
      brand,
      category: category || "all",
      count: products.length,
      products,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Unexpected error querying Supabase",
      detail: String(err),
    });
  }
}
