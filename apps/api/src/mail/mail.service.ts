import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { env } from '../config/env';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  /** لا يرمي استثناءً: فشل البريد لا يُفشل العملية (TC05). يرجع false عند الفشل. */
  async send(to: string, mail: { subject: string; html: string }): Promise<boolean> {
    try {
      await this.transporter.sendMail({ from: env.mailFrom, to, subject: mail.subject, html: mail.html });
      return true;
    } catch (err) {
      this.logger.error(`mail to ${to} failed: ${(err as Error).message}`);
      return false;
    }
  }

  async sendMany(recipients: string[], mail: { subject: string; html: string }) {
    return Promise.all(recipients.map((r) => this.send(r, mail)));
  }
}
