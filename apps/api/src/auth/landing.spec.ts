import { computeLanding } from './landing';

const base: any = { emailVerifiedAt: new Date(), status: 'ACTIVE', role: 'CAMP_REP', camp: null, organization: null, registrationRequest: { status: 'PENDING' } };

describe('computeLanding', () => {
  it('غير مؤكد → EMAIL_VERIFY (TC08)', () => expect(computeLanding({ ...base, emailVerifiedAt: null })).toBe('EMAIL_VERIFY'));
  it('قيد الاعتماد → PENDING', () => expect(computeLanding(base)).toBe('PENDING'));
  it('مرفوض → REJECTED', () => expect(computeLanding({ ...base, registrationRequest: { status: 'REJECTED' } })).toBe('REJECTED'));
  it('مقبول → DASHBOARD', () => expect(computeLanding({ ...base, camp: { status: 'ACTIVE' } })).toBe('DASHBOARD'));
  it('جهة موقوفة → SUSPENDED (TC10)', () => expect(computeLanding({ ...base, camp: { status: 'SUSPENDED' } })).toBe('SUSPENDED'));
  it('أدمن مؤكد → DASHBOARD', () => expect(computeLanding({ ...base, role: 'ADMIN', registrationRequest: null })).toBe('DASHBOARD'));
});
