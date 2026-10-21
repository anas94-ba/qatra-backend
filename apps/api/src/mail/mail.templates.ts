import { env } from '../config/env';
import { escapeHtml as h } from '../common/text';

const wrap = (title: string, body: string) => `<!doctype html><html lang="ar" dir="rtl"><body style="font-family:Tahoma,Arial,sans-serif;line-height:1.8">
<h2>${h(title)}</h2>${body}<hr><small>قطرة - منصة تنسيق توزيع مياه الشرب</small></body></html>`;

const link = (path: string, token: string) => `${env.appUrl}${path}?token=${encodeURIComponent(token)}`;
const btn = (href: string, label: string) => `<p><a href="${h(href)}" style="background:#0b6;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${h(label)}</a></p><p dir="ltr">${h(href)}</p>`;

export const templates = {
  verifyEmail: (token: string) => ({
    subject: 'قطرة: أكّد بريدك الإلكتروني',
    html: wrap('أكّد بريدك الإلكتروني', `<p>اضغط الزر لتأكيد بريدك. الرابط صالح 24 ساعة ولمرة واحدة.</p>${btn(link('/verify-email', token), 'تأكيد البريد')}`),
  }),
  setPassword: (token: string, hours: number) => ({
    subject: 'قطرة: تم إنشاء حسابك، عيّن كلمة المرور',
    html: wrap('عيّن كلمة المرور', `<p>أنشأ فريق المنصة حسابًا لجهتك. عيّن كلمة مرورك عبر الرابط (صالح ${hours} ساعة ولمرة واحدة).</p>${btn(link('/reset-password', token), 'تعيين كلمة المرور')}`),
  }),
  resetPassword: (token: string) => ({
    subject: 'قطرة: إعادة تعيين كلمة المرور',
    html: wrap('إعادة تعيين كلمة المرور', `<p>وصلنا طلب لإعادة تعيين كلمة المرور. الرابط صالح ساعة واحدة ولمرة واحدة. إن لم تطلب ذلك تجاهل الرسالة.</p>${btn(link('/reset-password', token), 'إعادة التعيين')}`),
  }),
  approved: (name: string) => ({
    subject: 'قطرة: تم قبول طلبك',
    html: wrap('تم قبول طلبك', `<p>تم قبول طلب تسجيل «${h(name)}». يمكنك الآن تسجيل الدخول والوصول للوحة التحكم.</p>`),
  }),
  rejected: (name: string, reason: string, remaining: number) => ({
    subject: 'قطرة: تعذّر قبول طلبك',
    html: wrap('تعذّر قبول طلبك', `<p>لم يُقبل طلب «${h(name)}» للسبب التالي:</p><blockquote>${h(reason)}</blockquote><p>${remaining > 0 ? `يمكنك تعديل البيانات وإعادة التقديم (المحاولات المتبقية: ${remaining}).` : 'استُنفدت محاولات التقديم.'}</p>`),
  }),
  suspended: (name: string, reason: string) => ({
    subject: 'قطرة: تم توقيف الحساب',
    html: wrap('تم توقيف الجهة', `<p>تم توقيف «${h(name)}» مؤقتًا للسبب التالي:</p><blockquote>${h(reason)}</blockquote>`),
  }),
  reactivated: (name: string) => ({
    subject: 'قطرة: أُعيد تفعيل الحساب',
    html: wrap('أُعيد تفعيل الجهة', `<p>أُعيد تفعيل «${h(name)}». يمكنك الدخول مجددًا.</p>`),
  }),
  donationLinkChanged: (adminEmail: string) => ({
    subject: 'قطرة (تنبيه أمني): تغيير رابط التبرع',
    html: wrap('تغيّر رابط التبرع', `<p>غيّر الأدمن ${h(adminEmail)} رابط التبرع. راجع سجل التدقيق إن لم تكن على علم بذلك.</p>`),
  }),
  donationLinkFailing: (reason: string) => ({
    subject: 'قطرة (تنبيه): مشكلة في رابط التبرع',
    html: wrap('مشكلة في رابط التبرع', `<p>فشل الفحص الدوري لرابط التبرع: ${h(reason)}</p>`),
  }),
};
