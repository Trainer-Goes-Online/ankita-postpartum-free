# BodyWorx — Free international postpartum funnel

Sibling project to `ankita-postpartum` (₹497 paid India funnel). This repo hosts
the **100% free** version aimed at international traffic. Same landing-page
structure and tracking stack; **no payment provider**.

## Stack

- Next.js 14.2 (App Router) · React 18 · TypeScript 5
- Tailwind 3 · Framer Motion · Phosphor Icons · Plus Jakarta / Poppins / Fraunces
- CRM: Pabbly Connect webhook (fired from `/api/register` after form submit)
- Tracking: Meta Pixel (browser `PageView` + Manual Advanced Matching) + Meta CAPI
  (`AddToCart`, `CompleteRegistration`, `QualifiedLead`) + GA4 + Clarity —
  everything host-gated to `NEXT_PUBLIC_PRODUCTION_HOST`
- Attribution: edge-middleware `bw_attr` cookie (L1–L6 per playbook), server
  routes read cookie first, body supplement, referrer + `_fbc` fallback

## Routes

| Route | File | Notes |
|---|---|---|
| `/` | [app/page.tsx](app/page.tsx) + `_landing/*` | Landing (identical to paid funnel minus pricing) |
| `/register` | [app/register/page.tsx](app/register/page.tsx) | 2-col form + free-registration summary; submits to `/api/register` |
| `/thank-you` | [app/thank-you/page.tsx](app/thank-you/page.tsx) | WhatsApp community invite |
| `/privacy-policy` | | Legal |
| `/terms-and-conditions` | | Legal (no refund section — nothing is charged) |
| `POST /api/register` | [app/api/register/route.ts](app/api/register/route.ts) | Pabbly + Meta CAPI `CompleteRegistration` |
| `POST /api/meta/add-to-cart` | | Meta CAPI `AddToCart` on landing CTA click |
| `POST /api/meta/qualified-lead` | | Meta CAPI `QualifiedLead` on "Working Professional" |

## Env vars (all in `.env.local`)

See [`.env.local.example`](.env.local.example) for the full list.

- `NEXT_PUBLIC_PRODUCTION_HOST` — bare hostname; drives host gate + `metadataBase` + CAPI fallback URL
- `NEXT_PUBLIC_VALUE_STACK_LABEL` — "worth X" line; swap per region (₹10,000 / $120 / £90)
- `NEXT_PUBLIC_WEBINAR_DATE` / `_TIMES` — batch content, updated every ~2 weeks
- `NEXT_PUBLIC_WHATSAPP_INVITE_URL` — international community group
- `NEXT_PUBLIC_META_PIXEL_ID` + `META_CAPI_ACCESS_TOKEN` — dedicated free-funnel pixel
- `PABBLY_WEBHOOK_URL` — new international CRM workflow
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID` / `NEXT_PUBLIC_CLARITY_PROJECT_ID` — optional

**No Razorpay env vars.** No price env vars. No coupon logic.

## Fork lineage

Forked from `ankita-postpartum` on 2026-08-29. Structural diff vs paid funnel:

- **Removed**: `razorpay` npm dep, `/api/razorpay/*`, `/api/checkout/free-order`, `lib/coupons.ts`, `PaymentLogos` component, `/refund-policy` page, `Purchase` / `sales` / `InitiateCheckout` CAPI events, all pricing constants (`amountRupeesNumeric`, `listPriceRupees`, `PRICE`, `LIST`, `VALUE_TOTAL`)
- **Renamed**: `/checkout` → `/register`; `handleSubmit` fires `/api/register` directly (no order-create + modal path); `CheckoutIntentListener` now watches `/register` anchors
- **Added**: `/api/register` route, `sendCompleteRegistrationEvent` in `lib/meta-events.ts`, env-driven `NEXT_PUBLIC_PRODUCTION_HOST` + `NEXT_PUBLIC_VALUE_STACK_LABEL`
- **Adapted copy**: hero CTA "Register Free — Save Your Spot", value stack shows `VALUE_STACK_LABEL → FREE`, sticky CTA "100% Free · Starts …"

Kept identically: attribution middleware + `lib/attribution.ts`, MAM cookie, `bw_uid` external_id, `bw_mam` MAM cookie, `bw_fbclid` legacy cookie, Meta Pixel loader + host gate, GA4 helper (retargeted to `add_to_cart` / `complete_registration` / `join_whatsapp`), Pabbly payload shape (adapted: `registration_id` instead of `payment_id`, no amount/currency fields, adds `attribution_source` + `occupation`).

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run build
npm run type-check
npm run lint
```
