# Foundation Audit Lead Magnet Setup

## Route

- Landing page: `/free/foundation-audit`
- Thank-you page: `/free/foundation-audit/thank-you`
- Stable PDF: `/assets/free/foundation-audit.pdf`
- Privacy: `/privacy`
- Terms: `/terms`

## Required Vercel environment variables

- `KIT_API_KEY`
- `KIT_FOUNDATION_AUDIT_TAG_ID`
- `KIT_FOUNDATION_AUDIT_DELIVERY_SEQUENCE_ID`
- `KIT_FREE_RESOURCE_NURTURE_SEQUENCE_ID`
- `KIT_SOURCE_YOUTUBE_TAG_ID`
- `KIT_CREATOR_SEDRICK_TAG_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

The nurture sequence and YouTube source tag are optional in code so the delivery sequence can be verified independently first. They must be present before public launch.

Use these non-secret Kit IDs when the preview environment is connected:

```text
KIT_FOUNDATION_AUDIT_TAG_ID=21436178
KIT_SOURCE_YOUTUBE_TAG_ID=21436180
KIT_CREATOR_SEDRICK_TAG_ID=21436182
KIT_FOUNDATION_AUDIT_DELIVERY_SEQUENCE_ID=2837311
KIT_FREE_RESOURCE_NURTURE_SEQUENCE_ID=2837317
```

## Required Kit assets

Created in the Godsprisoner Kit account on July 23, 2026:

1. Tag: `Lead Magnet - Foundation Audit` (`21436178`)
2. Tag: `Source - YouTube` (`21436180`)
3. Tag: `Creator - Sedrick Davis` (`21436182`)
4. Sequence: `Foundation Audit - Delivery` (`2837311`)
5. Sequence: `Free Resources - Shared Nurture` (`2837317`)

The two sequences remain in draft state with zero recipients. Do not publish them before the controlled test is approved.

Required Kit custom fields:

- `brand`
- `creator_source`
- `acquisition_source`
- `video_identifier`
- `campaign`
- `lead_magnet_slug`
- `subscriber_lifecycle_stage`

All seven custom fields were created in Kit on July 23, 2026. Their values remain blank on existing subscribers.

The delivery sequence sends the requested PDF. The shared nurture sequence introduces the broader study catalog, store, Starter Membership, and future Bible Intelligence Agency offers. Do not use Starter credits for this resource.

## Tracking URL pattern

```text
/free/foundation-audit?creator=sedrick-davis&source=youtube&video=VIDEO_ID&campaign=foundation-audit&utm_source=youtube&utm_medium=video&utm_campaign=foundation-audit
```

Captured fields:

- brand
- creator
- acquisition source
- video identifier
- campaign
- resource slug
- UTM source
- UTM medium
- UTM campaign
- UTM content
- page path
- referrer
- consent timestamp
- Kit subscriber ID
- delivery status

## Database

Apply:

`supabase/migrations/20260723_foundation_audit_lead_magnet.sql`

Applied successfully to the `gp73-knowledge-engine` production project on July 23, 2026. A read-only verification confirmed one active `gp73 / foundation-audit` catalog record with the expected landing and PDF paths.

This creates only:

- `free_resources`
- `free_resource_leads`

It does not touch:

- `documents`
- `match_documents`
- membership credits
- Starter Workflow A
- Starter Workflow B

## Verification rule

Do not send an email during code QA.

After the page, database, Kit assets, and environment variables are configured:

1. use one controlled subscriber
2. submit the landing page once
3. confirm one `free_resource_leads` row
4. confirm the Foundation Audit Kit tag
5. confirm the YouTube source tag
6. confirm the delivery sequence enrollment
7. confirm the shared nurture enrollment
8. confirm the delivery email arrives
9. confirm the PDF link opens
10. confirm a repeat submission does not create a duplicate lead row
