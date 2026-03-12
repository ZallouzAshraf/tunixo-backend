import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { RegisterDto } from "./dto/register.dto";
import { User, Role } from "@prisma/client";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type SafeUser = Omit<User, "password" | "refreshToken">;

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) return null;
    const isMatch = await bcrypt.compare(password, user.password);
    return isMatch ? user : null;
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException("User with this email already exists");
    }
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        fullName: dto.fullName,
        phone: dto.phone,
        role: dto.role || "BUYER",
      },
    });
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });
    const { password, refreshToken, ...safeUser } = user;
    this.notificationsService
      .sendWelcomeBuyer({ email: user.email, fullName: user.fullName ?? "" })
      .catch(() => {});
    return { user: safeUser, ...tokens };
  }

  async login(
    user: User,
  ): Promise<{ user: SafeUser; accessToken: string; refreshToken: string }> {
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });
    const { password, refreshToken, ...safeUser } = user;
    return { user: safeUser, ...tokens };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: "Logged out successfully" };
  }

  /** Verify refresh token JWT and return userId (for public refresh endpoint). */
  getUserIdFromRefreshToken(refreshToken: string): string {
    if (!refreshToken || typeof refreshToken !== "string") {
      throw new ForbiddenException("Invalid refresh token");
    }
    try {
      const payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.configService.get<string>("jwt.refreshSecret"),
      });
      return payload.sub;
    } catch {
      throw new ForbiddenException("Invalid or expired refresh token");
    }
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.refreshToken) {
      throw new ForbiddenException("Invalid refresh token");
    }
    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) {
      throw new ForbiddenException("Invalid refresh token");
    }
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });
    return tokens;
  }

  async generateTokens(
    userId: string,
    email: string,
    role: Role,
  ): Promise<TokenPair> {
    const payload = { sub: userId, email, role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("jwt.secret"),
        expiresIn: this.configService.get<string>("jwt.expiresIn"),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>("jwt.refreshSecret"),
        expiresIn: this.configService.get<string>("jwt.refreshExpiresIn"),
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
