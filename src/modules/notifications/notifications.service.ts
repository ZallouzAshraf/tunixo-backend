import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      secure: false,
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  private async sendMail(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<void> {
    try {
      const from =
        this.configService.get<string>('MAIL_FROM') ??
        this.configService.get<string>('MAIL_USER');
      await this.transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      });
      this.logger.log(`Email sent to ${params.to}`);
    } catch (err) {
      this.logger.warn(`Email failed to ${params.to}: ${err}`);
      // Never throw — email failure must not break the app flow
    }
  }

  private getBaseTemplate(title: string, content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#0f0f0f;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0f0f;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:560px;background:#1a1a1a;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 24px 16px;border-bottom:1px solid #2a2a2a;">
              <span style="font-size:24px;font-weight:700;color:#6366f1;">Tunixo</span>
            </td>
          </tr>
          <tr>
            <td style="padding:24px;">
              <h1 style="margin:0 0 16px;font-size:20px;color:#f4f4f5;">${title}</h1>
              <div style="color:#a1a1aa;line-height:1.6;">${content}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#0f0f0f;text-align:center;">
              <span style="font-size:12px;color:#71717a;">© 2024 Tunixo — Tunisia's Digital Gateway</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ─── BUYER EMAILS ─────────────────────

  async sendWelcomeBuyer(params: {
    email: string;
    fullName: string;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Bienvenue sur Tunixo ! Votre compte est activé.</p>
      <p>Rechargez votre wallet et accédez à tous vos services digitaux favoris.</p>
      <p style="margin-top:24px;">
        <a href="${this.configService.get('FRONTEND_URL')}/services" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Découvrir les services</a>
      </p>
    `;
    await this.sendMail({
      to: params.email,
      subject: 'Bienvenue sur Tunixo 🎉',
      html: this.getBaseTemplate('Bienvenue sur Tunixo', content),
    });
  }

  async sendWalletCredited(params: {
    email: string;
    fullName: string;
    amount: number;
    newBalance: number;
    reference: string;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Votre wallet a été rechargé de <strong>${params.amount} TND</strong>.</p>
      <p>Nouveau solde : <strong>${params.newBalance} TND</strong>.</p>
      <p>Référence paiement : ${params.reference}.</p>
      <p style="margin-top:24px;">
        <a href="${this.configService.get('FRONTEND_URL')}/orders" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Voir mes services</a>
      </p>
    `;
    await this.sendMail({
      to: params.email,
      subject: `Wallet rechargé — ${params.amount} TND ✅`,
      html: this.getBaseTemplate('Wallet rechargé', content),
    });
  }

  async sendOrderPending(params: {
    email: string;
    fullName: string;
    orderId: string;
    serviceName: string;
    amountPaid: number;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Votre commande a bien été reçue.</p>
      <p><strong>${params.serviceName}</strong> — ${params.amountPaid} TND payés.</p>
      <p>Votre commande est en cours de traitement. Vous recevrez vos accès dans les prochaines heures.</p>
      <p>Référence commande : ${params.orderId}.</p>
    `;
    await this.sendMail({
      to: params.email,
      subject: `Commande reçue — ${params.serviceName} ⏳`,
      html: this.getBaseTemplate('Commande reçue', content),
    });
  }

  async sendOrderDelivered(params: {
    email: string;
    fullName: string;
    serviceName: string;
    serviceEmail: string;
    expiresAt: Date;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const expiresStr = params.expiresAt
      ? new Date(params.expiresAt).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '—';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Bonne nouvelle ! Votre abonnement est actif.</p>
      <p><strong>Service :</strong> ${params.serviceName}</p>
      <p><strong>Activé sur :</strong> ${params.serviceEmail}</p>
      <p><strong>Valide jusqu'au :</strong> ${expiresStr}</p>
      <p>Connectez-vous directement sur la plateforme avec votre compte habituel.</p>
      <p style="color:#f59e0b;">Si vous n'avez pas reçu de confirmation de la plateforme, patientez quelques minutes.</p>
      <p style="margin-top:24px;">
        <a href="${this.configService.get('FRONTEND_URL')}/orders" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Voir mes commandes</a>
      </p>
    `;
    await this.sendMail({
      to: params.email,
      subject: `✅ ${params.serviceName} activé sur votre compte`,
      html: this.getBaseTemplate('Abonnement activé', content),
    });
  }

  async sendOrderRefunded(params: {
    email: string;
    fullName: string;
    serviceName: string;
    amountRefunded: number;
    newBalance: number;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Votre remboursement a été effectué.</p>
      <p><strong>${params.amountRefunded} TND</strong> ont été recrédités sur votre wallet (service : ${params.serviceName}).</p>
      <p>Nouveau solde : <strong>${params.newBalance} TND</strong>.</p>
    `;
    await this.sendMail({
      to: params.email,
      subject: `Remboursement effectué — ${params.amountRefunded} TND`,
      html: this.getBaseTemplate('Remboursement effectué', content),
    });
  }

  async sendSubscriptionExpiringSoon(params: {
    email: string;
    fullName: string;
    serviceName: string;
    expiresAt: Date;
    renewUrl: string;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const expiresStr = new Date(params.expiresAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const content = `
      <p>Bonjour ${name},</p>
      <p>Votre abonnement <strong>${params.serviceName}</strong> expire dans 5 jours (${expiresStr}).</p>
      <p style="margin-top:24px;">
        <a href="${params.renewUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Renouveler maintenant</a>
      </p>
    `;
    await this.sendMail({
      to: params.email,
      subject: `⚠️ ${params.serviceName} expire dans 5 jours`,
      html: this.getBaseTemplate('Expiration proche', content),
    });
  }

  // ─── SELLER EMAILS ────────────────────

  async sendWelcomeSeller(params: {
    email: string;
    fullName: string;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Bienvenue sur Tunixo en tant que vendeur.</p>
      <p>Déposez vos devises et recevez des TND.</p>
      <ol style="color:#a1a1aa;line-height:1.8;">
        <li>Soumettez votre dépôt (USD) avec une preuve de paiement.</li>
        <li>Notre équipe valide sous 1-24 h.</li>
        <li>Les TND sont crédités sur votre wallet.</li>
      </ol>
      <p style="margin-top:24px;">
        <a href="${this.configService.get('FRONTEND_URL')}/deposits" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Soumettre mon premier dépôt</a>
      </p>
    `;
    await this.sendMail({
      to: params.email,
      subject: 'Bienvenue sur Tunixo — Compte Vendeur 💰',
      html: this.getBaseTemplate('Bienvenue Vendeur', content),
    });
  }

  async sendDepositReceived(params: {
    email: string;
    fullName: string;
    amountUsd: number;
    amountTnd: number;
    depositId: string;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Votre dépôt de <strong>$${params.amountUsd} USD</strong> (environ ${params.amountTnd} TND) a bien été reçu.</p>
      <p>Il est en cours de vérification par notre équipe. Délai habituel : 1-24 heures.</p>
      <p>Référence dépôt : ${params.depositId}.</p>
    `;
    await this.sendMail({
      to: params.email,
      subject: `Dépôt reçu — $${params.amountUsd} en cours de vérification ⏳`,
      html: this.getBaseTemplate('Dépôt reçu', content),
    });
  }

  async sendDepositConfirmed(params: {
    email: string;
    fullName: string;
    amountUsd: number;
    amountTnd: number;
    newBalance: number;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Votre dépôt de <strong>$${params.amountUsd} USD</strong> a été confirmé.</p>
      <p><strong>${params.amountTnd} TND</strong> ont été crédités sur votre wallet.</p>
      <p>Nouveau solde : <strong>${params.newBalance} TND</strong>.</p>
      <p style="margin-top:24px;">
        <a href="${this.configService.get('FRONTEND_URL')}/wallet" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Voir mon wallet</a>
      </p>
    `;
    await this.sendMail({
      to: params.email,
      subject: `Dépôt confirmé — ${params.amountTnd} TND crédités ✅`,
      html: this.getBaseTemplate('Dépôt confirmé', content),
    });
  }

  async sendDepositRejected(params: {
    email: string;
    fullName: string;
    amountUsd: number;
    reason: string;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Votre dépôt de <strong>$${params.amountUsd} USD</strong> n'a pas pu être validé.</p>
      <p><strong>Motif :</strong> ${params.reason}</p>
      <p>Contactez notre support si vous pensez que c'est une erreur.</p>
    `;
    await this.sendMail({
      to: params.email,
      subject: 'Dépôt refusé — Action requise ❌',
      html: this.getBaseTemplate('Dépôt refusé', content),
    });
  }

  async sendWithdrawalRequested(params: {
    email: string;
    fullName: string;
    amountTnd: number;
    method: string;
    withdrawalId: string;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Votre demande de retrait de <strong>${params.amountTnd} TND</strong> (${params.method}) a bien été enregistrée.</p>
      <p>Traitement sous 24-48 heures.</p>
      <p>Référence : ${params.withdrawalId}.</p>
    `;
    await this.sendMail({
      to: params.email,
      subject: `Retrait demandé — ${params.amountTnd} TND ⏳`,
      html: this.getBaseTemplate('Retrait demandé', content),
    });
  }

  async sendWithdrawalCompleted(params: {
    email: string;
    fullName: string;
    amountTnd: number;
    method: string;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Votre retrait de <strong>${params.amountTnd} TND</strong> a été effectué (${params.method}).</p>
      <p>Vérifiez votre compte ${params.method}.</p>
    `;
    await this.sendMail({
      to: params.email,
      subject: `Retrait effectué — ${params.amountTnd} TND envoyés ✅`,
      html: this.getBaseTemplate('Retrait effectué', content),
    });
  }

  async sendWithdrawalRejected(params: {
    email: string;
    fullName: string;
    amountTnd: number;
    reason: string;
  }): Promise<void> {
    const name = params.fullName || 'there';
    const content = `
      <p>Bonjour ${name},</p>
      <p>Votre demande de retrait de <strong>${params.amountTnd} TND</strong> n'a pas pu être traitée.</p>
      <p>Le montant a été remboursé sur votre wallet.</p>
      <p><strong>Motif :</strong> ${params.reason}</p>
    `;
    await this.sendMail({
      to: params.email,
      subject: `Retrait refusé — ${params.amountTnd} TND remboursés`,
      html: this.getBaseTemplate('Retrait refusé', content),
    });
  }

  // ─── ADMIN EMAILS ─────────────────────

  async notifyAdminNewDeposit(params: {
    sellerEmail: string;
    sellerName: string;
    amountUsd: number;
    depositId: string;
    paymentMethod: string;
  }): Promise<void> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (!adminEmail) return;
    const dashboardUrl = `${this.configService.get('FRONTEND_URL')}/admin/deposits`;
    const content = `
      <p>Nouveau dépôt à valider.</p>
      <p>Vendeur : <strong>${params.sellerName || params.sellerEmail}</strong> (${params.sellerEmail})</p>
      <p>Montant : <strong>$${params.amountUsd} USD</strong> — ${params.paymentMethod}</p>
      <p>Référence : ${params.depositId}</p>
      <p style="margin-top:16px;">
        <a href="${dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Ouvrir l'admin</a>
      </p>
    `;
    await this.sendMail({
      to: adminEmail,
      subject: '[Tunixo Admin] Nouveau dépôt à valider',
      html: this.getBaseTemplate('Nouveau dépôt', content),
    });
  }

  async notifyAdminNewWithdrawal(params: {
    sellerEmail: string;
    sellerName: string;
    amountTnd: number;
    method: string;
    methodDetails: Record<string, any>;
    withdrawalId: string;
  }): Promise<void> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (!adminEmail) return;
    const detailsStr = Object.entries(params.methodDetails)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' — ');
    const dashboardUrl = `${this.configService.get('FRONTEND_URL')}/admin/withdrawals`;
    const content = `
      <p>Nouveau retrait à traiter.</p>
      <p>Vendeur : <strong>${params.sellerName || params.sellerEmail}</strong> (${params.sellerEmail})</p>
      <p>Montant : <strong>${params.amountTnd} TND</strong> — ${params.method}</p>
      <p>Détails : ${detailsStr}</p>
      <p>Référence : ${params.withdrawalId}</p>
      <p style="margin-top:16px;">
        <a href="${dashboardUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Ouvrir l'admin</a>
      </p>
    `;
    await this.sendMail({
      to: adminEmail,
      subject: '[Tunixo Admin] Nouveau retrait à traiter',
      html: this.getBaseTemplate('Nouveau retrait', content),
    });
  }

  async notifyAdminPendingOrder(params: {
    buyerEmail: string;
    buyerName?: string;
    serviceName: string;
    orderId: string;
    amountPaid: number;
    serviceEmail: string;
  }): Promise<void> {
    const adminEmail = this.configService.get<string>('ADMIN_EMAIL');
    if (!adminEmail) return;
    const fulfillUrl = `${this.configService.get('FRONTEND_URL')}/admin/orders`;
    const buyerLabel = params.buyerName ? `${params.buyerName} (${params.buyerEmail})` : params.buyerEmail;
    const content = `
      <p>Commande en attente :</p>
      <p>Client : <strong>${buyerLabel}</strong></p>
      <p>Service : <strong>${params.serviceName}</strong></p>
      <p><strong>Email à activer : ${params.serviceEmail}</strong> ← IMPORTANT</p>
      <p>Montant : ${params.amountPaid} TND</p>
      <p style="margin-top:16px;">
        <a href="${fulfillUrl}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Livrer la commande</a>
      </p>
    `;
    await this.sendMail({
      to: adminEmail,
      subject: '[Tunixo Admin] Commande en attente de livraison',
      html: this.getBaseTemplate('Commande en attente', content),
    });
  }
}
