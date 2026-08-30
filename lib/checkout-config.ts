/**
 * Free-funnel config (single source of truth).
 *
 * Everything visible on the site is env-controlled so batch content,
 * copy, and deploy host can change without touching code:
 *
 *     NEXT_PUBLIC_PRODUCTION_HOST=intl.example.com     # deploy subdomain
 *     NEXT_PUBLIC_VALUE_STACK_LABEL=$120                 # "worth X" line
 *     NEXT_PUBLIC_WEBINAR_DATE=8th September           # batch date
 *     NEXT_PUBLIC_WEBINAR_TIMES=4:30 AM, 2:30 PM & 5:30 PM GST  # session times
 *     NEXT_PUBLIC_WHATSAPP_INVITE_URL=https://chat.whatsapp.com/...
 *
 * There is NO price env — this is a free registration funnel.
 */

const PRODUCTION_HOST =
  process.env.NEXT_PUBLIC_PRODUCTION_HOST?.trim() || 'international.bodyworx.in';

// Value-stack label shown in "worth X" copy across landing sections.
// Kept as a single string (not a number + currency) so it can be swapped
// per campaign / region without any code change — e.g. `$120`, `₹10,000`,
// `£90`, `€110`. Default is USD — ads currently run in the UAE.
const VALUE_STACK_LABEL =
  process.env.NEXT_PUBLIC_VALUE_STACK_LABEL?.trim() || '$120';

const WEBINAR_DATE =
  process.env.NEXT_PUBLIC_WEBINAR_DATE?.trim() || '8th September';
const WEBINAR_TIMES =
  process.env.NEXT_PUBLIC_WEBINAR_TIMES?.trim() ||
  '4:30 AM, 2:30 PM & 5:30 PM GST';
const WHATSAPP_INVITE_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_INVITE_URL?.trim() ||
  'https://chat.whatsapp.com/PLACEHOLDER';

export const CHECKOUT_CONFIG = {
  capi: {
    // ── Meta CAPI event names — CUSTOM, never standard ──────────────────
    // The dataset (Ankita Pixel 3 / 2344458902754627) is classified under
    // Meta's "Health and wellness condition" category, which blocks or
    // deprioritizes STANDARD events. Standard names are therefore banned
    // here: `AddToCart`, `CompleteRegistration` and `QualifiedLead` are
    // gone and must not come back — re-adding one re-triggers the exact
    // restriction these names exist to route around.
    //
    // Per META_HW_POST_FIX_ROADMAP.md the win condition is not the warning
    // disappearing (it won't — classification is content-driven and
    // effectively permanent). It is these custom events continuing to flow
    // so campaigns keep optimizing. Point every ad set at these names.
    //
    // If Meta later scans/deprioritizes these too (Scenario C), make the
    // names more opaque here — `evt_a`, `evt_b`, `evt_c` — and repoint the
    // ad sets. This object is the only place they are defined.
    addToCartEventName: 'atc_event',            // landing CTA click
    completeRegistrationEventName: 'reg_complete', // /api/register success
    // `ql_event`, not `qualified_lead`: field reports have Meta blocking
    // names containing the token "lead" (`lead`, `generate_lead`) on
    // restricted datasets, so the word is avoided entirely.
    qualifiedLeadEventName: 'ql_event',         // "Working Professional"
    // Host allow-list: env-driven so a new deploy subdomain only needs an
    // env swap (in .env.local + Vercel), no code change. Localhost and
    // *.vercel.app previews are deliberately excluded so test traffic
    // doesn't pollute Meta's pixel data.
    productionHosts: [PRODUCTION_HOST],
    // Used when the client doesn't send eventSourceUrl. Restricted-category
    // accounts require event_source_url on every event or Meta drops them.
    fallbackEventSourceUrl: `https://${PRODUCTION_HOST}/register`,
  },

  // Gulf Standard Time (UTC+4) — the batch times above and the Pabbly
  // registered_date/_time stamps are both expressed in the UAE's timezone.
  registrationTimezone: 'Asia/Dubai',
  funnelSlug: 'postpartum-challenge-free',
  utmSessionKey: 'bodyworx_utm',

  valueStackLabel: VALUE_STACK_LABEL,
  webinarDate: WEBINAR_DATE,
  webinarTimes: WEBINAR_TIMES,
  whatsappInviteUrl: WHATSAPP_INVITE_URL,
  productionHost: PRODUCTION_HOST,
};
