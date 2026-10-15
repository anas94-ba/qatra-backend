import { createHash, randomBytes } from 'crypto';

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
/** رمز عشوائي يُرسل للمستخدم؛ يُخزَّن hash فقط في القاعدة */
export const newToken = () => randomBytes(32).toString('hex');
export const addHours = (h: number, from = new Date()) => new Date(from.getTime() + h * 3_600_000);
export const addMinutes = (m: number, from = new Date()) => new Date(from.getTime() + m * 60_000);
export const addDaysTo = (d: number, from = new Date()) => new Date(from.getTime() + d * 86_400_000);
