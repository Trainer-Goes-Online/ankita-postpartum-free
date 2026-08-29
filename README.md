# BodyWorx — Free Postpartum Recovery Challenge (international funnel)

Next.js 14 (App Router) site for the **5-Day Postpartum Recovery Challenge**
delivered **100% free** to international audiences.

Sibling project to `ankita-postpartum` (the ₹497 paid India funnel). The two
share the landing-page copy structure, attribution + tracking stack, and CRM
schema — but this project has **no payment provider**. The moment of truth is
form submission, not payment.

## Pages

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/register` | 2-col free registration form (name, email, city, phone, occupation) |
| `/thank-you` | Registration confirmed + WhatsApp community invite |
| `/privacy-policy` | Legal |
| `/terms-and-conditions` | Legal (no refund policy — nothing is charged) |

## API routes

| Route | What fires |
|---|---|
| `POST /api/register` | Pabbly webhook + Meta CAPI `CompleteRegistration` on form submit |
| `POST /api/meta/add-to-cart` | Meta CAPI `AddToCart` on any landing CTA click |
| `POST /api/meta/qualified-lead` | Meta CAPI `QualifiedLead` when user picks "Working Professional" |

The `middleware.ts` at the repo root captures `utm_*` / `fbclid` / `gclid` at
the edge on every HTML request into the `bw_attr` cookie, so attribution
survives the client-hydration race that would otherwise drop it on in-app
browsers.

## Local setup

```bash
npm install
cp .env.local.example .env.local
# Fill in Pabbly webhook + Meta pixel/CAPI + subdomain + webinar times +
# WhatsApp invite. See .env.local.example for what each key does.
npm run dev
```

Visit http://localhost:3000. On localhost the Meta CAPI + GA4 + Clarity are
all host-gated off, so no test data pollutes production analytics.

## Deploy

1. Push to this repo (`ankita-postpartum-free`).
2. Import into Vercel.
3. Add every env var from `.env.local` to Vercel Production.
4. Point the international subdomain (e.g. `intl.bodyworx.in`) at the
   Vercel deployment.
5. **Set `NEXT_PUBLIC_PRODUCTION_HOST` in Vercel to the exact bare hostname**
   (no scheme). The middleware allow-list + `metadataBase` + CAPI host gate
   all read this — one env, one place to update.
6. Add the same hostname to the Meta dataset's Traffic Permissions.
7. Create a Pabbly workflow pointed at the new international CRM (34-field
   payload — includes `registration_id`, `attribution_source`, `occupation`,
   and the standard identity + attribution + context blocks the paid funnel
   also emits).

## What changes vs. the paid funnel

Removed entirely:
- Razorpay SDK + all `/api/razorpay/*` routes + coupon logic
- `/api/checkout/free-order` (there is no coupon path any more — everything is free)
- `Purchase` + `sales` CAPI events + `InitiateCheckout` CAPI event
- Pricing display everywhere (₹PRICE, ₹LIST, SAVE-₹X, "70% off", refund policy)
- Refund policy page

Added / adapted:
- `/register` route (renamed from `/checkout`) with `Complete Free Registration` submit button
- `/api/register` server route that fires Pabbly + `CompleteRegistration`
- `sendCompleteRegistrationEvent` in `lib/meta-events.ts`
- Env-driven `NEXT_PUBLIC_PRODUCTION_HOST` for the deploy hostname
- Env-driven `NEXT_PUBLIC_VALUE_STACK_LABEL` (`₹10,000` / `$120` / `£90` — swap per campaign)
- Copy shift: "Get Instant Access · ₹PRICE" → "Register Free — Save Your Spot" everywhere
