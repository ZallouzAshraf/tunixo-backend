import { Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string): Promise<Omit<User, 'password' | 'refreshToken'>> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { password, refreshToken, ...safe } = user;
    return safe;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async updateProfile(
    id: string,
    dto: UpdateUserDto,
  ): Promise<Omit<User, 'password' | 'refreshToken'>> {
    const data: Partial<User> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email.toLowerCase();
    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }
    const user = await this.prisma.user.update({
      where: { id },
      data,
    });
    const { password, refreshToken, ...safe } = user;
    return safe;
  }

  async getWalletBalance(id: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { walletBalance: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.walletBalance;
  }
}
