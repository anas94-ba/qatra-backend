import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { env } from '../config/env';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private resend = new Resend(process.env.RESEND_API_KEY);

  /** Never throws: a mail failure does not fail the operation (TC05). Returns false on failure. */
  async send(to: string, mail: { subject: string; html: string }): Promise<boolean> {
    try {
      const { error } = await this.resend.emails.send({
        from: env.mailFrom,
        to,
        subject: mail.subject,
        html: mail.html,
      });
      if (error) {
        this.logger.error(`mail to ${to} failed: ${error.message}`);
        return false;
      }
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