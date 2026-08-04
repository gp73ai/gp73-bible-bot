export const config = {
  runtime: "nodejs",
};

const KIT_API_BASE = "https://api.kit.com/v4";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_BRANDS = new Set(["gp73"]);
const MAX_BODY_BYTES = 16_384;

const RESOURCE_CONFIG = {
  "foundation-audit": {
    tagEnv: "KIT_FOUNDATION_AUDIT_TAG_ID",
    sequenceEnv: "KIT_FOUNDATION_AUDIT_DELIVERY_SEQUENCE_ID",
    defaultCampaign: "foundation-audit",
    defaultPagePath: "/free/foundation-audit",
    inactiveMessage: "The Foundation Audit delivery system is not active yet.",
    errorMessage: "We could not prepare your Foundation Audit right now. Please try again.",
  },
  "truth-detector": {
    tagEnv: "KIT_TRUTH_DETECTOR_TAG_ID",
    sequenceEnv: "KIT_TRUTH_DETECTOR_DELIVERY_SEQUENCE_ID",
    defaultCampaign: "truth-detector",
    defaultPagePath: "/free/truth-detector",
    inactiveMessage: "The Truth Detector delivery system is not active yet.",
    errorMessage: "We could not prepare your Truth Detector breakdown right now. Please try again.",
  },
  "redefinition-test": {
      tagEnv: "KIT_REDEFINITION_TEST_TAG_ID",
      sequenceEnv: "KIT_REDEFINITION_TEST_DELIVERY_SEQUENCE_ID",
      defaultCampaign: "redefinition-test",
      defaultPagePath: "/free/redefinition-test",
      inactiveMessage: "The Redefinition Test delivery system is not active yet.",
      errorMessage: "We could not prepare your Redefinition Test results right now. Please try again.",
  },
};

function text(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeEmail(value) {
  return text(value, 254).toLowerCase();
}

function jsonSize(value) {
  return Buffer.byteLength(JSON.stringify(value || {}), "utf8");
}

async function kitRequest(path, options, apiKey) {
  const response = await fetch(`${KIT_API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Kit-Api-Key": apiKey,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Kit request failed with status ${response.status}: ${detail.slice(0, 300)}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function upsertCapture(config, capture) {
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/free_resource_leads?on_conflict=email,brand_slug,resource_slug`,
    {
      method: "POST",
      headers: {
        apikey: config.supabaseServiceKey,
        Authorization: `Bearer ${config.supabaseServiceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(capture),
    }
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Lead capture write failed with status ${response.status}: ${detail.slice(0, 300)}`);
  }

  const rows = await response.json();
  return rows[0] || null;
}

async function updateCapture(config, id, patch) {
  if (!id) return;
  const response = await fetch(
    `${config.supabaseUrl}/rest/v1/free_resource_leads?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: config.supabaseServiceKey,
        Authorization: `Bearer ${config.supabaseServiceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    }
  );

  if (!response.ok) {
    throw new Error(`Lead capture update failed with status ${response.status}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  if (jsonSize(req.body) > MAX_BODY_BYTES) {
    return res.status(413).json({ success: false, message: "Request is too large" });
  }

  const body = req.body || {};
  const firstName = text(body.first_name, 80);
  const email = normalizeEmail(body.email);
  const resourceSlug = text(body.resource_slug, 100);
  const brand = text(body.brand || "gp73", 80).toLowerCase();
  const honeypot = text(body.company, 120);

  if (honeypot) {
    return res.status(200).json({ success: true });
  }

  if (!firstName || !EMAIL_RE.test(email)) {
    return res.status(422).json({
      success: false,
      message: "Enter your first name and a valid email address.",
    });
  }

  if (!body.consent) {
    return res.status(422).json({
      success: false,
      message: "Consent is required to deliver the resource by email.",
    });
  }

  const resourceConfig = RESOURCE_CONFIG[resourceSlug];

  if (!resourceConfig || !ALLOWED_BRANDS.has(brand)) {
    return res.status(404).json({ success: false, message: "Resource not found" });
  }

  const runtime = {
    kitApiKey: process.env.KIT_API_KEY,
    kitDeliverySequenceId: process.env[resourceConfig.sequenceEnv],
    kitNurtureSequenceId: process.env.KIT_FREE_RESOURCE_NURTURE_SEQUENCE_ID,
    kitResourceTagId: process.env[resourceConfig.tagEnv],
    kitSourceTagId: process.env.KIT_SOURCE_YOUTUBE_TAG_ID,
    kitCreatorTagId: process.env.KIT_CREATOR_SEDRICK_TAG_ID,
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const missing = Object.entries({
    KIT_API_KEY: runtime.kitApiKey,
    [resourceConfig.sequenceEnv]: runtime.kitDeliverySequenceId,
    [resourceConfig.tagEnv]: runtime.kitResourceTagId,
    SUPABASE_URL: runtime.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: runtime.supabaseServiceKey,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    return res.status(503).json({
      success: false,
      message: resourceConfig.inactiveMessage,
    });
  }

  const now = new Date().toISOString();
  const capture = {
    email,
    first_name: firstName,
    resource_slug: resourceSlug,
    brand_slug: brand,
    creator_slug: text(body.creator || "sedrick-davis", 80),
    acquisition_source: text(body.acquisition_source || "youtube", 80),
    video_id: text(body.video_id, 120) || null,
    campaign: text(body.campaign || resourceConfig.defaultCampaign, 120),
    utm_source: text(body.utm_source, 120) || null,
    utm_medium: text(body.utm_medium, 120) || null,
    utm_campaign: text(body.utm_campaign, 120) || null,
    utm_content: text(body.utm_content, 120) || null,
    page_path: text(body.page_path, 240) || resourceConfig.defaultPagePath,
    referrer: text(body.referrer, 500) || null,
    consent_at: now,
    last_requested_at: now,
    capture_status: "received",
    delivery_status: "pending",
    user_agent: text(req.headers["user-agent"], 500) || null,
  };

  let lead = null;

  try {
    lead = await upsertCapture(runtime, capture);

    const subscriberResult = await kitRequest(
      "/subscribers",
      {
        method: "POST",
        body: JSON.stringify({
          first_name: firstName,
          email_address: email,
          fields: {
            brand,
            creator_source: capture.creator_slug,
            acquisition_source: capture.acquisition_source,
            video_identifier: capture.video_id || "",
            campaign: capture.campaign,
            lead_magnet_slug: resourceSlug,
            subscriber_lifecycle_stage: "lead",
          },
        }),
      },
      runtime.kitApiKey
    );

    const subscriber = subscriberResult && subscriberResult.subscriber;
    if (!subscriber || !subscriber.id) {
      throw new Error("Kit did not return a subscriber ID");
    }

    await kitRequest(
      `/tags/${encodeURIComponent(runtime.kitResourceTagId)}/subscribers/${encodeURIComponent(subscriber.id)}`,
      { method: "POST", body: "{}" },
      runtime.kitApiKey
    );

    if (runtime.kitSourceTagId && capture.acquisition_source === "youtube") {
      await kitRequest(
        `/tags/${encodeURIComponent(runtime.kitSourceTagId)}/subscribers/${encodeURIComponent(subscriber.id)}`,
        { method: "POST", body: "{}" },
        runtime.kitApiKey
      );
    }

    if (runtime.kitCreatorTagId && capture.creator_slug === "sedrick-davis") {
      await kitRequest(
        `/tags/${encodeURIComponent(runtime.kitCreatorTagId)}/subscribers/${encodeURIComponent(subscriber.id)}`,
        { method: "POST", body: "{}" },
        runtime.kitApiKey
      );
    }

    await kitRequest(
      `/sequences/${encodeURIComponent(runtime.kitDeliverySequenceId)}/subscribers/${encodeURIComponent(subscriber.id)}`,
      { method: "POST", body: "{}" },
      runtime.kitApiKey
    );

    if (runtime.kitNurtureSequenceId) {
      await kitRequest(
        `/sequences/${encodeURIComponent(runtime.kitNurtureSequenceId)}/subscribers/${encodeURIComponent(subscriber.id)}`,
        { method: "POST", body: "{}" },
        runtime.kitApiKey
      );
    }

    await updateCapture(runtime, lead && lead.id, {
      kit_subscriber_id: String(subscriber.id),
      capture_status: "subscribed",
      delivery_status: "queued",
      kit_queued_at: new Date().toISOString(),
      last_error: null,
    });

    return res.status(200).json({
      success: true,
      resource: resourceSlug,
      delivery_status: "queued",
    });
  } catch (error) {
    try {
      await updateCapture(runtime, lead && lead.id, {
        capture_status: "failed",
        delivery_status: "failed",
        last_error: text(error && error.message, 500),
      });
    } catch {
      // Do not replace the original delivery error with a logging error.
    }

    return res.status(502).json({
      success: false,
      message: resourceConfig.errorMessage,
    });
  }
}
