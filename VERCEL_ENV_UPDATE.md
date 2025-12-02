# Fix Email Verification & Password Reset URLs

## Problem
Email verification and password reset links are pointing to `localhost:3000` instead of production URL.

## Solution
Update the `NEXTAUTH_URL` environment variable in Vercel:

### Steps:

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/umshah583s-projects/quick-way1
   - Or go to https://vercel.com → Select `quick-way1` project

2. **Navigate to Settings**
   - Click **Settings** tab
   - Click **Environment Variables** in the left sidebar

3. **Update NEXTAUTH_URL**
   - Find `NEXTAUTH_URL` variable
   - **Edit** or **Add** (if missing):
     - **Key**: `NEXTAUTH_URL`
     - **Value**: `https://quick-way1.vercel.app`
     - **Environments**: Select all (Production, Preview, Development)

4. **Save Changes**
   - Click **Save**

5. **Redeploy** (Important!)
   - Go to **Deployments** tab
   - Click **...** menu on latest deployment
   - Click **Redeploy**
   - Or push a new commit to trigger deployment

## Verify Fix

After redeploying, test:

### Test Password Reset:
```bash
curl -X POST https://quick-way1.vercel.app/api/auth/request-password-reset \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

Check email - link should be:
```
https://quick-way1.vercel.app/auth/reset-password?token=xxx
```
NOT:
```
http://localhost:3000/auth/reset-password?token=xxx
```

### Test Email Verification:
Register new user and check verification email link.

## Current Code
The email sending code in `src/lib/email.ts` uses:
```typescript
const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/verify-email?token=${token}`;
const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}`;
```

Once `NEXTAUTH_URL` is set in Vercel, it will use the production URL automatically.
