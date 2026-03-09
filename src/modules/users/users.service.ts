import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';

const safeUserSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  walletBalance: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type SafeUser = {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  walletBalance: number;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const data: { fullName?: string; phone?: string } = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: safeUserSelect,
    });
    return user;
  }

  async getWalletBalance(id: string): Promise<{ balance: number }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { walletBalance: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { balance: user.walletBalance };
  }
}
