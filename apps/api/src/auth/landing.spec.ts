import { computeLanding } from './landing';

const base: any = { emailVerifiedAt: new Date(), status: 'ACTIVE', role: 'CAMP_REP', camp: null, organization: null, registrationRequest: { status: 'PENDING' } };

describe('computeLanding', () => {
  it('unverified email -> EMAIL_VERIFY (TC08)', () => expect(computeLanding({ ...base, emailVerifiedAt: null })).toBe('EMAIL_VERIFY'));
  it('pending approval -> PENDING', () => expect(computeLanding(base)).toBe('PENDING'));
  it('rejected -> REJECTED', () => expect(computeLanding({ ...base, registrationRequest: { status: 'REJECTED' } })).toBe('REJECTED'));
  it('approved -> DASHBOARD', () => expect(computeLanding({ ...base, camp: { status: 'ACTIVE' } })).toBe('DASHBOARD'));
  it('suspended entity -> SUSPENDED (TC10)', () => expect(computeLanding({ ...base, camp: { status: 'SUSPENDED' } })).toBe('SUSPENDED'));
  it('verified admin -> DASHBOARD', () => expect(computeLanding({ ...base, role: 'ADMIN', registrationRequest: null })).toBe('DASHBOARD'));
});
