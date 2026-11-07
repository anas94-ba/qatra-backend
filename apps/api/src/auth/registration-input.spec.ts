import { validateRegistrationInput } from './registration-input';

const camp = { entityType: 'CAMP' as const, name: 'مخيم تجريبي', region: 'غزة', lat: 31.4, lng: 34.35, contactName: 'مسؤول', phone: '+970599000000', details: { families: 100, population: 500, repTitle: 'مدير' } };

describe('validateRegistrationInput', () => {
  it('accepts a camp with all fields (TC100)', () => expect(validateRegistrationInput(camp).errors).toEqual([]));
  it('rejects missing fields (TC102)', () => expect(validateRegistrationInput({ ...camp, details: {} }).errors.length).toBeGreaterThan(0));
  it('rejects fields of another type (TC102)', () => {
    const r = validateRegistrationInput({ ...camp, details: { ...camp.details, hqCountry: 'X' } });
    expect(r.errors.join()).toContain('hqCountry');
  });
  it('rejects coordinates outside Gaza', () => expect(validateRegistrationInput({ ...camp, lat: 10, lng: 10 }).errors.join()).toContain('خارج نطاق'));
  it('an international organization requires a headquarters country', () => {
    const r = validateRegistrationInput({ entityType: 'INTERNATIONAL_ORG', name: 'منظمة', contactName: 'م', phone: '0599000000', description: 'وصف النشاط الكامل' });
    expect(r.errors.join()).toContain('بلد المقر');
  });
  it('strips HTML (TC24)', () => {
    const r = validateRegistrationInput({ ...camp, name: '<img onerror=x>مخيم' });
    expect(r.clean.name).not.toMatch(/[<>]/);
  });
});
