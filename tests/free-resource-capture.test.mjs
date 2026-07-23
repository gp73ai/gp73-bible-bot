import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/free-resource-capture.js";

function responseHarness() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function validBody(overrides = {}) {
  return {
    first_name: "Test",
    email: "test@example.com",
    resource_slug: "foundation-audit",
    brand: "gp73",
    creator: "sedrick-davis",
    acquisition_source: "youtube",
    campaign: "foundation-audit",
    consent: true,
    company: "",
    ...overrides,
  };
}

test("rejects non-POST requests", async () => {
  const res = responseHarness();
  await handler({ method: "GET", headers: {}, body: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.success, false);
});

test("rejects invalid email", async () => {
  const res = responseHarness();
  await handler(
    { method: "POST", headers: {}, body: validBody({ email: "invalid" }) },
    res
  );
  assert.equal(res.statusCode, 422);
});

test("requires consent", async () => {
  const res = responseHarness();
  await handler(
    { method: "POST", headers: {}, body: validBody({ consent: false }) },
    res
  );
  assert.equal(res.statusCode, 422);
});

test("rejects unknown resources", async () => {
  const res = responseHarness();
  await handler(
    { method: "POST", headers: {}, body: validBody({ resource_slug: "unknown" }) },
    res
  );
  assert.equal(res.statusCode, 404);
});

test("does not call Kit while production configuration is absent", async () => {
  const res = responseHarness();
  await handler({ method: "POST", headers: {}, body: validBody() }, res);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /not active yet/i);
});

test("silently accepts honeypot submissions without external work", async () => {
  const res = responseHarness();
  await handler(
    { method: "POST", headers: {}, body: validBody({ company: "bot value" }) },
    res
  );
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test("queues the complete tracked delivery and nurture path without a live send", async () => {
  const originalFetch = global.fetch;
  const envKeys = [
    "KIT_API_KEY",
    "KIT_FOUNDATION_AUDIT_DELIVERY_SEQUENCE_ID",
    "KIT_FREE_RESOURCE_NURTURE_SEQUENCE_ID",
    "KIT_FOUNDATION_AUDIT_TAG_ID",
    "KIT_SOURCE_YOUTUBE_TAG_ID",
    "KIT_CREATOR_SEDRICK_TAG_ID",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
  const calls = [];

  Object.assign(process.env, {
    KIT_API_KEY: "test-kit-key",
    KIT_FOUNDATION_AUDIT_DELIVERY_SEQUENCE_ID: "delivery-sequence",
    KIT_FREE_RESOURCE_NURTURE_SEQUENCE_ID: "nurture-sequence",
    KIT_FOUNDATION_AUDIT_TAG_ID: "foundation-tag",
    KIT_SOURCE_YOUTUBE_TAG_ID: "youtube-tag",
    KIT_CREATOR_SEDRICK_TAG_ID: "sedrick-tag",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-key",
  });

  global.fetch = async (url, options = {}) => {
    calls.push({
      url: String(url),
      method: options.method || "GET",
      body: options.body ? JSON.parse(options.body) : null,
    });

    if (String(url).includes("/rest/v1/free_resource_leads?on_conflict=")) {
      return new Response(JSON.stringify([{ id: "lead-1" }]), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (String(url).endsWith("/v4/subscribers")) {
      return new Response(JSON.stringify({ subscriber: { id: 73 } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (String(url).includes("/rest/v1/free_resource_leads?id=eq.lead-1")) {
      return new Response(null, { status: 204 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const res = responseHarness();
    await handler(
      {
        method: "POST",
        headers: { "user-agent": "Foundation Audit test" },
        body: validBody({
          video_id: "foundation-audit-001",
          utm_source: "youtube",
          utm_medium: "video",
          utm_campaign: "foundation-audit-launch",
        }),
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body.delivery_status, "queued");

    const subscriberCall = calls.find((call) => call.url.endsWith("/v4/subscribers"));
    assert.deepEqual(subscriberCall.body.fields, {
      brand: "gp73",
      creator_source: "sedrick-davis",
      acquisition_source: "youtube",
      video_identifier: "foundation-audit-001",
      campaign: "foundation-audit",
      lead_magnet_slug: "foundation-audit",
      subscriber_lifecycle_stage: "lead",
    });

    const tagCalls = calls.filter((call) => call.url.includes("/v4/tags/"));
    assert.equal(tagCalls.length, 3);
    assert.ok(tagCalls.some((call) => call.url.includes("/tags/foundation-tag/")));
    assert.ok(tagCalls.some((call) => call.url.includes("/tags/youtube-tag/")));
    assert.ok(tagCalls.some((call) => call.url.includes("/tags/sedrick-tag/")));

    const sequenceCalls = calls.filter((call) => call.url.includes("/v4/sequences/"));
    assert.equal(sequenceCalls.length, 2);
    assert.ok(sequenceCalls.some((call) => call.url.includes("/sequences/delivery-sequence/")));
    assert.ok(sequenceCalls.some((call) => call.url.includes("/sequences/nurture-sequence/")));

    const initialCapture = calls.find((call) =>
      call.url.includes("/rest/v1/free_resource_leads?on_conflict=")
    );
    assert.equal(initialCapture.body.video_id, "foundation-audit-001");
    assert.equal(initialCapture.body.utm_source, "youtube");
    assert.equal(initialCapture.body.utm_campaign, "foundation-audit-launch");
  } finally {
    global.fetch = originalFetch;
    for (const key of envKeys) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  }
});
