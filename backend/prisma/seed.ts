import "dotenv/config";
import { PrismaClient, OrderStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const daysAgo = (days: number): Date => new Date(Date.now() - days * 86_400_000);

async function main() {
  // --- Staff users (Phase 3) -------------------------------------------------
  const adminPassword = await bcrypt.hash("Admin123!", 10);
  const agentPassword = await bcrypt.hash("Agent123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "System Admin",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  const agent = await prisma.user.upsert({
    where: { email: "agent@example.com" },
    update: {},
    create: {
      email: "agent@example.com",
      name: "Support Agent",
      passwordHash: agentPassword,
      role: "AGENT",
    },
  });

  // --- Customers -------------------------------------------------------------
  const customerSeeds = [
    {
      key: "muhammad",
      name: "Muhammad",
      email: "muhammad@example.com",
      orders: [
        {
          id: "123",
          status: OrderStatus.DELIVERED as OrderStatus,
          amount: "750.00",
          deliveredDaysAgo: 1, // high value -> human approval
        },
        {
          id: "124",
          status: OrderStatus.DELIVERED as OrderStatus,
          amount: "100.00",
          deliveredDaysAgo: 1, // auto refund scenario
        },
        {
          id: "125",
          status: OrderStatus.DELIVERED as OrderStatus,
          amount: "2200.00",
          deliveredDaysAgo: 45, // outside refund window
        },
      ],
    },
    {
      key: "fatima",
      name: "Fatima",
      email: "fatima@example.com",
      orders: [
        {
          id: "456",
          status: OrderStatus.DELIVERED as OrderStatus,
          amount: "50.00",
          deliveredDaysAgo: 10, // low value -> auto refund
        },
      ],
    },
    {
      key: "ahmad",
      name: "Ahmad",
      email: "ahmad@example.com",
      orders: [
        {
          id: "789",
          status: OrderStatus.DELIVERED as OrderStatus,
          amount: "2500.00",
          deliveredDaysAgo: 1, // high value -> human approval
        },
      ],
    },
  ];

  for (const seed of customerSeeds) {
    const customer = await prisma.customer.upsert({
      where: { email: seed.email },
      update: {},
      create: { name: seed.name, email: seed.email },
    });

    for (const order of seed.orders) {
      await prisma.order.upsert({
        where: { id: order.id },
        update: {},
        create: {
          id: order.id,
          customerId: customer.id,
          status: order.status,
          amount: order.amount,
          currency: "USD",
          deliveredAt: daysAgo(order.deliveredDaysAgo),
        },
      });
    }
  }

  // --- Knowledge base documents (Phase 5 placeholder content) ----------------
  const knowledgeSeeds = [
    {
      title: "Refund Policy",
      filename: "refund-policy.md",
      content: `# Refund Policy

Customers may request a refund within 30 days of delivery.
Orders above $500 require human approval before a refund is issued.
Damaged products are eligible for refunds if reported within 7 days.
Digital products are non-refundable.`,
    },
    {
      title: "Shipping Policy",
      filename: "shipping-policy.md",
      content: `# Shipping Policy

Standard shipping takes 3-5 business days.
Express shipping takes 1-2 business days.
Orders are shipped within 24 hours of purchase.`,
    },
    {
      title: "Order Damage Policy",
      filename: "damaged-orders.md",
      content: `# Damaged Orders

If an order arrives damaged, customers must report it within 7 days of delivery.
Eligible customers receive a full refund or a free replacement.
Damaged orders above $500 require human approval.`,
    },
  ];

  for (const doc of knowledgeSeeds) {
    await prisma.knowledgeDocument.upsert({
      where: { filename: doc.filename },
      update: {},
      create: doc,
    });
  }

  console.log(
    `Seeded: admin(id=${admin.id}), agent(id=${agent.id}), customers=${customerSeeds.length}, knowledge docs=${knowledgeSeeds.length}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());