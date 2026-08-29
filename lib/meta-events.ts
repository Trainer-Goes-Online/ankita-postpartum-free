import { sha256Hex, hashEmail, hashPhone, hashName, hashCity, hashCountry, type Utm } from '@/lib/meta-capi';

/**
 * Meta CAPI event senders — free funnel.
 *
 * Three events fire from the server:
 *   - AddToCart on landing CTA click (POST /api/meta/add-to-cart)
 *   - QualifiedLead when user picks "Working Professional"
 *     (POST /api/meta/qualified-lead)
 *   - CompleteRegistration on successful /api/register submission
 *
 * Standard Meta event names (dataset not H&W-classified). Full PII
 * payload on the identified events (CompleteRegistration + IC + QL) —
 * same 11-signal user_data shape used by the sibling paid funnel's
 * Purchase/sales, minus the money fields.
 */

/**
 * AddToCart — no PII available at CTA click time. Only signals we have
 * are fbc/fbp cookies + IP + UA. Expected EMQ: 3–5 (data-availability
 * ceiling, not a bug).
 */
export async function sendAddToCartEvent(params: {
  pixelId: string;
  accessToken: string;
  fbc: string | undefined;
  fbp: string | undefined;
  clientIp: string | undefined;
  clientUserAgent: string | undefined;
  eventSourceUrl: string;
}) {
  // event_id — deterministic per browser so Meta's 48h dedup collapses
  // accidental double-fires from rapid clicks / multi-tab. Falls back to
  // random hex if _fbp cookie is missing (ad-blocker case).
  const eventId = params.fbp
    ? sha256Hex(`${params.fbp}|atc`)
    : `${sha256Hex(`${Date.now()}_${Math.random()}`)}_atc`;

  const userData = {
    ...(params.fbc && { fbc: params.fbc }),
    ...(params.fbp && { fbp: params.fbp }),
    ...(params.clientUserAgent && { client_user_agent: params.clientUserAgent }),
    ...(params.clientIp && { client_ip_address: params.clientIp }),
  };

  const customData = {
    content_ids: ['postnatal_recovery_challenge_free'],
    content_name: '5-Day Postpartum Recovery Challenge — Free Registration',
    content_type: 'product',
  };

  const payload = {
    data: [
      {
        event_name: 'AddToCart',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: params.eventSourceUrl,
        user_data: userData,
        custom_data: customData,
      },
    ],
  };

  const res = await fetch(
    `https://graph.facebook.com/v25.0/${params.pixelId}/events?access_token=${params.accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}

/**
 * CompleteRegistration — fires when /api/register successfully accepts a
 * form submission. Full 11-signal payload. This is the "conversion"
 * event of the free funnel and is what campaigns should optimize for.
 */
export async function sendCompleteRegistrationEvent(params: {
  pixelId: string;
  accessToken: string;
  registrationId: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  city: string;
  country: string;
  externalId: string | undefined;
  fbc: string | undefined;
  fbp: string | undefined;
  clientIp: string | undefined;
  clientUserAgent: string | undefined;
  eventSourceUrl: string;
  utm: Utm;
}) {
  const em = hashEmail(params.email);
  const ph = hashPhone(params.phone);
  const fn = hashName(params.firstName);
  const ln = hashName(params.lastName);
  const ct = hashCity(params.city);
  const country = hashCountry(params.country);
  const externalId = params.externalId
    ? sha256Hex(params.externalId.trim().toLowerCase())
    : undefined;

  const userData = {
    ...(em && { em: [em] }),
    ...(ph && { ph: [ph] }),
    ...(fn && { fn: [fn] }),
    ...(ln && { ln: [ln] }),
    ...(ct && { ct: [ct] }),
    ...(country && { country: [country] }),
    ...(externalId && { external_id: [externalId] }),
    ...(params.fbc && { fbc: params.fbc }),
    ...(params.fbp && { fbp: params.fbp }),
    ...(params.clientUserAgent && { client_user_agent: params.clientUserAgent }),
    ...(params.clientIp && { client_ip_address: params.clientIp }),
  };

  // No `value` / `currency` — this is a free registration, not a
  // purchase. Meta CompleteRegistration expects a currency+value pair
  // only for paid registrations; a free registration ships neither.
  const customData = {
    content_ids: ['postnatal_recovery_challenge_free'],
    content_name: '5-Day Postpartum Recovery Challenge — Free Registration',
    content_type: 'product',
    status: 'completed',
    registration_id: params.registrationId,
    ...(params.utm.source && { utm_source: params.utm.source }),
    ...(params.utm.medium && { utm_medium: params.utm.medium }),
    ...(params.utm.campaign && { utm_campaign: params.utm.campaign }),
    ...(params.utm.content && { utm_content: params.utm.content }),
    ...(params.utm.term && { utm_term: params.utm.term }),
    ...(params.utm.id && { utm_id: params.utm.id }),
  };

  const payload = {
    data: [
      {
        event_name: 'CompleteRegistration',
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.registrationId,
        action_source: 'website',
        event_source_url: params.eventSourceUrl,
        user_data: userData,
        custom_data: customData,
      },
    ],
  };

  const res = await fetch(
    `https://graph.facebook.com/v25.0/${params.pixelId}/events?access_token=${params.accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}

/**
 * QualifiedLead — fired the first time a visitor identifies as "Working
 * Professional" in the register-form occupation dropdown. Custom event
 * name (PascalCase) so Meta's algorithm can be pointed at it as a
 * mid-funnel optimization signal.
 */
export async function sendQualifiedLeadEvent(params: {
  pixelId: string;
  accessToken: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  city: string;
  country: string;
  externalId: string | undefined;
  fbc: string | undefined;
  fbp: string | undefined;
  clientIp: string | undefined;
  clientUserAgent: string | undefined;
  eventSourceUrl: string;
}) {
  const em = hashEmail(params.email);
  const ph = hashPhone(params.phone);
  const fn = hashName(params.firstName);
  const ln = hashName(params.lastName);
  const ct = hashCity(params.city);
  const country = hashCountry(params.country);
  const externalId = params.externalId
    ? sha256Hex(params.externalId.trim().toLowerCase())
    : undefined;

  const emailNorm = params.email.trim().toLowerCase();
  const eventId = emailNorm
    ? sha256Hex(`${emailNorm}|ql`)
    : params.fbp
      ? sha256Hex(`${params.fbp}|ql`)
      : `${sha256Hex(`${Date.now()}_${Math.random()}`)}_ql`;

  const userData = {
    ...(em && { em: [em] }),
    ...(ph && { ph: [ph] }),
    ...(fn && { fn: [fn] }),
    ...(ln && { ln: [ln] }),
    ...(ct && { ct: [ct] }),
    ...(country && { country: [country] }),
    ...(externalId && { external_id: [externalId] }),
    ...(params.fbc && { fbc: params.fbc }),
    ...(params.fbp && { fbp: params.fbp }),
    ...(params.clientUserAgent && { client_user_agent: params.clientUserAgent }),
    ...(params.clientIp && { client_ip_address: params.clientIp }),
  };

  const customData = {
    content_ids: ['postnatal_recovery_challenge_free'],
    content_name: '5-Day Postpartum Recovery Challenge — Working Professional',
    content_type: 'product',
    lead_type: 'working_professional',
  };

  const payload = {
    data: [
      {
        event_name: 'QualifiedLead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: params.eventSourceUrl,
        user_data: userData,
        custom_data: customData,
      },
    ],
  };

  const res = await fetch(
    `https://graph.facebook.com/v25.0/${params.pixelId}/events?access_token=${params.accessToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(JSON.stringify(err));
  }
  return res.json();
}
