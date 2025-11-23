# CSV Verification Steps

Please check your exported CSV file for driver Aslam and answer these questions:

## Question 1: Which column did you sum to get 2134.34?
- [ ] **Amount (AED)** column?
- [ ] **Net (AED)** column?  
- [ ] **Gross (AED)** column?

## Question 2: Check the Status column
For all rows where Driver = Aslam:
- How many rows show **Status = "Settled"**?
- How many rows show **Status = "Pending"**?

## Question 3: Sum by Status
Filter the CSV to show only **Status = "Settled"** rows for Aslam:
- What is the sum of **Net (AED)** column for settled rows? _______

Filter the CSV to show only **Status = "Pending"** rows for Aslam:
- What is the sum of **Net (AED)** column for pending rows? _______

## Question 4: Compare Gross vs Net
For the same Aslam rows:
- Sum of **Gross (AED)** column = _______
- Sum of **Net (AED)** column = _______
- Difference = _______

## Expected Results:

If calculation is correct:
- Settled Net sum ≈ 1480.30 (this would give 79% = 1169.44 payout)
- Pending Net sum ≈ 654.04  
- Total Net = 1480.30 + 654.04 = 2134.34 ✓

- Gross sum should be HIGHER than Net sum (by the amount of VAT + Stripe fees)

---

**Please provide these numbers so I can verify if the calculation is correct or if there's a bug.**
