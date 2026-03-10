import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const adminExists = await prisma.user.findUnique({
    where: { email: "admin@tunixo.tn" },
  });

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash("Admin@123", 10);
    await prisma.user.create({
      data: {
        email: "admin@tunixo.tn",
        password: hashedPassword,
        fullName: "Tunixo Admin",
        role: "ADMIN",
        isVerified: true,
      },
    });
  } else {
    console.log("ℹ️ Admin already exists");
  }

  const reserveExists = await prisma.platformReserve.findFirst();
  if (!reserveExists) {
    await prisma.platformReserve.create({
      data: { amountUsd: 0 },
    });
    console.log("✅ Platform reserve initialized");
  }

  console.log("🌱 Seed completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
