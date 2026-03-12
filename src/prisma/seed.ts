import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const FREE_FIRE_PRODUCTS = [
  { name: "Free Fire 100 Diamonds", slug: "free-fire-100-diamonds", priceTnd: 5, costUsd: 0.99, gameId: "freefire", productId: "100" },
  { name: "Free Fire 310 Diamonds", slug: "free-fire-310-diamonds", priceTnd: 14, costUsd: 2.99, gameId: "freefire", productId: "310" },
  { name: "Free Fire 520 Diamonds", slug: "free-fire-520-diamonds", priceTnd: 23, costUsd: 4.99, gameId: "freefire", productId: "520" },
  { name: "Free Fire 1060 Diamonds", slug: "free-fire-1060-diamonds", priceTnd: 45, costUsd: 9.99, gameId: "freefire", productId: "1060" },
  { name: "Free Fire 2180 Diamonds", slug: "free-fire-2180-diamonds", priceTnd: 88, costUsd: 19.99, gameId: "freefire", productId: "2180" },
];

const PUBG_PRODUCTS = [
  { name: "PUBG 60 UC", slug: "pubg-60-uc", priceTnd: 5, costUsd: 0.99, gameId: "pubgm", productId: "60" },
  { name: "PUBG 300 UC", slug: "pubg-300-uc", priceTnd: 22, costUsd: 4.99, gameId: "pubgm", productId: "300" },
  { name: "PUBG 600 UC", slug: "pubg-600-uc", priceTnd: 43, costUsd: 9.99, gameId: "pubgm", productId: "600" },
  { name: "PUBG 1500 UC", slug: "pubg-1500-uc", priceTnd: 105, costUsd: 24.99, gameId: "pubgm", productId: "1500" },
  { name: "PUBG 3000 UC", slug: "pubg-3000-uc", priceTnd: 205, costUsd: 49.99, gameId: "pubgm", productId: "3000" },
];

const GOOGLE_PLAY_PRODUCTS = [
  { name: "Google Play 5€", slug: "google-play-5", priceTnd: 20, costUsd: 5.5 },
  { name: "Google Play 10€", slug: "google-play-10", priceTnd: 38, costUsd: 11 },
  { name: "Google Play 25€", slug: "google-play-25", priceTnd: 92, costUsd: 27 },
  { name: "Google Play 50€", slug: "google-play-50", priceTnd: 180, costUsd: 54 },
];

const PLAYSTATION_PRODUCTS = [
  { name: "PSN 10€", slug: "psn-10", priceTnd: 40, costUsd: 11 },
  { name: "PSN 20€", slug: "psn-20", priceTnd: 78, costUsd: 22 },
  { name: "PSN 50€", slug: "psn-50", priceTnd: 192, costUsd: 55 },
];

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
    console.log("✅ Admin user created");
  } else {
    console.log("ℹ️ Admin already exists");
  }

  const categories = [
    { category: "free-fire", products: FREE_FIRE_PRODUCTS, serviceType: "TOPUP" as const },
    { category: "pubg", products: PUBG_PRODUCTS, serviceType: "TOPUP" as const },
    { category: "google-play", products: GOOGLE_PLAY_PRODUCTS, serviceType: "GIFTCARD" as const },
    { category: "playstation", products: PLAYSTATION_PRODUCTS, serviceType: "GIFTCARD" as const },
  ];

  let sortOrder = 0;
  for (const { category, products, serviceType } of categories) {
    for (const p of products) {
      const existing = await prisma.product.findUnique({
        where: { slug: p.slug },
      });
      if (!existing) {
        await prisma.product.create({
          data: {
            name: p.name,
            slug: p.slug,
            category,
            serviceType,
            priceTnd: p.priceTnd,
            costUsd: p.costUsd,
            sortOrder: sortOrder++,
            ...("gameId" in p && p.gameId
              ? { gameId: p.gameId, productId: p.productId }
              : {}),
          },
        });
        console.log(`  Created product: ${p.name}`);
      }
    }
  }

  console.log("🌱 Seed completed");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
