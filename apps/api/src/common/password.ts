export function validatePassword(pw: string): string | null {
  if (typeof pw !== 'string' || pw.length < 8) return 'كلمة المرور يجب ألا تقل عن 8 أحرف';
  if (pw.length > 128) return 'كلمة المرور طويلة جدًا';
  if (!/[A-Za-z\u0600-\u06FF]/.test(pw) || !/\d/.test(pw)) return 'كلمة المرور يجب أن تحتوي حروفًا وأرقامًا';
  return null;
}
