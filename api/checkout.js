// api/checkout.js
// GET /api/checkout?offer_id=<uuid>
//
// Secure server-side redirect from a Creator Commerce offer to its mapped
// external checkout destination (currently: GHL payment links only).
//
// This endpoint is the ONLY place that is allowed to turn an offer_id into
// an outbound checkout URL. It never accepts a caller-supplied redirect
// target — the destination always comes from the checkout_destinations
// table, keyed by offer_id, so there is no open-redirect surface here.
//
// Validation chain (in order):
//   1. offer_id must be present and a syntactically valid UUID      -> 400
//   2. offer must exist in `offers`                                 -> 404
//   3. offer must be active                                         -> 409
//   4. offer's product must exist and belong to a known brand       -> 404
//   5. an active checkout_destinations row must exist for the offer -> 404
//   6. the destination provider must be an approved provider (ghl)  -> 409
//   7. the destination_url host must be on the GHL allowlist        -> 502
//
// On success: 302 redirect to the mapped GHL checkout URL.

export const config = {
    runtime: "nodejs",
};

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Only these hosts are ever allowed as a redirect target. This is the
// concrete defense against an open-redirect vulnerability: even if a bad
// row somehow made it into checkout_destinations, we still refuse to
// redirect anywhere outside this allowlist.
const ALLOWED_REDIRECT_HOSTS = [
  "link.fastpaydirect.com", // GHL / LeadConnector hosted payment links
  "app.gohighlevel.com",
  ];

// Providers this endpoint is willing to route to. Per the Creator Commerce
// checkout-routing decision, GHL is the only live provider — Stripe
// Checkout is intentionally NOT implemented here.
const ALLOWED_PROVIDERS = ["ghl"];

function isAllowedRedirectUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "https:") return false;
    return ALLOWED_REDIRECT_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

const offerId = req.query.offer_id;

if (!offerId || Array.isArray(offerId) || !UUID_RE.test(offerId)) {
  return res.status(400).json({
    success: false,
    message: "Missing or invalid offer_id",
  });
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
  // 1. Load the offer + its parent product in one round trip.
  const offerUrl =
    `${SUPABASE_URL}/rest/v1/offers?select=id,product_id,active,price_usd,price_label,products(id,brand_slug,slug,status)` +
    `&id=eq.${encodeURIComponent(offerId)}` +
    `&limit=1`;

  const offerRes = await fetch(offerUrl, { headers });

  if (!offerRes.ok) {
    const detail = await offerRes.text();
    return res.status(502).json({
      success: false,
      message: "Supabase query failed",
      detail,
    });
  }

  const offerRows = await offerRes.json();
  const offer = offerRows[0];

  if (!offer) {
    return res.status(404).json({
      success: false,
      message: "Offer not found",
    });
  }

  if (!offer.active) {
    return res.status(409).json({
      success: false,
      message: "Offer is not active",
    });
  }

  const product = offer.products;

  if (!product || !product.brand_slug) {
    return res.status(404).json({
      success: false,
      message: "Offer has no associated product",
    });
  }

  // 2. Confirm the brand is a recognized brand (integrity check — this
  // is not the same as the public store's active/coming_soon listing
  // filter, since this endpoint must also serve internal/test offers
  // that are intentionally hidden from the public store).
  const brandUrl =
    `${SUPABASE_URL}/rest/v1/creator_brands?select=brand_slug` +
    `&brand_slug=eq.${encodeURIComponent(product.brand_slug)}` +
    `&limit=1`;

  const brandRes = await fetch(brandUrl, { headers });

  if (!brandRes.ok) {
    const detail = await brandRes.text();
    return res.status(502).json({
      success: false,
      message: "Supabase query failed",
      detail,
    });
  }

  const brandRows = await brandRes.json();

  if (!brandRows[0]) {
    return res.status(404).json({
      success: false,
      message: "Product's brand is not permitted",
    });
  }

  // 3. Load the checkout destination mapped to this offer.
  const destUrl =
    `${SUPABASE_URL}/rest/v1/checkout_destinations?select=id,provider,destination_url,offer_id` +
    `&offer_id=eq.${encodeURIComponent(offer.id)}` +
    `&limit=1`;

  const destRes = await fetch(destUrl, { headers });

  if (!destRes.ok) {
    const detail = await destRes.text();
    return res.status(502).json({
      success: false,
      message: "Supabase query failed",
      detail,
    });
  }

  const destRows = await destRes.json();
  const destination = destRows[0];

  if (!destination || !destination.destination_url) {
    return res.status(404).json({
      success: false,
      message: "No checkout destination configured for this offer",
    });
  }

  if (!ALLOWED_PROVIDERS.includes(destination.provider)) {
    return res.status(409).json({
      success: false,
      message: `Checkout provider "${destination.provider}" is not approved`,
    });
  }

  if (!isAllowedRedirectUrl(destination.destination_url)) {
    return res.status(502).json({
      success: false,
      message: "Checkout destination URL failed safety validation",
    });
  }

  // All checks passed — safe to redirect.
  res.writeHead(302, { Location: destination.destination_url });
  return res.end();
} catch (err) {
  return res.status(502).json({
    success: false,
    message: "Unexpected error resolving checkout",
    detail: String(err),
  });
}
}
