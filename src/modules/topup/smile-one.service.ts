import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const BASE_URL = process.env.SMILEONE_BASE_URL || 'https://www.smile.one/smilecoin/api';

export interface SmileProduct {
  id: string;
  name: string;
  price?: number;
  [key: string]: unknown;
}

export interface ValidatePlayerResult {
  valid: boolean;
  username: string;
}

export interface CreateOrderResult {
  success: boolean;
  orderId: string;
  message: string;
}

export interface CheckOrderResult {
  status: string;
}

@Injectable()
export class SmileOneService {
  private readonly logger = new Logger(SmileOneService.name);
  private readonly email: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.email = this.configService.get<string>('SMILEONE_EMAIL') ?? '';
    this.apiKey = this.configService.get<string>('SMILEONE_API_KEY') ?? '';
    this.baseUrl = this.configService.get<string>('SMILEONE_BASE_URL') ?? BASE_URL;
  }

  private getSignature(timestamp: string): string {
    const signStr = this.email + this.apiKey + timestamp;
    return crypto.createHash('md5').update(signStr).digest('hex');
  }

  private async request<T>(
    path: string,
    options: RequestInit & { params?: Record<string, string> } = {},
  ): Promise<T> {
    const timestamp = String(Date.now());
    const sign = this.getSignature(timestamp);
    const url = new URL(path, this.baseUrl);
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) =>
        url.searchParams.set(k, v),
      );
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      email: this.email,
      timestamp,
      sign,
      ...(options.headers as Record<string, string>),
    };
    const { params: _p, ...fetchOpts } = options;
    const res = await fetch(url.toString(), {
      ...fetchOpts,
      headers,
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.warn(`Smile.one ${path} ${res.status}: ${text}`);
      throw new Error(`Smile.one API error: ${res.status} ${text}`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Validate player ID before purchase.
   * Game IDs: freefire, pubgm
   */
  async validatePlayer(
    gameId: string,
    playerId: string,
    zoneId?: string,
  ): Promise<ValidatePlayerResult> {
    try {
      const params: Record<string, string> = {
        game_id: gameId,
        player_id: playerId,
      };
      if (zoneId) params.zone_id = zoneId;
      const data = await this.request<{ valid: boolean; username?: string; name?: string }>(
        '/validate',
        { method: 'GET', params },
      );
      const username =
        (data as { username?: string }).username ??
        (data as { name?: string }).name ??
        '';
      return {
        valid: data.valid === true,
        username: String(username),
      };
    } catch (err) {
      this.logger.warn(`validatePlayer failed: ${err}`);
      return { valid: false, username: '' };
    }
  }

  /**
   * Get available products for a game.
   */
  async getProducts(gameId: string): Promise<SmileProduct[]> {
    const data = await this.request<{ data?: SmileProduct[]; products?: SmileProduct[] }>(
      '/products',
      { method: 'GET', params: { game_id: gameId } },
    );
    const list = (data as { data?: SmileProduct[] }).data ?? (data as { products?: SmileProduct[] }).products ?? [];
    return Array.isArray(list) ? list : [];
  }

  /**
   * Create top-up order.
   */
  async createOrder(
    gameId: string,
    productId: string,
    playerId: string,
    zoneId?: string,
  ): Promise<CreateOrderResult> {
    const body: Record<string, string> = {
      game_id: gameId,
      product_id: productId,
      player_id: playerId,
    };
    if (zoneId) body.zone_id = zoneId;
    const data = await this.request<{ order_id?: string; orderId?: string; success?: boolean; message?: string }>(
      '/order',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
    const orderId =
      (data as { order_id?: string }).order_id ??
      (data as { orderId?: string }).orderId ??
      '';
    const success = (data as { success?: boolean }).success !== false;
    const message = (data as { message?: string }).message ?? (success ? 'OK' : 'Failed');
    return {
      success,
      orderId: String(orderId),
      message,
    };
  }

  /**
   * Check order status.
   */
  async checkOrder(orderId: string): Promise<CheckOrderResult> {
    const data = await this.request<{ status?: string }>(
      '/order/status',
      { method: 'GET', params: { order_id: orderId } },
    );
    return {
      status: (data as { status?: string }).status ?? 'UNKNOWN',
    };
  }
}
