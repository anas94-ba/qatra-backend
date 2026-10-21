import { BadRequestException, Injectable } from '@nestjs/common';

/** Cloudflare Turnstile. بدون CAPTCHA_SECRET يُعطَّل (التطوير والاختبار). */
@Injectable()
export class CaptchaService {
  async verify(token?: string) {
    const secret = process.env.CAPTCHA_SECRET;
    if (!secret) return;
    if (!token) throw new BadRequestException('التحقق من CAPTCHA مطلوب');
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as { success?: boolean };
    if (!data.success) throw new BadRequestException('فشل التحقق من CAPTCHA');
  }
}
