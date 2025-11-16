import { prisma } from "@/lib/prisma";

type PartnerPayoutAggregateArgs = { _sum: { amountCents: true } };
type PartnerPayoutAggregateResult = { _sum: { amountCents: number | null } };
type PartnerPayoutCreateArgs = {
  data: {
    partnerId: string;
    amountCents: number;
    note: string | null;
    periodMonth: number;
    periodYear: number;
    createdByAdminId?: string | null;
  };
};

type PartnerPayoutDelegateSubset = {
  aggregate: (args: PartnerPayoutAggregateArgs) => Promise<PartnerPayoutAggregateResult>;
  create: (args: PartnerPayoutCreateArgs) => Promise<unknown>;
  findMany: (...args: unknown[]) => Promise<unknown>;
  groupBy: (...args: unknown[]) => Promise<unknown>;
};

export function getPartnerPayoutDelegate(client: typeof prisma = prisma): PartnerPayoutDelegateSubset {
  return (client as typeof client & { partnerPayout: PartnerPayoutDelegateSubset }).partnerPayout;
}
