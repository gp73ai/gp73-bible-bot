// api/store-product.js
// GET /api/store-product?brand=gp73&slug=genesis-foundations-study
//
// Reads the real `products` (+ `offers`) tables. See api/store-products.js
// header for the full explanation of the Supabase connection pattern. No
// hardcoded catalog remains, and there is no silent fallback to demo data —
// a genuine Supabase failure returns a real error (502/500), and an unknown
// product returns 404, not a swallowed empty success.

export const config = {
  runtime: "nodejs",
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
    const productUrl =
      `${SUPABASE_URL}/rest/v1/products?select=id,brand_slug,slug,category,product_type,display_name,short_description,long_description,benefits,cover_image,preview_asset,status,offers(price_usd,price_label,offer_type,active)` +
      `&brand_slug=eq.${encodeURIComponent(brand)}` +
      `&slug=eq.${encodeURIComponent(slug)}` +
      `&status=in.(active,coming_soon)` +
      `&limit=1`;

    const r = await fetch(productUrl, { headers });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({
        success: false,
        message: "Supabase query failed",
        detail,
      });
    }

    const rows = await r.json();
    const row = rows[0];

    if (!row) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
        source: "supabase",
      });
    }

    const offers = row.offers || [];
    const offer = offers.find((o) => o.active) || offers[0] || null;

    const product = {
      slug: row.slug,
      brand_slug: row.brand_slug,
      display_name: row.display_name,
      short_description: row.short_description,
      long_description: row.long_description,
      benefits: row.benefits || [],
      price_usd: offer ? offer.price_usd : 0,
      price_label: offer ? offer.price_label : null,
      product_type: row.product_type,
      cover_image: row.cover_image,
      preview_asset: row.preview_asset,
      category: row.category,
      status: row.status,
    };

    const relatedUrl =
      `${SUPABASE_URL}/rest/v1/products?select=id,brand_slug,slug,category,product_type,display_name,short_description,cover_image,status,offers(price_usd,price_label,active)` +
      `&brand_slug=eq.${encodeURIComponent(brand)}` +
      `&category=eq.${encodeURIComponent(row.category)}` +
      `&slug=neq.${encodeURIComponent(slug)}` +
      `&status=in.(active,coming_soon)`;

    let related = [];
    const relR = await fetch(relatedUrl, { headers });
    if (relR.ok) {
      const relRows = await relR.json();
      related = relRows.map((p) => {
        const offs = p.offers || [];
        const o = offs.find((x) => x.active) || offs[0] || null;
        return {
          slug: p.slug,
          brand_slug: p.brand_slug,
          display_name: p.display_name,
          short_description: p.short_description,
          price_usd: o ? o.price_usd : 0,
          price_label: o ? o.price_label : null,
          product_type: p.product_type,
          cover_image: p.cover_image,
          category: p.category,
          status: p.status,
        };
      });
    }

    return res.status(200).json({
      success: true,
      source: "supabase",
      product,
      related,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Unexpected error querying Supabase",
      detail: String(err),
    });
  }
}
