import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendTemporaryPasswordEmail(recipientEmail: string, recipientName: string, temporaryPassword: string) {
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
    const fromAddress = process.env.GMAIL_FROM?.trim() || gmailUser;

    if (!gmailUser || !gmailAppPassword || !fromAddress) {
      this.logger.warn(
        `Gmail app password email is not configured. Skipping temp password email to ${recipientEmail}.`,
      );
      return false;
    }

    const transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailAppPassword,
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
