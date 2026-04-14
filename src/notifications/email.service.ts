import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export interface PriceAlertData {
  to: string;
  productTitle: string;
  oldPrice: number;
  newPrice: number;
  dropPercent: number;
  store: string;
  productUrl: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST'),
      port: config.get<number>('SMTP_PORT', 587),
      secure: config.get<boolean>('SMTP_SECURE', false),
      auth: {
        user: config.get<string>('SMTP_USER'),
        pass: config.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendPriceAlert(data: PriceAlertData): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM'),
        to: data.to,
        subject: `Price Drop: ${data.productTitle} is now ${data.newPrice.toLocaleString()} EGP`,
        html: this.buildAlertHtml(data),
      });
    } catch (err) {
      this.logger.error(`Failed to send price alert to ${data.to}`, (err as Error).message);
    }
  }

  async sendLockoutNotification(email: string, unlocksAt: Date): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.config.get<string>('SMTP_FROM'),
        to: email,
        subject: 'SeerPrice: Account temporarily locked',
        html: `
          <h2>Account Temporarily Locked</h2>
          <p>Your account was locked due to multiple failed login attempts.</p>
          <p><strong>Unlocks at:</strong> ${unlocksAt.toLocaleString('en-EG', { timeZone: 'Africa/Cairo' })}</p>
          <p>If this wasn't you, contact support immediately.</p>
        `,
      });
    } catch (err) {
      this.logger.error(`Failed to send lockout email to ${email}`, (err as Error).message);
    }
  }

  private buildAlertHtml(d: PriceAlertData): string {
    return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
<h2 style="color:#e53e3e">Price Drop Alert!</h2>
<h3>${d.productTitle}</h3>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
  <tr><td style="padding:8px;background:#f7f7f7;color:#999">Old Price</td>
      <td style="padding:8px;text-decoration:line-through;color:#999">${d.oldPrice.toLocaleString()} EGP</td></tr>
  <tr><td style="padding:8px;background:#f7f7f7">New Price</td>
      <td style="padding:8px;color:#38a169;font-weight:bold;font-size:1.2em">${d.newPrice.toLocaleString()} EGP</td></tr>
  <tr><td style="padding:8px;background:#f7f7f7">You Save</td>
      <td style="padding:8px;color:#e53e3e;font-weight:bold">${d.dropPercent}% off</td></tr>
</table>
<a href="${d.productUrl}" style="background:#3182ce;color:white;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block">
  View on ${d.store}
</a>
<p style="color:#999;font-size:0.8em;margin-top:24px">SeerPrice — Egyptian Electronics Price Tracker</p>
</body></html>`;
  }
}
