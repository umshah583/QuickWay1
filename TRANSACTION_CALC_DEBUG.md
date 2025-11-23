# Transaction Calculation Debug

## How amounts are stored in database:

### When booking is created:
1. `calculateBookingPricing` is called
2. It calculates: `finalAmountCents = basePrice + VAT + Stripe fees`
3. For **cash**: `cashAmountCents = finalAmountCents` is stored
4. For **card**: `payment.amountCents = stripe intent.amount` (also finalAmountCents) is stored

**So the stored amount INCLUDES VAT and fees** (this is what customer pays)

## What transactions page shows:

### In transactionsData.ts:
- We read `payment.amountCents` or `cashAmountCents` (customer paid amount)
- We call `computeOnlineNet(amount)` which SUBTRACTS VAT and Stripe fees
- Result = net after fees

### CSV columns:
- **Amount (AED)** = net after fees
- **Gross (AED)** = customer paid amount (includes fees)  
- **Stripe % (AED)** = Stripe percentage fee
- **Stripe 1 AED (AED)** = fixed Stripe fee
- **VAT (AED)** = VAT amount
- **Net (AED)** = net after fees (same as Amount)

## Example calculation:

Customer pays **AED 100** for a service:
- Service base: 90.50
- VAT 5%: 4.76  
- Stripe 2.5%: 2.38
- Stripe fixed: 1.00
- **Total charged: 100.00** ← stored as `payment.amountCents = 10000`

Then in transactions:
- Read: `amountCents = 10000`
- Calculate: `gross = 100.00`
- Calculate: `VAT = 100 * 5% = 5.00`
- Calculate: `Stripe% = 100 * 2.5% = 2.50`
- Calculate: `Stripe fixed = 1.00`
- Calculate: `net = 100 - 5 - 2.5 - 1 = 91.50`

CSV shows:
- Amount: 91.50
- Gross: 100.00
- VAT: -5.00
- Stripe %: -2.50
- Stripe 1 AED: -1.00
- Net: 91.50

## CRITICAL QUESTION:

When you export CSV for Aslam and sum:
- **"Gross (AED)" column** - what total do you get?
- **"Net (AED)" column** - what total do you get?

If:
- Gross total = higher number
- Net total = 2134.34

Then calculation is CORRECT, and fees are being subtracted once.

If both are 2134.34, then there's a bug.
