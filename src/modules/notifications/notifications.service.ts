import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Order } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'smtp.gmail.com'),
      port: this.configService.get<number>('MAIL_PORT', 587),
      secure: false,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async sendWelcomeEmail(email: string, fullName?: string): Promise<void> {
    const name = fullName || 'there';
    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_USER'),
      to: email,
      subject: 'Welcome to Tunixo',
      html: `
        <h1>Welcome to Tunixo!</h1>
        <p>Hi ${name},</p>
        <p>Thank you for signing up. You can now pay in TND and get instant access to international digital services.</p>
        <p>Best regards,<br/>The Tunixo Team</p>
      `,
    });
  }

  async sendOrderConfirmation(
    email: string,
    order: Order & { service?: { name: string } },
    credentials: Record<string, unknown>,
  ): Promise<void> {
    const credsHtml = Object.entries(credentials)
      .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${String(v)}</td></tr>`)
      .join('');
    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_USER'),
      to: email,
      subject: `Order Confirmed - ${order.service?.name ?? 'Service'}`,
      html: `
        <h1>Order Confirmed</h1>
        <p>Your order #${order.id} for ${order.service?.name ?? 'service'} is active.</p>
        <h2>Your credentials:</h2>
        <table border="1" cellpadding="8">${credsHtml}</table>
        <p>Keep these credentials safe.</p>
        <p>Best regards,<br/>The Tunixo Team</p>
      `,
    });
  }

  async sendPaymentConfirmation(email: string, amount: number): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_USER'),
      to: email,
      subject: 'Payment Received - Tunixo',
      html: `
        <h1>Payment Received</h1>
        <p>Your wallet has been credited with <strong>${amount} TND</strong>.</p>
        <p>You can now use your balance to purchase subscriptions.</p>
        <p>Best regards,<br/>The Tunixo Team</p>
      `,
    });
  }

  async sendOrderPending(email: string, serviceName: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_USER'),
      to: email,
      subject: `Order Received - ${serviceName}`,
      html: `
        <h1>Order Received</h1>
        <p>Your order for <strong>${serviceName}</strong> has been received and is being processed.</p>
        <p>You will receive your credentials by email once your order is fulfilled.</p>
        <p>Best regards,<br/>The Tunixo Team</p>
      `,
    });
  }

  async sendDepositConfirmed(
    email: string,
    amountUsd: number,
    amountTnd: number,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_USER'),
      to: email,
      subject: 'Deposit Confirmed - Tunixo',
      html: `
        <h1>Deposit Confirmed</h1>
        <p>Your deposit of <strong>$${amountUsd} USD</strong> has been confirmed.</p>
        <p>Your wallet has been credited with <strong>${amountTnd} TND</strong>.</p>
        <p>You can now use your balance or request a withdrawal.</p>
        <p>Best regards,<br/>The Tunixo Team</p>
      `,
    });
  }

  async sendAdminNewDepositAlert(
    adminEmail: string,
    sellerEmail: string,
    amountUsd: number,
    paymentMethod: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_USER'),
      to: adminEmail,
      subject: 'New deposit to review - Tunixo',
      html: `
        <h1>New Deposit Pending</h1>
        <p>Seller <strong>${sellerEmail}</strong> submitted a deposit of <strong>$${amountUsd} USD</strong> via <strong>${paymentMethod}</strong>.</p>
        <p>Please review and confirm or reject in the admin panel.</p>
        <p>Best regards,<br/>Tunixo System</p>
      `,
    });
  }

  async sendDepositRejected(
    email: string,
    amountUsd: number,
    rejectionReason: string,
  ): Promise<void> {
    await this.transporter.sendMail({
      from: this.configService.get<string>('MAIL_USER'),
      to: email,
      subject: 'Deposit Rejected - Tunixo',
      html: `
        <h1>Deposit Rejected</h1>
        <p>Your deposit of <strong>$${amountUsd} USD</strong> could not be confirmed.</p>
        <p><strong>Reason:</strong> ${rejectionReason}</p>
        <p>Please contact support if you have questions.</p>
        <p>Best regards,<br/>The Tunixo Team</p>
      `,
    });
  }
}
