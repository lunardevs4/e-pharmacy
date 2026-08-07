import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendTemporaryPasswordEmail(recipientEmail: string, recipientName: string, temporaryPassword: string) {
    const host = process.env.SMTP_HOST?.trim();
    const port = Number(process.env.SMTP_PORT || 587);
    const username = process.env.SMTP_USER?.trim();
    const password = process.env.SMTP_PASS?.trim();
    const fromAddress = process.env.SMTP_FROM?.trim() || username;

    if (!host || !username || !password || !fromAddress) {
      this.logger.warn(
        `SMTP is not configured. Skipping temp password email to ${recipientEmail}.`,
      );
      return false;
    }

    const transport = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: username,
        pass: password,
      },
    });

    await transport.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: 'Your temporary e-Pharmacy password',
      text: [
        `Hello ${recipientName},`,
        '',
        `Your account has been created.`,
        `Temporary password: ${temporaryPassword}`,
        '',
        'Please sign in and change your password immediately.',
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <p>Hello ${recipientName},</p>
          <p>Your account has been created.</p>
          <p><strong>Temporary password:</strong> <code>${temporaryPassword}</code></p>
          <p>Please sign in and change your password immediately.</p>
        </div>
      `,
    });

    this.logger.log(`Temporary password email sent to ${recipientEmail}`);
    return true;
  }
}
