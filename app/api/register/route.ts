import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { CHECKOUT_CONFIG } from '@/lib/checkout-config';
import { sendCompleteRegistrationEvent } from '@/lib/meta-events';
import { hashEmail, type Utm, type CustomerData } from '@/lib/meta-capi';
import {
  ATTR_COOKIE,
  readAttrCookie,
  resolveAttribution,
  type AttrLike,
} from '@/lib/attribution';

/**
 * POST /api/register
 *
 * The conversion authority of the free funnel. Replaces the paid
 * funnel's Razorpay webhook — since there is no payment, the moment
 * of truth is the form submission itself.
 *
 * Pipeline:
 *   1. Validate the customer body has an email.
 *   2. Read attribution — bw_attr cookie is primary, body a supplement,
 *      referrer + _fbc are fallbacks (same precedence chain the paid
 *      funnel's create-order uses).
 *   3. Mint a deterministic registrationId (sha256(email + salt)) so
 *      double-submits from the same email get Meta-deduped within 48h.
 *   4. Fire Pabbly webhook (always — CRM row for every registration).
 *   5. Fire Meta CAPI CompleteRegistration (host-gated to production;
 *      preview / localhost skips cleanly).
 *   6. Return `{success, registrationId}` so the client can redirect
 *      to /thank-you.
 */

interface RegisterCustomerData extends CustomerData {
  occupation?: string;
}

type UtmBody = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  id?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      customer,
      utm,
      fbclid: fbclidFromBody,
      eventSourceUrl,
    }: {
      customer?: RegisterCustomerData;
      utm?: UtmBody;
      fbclid?: string;
      eventSourceUrl?: string;
    } = body;

    if (!customer?.email) {
      return NextResponse.json(
        { success: false, error: 'Missing customer email.' },
        { status: 400 },
      );
    }
    if (!customer.firstName || !customer.phone) {
      return NextResponse.json(
        { success: false, error: 'Missing required customer fields.' },
        { status: 400 },
      );
    }

    // ── Attribution: cookie primary, body supplement, referrer + _fbc fallback ──
    const fbcCookie = req.cookies.get('_fbc')?.value;
    const fbpCookie = req.cookies.get('_fbp')?.value;
    const bwUid = req.cookies.get('bw_uid')?.value;
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      '';
    const clientUserAgent = req.headers.get('user-agent') ?? '';
    const referrerHeader = req.headers.get('referer') ?? '';

    const cookieAttr = readAttrCookie(req.cookies.get(ATTR_COOKIE)?.value);
    const bodyAttr: AttrLike = {
      source:   utm?.source   ?? '',
      medium:   utm?.medium   ?? '',
      campaign: utm?.campaign ?? '',
      content:  utm?.content  ?? '',
      term:     utm?.term     ?? '',
      id:       utm?.id       ?? '',
      fbclid:   fbclidFromBody ?? '',
    };
    const resolved = resolveAttribution({
      cookieAttr,
      bodyAttr,
      referrer: referrerHeader,
      landingUrl: cookieAttr.landing_url ?? '',
      fbc: fbcCookie ?? '',
    });

    // Reconstruct _fbc when the browser cookie is empty (Pixel blocked,
    // iOS ITP, in-app race) — recovers Meta match quality on paid social.
    const fbc =
      fbcCookie ||
      (resolved.fbclid ? `fb.1.${resolved.fbclidTs}.${resolved.fbclid}` : '');
    const resolvedEventSourceUrl =
      eventSourceUrl?.trim() || CHECKOUT_CONFIG.capi.fallbackEventSourceUrl;

    if (resolved.utmSource === 'none' && !resolved.fbclid) {
      console.error('[register] ATTRIBUTION MISSING — no utm/fbclid recovered');
    }

    // ── Mint a deterministic registrationId ─────────────────────────────
    // sha256(email|reg) — stable per real user so a duplicate submit
    // within Meta's 48h dedup window collapses to one CompleteRegistration
    // event. Pabbly may still see duplicate rows — filter downstream on
    // registration_id.
    const emailNorm = customer.email.trim().toLowerCase();
    const registrationId = `reg_${crypto
      .createHash('sha256')
      .update(`${emailNorm}|reg`)
      .digest('hex')
      .slice(0, 24)}`;

    const now = new Date();
    const externalIdEmailHash = hashEmail(customer.email) ?? '';
    const utmResolved: Utm = {
      source:   resolved.utm.source,
      medium:   resolved.utm.medium,
      campaign: resolved.utm.campaign,
      content:  resolved.utm.content,
      term:     resolved.utm.term,
      id:       resolved.utm.id,
    };

    // ── Build the Pabbly payload ────────────────────────────────────────
    // Free-funnel schema — no amount/currency/payment_id fields. Adds:
    //   registration_id, registered_at, attribution_source, occupation
    // and keeps the same identity/attribution/context blocks as the
    // paid funnel so a shared CRM template can consume both.
    const pabblyPayload = {
      first_name:        customer.firstName,
      last_name:         customer.lastName,
      full_name:         `${customer.firstName} ${customer.lastName}`.trim(),
      email:             customer.email,
      phone:             `${customer.dialCode}${customer.phone}`,
      city:              customer.city,
      country_code:      customer.countryCode,
      occupation:        customer.occupation ?? '',
      registration_id:   registrationId,
      registered_at:     now.toISOString(),
      registered_date:   now.toLocaleDateString('en-GB', { timeZone: CHECKOUT_CONFIG.registrationTimezone }),
      registered_time:   now.toLocaleTimeString('en-GB', { timeZone: CHECKOUT_CONFIG.registrationTimezone }),
      utm_source:        utmResolved.source ?? '',
      utm_medium:        utmResolved.medium ?? '',
      utm_campaign:      utmResolved.campaign ?? '',
      utm_content:       utmResolved.content ?? '',
      utm_term:          utmResolved.term ?? '',
      utm_id:            utmResolved.id ?? '',
      lead_id:           registrationId,
      created_at:        now.toISOString(),
      fbc:               fbc,
      fbp:               fbpCookie ?? '',
      client_ip_address: clientIp,
      client_user_agent: clientUserAgent,
      external_id:       externalIdEmailHash,
      event_source_url:  resolvedEventSourceUrl,
      is_test:           'false',
      fbclid:            resolved.fbclid,
      attribution_source: resolved.provenance,
      funnel:            CHECKOUT_CONFIG.funnelSlug,
    };

    // ── Fire Pabbly (always, non-blocking) ──────────────────────────────
    let pabblyStatus: 'sent' | 'skipped' | 'error' = 'skipped';
    const webhookUrl = process.env.PABBLY_WEBHOOK_URL;
    if (webhookUrl) {
      try {
        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pabblyPayload),
        });
        if (r.ok) {
          console.log(`[register] registrationId=${registrationId} Pabbly sent (${r.status})`);
          pabblyStatus = 'sent';
        } else {
          console.error(`[register] registrationId=${registrationId} Pabbly failed (${r.status})`);
          pabblyStatus = 'error';
        }
      } catch (err) {
        console.error(`[register] registrationId=${registrationId} Pabbly threw:`, err);
        pabblyStatus = 'error';
      }
    } else {
      console.error(`[register] registrationId=${registrationId} PABBLY_WEBHOOK_URL not set`);
    }

    // ── Fire Meta CAPI CompleteRegistration ─────────────────────────────
    // Host-gated to production so localhost + previews never fire.
    const requestHost = (req.headers.get('host') ?? '').toLowerCase().split(':')[0];
    const isProductionHost = CHECKOUT_CONFIG.capi.productionHosts.includes(requestHost);
    const metaPixelId =
      process.env.NEXT_PUBLIC_META_PIXEL_ID ?? process.env.META_PIXEL_ID;
    const metaAccessToken = process.env.META_CAPI_ACCESS_TOKEN;

    let capiStatus: 'sent' | 'skipped' | 'error' = 'skipped';
    if (!isProductionHost) {
      console.log(`[register] CAPI skipped — non-production host "${requestHost}"`);
    } else if (metaPixelId && metaAccessToken) {
      try {
        const capiResult = await sendCompleteRegistrationEvent({
          pixelId: metaPixelId,
          accessToken: metaAccessToken,
          registrationId,
          email: customer.email,
          phone: `${customer.dialCode}${customer.phone}`,
          firstName: customer.firstName,
          lastName: customer.lastName,
          city: customer.city,
          country: customer.countryCode,
          externalId: bwUid,
          fbc: fbc || undefined,
          fbp: fbpCookie,
          clientIp: clientIp || undefined,
          clientUserAgent: clientUserAgent || undefined,
          eventSourceUrl: resolvedEventSourceUrl,
          utm: utmResolved,
        });
        console.log(
          `[register] registrationId=${registrationId} Meta CAPI CompleteRegistration sent:`,
          capiResult,
        );
        capiStatus = 'sent';
      } catch (err) {
        console.error(`[register] registrationId=${registrationId} Meta CAPI error:`, err);
        capiStatus = 'error';
      }
    } else {
      console.error(`[register] registrationId=${registrationId} Meta env vars missing`);
    }

    return NextResponse.json({
      success: true,
      registrationId,
      pabbly: pabblyStatus,
      capi: capiStatus,
    });
  } catch (err) {
    console.error('[register] fatal:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500 },
    );
  }
}
