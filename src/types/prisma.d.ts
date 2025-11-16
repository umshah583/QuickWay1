import { Prisma } from "@prisma/client";

declare module "@prisma/client" {
  interface PrismaClient {
    partnerPayout: Prisma.PartnerPayoutDelegate;
  }
}
