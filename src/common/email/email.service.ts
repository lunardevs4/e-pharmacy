import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendNotificationEmail(recipientEmail: string, recipientName: string, subject: string, message: string) {
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
    const fromAddress = process.env.GMAIL_FROM?.trim() || gmailUser;
    if (!gmailUser || !gmailAppPassword || !fromAddress) {
      this.logger.warn(`Gmail email is not configured. Skipping notification email to ${recipientEmail}.`);
      return false;
    }
    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailAppPassword } });
    await transport.sendMail({
      from: `"Rwanda E-pharmacy" <${fromAddress}>`,
      to: recipientEmail,
      subject,
      text: [
        `Hello ${recipientName},`,
        '',
        message,
        '',
        'Best regards,',
        'The e-Pharmacy Team',
      ].join('\n'),
      html: `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <p>Hello ${recipientName},</p>

      <p>${message}</p>

      <p>
        Best regards,<br>
        The e-Pharmacy Team
      </p>
    </div>
  `,


    });
    this.logger.log(`Notification email sent to ${recipientEmail}`);
    return true;
  }

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

      from: `"Rwanda E-pharmacy" <${fromAddress}>`,
      to: recipientEmail,
      subject: 'Your temporary e-Pharmacy password',
      text: [
        `Hello ${recipientName},`,
        '',
        'Your e-Pharmacy account has been created.',
        '',
        `Temporary password: ${temporaryPassword}`,
        '',
        'Please sign in using this password and change it after logging in.',
        '',
        'If you did not expect this account, please contact the e-Pharmacy team.',
        '',
        'Best regards,',
        'The e-Pharmacy Team',
      ].join('\n'),
      html: `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <p>Hello ${recipientName},</p>

      <p>Your e-Pharmacy account has been created.</p>

      <p>Your temporary password is:</p>

      <p>
        <code style="display:inline-block;background:#f3f4f6;padding:8px 12px;border-radius:6px;font-family:monospace;font-size:14px">
          ${temporaryPassword}
        </code>
      </p>

      <p>Please sign in using this password and change it after logging in.</p>

      <p>If you did not expect this account, please contact the e-Pharmacy team.</p>

      <p>
        Best regards,<br>
        The e-Pharmacy Team
      </p>
    </div>
  `,

    });

    this.logger.log(`Temporary password email sent to ${recipientEmail}`);
    return true;
  }

  async sendVerificationEmail(recipientEmail: string, recipientName: string, verificationUrl: string) {
    const gmailUser = process.env.GMAIL_USER?.trim();
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.trim();
    const fromAddress = process.env.GMAIL_FROM?.trim() || gmailUser;
    if (!gmailUser || !gmailAppPassword || !fromAddress) {
      this.logger.warn(`Gmail email is not configured. Skipping verification email to ${recipientEmail}.`);
      return false;
    }
    const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: gmailUser, pass: gmailAppPassword } });
    await transport.sendMail({

      from: `"Rwanda E-pharmacy" <${fromAddress}>`,
      to: recipientEmail,
      subject: 'Verify your e-Pharmacy email',
      text: [
        `Hello ${recipientName},`,
        '',
        'Thank you for creating an e-Pharmacy account.',
        '',
        'Please verify your email address by clicking the link below:',
        verificationUrl,
        '',
        'This verification link will expire in 24 hours.',
        '',
        'If you did not create this account, you can safely ignore this email.',
        '',
        'Best regards,',
        'The e-Pharmacy Team',
      ].join('\n'),
      html: `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:600px;margin:0 auto">
      <p>Hello ${recipientName},</p>

      <p>Thank you for creating an e-Pharmacy account.</p>

      <p>Please verify your email address by clicking the button below:</p>

      <p>
        <a
          href="${verificationUrl}"
          style="display:inline-block;background:#059669;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none"
        >
          Verify email
        </a>
      </p>

      <p>This verification link will expire in 24 hours.</p>

      <p>If you did not create this account, you can safely ignore this email.</p>

      <p>
        Best regards,<br>
        The e-Pharmacy Team
      </p>
    </div>
  `,

    });
    this.logger.log(`Verification email sent to ${recipientEmail}`);
    return true;
  }
}
