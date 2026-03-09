import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';

const KONNECT_BASE_URL = 'https://api.konnect.network/api/v2';

export interface KonnectInitParams {
  amount: number;
  description: string;
  orderId: string;
  webhookUrl: string;
  successUrl: string;
  failUrl: string;
}

export interface KonnectInitResult {
  paymentRef: string;
  payUrl: string;
}

export interface KonnectPaymentResult {
  status: string;
  amount: number;
}

@Injectable()
export class KonnectProvider {
  private readonly client: AxiosInstance;
  private readonly apiKey: string;
  private readonly walletId: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('KONNECT_API_KEY', '');
    this.walletId = this.configService.get<string>('KONNECT_WALLET_ID', '');
    this.client = axios.create({
      baseURL: KONNECT_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
    });
  }

  async initPayment(params: KonnectInitParams): Promise<KonnectInitResult> {
    const amountInMillimes = Math.round(params.amount * 1000);
    try {
      const response = await this.client.post<Record<string, unknown>>(
        '/payments/init',
        {
          receiverWalletId: this.walletId,
          token: 'TND',
          amount: amountInMillimes,
          type: 'immediate',
          description: params.description,
          acceptedPaymentMethods: ['wallet', 'bank_card', 'd17'],
          lifespan: 30,
          checkoutForm: true,
          addPaymentFeesToAmount: false,
          firstName: '',
          lastName: '',
          orderId: params.orderId,
          webhook: params.webhookUrl,
          silentWebhook: true,
          successUrl: params.successUrl,
          failUrl: params.failUrl,
          theme: 'light',
        },
      );
      const data = response.data;
      const paymentRef =
        (data['payment_ref'] as string) ??
        (data['paymentRef'] as string) ??
        (data['id'] as string) ??
        '';
      const payUrl =
        (data['pay_url'] as string) ?? (data['payUrl'] as string) ?? (data['url'] as string) ?? '';
      return { paymentRef, payUrl };
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const msg =
        axiosErr.response?.data?.message ?? 'Konnect payment initiation failed';
      throw new ServiceUnavailableException(msg);
    }
  }

  async getPayment(paymentRef: string): Promise<KonnectPaymentResult> {
    try {
      const response = await this.client.get<Record<string, unknown>>(
        `/payments/${paymentRef}`,
      );
      const data = response.data;
      const status = (data['status'] as string) ?? (data['payment_status'] as string) ?? 'unknown';
      const amount = Number(data['amount'] ?? data['amountMillimes'] ?? 0);
      return { status, amount };
    } catch (err) {
      const axiosErr = err as AxiosError<{ message?: string }>;
      const msg =
        axiosErr.response?.data?.message ?? 'Konnect get payment failed';
      throw new ServiceUnavailableException(msg);
    }
  }

  verifyWebhookSignature(payload: Record<string, unknown>): boolean {
    const ref =
      payload['payment_ref'] ?? payload['paymentRef'] ?? payload['orderId'];
    return ref != null && String(ref).length > 0;
  }
}
