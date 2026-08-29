'use client';

/**
 * /register — 2-column free registration form for the 5-Day Postpartum
 * Recovery Challenge (international free funnel). Self-contained
 * (no navbar, inline palette), routes success → /thank-you. Submits to
 * /api/register which fires Pabbly + Meta CAPI CompleteRegistration.
 * No payment provider: this funnel is entirely free.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LazyMotion, domAnimation, m, type Variants } from 'framer-motion';
import { useCallback, useEffect, useRef, useState } from 'react';
import { isValidPhoneNumber } from 'libphonenumber-js';
import {
  ShieldCheck,
  Lock,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  CaretDown,
  X,
  Lightning,
  Clock,
  Sparkle,
  Heart,
} from '@phosphor-icons/react/dist/ssr';
import { CHECKOUT_CONFIG } from '@/lib/checkout-config';
import { readUtmCookie, readUtmFromUrl, writeUtmCookie } from '@/lib/utm';
import { writeMam } from '@/lib/mam';
import { trackGa4EventOnce } from '@/lib/ga4';

// ── Palette (isolated) ───────────────────────────────────────────────────────
const C = {
  brand: '#F24C69',
  deep: '#C73A57',
  bright: '#FF6E88',
  blush: '#FCE4EA',
  cream: '#FFF7F9',
  ink: '#1F1014',
  inkSoft: '#4B2A33',
  inkMuted: '#8C6B74',
  line: '#F2D6DD',
  whisper: '#FDF3F5',
  black: '#0A0A0A',
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const VALUE_STACK_LABEL = CHECKOUT_CONFIG.valueStackLabel;

// ── Country data ─────────────────────────────────────────────────────────────
interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}
const COUNTRIES: Country[] = [
  { code: 'AE', name: 'UAE', dial: '+971', flag: '🇦🇪' },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦' },
  { code: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦' },
  { code: 'KW', name: 'Kuwait', dial: '+965', flag: '🇰🇼' },
  { code: 'OM', name: 'Oman', dial: '+968', flag: '🇴🇲' },
  { code: 'BH', name: 'Bahrain', dial: '+973', flag: '🇧🇭' },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩' },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal', dial: '+977', flag: '🇳🇵' },
];

// Locale-correct sample numbers for the phone field. Falls back to a generic
// label for any country not listed here.
const PHONE_PLACEHOLDERS: Record<string, string> = {
  AE: '501234567',
  SA: '501234567',
  QA: '33123456',
  KW: '51234567',
  OM: '92123456',
  BH: '36001234',
  IN: '9876543210',
  US: '2015550123',
  GB: '7400123456',
};


// ── Validation ───────────────────────────────────────────────────────────────
const NAME_RE = /^[a-zA-Z\s\-'.]{2,}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Occupation = '' | 'Working Professional' | 'Homemaker';

interface FormFields {
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  phone: string;
  occupation: Occupation;
}
interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  city?: string;
  phone?: string;
  occupation?: string;
}

function validateFields(fields: FormFields, countryCode: string): FormErrors {
  const errors: FormErrors = {};
  if (!fields.firstName.trim()) errors.firstName = 'First name is required.';
  else if (!NAME_RE.test(fields.firstName.trim()))
    errors.firstName = 'Letters, spaces, and hyphens only.';
  if (!fields.lastName.trim()) errors.lastName = 'Last name is required.';
  else if (!NAME_RE.test(fields.lastName.trim()))
    errors.lastName = 'Letters, spaces, and hyphens only.';
  if (!fields.email.trim()) errors.email = 'Email address is required.';
  else if (!EMAIL_RE.test(fields.email.trim())) errors.email = 'Enter a valid email address.';
  if (!fields.city.trim()) errors.city = 'City is required.';
  else if (fields.city.trim().length < 2) errors.city = 'Enter your city name.';
  if (!fields.phone.trim()) {
    errors.phone = 'Phone number is required.';
  } else {
    const country = COUNTRIES.find((c) => c.code === countryCode);
    if (country) {
      try {
        const fullNumber = `${country.dial}${fields.phone.trim()}`;
        const valid = isValidPhoneNumber(
          fullNumber,
          countryCode as Parameters<typeof isValidPhoneNumber>[1],
        );
        if (!valid) errors.phone = `Invalid number for ${country.name}.`;
      } catch {
        errors.phone = 'Enter a valid phone number.';
      }
    }
  }
  if (!fields.occupation) errors.occupation = 'Please select an option.';
  return errors;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  return (
    <LazyMotion features={domAnimation}>
    <main style={{ background: C.cream, color: C.ink }} className="min-h-screen overflow-x-hidden font-body">
      <MinimalHeader />
      <CheckoutBody />
      {/* Global footer renders from app/layout.tsx */}
    </main>
    </LazyMotion>
  );
}

// ── Header — pink-gradient backdrop, brand mark on left, Back on right ──────
function MinimalHeader() {
  return (
    <header
      className="relative"
      style={{
        background: `linear-gradient(180deg, ${C.whisper} 0%, ${C.blush} 100%)`,
        borderBottom: `1px solid ${C.line}`,
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-4 md:px-8">
        {/* Brand mark — heart-in-pink-tile + BODYWORX wordmark */}
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-xl text-white shadow-sm sm:h-11 sm:w-11"
            style={{
              background: `linear-gradient(160deg, ${C.brand}, ${C.deep})`,
              boxShadow: '0 8px 20px -8px rgba(199,58,87,0.45)',
            }}
          >
            <Heart weight="fill" className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
          </span>
          <span
            className="font-heading text-[18px] font-extrabold tracking-[0.06em] sm:text-[20px]"
            style={{ color: C.ink }}
          >
            BODYWORX
          </span>
        </div>

        {/* Back link — right side */}
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold transition-colors hover:opacity-70 sm:text-[14px]"
          style={{ color: C.ink }}
        >
          <ArrowLeft weight="bold" className="h-4 w-4" />
          Back
        </Link>
      </div>
    </header>
  );
}

// ── Body — 2-col layout: form left, sticky summary right ─────────────────────
function CheckoutBody() {
  return (
    <section className="py-8 md:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-5 md:px-8">
        {/* Heading */}
        <m.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mb-8 text-center sm:mb-10 md:mb-12"
        >
          <m.span
            variants={fadeUp}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] sm:gap-2 sm:px-3.5 sm:text-[11px] sm:tracking-[0.18em]"
            style={{ background: C.blush, color: C.deep }}
          >
            <Sparkle weight="fill" className="h-3 w-3 shrink-0" />
            <span className="truncate sm:overflow-visible sm:whitespace-normal">5-Day Postpartum Recovery Challenge</span>
          </m.span>
          <m.h1
            variants={fadeUp}
            className="mt-4 font-heading text-[22px] font-extrabold leading-tight sm:text-[28px] md:text-[36px]"
            style={{ color: C.ink }}
          >
            Save Your Free Spot.
          </m.h1>
          <m.p
            variants={fadeUp}
            className="mt-2 text-[13.5px] sm:text-[14.5px]"
            style={{ color: C.inkMuted }}
          >
            One step away from your live recovery reset.
          </m.p>
        </m.div>

        {/* 2-column grid */}
        <CheckoutGrid />
      </div>
    </section>
  );
}

function CheckoutGrid() {
  const router = useRouter();

  const [fields, setFields] = useState<FormFields>({
    firstName: '',
    lastName: '',
    email: '',
    city: '',
    phone: '',
    occupation: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<keyof FormFields, boolean>>({
    firstName: false,
    lastName: false,
    email: false,
    city: false,
    phone: false,
    occupation: false,
  });
  const [countryCode, setCountryCode] = useState('AE');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const urlUtm = readUtmFromUrl(window.location.search);
    writeUtmCookie(urlUtm);
  }, []);

  // Form-fill Manual Advanced Matching capture.
  // Debounced 500ms after the last keystroke — when the entire form is
  // validly filled, hash identifiers and persist to the bw_mam cookie. This
  // is what lifts PageView EMQ across the user's future visits: even if
  // they bail without paying, the 30-day cookie means any return visit
  // (landing, /checkout, any page) fires PageView with the full hashed
  // user_data block. The post-conversion writeMam calls in
  // handlePaymentSuccess / handleFreeOrderSuccess remain as a defence in
  // depth in case the 500ms window never elapsed (e.g. ultra-fast submit).
  useEffect(() => {
    const validationErrors = validateFields(fields, countryCode);
    if (Object.keys(validationErrors).length > 0) return;

    const timer = setTimeout(() => {
      const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];
      writeMam({
        email: fields.email.trim(),
        phone: `${selectedCountry.dial}${fields.phone.trim()}`,
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        city: fields.city.trim(),
        country: countryCode,
      });
    }, 500);

    return () => clearTimeout(timer);
  }, [fields, countryCode]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  function handleChange(field: keyof FormFields, value: string) {
    setFields((f) => ({ ...f, [field]: value }));
    if (touched[field]) {
      const updated = { ...fields, [field]: value };
      const newErrors = validateFields(updated, countryCode);
      setErrors((e) => ({ ...e, [field]: newErrors[field] }));
    }
  }
  function handleBlur(field: keyof FormFields) {
    setTouched((t) => ({ ...t, [field]: true }));
    const newErrors = validateFields(fields, countryCode);
    setErrors((e) => ({ ...e, [field]: newErrors[field] }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ firstName: true, lastName: true, email: true, city: true, phone: true, occupation: true });
    const allErrors = validateFields(fields, countryCode);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) {
      const firstErrorKey = Object.keys(allErrors)[0] as keyof FormFields;
      document.getElementById(`field-${firstErrorKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setLoading(true);
    try {
      // Send the enriched body so /api/register can resolve attribution
      // (cookie primary, body a supplement, referrer + _fbc fallback) and
      // fire Pabbly + Meta CAPI CompleteRegistration.
      const utmForOrder = readUtmCookie();
      const fbclidForOrder =
        typeof document !== 'undefined'
          ? (document.cookie.match(/(?:^|;\s*)bw_fbclid=([^;]*)/)?.[1] ?? '')
          : '';
      const selectedCountry =
        COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];

      const registerRes = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            firstName: fields.firstName.trim(),
            lastName:  fields.lastName.trim(),
            email:     fields.email.trim(),
            city:      fields.city.trim(),
            phone:     fields.phone.trim(),
            countryCode,
            dialCode:  selectedCountry.dial,
            occupation: fields.occupation,
          },
          utm: utmForOrder,
          fbclid: decodeURIComponent(fbclidForOrder),
          eventSourceUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
      if (!registerRes.ok) {
        const err = await registerRes.json().catch(() => ({}));
        throw new Error(err.error ?? 'Could not complete registration.');
      }
      const result = await registerRes.json();
      if (!result.success) {
        throw new Error(result.error ?? 'Could not complete registration.');
      }

      // Fire GA4 CompleteRegistration on the client side — once per browser.
      // (GA4 alone; Meta CAPI already fired server-side in /api/register.)
      trackGa4EventOnce('complete_registration');

      // Stash hashed identifiers in the bw_mam cookie so the next PageView
      // (/thank-you) carries Manual Advanced Matching data — matches the
      // hashes server CAPI just sent for CompleteRegistration.
      await writeMam({
        email: fields.email.trim(),
        phone: `${selectedCountry.dial}${fields.phone.trim()}`,
        firstName: fields.firstName.trim(),
        lastName: fields.lastName.trim(),
        city: fields.city.trim(),
        country: countryCode,
      });
      router.push(buildTYUrl());
    } catch (err) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      showToast(msg);
    }
  }

  /**
   * Meta CAPI `QualifiedLead` — fired ONCE per browser the first time
   * the visitor selects "Working Professional" in the occupation
   * dropdown. Uses whatever identifiers are already in the form at that
   * moment (email may or may not be filled yet). Fire-and-forget so the
   * dropdown selection is never blocked.
   */
  async function fireMetaQualifiedLeadOnce(customer: {
    firstName: string;
    lastName: string;
    email: string;
    city: string;
    phone: string;
    countryCode: string;
    dialCode: string;
  }) {
    try {
      if (typeof window === 'undefined') return;
      const KEY = 'bw_ql_fired';
      let existing: string | null = null;
      try {
        existing = window.localStorage.getItem(KEY);
      } catch { /* private mode — best effort */ }
      if (existing === '1') return;

      // Stamp BEFORE the fetch so a fast browse-away can't double-fire.
      try { window.localStorage.setItem(KEY, '1'); } catch { /* ignore */ }

      await fetch('/api/meta/qualified-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          eventSourceUrl: window.location.href,
        }),
        keepalive: true,
      });
    } catch {
      // Never surface analytics errors to the buyer.
    }
  }

  return (
    <>
      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className="fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-3 rounded-2xl px-4 py-3 text-sm text-white shadow-xl"
          style={{ background: C.black }}
        >
          <span className="flex-1">{toast}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="shrink-0 rounded-full p-1 text-white/70 hover:text-white"
          >
            <X weight="bold" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
        {/* LEFT: form (renders below summary on mobile) */}
        <m.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="order-2 overflow-hidden rounded-3xl p-5 sm:p-6 md:p-8 lg:order-1"
          style={{ background: 'white', border: `1px solid ${C.line}`, boxShadow: '0 30px 80px -40px rgba(199,58,87,0.25)' }}
        >
          <h2 className="font-heading text-[20px] font-extrabold sm:text-[22px]" style={{ color: C.ink }}>
            Your Details
          </h2>
          <p className="mt-1 text-[13.5px]" style={{ color: C.inkMuted }}>
            We&apos;ll send your Zoom link and welcome guide to this email.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-7">
            {/* `minmax(0, 1fr)` lets columns shrink below their content width
                so a wide child (like the coupon button) can't force the
                grid wider than its parent on narrow phones. */}
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
                <Field
                  id="firstName"
                  label="First Name"
                  placeholder="Aisha"
                  value={fields.firstName}
                  error={errors.firstName}
                  touched={touched.firstName}
                  onChange={(v) => handleChange('firstName', v)}
                  onBlur={() => handleBlur('firstName')}
                  autoComplete="given-name"
                />
                <Field
                  id="lastName"
                  label="Last Name"
                  placeholder="Khan"
                  value={fields.lastName}
                  error={errors.lastName}
                  touched={touched.lastName}
                  onChange={(v) => handleChange('lastName', v)}
                  onBlur={() => handleBlur('lastName')}
                  autoComplete="family-name"
                />
              </div>

              <Field
                id="email"
                label="Email Address"
                type="email"
                placeholder="aisha@example.com"
                value={fields.email}
                error={errors.email}
                touched={touched.email}
                onChange={(v) => handleChange('email', v)}
                onBlur={() => handleBlur('email')}
                autoComplete="email"
                inputMode="email"
              />

              <Field
                id="city"
                label="Town / City"
                placeholder="Dubai"
                value={fields.city}
                error={errors.city}
                touched={touched.city}
                onChange={(v) => handleChange('city', v)}
                onBlur={() => handleBlur('city')}
                autoComplete="address-level2"
              />

              <div id="field-phone" className="flex flex-col">
                <label htmlFor="phone" className="mb-1.5 text-[13px] font-semibold" style={{ color: C.ink }}>
                  Phone Number <span style={{ color: C.brand }}>*</span>
                </label>
                <PhoneInput
                  value={fields.phone}
                  countryCode={countryCode}
                  onValueChange={(v) => handleChange('phone', v)}
                  onCountryChange={(code) => {
                    setCountryCode(code);
                    if (touched.phone) {
                      const newErrors = validateFields(fields, code);
                      setErrors((e) => ({ ...e, phone: newErrors.phone }));
                    }
                  }}
                  error={errors.phone}
                  touched={touched.phone}
                  onBlur={() => handleBlur('phone')}
                />
                <span
                  role="alert"
                  className={[
                    'mt-1 text-[11.5px] transition-opacity',
                    touched.phone && !!errors.phone ? 'opacity-100' : 'opacity-0',
                  ].join(' ')}
                  style={{ color: '#DC2626' }}
                >
                  {errors.phone ?? ' '}
                </span>
              </div>

              {/* Occupation — fires the "QualifiedLead" Meta CAPI custom
                  event when the user picks "Working Professional". Deduped
                  once per browser via bw_ql_fired. */}
              <div id="field-occupation" className="flex flex-col">
                <label htmlFor="occupation" className="mb-1.5 text-[13px] font-semibold" style={{ color: C.ink }}>
                  Are you a working professional or homemaker? <span style={{ color: C.brand }}>*</span>
                </label>
                <div className="relative">
                  <select
                    id="occupation"
                    value={fields.occupation}
                    onChange={(e) => {
                      const next = e.target.value as Occupation;
                      handleChange('occupation', next);
                      if (next === 'Working Professional') {
                        void fireMetaQualifiedLeadOnce({
                          firstName: fields.firstName.trim(),
                          lastName:  fields.lastName.trim(),
                          email:     fields.email.trim(),
                          city:      fields.city.trim(),
                          phone:     fields.phone.trim(),
                          countryCode,
                          dialCode:  (COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0]).dial,
                        });
                      }
                    }}
                    onBlur={() => handleBlur('occupation')}
                    className="w-full appearance-none rounded-2xl border bg-white px-4 py-3 pr-10 text-[15px] outline-none transition-colors"
                    style={{
                      borderColor:
                        touched.occupation && errors.occupation ? '#DC2626' : C.line,
                      color: fields.occupation ? C.ink : C.inkMuted,
                    }}
                  >
                    <option value="" disabled>Select an option</option>
                    <option value="Working Professional">Working Professional</option>
                    <option value="Homemaker">Homemaker</option>
                  </select>
                  <CaretDown
                    weight="bold"
                    aria-hidden="true"
                    className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: C.inkMuted }}
                  />
                </div>
                <span
                  role="alert"
                  className={[
                    'mt-1 text-[11.5px] transition-opacity',
                    touched.occupation && !!errors.occupation ? 'opacity-100' : 'opacity-0',
                  ].join(' ')}
                  style={{ color: '#DC2626' }}
                >
                  {errors.occupation ?? ' '}
                </span>
              </div>

            </div>

            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="group mt-7 inline-flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl py-4 font-heading text-[15px] font-bold text-white shadow-lg transition-transform duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 sm:text-[16px]"
              style={{
                background: `linear-gradient(180deg, ${C.brand}, ${C.deep})`,
                boxShadow: '0 18px 40px -14px rgba(199,58,87,0.55)',
              }}
            >
              {loading ? (
                <>
                  <Spinner /> Processing…
                </>
              ) : (
                <>
                  Complete Free Registration
                  <ArrowRight weight="bold" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[10.5px] sm:text-[11.5px]" style={{ color: C.inkMuted }}>
              <span className="inline-flex items-center gap-1 whitespace-nowrap sm:gap-1.5">
                <Lock weight="fill" className="h-3 w-3 shrink-0" style={{ color: C.brand }} /> 100% Free · No card required
              </span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap">Instant WhatsApp access</span>
            </div>

            <p className="mt-5 text-center text-[12px] leading-relaxed" style={{ color: C.inkMuted }}>
              Your personal data will be used to send you the challenge access and for the purposes described in our{' '}
              <a href="#" className="font-semibold underline" style={{ color: C.brand }}>
                privacy policy
              </a>
              .
            </p>
          </form>
        </m.div>

        {/* RIGHT: sticky summary */}
        <m.aside
          variants={fadeUp}
          initial="hidden"
          animate="show"
          aria-label="Registration summary"
          className="order-1 self-start overflow-hidden rounded-3xl p-4 sm:p-5 md:p-7 lg:order-2 lg:sticky lg:top-6 lg:p-7"
          style={{ background: 'white', border: `1px solid ${C.line}`, boxShadow: '0 30px 80px -40px rgba(199,58,87,0.25)' }}
        >
          <OrderSummary />
        </m.aside>
      </div>
    </>
  );
}

function buildTYUrl() {
  const utm = readUtmCookie();
  const params = new URLSearchParams({ funnel: 'postpartum-5day-free' });
  if (utm.source) params.set('utm_source', utm.source);
  if (utm.medium) params.set('utm_medium', utm.medium);
  if (utm.campaign) params.set('utm_campaign', utm.campaign);
  if (utm.content) params.set('utm_content', utm.content);
  if (utm.term) params.set('utm_term', utm.term);
  if (utm.id) params.set('utm_id', utm.id);
  params.set('free', '1');
  return `/thank-you?${params.toString()}`;
}

// ── Order summary card ───────────────────────────────────────────────────────
// ── Value stack: same 10-item bonus list as the paid funnel, but with
// the payable price replaced by "FREE". The label prefix (currency +
// number) is env-driven so a media buyer can flip $120 → ₹10,000 → £90
// without a code change — see NEXT_PUBLIC_VALUE_STACK_LABEL.
const RECAP: { title: string; label: string }[] = [
  { title: '5-Day Recovery Challenge', label: 'included' },
  { title: 'DR Gap Check & Analysis', label: 'included' },
  { title: 'Core & Pelvic Floor Safety Check', label: 'included' },
  { title: 'Posture & Back Pain Fix', label: 'included' },
  { title: 'Tummy-Flattening Food Guide', label: 'included' },
  { title: 'Personalized Welcome Video', label: 'included' },
  { title: 'Safe Exercise Starter Guide', label: 'included' },
  { title: '20 Mom Secrets Guide', label: 'included' },
];

function OrderSummary() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Mobile-only collapsed header (tap to toggle) ──────────────── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="order-summary-details"
        className="-mx-1 flex w-[calc(100%+0.5rem)] items-center justify-between gap-3 rounded-2xl px-1 py-1 text-left transition-colors lg:hidden lg:pointer-events-none"
      >
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.2em]" style={{ color: C.deep }}>
            Registration Summary
          </p>
          <p className="mt-0.5 text-[12.5px]" style={{ color: C.inkMuted }}>
            {open ? 'Tap to hide details' : 'Tap to view details'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-heading text-[22px] font-extrabold leading-none" style={{ color: C.brand }}>
            FREE
          </span>
          <CaretDown
            weight="bold"
            aria-hidden="true"
            className={['h-4 w-4 transition-transform', open ? 'rotate-180' : ''].join(' ')}
            style={{ color: C.inkMuted }}
          />
        </div>
      </button>

      <div
        id="order-summary-details"
        className={['mt-3 space-y-4 overflow-hidden transition-all lg:mt-0 lg:!block', open ? 'block' : 'hidden'].join(' ')}
      >
        {/* Product header */}
        <div className="flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4" style={{ borderColor: C.line, background: C.whisper }}>
          <span
            aria-hidden="true"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white shadow-sm sm:h-12 sm:w-12"
            style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.deep})` }}
          >
            <Heart weight="fill" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-[14px] font-extrabold sm:text-[15px]" style={{ color: C.ink }}>
              5-Day Postpartum Recovery Challenge
            </p>
            <p className="mt-0.5 text-[11.5px]" style={{ color: C.inkMuted }}>
              Starts {CHECKOUT_CONFIG.webinarDate} · {CHECKOUT_CONFIG.webinarTimes}
            </p>
          </div>
        </div>

        {/* What's included */}
        <div>
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em]" style={{ color: C.deep }}>
            What's included
          </p>
          <ul className="space-y-1.5">
            {RECAP.map((r) => (
              <li key={r.title} className="flex items-start justify-between gap-3 text-[13px]">
                <span className="inline-flex items-center gap-1.5" style={{ color: C.ink }}>
                  <CheckCircle weight="fill" className="h-3.5 w-3.5 shrink-0" style={{ color: C.brand }} />
                  <span>{r.title}</span>
                </span>
                <span className="shrink-0 text-[11.5px] font-semibold" style={{ color: C.inkMuted }}>
                  {r.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Value stack — total value → FREE */}
        <div className="rounded-2xl border p-3.5 sm:p-4" style={{ borderColor: C.line, background: 'white' }}>
          <div className="flex items-baseline justify-between">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.16em]" style={{ color: C.inkMuted }}>
              Total value
            </span>
            <span className="text-[15px] font-semibold line-through" style={{ color: C.inkMuted }}>
              {VALUE_STACK_LABEL}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-heading text-[13px] font-bold uppercase tracking-[0.14em]" style={{ color: C.deep }}>
              You pay today
            </span>
            <span className="font-heading text-[28px] font-extrabold leading-none" style={{ color: C.brand }}>
              FREE
            </span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: C.inkMuted }}>
            <Sparkle weight="fill" className="h-3 w-3" style={{ color: C.brand }} /> No card required, no charges — ever.
          </div>
        </div>

        {/* Guarantee card */}
        <div className="rounded-2xl border p-3.5" style={{ borderColor: C.line, background: C.whisper }}>
          <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: C.deep }}>
            <ShieldCheck weight="fill" className="h-4 w-4" />
            No spam. Zoom link on WhatsApp.
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed" style={{ color: C.inkMuted }}>
            After you register, we'll share your Zoom link and session reminders inside the private WhatsApp community. That's it.
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[11.5px]" style={{ color: C.deep }}>
            <Lightning weight="fill" className="h-3.5 w-3.5" /> Live &amp; interactive · Ask questions in real-time
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11.5px]" style={{ color: C.deep }}>
            <Clock weight="fill" className="h-3.5 w-3.5" /> Pick the session time that fits your schedule
          </div>
        </div>
      </div>
    </>
  );
}

function Field({
  id,
  label,
  type = 'text',
  placeholder,
  value,
  error,
  touched,
  onChange,
  onBlur,
  autoComplete,
  inputMode,
}: {
  id: keyof FormFields;
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  error?: string;
  touched: boolean;
  onChange: (v: string) => void;
  onBlur: () => void;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'numeric';
}) {
  const hasError = touched && !!error;
  const isValid = touched && !error && value.trim().length > 0;
  return (
    <div id={`field-${id}`} className="flex flex-col">
      <label htmlFor={id} className="mb-1.5 text-[13px] font-semibold" style={{ color: C.ink }}>
        {label} <span style={{ color: C.brand }}>*</span>
      </label>
      <input
        id={id}
        name={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={hasError}
        className="w-full rounded-2xl bg-white px-4 py-3 text-[15px] transition-colors focus:outline-none"
        style={{
          color: C.ink,
          border: `1px solid ${hasError ? '#FCA5A5' : isValid ? C.brand : C.line}`,
          boxShadow: hasError ? '0 0 0 3px #FEE2E2' : 'none',
        }}
      />
      <span
        role="alert"
        className={['mt-1 text-[11.5px] transition-opacity', hasError ? 'opacity-100' : 'opacity-0'].join(' ')}
        style={{ color: '#DC2626' }}
      >
        {error ?? ' '}
      </span>
    </div>
  );
}

// ── Phone input ──────────────────────────────────────────────────────────────
function PhoneInput({
  value,
  countryCode,
  onValueChange,
  onCountryChange,
  error,
  touched,
  onBlur,
}: {
  value: string;
  countryCode: string;
  onValueChange: (v: string) => void;
  onCountryChange: (code: string) => void;
  error?: string;
  touched: boolean;
  onBlur: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];

  const filtered = search.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dial.includes(search) ||
          c.code.toLowerCase().includes(search.toLowerCase()),
      )
    : COUNTRIES;

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const hasError = touched && !!error;

  return (
    <div
      ref={wrapRef}
      className="relative flex items-stretch rounded-2xl bg-white transition-colors"
      style={{
        border: `1px solid ${hasError ? '#FCA5A5' : C.line}`,
        boxShadow: hasError ? '0 0 0 3px #FEE2E2' : 'none',
      }}
    >
      <button
        type="button"
        className="flex shrink-0 items-center gap-1 rounded-l-2xl px-2.5 py-3 text-[13px] font-semibold transition-colors sm:gap-1.5 sm:px-3 sm:text-[14px]"
        style={{ color: C.ink, borderRight: `1px solid ${C.line}` }}
        onClick={() => setOpen((o) => !o)}
        aria-label="Select country"
        aria-expanded={open}
      >
        <span aria-hidden="true">{selected.flag}</span>
        <span className="tabular-nums">{selected.dial}</span>
        <CaretDown weight="bold" className={`h-3 w-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: C.inkMuted }} />
      </button>
      <input
        ref={inputRef}
        type="tel"
        className="min-w-0 flex-1 rounded-r-2xl bg-transparent px-3 py-3 text-[15px] placeholder:opacity-60 focus:outline-none sm:px-3.5"
        style={{ color: C.ink }}
        placeholder={PHONE_PLACEHOLDERS[countryCode] ?? 'Phone number'}
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(/\D/g, ''))}
        onBlur={onBlur}
        inputMode="numeric"
        autoComplete="tel-national"
      />
      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[320px] overflow-hidden rounded-2xl shadow-xl"
          style={{ background: 'white', border: `1px solid ${C.line}` }}
        >
          <div className="p-2.5" style={{ borderBottom: `1px solid ${C.line}` }}>
            <input
              type="text"
              placeholder="Search country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="w-full rounded-xl bg-white px-3 py-2 text-[13px] focus:outline-none"
              style={{ color: C.ink, border: `1px solid ${C.line}` }}
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto" role="listbox">
            {filtered.map((c) => (
              <button
                type="button"
                key={c.code}
                role="option"
                aria-selected={c.code === countryCode}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13.5px] transition-colors hover:opacity-80"
                style={{
                  background: c.code === countryCode ? C.blush : 'white',
                  color: c.code === countryCode ? C.deep : C.ink,
                  fontWeight: c.code === countryCode ? 600 : 400,
                }}
                onClick={() => {
                  onCountryChange(c.code);
                  setOpen(false);
                  setSearch('');
                  inputRef.current?.focus();
                }}
              >
                <span aria-hidden="true">{c.flag}</span>
                <span className="flex-1">{c.name}</span>
                <span className="tabular-nums" style={{ color: C.inkMuted }}>{c.dial}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[13px]" style={{ color: C.inkMuted }}>
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Coupon section ───────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Footer strip ─────────────────────────────────────────────────────────────
function FooterStrip() {
  return (
    <footer style={{ background: 'white', borderTop: `1px solid ${C.line}` }}>
      <div className="mx-auto max-w-6xl px-5 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3 text-[11.5px]" style={{ color: C.inkMuted }}>
          <span>© 2026 TrainerGoesOnline. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <a href="#" className="hover:underline">Privacy Policy</a>
            <span>·</span>
            <a href="#" className="hover:underline">Terms and Conditions</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Suppress unused import (Lightning kept for future use without breaking lint).
void Lightning;
