import {
  hashEmail,
  hashPhone,
  hashName,
  hashCity,
  hashCountry,
  sha256Hex,
  toOrigin,
} from '@/lib/meta-capi';

/**
 * Meta CAPI event senders — free funnel.
 *
 * Three events fire from the server:
 *   - AddToCart on landing CTA click (POST /api/meta/add-to-cart)
 *   - QualifiedLead when user picks "Working Professional"
 *     (POST /api/meta/qualified-lead)
 *   - CompleteRegistration on successful /api/register submission
 *
 * H&W PREVENTIVE POSTURE (META_HW_PREVENTIVE_SOP.md)
 * ---------------------------------------------------
 * Standard event names are retained by explicit decision, but every OTHER
 * classification surface the SOP names is stripped:
 *
 *   - custom_data carries NO descriptive strings. No content_name,
 *     content_ids, content_type, category, lead_type, and no utm_* /
 *     fbclid. An opaque `order_id` is the only field that survives, and
 *     only where we have one. These strings were the loudest signal we
 *     controlled — "Postpartum Recovery Challenge" told Meta's classifier
 *     exactly what the dataset was about.
 *   - event_source_url is reduced to its ORIGIN (toOrigin) so no health-y
 *     path or query string is ever crawled.
 *   - external_id is sha256(lowercased email) on every event — one stable
 *     identity that reconciles 1:1 with the Pabbly `external_id` column.
 *
 * Full hashed user_data stays (EMQ) — hashed PII is not a classification
 * signal and is what keeps match quality high.
 */

/**
 * AddToCart — no PII available at CTA click time (the visitor hasn't
 * typed anything yet), so there is no email to derive external_id from.
 * Only signals we have are fbc/fbp cookies + IP + UA. Expected EMQ: 3–5
 * — a data-availability ceiling, not a bug.
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

  // No custom_data at all — nothing descriptive to say about a CTA click,
  // and anything we did say would only feed the classifier.
  const payload = {
    data: [
      {
        event_name: 'AddToCart',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: toOrigin(params.eventSourceUrl),
        user_data: userData,
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
  // external_id — sha256(lowercased email), identical to the value the
  // Pabbly payload ships under the same key, so a CRM row and a Meta
  // event can be reconciled without a second identifier.
  const externalId = em;

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

  // No `value` / `currency` — free registration, nothing is charged. No
  // content_name / content_ids / status / utm_* either: those are the
  // descriptive strings the preventive SOP strips. `order_id` is an
  // opaque hash prefix and says nothing about the offer.
  const customData = {
    order_id: params.registrationId,
  };

  const payload = {
    data: [
      {
        event_name: 'CompleteRegistration',
        event_time: Math.floor(Date.now() / 1000),
        event_id: params.registrationId,
        action_source: 'website',
        event_source_url: toOrigin(params.eventSourceUrl),
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
 * QualifiedLead — fired for a visitor who identifies as "Working
 * Professional", at SUBMIT time only (never on dropdown change), so the
 * event always carries a complete, validated identity set. Custom event
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
  // Same sha256(email) identity as CompleteRegistration and Pabbly.
  const externalId = em;

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

  // No custom_data — content_name/lead_type were pure classification fuel
  // and told Meta nothing it needs. The event NAME already carries the
  // only meaning we want the optimizer to see.
  const payload = {
    data: [
      {
        event_name: 'QualifiedLead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: toOrigin(params.eventSourceUrl),
        user_data: userData,
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
