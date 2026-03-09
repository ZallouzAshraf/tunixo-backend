import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

const KONNECT_BASE_URL = 'https://api.konnect.network/api/v2';

export interface KonnectInitPaymentResponse {
  payUrl?: string;
  paymentId?: string;
  [key: string]: unknown;
}

export interface KonnectPaymentStatus {
  status?: string;
  amount?: number;
  [key: string]: unknown;
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
        Authorization: `Bearer ${this.apiKey}`,
      },
    });
  }

  async initPayment(
    amount: number,
    webhookUrl: string,
    reference?: string,
  ): Promise<KonnectInitPaymentResponse> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const response = await this.client.post<KonnectInitPaymentResponse>(
      '/payments/init',
      {
        amount: Math.round(amount * 1000) / 1000,
        walletId: this.walletId,
        webhookUrl,
        successUrl: `${frontendUrl}/wallet?success=1`,
        failUrl: `${frontendUrl}/wallet?fail=1`,
        reference: reference ?? `topup-${Date.now()}`,
      },
    );
    return response.data;
  }

  async getPayment(paymentId: string): Promise<KonnectPaymentStatus> {
    const response = await this.client.get<KonnectPaymentStatus>(
      `/payments/${paymentId}`,
    );
    return response.data;
  }
}
