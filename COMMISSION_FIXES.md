# Commission Percentage Fixes - Complete Solution

## Problems Fixed

### ❌ Before:
1. **Individual commission 0% was treated as literal 0%** instead of "use default"
2. **Old payouts were recalculated** when commission percentage changed
3. **Outstanding amounts appeared** for already-settled bookings after commission change

### ✅ After:
1. **0 or null commission → uses default** from admin settings
2. **Old bookings locked** with snapshot commission rate
3. **No recalculation** of historical payouts

---

## How It Works Now

### 1. Individual Commission = 0 or NULL → Use Default

**Partner Settings:**
```
Default Commission (Admin Settings): 70%
Partner A Individual Commission: 0% or NULL
→ Partner A uses: 70% (default)

Partner B Individual Commission: 80%
→ Partner B uses: 80% (individual)
```

**Code Logic:**
```typescript
const commissionPercentage = 
  (partner.commissionPercentage && partner.commissionPercentage > 0) 
    ? partner.commissionPercentage   // Use individual if > 0
    : defaultCommission;              // Otherwise use default
```

---

### 2. Commission Rate Snapshot System

**When Driver Assigned to Booking:**
```typescript
// Fetch partner's commission (or default if 0/null)
const individualCommission = driver.partner?.commissionPercentage;
const snapshotCommission = 
  (individualCommission && individualCommission > 0) 
    ? individualCommission 
    : defaultCommission;

// Save to booking (locked forever)
booking.partnerCommissionPercentage = snapshotCommission;
```

**When Calculating Payouts:**
```typescript
// ALWAYS use snapshot if it exists (locked rate)
const bookingCommission = hasSnapshot 
  ? booking.partnerCommissionPercentage   // Use locked rate
  : commissionPercentage;                 // Fallback for old bookings
```

---

## Example Scenario

### Initial Setup:
```
Admin Settings:
  Default Commission: 70%

Partner XYZ:
  Individual Commission: 0% (uses default)

Booking #1 (Jan 1):
  Assigned to Partner XYZ driver
  Snapshot: 70%
  Gross: 100 AED
  Payout: 70 AED
```

### Admin Changes Default to 75%:
```
Admin Settings:
  Default Commission: 75% (changed from 70%)

Partner XYZ:
  Individual Commission: still 0% (now uses new 75% default)

OLD Booking #1 (Jan 1):
  Snapshot: 70% ✅ (LOCKED - won't change)
  Gross: 100 AED
  Payout: 70 AED ✅ (same as before)

NEW Booking #2 (Jan 15):
  Assigned to Partner XYZ driver
  Snapshot: 75% (new default)
  Gross: 100 AED
  Payout: 75 AED
```

### Admin Sets Individual Commission to 80%:
```
Partner XYZ:
  Individual Commission: 80% (overrides default)

OLD Booking #1 (Jan 1):
  Snapshot: 70% ✅ (still locked)
  Payout: 70 AED ✅

OLD Booking #2 (Jan 15):
  Snapshot: 75% ✅ (still locked)
  Payout: 75 AED ✅

NEW Booking #3 (Feb 1):
  Snapshot: 80% (new individual rate)
  Payout: 80 AED
```

---

## Outstanding Calculations

### Before Fix:
```
Partner XYZ (old commission 70%, new 80%):
  Old bookings recalculated at 80%:
    Booking #1: 100 AED × 80% = 80 AED (was 70 AED)
    Booking #2: 100 AED × 80% = 80 AED (was 70 AED)
  Total owed: 160 AED
  Already paid: 140 AED
  Outstanding: 20 AED ❌ (WRONG - already fully paid!)
```

### After Fix:
```
Partner XYZ (commission changed to 80%):
  Old bookings use locked snapshot:
    Booking #1: 100 AED × 70% = 70 AED ✅ (snapshot)
    Booking #2: 100 AED × 70% = 70 AED ✅ (snapshot)
  Total owed: 140 AED
  Already paid: 140 AED
  Outstanding: 0 AED ✅ (CORRECT!)
```

---

## Files Modified

### 1. `src/app/admin/bookings/actions.ts`
**What changed:**
- When assigning driver, check if individual commission is 0/null
- If yes, fetch and use default commission from settings
- Snapshot the correct commission rate in booking

**Key code:**
```typescript
const individualCommission = driver.partner?.commissionPercentage;
partnerCommissionPercentage = 
  (individualCommission && individualCommission > 0) 
    ? individualCommission 
    : defaultCommission;  // Use default if 0 or null
```

### 2. `src/app/admin/partners/financials.ts`
**What changed:**
- Load partner financials: if individual commission is 0/null → use default
- Calculate payouts: ALWAYS use snapshot commission if it exists
- Only fall back to current commission for old bookings without snapshot

**Key code:**
```typescript
// Load financials
const commissionPercentage = 
  (partner.commissionPercentage && partner.commissionPercentage > 0) 
    ? partner.commissionPercentage 
    : defaultCommission;

// Calculate payout
const hasSnapshot = typeof booking.partnerCommissionPercentage === 'number';
const bookingCommission = hasSnapshot 
  ? booking.partnerCommissionPercentage  // LOCKED rate
  : commissionPercentage;                 // Fallback only
```

---

## Logging

### Booking Assignment:
```javascript
[Booking] Partner abc123 - Individual: 0, Default: 70, Snapshotting: 70%
[Booking] Partner xyz789 - Individual: 80, Default: 70, Snapshotting: 80%
```

### Partner Financial Load:
```javascript
[Partner abc123] Individual commission: 0, Default: 70, Using: 70
[Partner xyz789] Individual commission: 80, Default: 70, Using: 80
```

### Payout Calculation:
```javascript
[partner-payout] {
  id: "booking-123",
  hasSnapshot: true,
  snapshotCommission: 70,
  currentCommission: 80,
  usedCommission: 70,
  usingSnapshot: "YES (locked)",  // Won't be affected by commission changes!
  netForPartner: 70.00
}
```

---

## Testing Checklist

### Test 1: Zero Commission Uses Default
- [ ] Set partner individual commission to 0
- [ ] Assign booking to partner's driver
- [ ] Check logs: should use default commission
- [ ] Verify booking snapshot = default percentage

### Test 2: Individual Commission Overrides Default
- [ ] Set partner individual commission to 80
- [ ] Default commission = 70
- [ ] Assign booking
- [ ] Verify booking snapshot = 80 (not 70)

### Test 3: Old Bookings Not Recalculated
- [ ] Create booking with commission 70%
- [ ] Mark as completed and paid
- [ ] Change partner commission to 80%
- [ ] Check financials: old booking still shows 70% payout
- [ ] Outstanding should NOT increase

### Test 4: Commission Change Timeline
- [ ] Default = 70%, Partner = 0
- [ ] Create Booking A → snapshot should be 70%
- [ ] Change default to 75%
- [ ] Create Booking B → snapshot should be 75%
- [ ] Check financials:
   - Booking A payout uses 70%
   - Booking B payout uses 75%

---

## Migration Notes

### Existing Bookings Without Snapshot
Old bookings (before this fix) will have `partnerCommissionPercentage = null`.

**Behavior:**
- Will use **current** partner commission (with 0→default logic)
- To lock them at historical rate, run migration:

```sql
-- Backfill historical snapshots (run once if needed)
UPDATE "Booking" b
SET "partnerCommissionPercentage" = 
  CASE 
    WHEN p."commissionPercentage" IS NOT NULL AND p."commissionPercentage" > 0 
    THEN p."commissionPercentage"
    ELSE 70  -- Replace with your historical default
  END
FROM "Partner" p
WHERE b."partnerId" = p.id
  AND b."partnerCommissionPercentage" IS NULL
  AND b."partnerId" IS NOT NULL;
```

---

## Benefits

✅ **Fair Billing** - 0% commission means "use default", not literal 0%  
✅ **Historical Accuracy** - Old payouts never change  
✅ **No False Outstanding** - Paid bookings stay paid  
✅ **Flexibility** - Admins can change rates anytime  
✅ **Clear Audit Trail** - Snapshot shows exact rate used  

---

## Summary

**Problem:** Setting individual commission to 0 gave partners nothing, and changing commission rates messed up old payouts.

**Solution:** 
1. Treat 0/null as "use system default"
2. Lock commission rate when booking assigned (snapshot)
3. Always use snapshot for calculations (never recalculate)

**Result:** Partners get fair payouts, admins can adjust rates freely, history stays accurate! 🎯
