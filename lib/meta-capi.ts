import crypto from 'crypto';

/**
 * Shared Meta Conversions API primitives — free funnel.
 *
 * The tripwire Purchase + sales dual-event sender from the paid funnel
 * has been removed (there is no payment). CompleteRegistration replaces
 * it — see lib/meta-events.ts. These helpers are shared by the register
 * route + the intent-event routes (AddToCart, QualifiedLead).
 */

export type Utm = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  id?: string;
};

export interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  phone: string;
  countryCode: string;
  dialCode: string;
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Meta CAPI normalization rules — each helper returns undefined when the
// field is empty so we don't ship a sha256 of the empty string (which
// would still match).
export function hashEmail(email: string): string | undefined {
  const v = email.trim().toLowerCase();
  return v ? sha256Hex(v) : undefined;
}
export function hashPhone(phone: string): string | undefined {
  // E.164 without "+": digits only.
  const v = phone.replace(/\D/g, '');
  return v ? sha256Hex(v) : undefined;
}
export function hashName(name: string): string | undefined {
  const v = name.trim().toLowerCase();
  return v ? sha256Hex(v) : undefined;
}
export function hashCity(city: string): string | undefined {
  // Strip everything that's not a-z — Meta spec, e.g. "New York" → "newyork".
  const v = city.toLowerCase().replace(/[^a-z]/g, '');
  return v ? sha256Hex(v) : undefined;
}
export function hashCountry(country: string): string | undefined {
  // ISO 3166-1 alpha-2, lowercase.
  const v = country.trim().toLowerCase();
  return v ? sha256Hex(v) : undefined;
}
