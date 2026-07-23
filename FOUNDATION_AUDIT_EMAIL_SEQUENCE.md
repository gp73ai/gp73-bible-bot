# Foundation Audit Email Sequence

## Delivery sequence

Sequence name: `Foundation Audit - Delivery`

Timing: immediately after successful opt-in

Subject: Your Foundation Audit is ready

Preview: Start with the last seven days.

Body:

Hi {{ subscriber.first_name }},

Your Foundation Audit is ready.

This is a ten-minute, four-law diagnostic for what your Bible study and your week are really built on.

Do not answer from what you meant to do. Use the last seven days. That is where the audit becomes honest and useful.

Button: `DOWNLOAD THE FOUNDATION AUDIT`

Button destination:

`https://gp73-bible-bot.vercel.app/assets/free/foundation-audit.pdf`

Save the PDF somewhere you can return to it. If the button does not work, reply to this email and we will help you.

Godsprisoner  
Bible Intelligence Agency

## Shared nurture sequence

Sequence name: `Free Resources - Shared Nurture`

This sequence is shared by Sedrick, Angela, and future creators. The delivery sequence is resource-specific. The nurture sequence is ecosystem-wide and uses the lead fields and tags to preserve source attribution.

### Email 1

Timing: 2 days after delivery

Subject: What did the last seven days reveal?

Preview: The audit only works when you answer from evidence.

Body:

Hi {{ subscriber.first_name }},

When you completed the audit, what did the last seven days actually reveal?

Most people judge their spiritual foundation by intention. The Foundation Audit asks a harder question: what are your habits producing?

Choose the weakest law you identified. Do not try to repair everything today. Strengthen one area with one repeatable action.

Button: `REVISIT THE FOUNDATION AUDIT`

Button destination:

`https://gp73-bible-bot.vercel.app/assets/free/foundation-audit.pdf`

### Email 2

Timing: 4 days after delivery

Subject: Information is not formation

Preview: Knowing more does not automatically make the foundation stronger.

Body:

Hi {{ subscriber.first_name }},

Bible information can increase while discernment stays weak.

Formation happens when truth changes how you interpret, decide, obey, and live. That is why the Bible Intelligence Agency study library is organized around clarity and application, not collecting disconnected facts.

If you want to continue with a focused study, browse the library and choose the issue that matches what your audit exposed.

Button: `EXPLORE THE STUDY LIBRARY`

Button destination:

`https://gp73-bible-bot.vercel.app/store`

### Email 3

Timing: 7 days after delivery

Subject: Choose the study that fits the crack

Preview: Do not buy random information. Match the study to the weakness.

Body:

Hi {{ subscriber.first_name }},

The right next study should match the weakness you identified.

If the problem is belief without understanding, start there. If prayer feels dead, address that. If your habits keep repeating without real change, choose the resource that confronts the pattern directly.

You do not need every study today. You need the right one next.

Button: `FIND MY NEXT STUDY`

Button destination:

`https://gp73-bible-bot.vercel.app/store`

### Email 4

Timing: 10 days after delivery

Subject: A structured way to keep growing

Preview: Two study credits each month, chosen by you.

Body:

Hi {{ subscriber.first_name }},

If you want a consistent structure instead of buying disconnected studies, Starter Membership gives you two study credits each month.

You choose which eligible studies to unlock. Credits reset monthly and do not roll over. The purpose is simple: keep moving through the material you actually need.

Starter is separate from the free Foundation Audit. Your audit did not use a membership credit.

Button: `SEE STARTER MEMBERSHIP`

Button destination:

`https://gp73-bible-bot.vercel.app/choose-your-path`

### Email 5

Timing: 14 days after delivery

Subject: Go deeper when you are ready

Preview: The Foundation Audit was the starting point.

Body:

Hi {{ subscriber.first_name }},

The Foundation Audit was designed to show you where the structure is weak.

The Bible Intelligence Agency exists to help you go deeper with organized studies, direct teaching, and a clearer path through the subjects that keep believers confused or stuck.

Take the next step when it matches what your audit revealed.

Button: `ENTER THE BIBLE INTELLIGENCE AGENCY`

Button destination:

`https://gp73-bible-bot.vercel.app/store`

## Automation rules

1. `Lead Magnet - Foundation Audit` enters the delivery sequence once.
2. `Source - YouTube` preserves the acquisition source.
3. `Creator - Sedrick Davis` preserves the creator source.
4. Delivery sequence enrollment is idempotent.
5. Shared nurture sequence enrollment is idempotent.
6. Existing members may receive the requested resource, but membership tags and credits are not changed.
7. Purchasers and active members remain eligible for relevant nurture unless they unsubscribe.
8. Unsubscribed, bounced, or complained subscribers must remain suppressed.
9. No broadcast is sent as part of this setup.
10. The first controlled test uses one approved subscriber only.
