// Types and validation rules shared between the UI and the API.
export const ENTITY_TYPES = ['CAMP', 'LOCAL_ORG', 'INTERNATIONAL_ORG', 'INITIATIVE'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const LANDINGS = ['EMAIL_VERIFY', 'PENDING', 'REJECTED', 'DASHBOARD', 'SUSPENDED'] as const;
export type Landing = (typeof LANDINGS)[number];

export const DELIVERY_STATUSES = ['PENDING', 'CONFIRMED', 'CONFIRMED_DIFF', 'REJECTED', 'CANCELLED'] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const MAX_REGISTRATION_ATTEMPTS = 3;
export const GAZA_TIMEZONE = 'Asia/Gaza';
