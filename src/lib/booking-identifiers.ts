import prisma from "@/lib/prisma";

function deriveAreaCode(areaName?: string | null) {
  if (!areaName) {
    return "GEN";
  }
  const normalized = areaName.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!normalized) {
    return "GEN";
  }
  return normalized.slice(0, 3).padEnd(3, "X");
}

async function nextInvoiceSequence(areaCode: string, year: number) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice_sequences.findUnique({
      where: {
        areaCode_year: {
          areaCode,
          year,
        },
      },
    });

    if (existing) {
      const updated = await tx.invoice_sequences.update({
        where: { areaCode_year: { areaCode, year } },
        data: { currentValue: { increment: 1 } },
      });
      return updated.currentValue;
    }

    const created = await tx.invoice_sequences.create({
      data: {
        areaCode,
        year,
        currentValue: 1,
      } as any,
    });
    return created.currentValue;
  });
}

async function generateUniqueOrderNumber(year: number, attempt = 0): Promise<string> {
  if (attempt > 5) {
    throw new Error("Failed to generate unique order number");
  }
  const randomDigits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join("");
  const orderNumber = `O-${year}-${randomDigits}`;
  const existing = await prisma.booking.findUnique({ where: { orderNumber } });
  if (!existing) {
    return orderNumber;
  }
  return generateUniqueOrderNumber(year, attempt + 1);
}

export async function generateBookingIdentifiers(areaName?: string | null) {
  const now = new Date();
  const year = now.getFullYear();
  const areaCode = deriveAreaCode(areaName);
  const sequenceValue = await nextInvoiceSequence(areaCode, year);
  const paddedSequence = sequenceValue.toString().padStart(5, "0");
  const invoiceNumber = `${areaCode}/${year}/${paddedSequence}`;
  const orderNumber = await generateUniqueOrderNumber(year);

  return {
    invoiceNumber,
    orderNumber,
  };
}
