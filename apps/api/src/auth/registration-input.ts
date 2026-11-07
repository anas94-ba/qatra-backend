import { sanitizeText } from '../common/text';
import { inGaza } from '../common/geo';

export type EntityTypeName = 'CAMP' | 'LOCAL_ORG' | 'INTERNATIONAL_ORG' | 'INITIATIVE';

export interface RegistrationInput {
  entityType: EntityTypeName;
  name: string;
  region?: string;
  lat?: number;
  lng?: number;
  description?: string;
  contactName: string;
  phone: string;
  details?: Record<string, unknown>;
}

const CAMP_KEYS = ['families', 'population', 'repTitle'];
const ORG_KEYS = ['registrationNumber', 'registrationDocUrl', 'hqCountry', 'referenceBody', 'regions', 'capacityLitersPerDay', 'contactLink'];

const posInt = (v: unknown) => typeof v === 'number' && Number.isInteger(v) && v >= 1;

/**
 * The camp form differs from the organization/initiative form, with independent validation per type (TC100–TC102).
 * Returns the cleaned fields + a list of errors (in Arabic).
 */
export function validateRegistrationInput(input: RegistrationInput) {
  const errors: string[] = [];
  const d = (input.details ?? {}) as Record<string, unknown>;
  const isCamp = input.entityType === 'CAMP';
  const allowed = isCamp ? CAMP_KEYS : ORG_KEYS;

  for (const k of Object.keys(d)) if (!allowed.includes(k)) errors.push(`الحقل «${k}» غير مسموح لهذا النوع`);

  const clean = {
    name: sanitizeText(input.name),
    region: input.region ? sanitizeText(input.region) : undefined,
    description: input.description ? sanitizeText(input.description) : undefined,
    contactName: sanitizeText(input.contactName),
    phone: sanitizeText(input.phone),
    lat: input.lat,
    lng: input.lng,
  };
  const details: Record<string, unknown> = {};

  if (isCamp) {
    if (!clean.region) errors.push('المحافظة/المنطقة مطلوبة');
    if (typeof clean.lat !== 'number' || typeof clean.lng !== 'number') errors.push('موقع المخيم على الخريطة مطلوب');
    else if (!inGaza(clean.lat, clean.lng)) errors.push('الإحداثيات خارج نطاق قطاع غزة');
    if (!posInt(d.families)) errors.push('عدد الأسر (تقديري) مطلوب');
    if (!posInt(d.population)) errors.push('عدد السكان (تقديري) مطلوب');
    if (posInt(d.families) && posInt(d.population) && (d.families as number) > (d.population as number)) errors.push('عدد الأسر لا يتجاوز عدد السكان');
    if (!sanitizeText(d.repTitle)) errors.push('صفة المسؤول مطلوبة');
    details.families = d.families;
    details.population = d.population;
    details.repTitle = sanitizeText(d.repTitle);
  } else {
    if (!clean.description || clean.description.length < 10) errors.push('وصف النشاط مطلوب (10 أحرف على الأقل)');
    if (input.entityType === 'INTERNATIONAL_ORG' && !sanitizeText(d.hqCountry)) errors.push('بلد المقر مطلوب للمؤسسة الدولية');
    if (input.entityType === 'INITIATIVE' && !sanitizeText(d.referenceBody)) errors.push('الجهة المرجعية مطلوبة للمبادرة');
    for (const k of ['registrationNumber', 'registrationDocUrl', 'hqCountry', 'referenceBody', 'contactLink']) {
      if (d[k] !== undefined && d[k] !== '') details[k] = sanitizeText(d[k]);
    }
    if (d.regions !== undefined) {
      if (!Array.isArray(d.regions)) errors.push('المناطق يجب أن تكون قائمة');
      else details.regions = (d.regions as unknown[]).map(sanitizeText).filter(Boolean).slice(0, 30);
    }
    if (d.capacityLitersPerDay !== undefined) {
      if (!posInt(d.capacityLitersPerDay)) errors.push('القدرة التقريبية يجب أن تكون رقمًا موجبًا');
      else details.capacityLitersPerDay = d.capacityLitersPerDay;
    }
    if (typeof details.registrationDocUrl === 'string' && details.registrationDocUrl && !/^https:\/\//.test(details.registrationDocUrl)) {
      errors.push('رابط المستند يجب أن يكون HTTPS');
    }
  }
  if (clean.name.length < 2) errors.push('الاسم مطلوب');
  if (clean.contactName.length < 2) errors.push('اسم المسؤول مطلوب');
  return { errors, clean, details };
}
