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
  process.env.NEXT_PUBLIC_PRODUCTION_HOST?.trim() || 'bodyworx-free.local';

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
    // Meta CAPI event names for the free funnel:
    //   - AddToCart: fires on landing CTA click
    //   - CompleteRegistration: fires on /api/register success
    //   - QualifiedLead: fires when the user picks "Working Professional"
    completeRegistrationEventName: 'CompleteRegistration',
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
