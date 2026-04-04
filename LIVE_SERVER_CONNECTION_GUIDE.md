# 🚀 Live Server Connection Guide

## 📋 Overview

This guide will help you connect both the web application and mobile app to the live server environment.

## 🔧 Configuration Files to Update

### 1. Mobile App Configuration

**File**: `c:\Users\PC\OneDrive\Desktop\Pilot\pilot\src\config\api.ts`

**Current (Local)**:
```typescript
export const API_BASE_URL = 'http://10.125.32.126:3000'; // Local dev server
```

**Update to (Live)**:
```typescript
export const API_BASE_URL = 'https://portal.quickways.org'; // Live server
```

### 2. Environment Variables

Create or update `.env.local` in the web application root:

```bash
# Database Connection
DATABASE_URL="postgresql://username:password@your-live-db-host:5432/your-database"

# Application URL
NEXTAUTH_URL="https://portal.quickways.org"

# Email Configuration (for customer credentials)
GMAIL_USER="your-email@gmail.com"
GMAIL_APP_PASSWORD="your-app-password"

# Firebase Configuration (for push notifications)
FIREBASE_PROJECT_ID="your-firebase-project"
FIREBASE_PRIVATE_KEY="your-firebase-private-key"
FIREBASE_CLIENT_EMAIL="your-firebase-client-email"

# JWT Secret
JWT_SECRET="your-jwt-secret-key"

# Other required environment variables
```

## 🔄 Step-by-Step Connection Process

### Step 1: Update Mobile App API URL

1. **Open**: `c:\Users\PC\OneDrive\Desktop\Pilot\pilot\src\config\api.ts`
2. **Replace** line 2:
   ```typescript
   // FROM:
   export const API_BASE_URL = 'http://10.125.32.126:3000';
   
   // TO:
   export const API_BASE_URL = 'https://portal.quickways.org';
   ```
3. **Save** the file

### Step 2: Configure Backend Environment

1. **Create** `.env.local` in `c:\proCarWash\web\` directory
2. **Add** the required environment variables (see above)
3. **Replace** placeholder values with actual live server credentials

### Step 3: Database Migration

1. **Navigate** to web directory:
   ```bash
   cd c:\proCarWash\web
   ```

2. **Generate Prisma client**:
   ```bash
   npx prisma generate
   ```

3. **Run migrations** (if needed):
   ```bash
   npx prisma migrate deploy
   ```

### Step 4: Deploy Backend

1. **Build** the application:
   ```bash
   npm run build
   ```

2. **Start** production server:
   ```bash
   npm start
   ```

### Step 5: Update Mobile App

1. **Rebuild** the mobile app with new API URL:
   ```bash
   cd c:\Users\PC\OneDrive\Desktop\Pilot\pilot
   
   # For Android
   npx react-native run-android
   
   # For iOS
   npx react-native run-ios
   ```

## 🔧 Required Environment Variables

### Database
- `DATABASE_URL`: PostgreSQL connection string for live database

### Application
- `NEXTAUTH_URL`: Live server URL (https://portal.quickways.org)
- `JWT_SECRET`: Secret key for JWT token generation

### Email (Customer Credentials)
- `GMAIL_USER`: Gmail address for sending emails
- `GMAIL_APP_PASSWORD`: Gmail app password (not regular password)

### Firebase (Push Notifications)
- `FIREBASE_PROJECT_ID`: Firebase project ID
- `FIREBASE_PRIVATE_KEY`: Firebase private key
- `FIREBASE_CLIENT_EMAIL`: Firebase service account email

### Optional
- `STRIPE_SECRET_KEY`: For payment processing
- `STRIPE_WEBHOOK_SECRET`: For Stripe webhooks

## 🧪 Testing Connection

### 1. Backend Health Check
```bash
curl https://portal.quickways.org/api/health
```

### 2. Mobile App Connection
- Open mobile app
- Check console logs for API calls
- Verify authentication works
- Test spot order creation

### 3. Email Testing
- Create a test spot order
- Verify customer receives credentials email
- Check email logs in server console

## 🚨 Common Issues & Solutions

### Issue 1: CORS Errors
**Solution**: Add live domain to CORS configuration in backend

### Issue 2: Database Connection Failed
**Solution**: Verify DATABASE_URL is correct and database is accessible

### Issue 3: Email Not Sending
**Solution**: Check Gmail credentials and app password setup

### Issue 4: Mobile App Cannot Connect
**Solution**: 
- Verify API_BASE_URL is correct
- Check network connectivity
- Ensure SSL certificate is valid

### Issue 5: Authentication Fails
**Solution**: Verify JWT_SECRET is same across all instances

## 🔄 Deployment Checklist

### Pre-Deployment
- [ ] Update mobile app API URL
- [ ] Configure all environment variables
- [ ] Test database connection
- [ ] Verify email configuration
- [ ] Test Firebase configuration

### Post-Deployment
- [ ] Test mobile app authentication
- [ ] Test spot order creation
- [ ] Test email sending
- [ ] Verify all API endpoints work
- [ ] Check error logs

## 📱 Mobile App Specific Notes

### Android
- Ensure `android:usesCleartextTraffic="false"` in AndroidManifest.xml for HTTPS
- Update network security config if needed

### iOS
- Update ATS (App Transport Security) settings for HTTPS
- Add domain to exception list if needed during testing

## 🛡️ Security Considerations

1. **Use HTTPS** for all API calls
2. **Validate environment variables** before deployment
3. **Use strong JWT secret** (at least 32 characters)
4. **Enable database SSL** connection
5. **Regularly rotate secrets** and passwords
6. **Monitor error logs** for security issues

## 📞 Support

If you encounter issues:

1. **Check console logs** in both web and mobile
2. **Verify environment variables** are correctly set
3. **Test database connection** separately
4. **Check network connectivity** between mobile and server
5. **Review error messages** for specific issues

## 🎉 Success Indicators

✅ Mobile app connects to live server  
✅ Authentication works correctly  
✅ Spot orders can be created  
✅ Customer credentials emails are sent  
✅ All API endpoints respond correctly  
✅ No CORS or SSL errors  

---

**Once these steps are completed, your application will be fully connected to the live server!** 🚀
