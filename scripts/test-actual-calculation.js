// This script calls the actual loadPartnerFinancialSnapshot to see what it calculates
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import the actual financial functions by requiring the compiled version
// Since we can't easily import TS, we'll recreate the logic here

const DEFAULT_PARTNER_COMMISSION_SETTING_KEY = "64bf0000000000000000000c";
const TAX_PERCENTAGE_SETTING_KEY = "64bf00000000000000000002";
const STRIPE_FEE_PERCENTAGE_SETTING_KEY = "64bf00000000000000000008";
const EXTRA_FEE_AMOUNT_SETTING_KEY = "64bf00000000000000000009";

async function loadPricingSettings() {
  const settings = await prisma.adminSetting.findMany({
    where: {
      key: { in: [TAX_PERCENTAGE_SETTING_KEY, STRIPE_FEE_PERCENTAGE_SETTING_KEY, EXTRA_FEE_AMOUNT_SETTING_KEY] }
    }
  });
  const map = new Map(settings.map(s => [s.key, s.value]));
  
  const parseNum = (v) => v ? parseFloat(v.replace(/,/g, '.')) : null;
  const taxPercentage = parseNum(map.get(TAX_PERCENTAGE_SETTING_KEY));
  const stripeFeePercentage = parseNum(map.get(STRIPE_FEE_PERCENTAGE_SETTING_KEY));
  const extraFee = parseNum(map.get(EXTRA_FEE_AMOUNT_SETTING_KEY));
  const extraFeeCents = extraFee ? Math.round(extraFee * 100) : 0;
  
  return { taxPercentage, stripeFeePercentage, extraFeeAmountCents: extraFeeCents };
}

function isBookingSettled(booking) {
  // Must be COMPLETED
  if (booking.taskStatus !== 'COMPLETED') return false;
  
  // Card payment must be PAID
  if (booking.payment?.status === 'PAID') return true;
  
  // Cash must be collected AND settled
  if (booking.cashCollected && booking.cashSettled) return true;
  
  return false;
}

function getBookingGrossValue(booking) {
  if (booking.payment?.status === 'PAID') {
    return booking.payment.amountCents ?? booking.service?.priceCents ?? 0;
  }
  if (booking.cashCollected) {
    return booking.cashAmountCents ?? booking.service?.priceCents ?? 0;
  }
  return 0;
}

function computeBookingNetBase(booking, grossCents, adjustments) {
  if (grossCents <= 0) return 0;
  
  // Use booking snapshots if available
  const taxPercentage = booking.taxPercentage ?? adjustments?.taxPercentage ?? 0;
  const stripeFeePercentage = booking.stripeFeePercentage ?? adjustments?.stripeFeePercentage ?? 0;
  const stripeFixedFeeCents = booking.extraFeeCents ?? adjustments?.extraFeeAmountCents ?? 0;
  
  const taxDecimal = taxPercentage > 0 ? taxPercentage / 100 : 0;
  const stripeDecimal = stripeFeePercentage > 0 ? stripeFeePercentage / 100 : 0;
  const fixedCents = stripeFixedFeeCents > 0 ? stripeFixedFeeCents : 0;
  
  if (booking.cashCollected) {
    const multiplier = 1 + taxDecimal;
    return multiplier > 0 ? Math.round(grossCents / multiplier) : 0;
  }
  
  if (booking.payment?.status === 'PAID') {
    const grossBeforeFixed = Math.max(0, grossCents - fixedCents);
    const multiplier = 1 + taxDecimal + stripeDecimal;
    return multiplier > 0 ? Math.round(grossBeforeFixed / multiplier) : 0;
  }
  
  return 0;
}

async function main() {
  console.log('🔍 Testing actual financial calculation...\n');
  
  const pricingAdjustments = await loadPricingSettings();
  console.log('Pricing settings:', pricingAdjustments);
  
  const defaultSetting = await prisma.adminSetting.findUnique({
    where: { key: DEFAULT_PARTNER_COMMISSION_SETTING_KEY },
    select: { value: true }
  });
  const defaultCommission = defaultSetting?.value ? parseFloat(defaultSetting.value) : 100;
  
  const partners = await prisma.partner.findMany({
    select: {
      id: true,
      name: true,
      commissionPercentage: true,
    }
  });
  
  for (const partner of partners) {
    console.log(`\n========== PARTNER: ${partner.name} ==========`);
    const currentCommission = partner.commissionPercentage ?? defaultCommission;
    console.log(`Current commission: ${currentCommission}%`);
    
    // Get bookings same way as financials.ts
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { partnerId: partner.id },
          { driver: { partnerId: partner.id } }
        ]
      },
      select: {
        id: true,
        status: true,
        taskStatus: true,
        cashCollected: true,
        cashSettled: true,
        cashAmountCents: true,
        partnerCommissionPercentage: true,
        taxPercentage: true,
        stripeFeePercentage: true,
        extraFeeCents: true,
        payment: { select: { status: true, amountCents: true } },
        service: { select: { priceCents: true } }
      }
    });
    
    let totalNet = 0;
    
    for (const booking of bookings) {
      const gross = getBookingGrossValue(booking);
      if (gross <= 0) continue;
      
      const settled = isBookingSettled(booking);
      if (!settled) continue;
      
      const netBase = computeBookingNetBase(booking, gross, pricingAdjustments);
      if (netBase <= 0) continue;
      
      // Use snapshot commission if available
      const hasSnapshot = typeof booking.partnerCommissionPercentage === 'number';
      const bookingCommission = hasSnapshot ? booking.partnerCommissionPercentage : currentCommission;
      const multiplier = Math.max(0, Math.min(bookingCommission, 100)) / 100;
      const netForPartner = Math.round(netBase * multiplier);
      
      totalNet += netForPartner;
      
      console.log(`  ${booking.id.substring(0,8)}... Gross:${gross} NetBase:${netBase} Commission:${bookingCommission}% (snap:${hasSnapshot}) NetPartner:${netForPartner}`);
    }
    
    // Get payouts
    const payouts = await prisma.partnerPayout.findMany({
      where: { partnerId: partner.id },
      select: { amountCents: true }
    });
    const totalPaid = payouts.reduce((sum, p) => sum + p.amountCents, 0);
    const outstanding = Math.max(0, totalNet - totalPaid);
    
    console.log(`\n📊 RESULT:`);
    console.log(`   Total Net Earned: AED ${(totalNet / 100).toFixed(2)}`);
    console.log(`   Total Paid Out: AED ${(totalPaid / 100).toFixed(2)}`);
    console.log(`   Outstanding: AED ${(outstanding / 100).toFixed(2)}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
