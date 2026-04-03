# Force Logout Feature - Admin User Management

## Overview
A comprehensive force logout system that allows administrators to forcefully logout any user from their active sessions. This feature is essential for security management, account maintenance, and emergency access control.

## Features

### 🔐 **Session Management**
- **Token Versioning**: Each user has a `tokenVersion` field that increments on force logout
- **Automatic Invalidation**: Existing tokens become invalid when token version changes
- **Real-time Verification**: Mobile apps check token version on each API call

### 🎛️ **Admin Controls**
- **Individual User Logout**: Force logout specific users
- **Global Logout**: Force logout all users at once
- **Role-based Organization**: Users grouped by role (Admin, Driver, User, Partner)
- **Session Status**: Visual indicators for user activity

### 📊 **User Information**
- **Token Version Display**: Shows current token version for each user
- **Session Status**: Active/Idle based on last update time
- **Account Details**: Email, role, verification status, creation date
- **Activity Tracking**: Last update timestamp

## Architecture

### Database Schema
```prisma
model User {
  // ... existing fields
  tokenVersion Int @default(0)  // New field for session invalidation
}
```

### API Endpoints

#### `POST /api/admin/users/force-logout`
**Purpose**: Force logout users by incrementing token version

**Request Body**:
```json
{
  "userId": "user-id-123"        // Optional - logout specific user
  // OR
  "logoutAll": true              // Optional - logout all users
}
```

**Response**:
```json
{
  "success": true,
  "message": "Force logout completed for John Doe",
  "affectedUsers": [...],
  "timestamp": "2024-03-29T...",
  "mechanism": "Token version incremented - all existing tokens will be invalidated on next verification"
}
```

#### `GET /api/admin/users/force-logout`
**Purpose**: Get list of all users with session information

**Response**:
```json
{
  "users": {
    "ADMIN": [...],
    "DRIVER": [...],
    "USER": [...],
    "PARTNER": [...]
  },
  "totalUsers": 10,
  "timestamp": "2024-03-29T...",
  "mechanism": "Token versioning - users are logged out when tokenVersion changes"
}
```

### Mobile Session Integration

#### Token Verification Process
1. **Mobile app sends JWT token** in API requests
2. **Server extracts token version** from JWT payload
3. **Server fetches current user** from database
4. **Server compares token versions**:
   - If match: ✅ Valid session
   - If mismatch: ❌ Force logout detected
5. **Token version increment** invalidates all existing tokens

#### Enhanced Mobile Session API
```typescript
// Updated signMobileToken - includes current token version
export async function signMobileToken(payload: MobileSessionPayload): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { tokenVersion: true }
  });
  
  return new SignJWT({
    // ... payload
    tokenVersion: user.tokenVersion,  // Include current version
  }).sign(secret);
}

// Updated verifyMobileToken - validates token version
export async function verifyMobileToken(token: string): Promise<MobileSessionPayload> {
  const { payload } = await jwtVerify(token, secret);
  const user = await prisma.user.findUnique({
    where: { id: payload.sub! },
    select: { tokenVersion: true, /* ... */ }
  });
  
  // Critical: Check if token version matches database
  if (payload.tokenVersion !== user.tokenVersion) {
    throw new Error("Token has been invalidated (force logout)");
  }
  
  return { /* ... user data */ };
}
```

## User Interface

### Navigation
- **Location**: Admin → Force Logout (`/admin/users/force-logout`)
- **Icon**: Logout/exit icon in admin navigation
- **Access**: Admin role required

### Interface Components

#### Global Actions Section
- **Force Logout All Users**: Emergency logout for all platform users
- **Warning Messages**: Clear guidance on impact and consequences

#### User Management by Role
- **Role Tabs**: Admin, Driver, User, Partner sections
- **User Cards**: Individual user information and actions
- **Status Indicators**: 
  - 🟢 Active (updated within last hour)
  - ⚪ Idle (not updated recently)
  - ✅ Verified (email verified)
  - 🔵 Role badges

#### User Information Display
```
John Doe
driver@test.com
[DRIVER] [Verified] [Active]

Token Version: v5
Created: Mar 29, 2024, 10:30 AM
Last Updated: Mar 29, 2024, 2:15 PM

[Force Logout]
```

## Security Considerations

### ✅ **Security Benefits**
- **Immediate Session Invalidation**: Tokens become invalid instantly
- **No Session Storage Required**: Stateless JWT approach
- **Scalable Solution**: Works across multiple servers/instances
- **Audit Trail**: All force logout actions are logged

### 🛡️ **Access Control**
- **Admin Only**: Only users with ADMIN role can access
- **Session Validation**: Admin sessions verified before actions
- **Action Logging**: All logout actions logged with admin identity

### 🔒 **Token Security**
- **Version-based Invalidation**: No need to store session blacklists
- **Automatic Cleanup**: Old tokens naturally expire
- **Database Consistency**: Token version atomic with user updates

## Use Cases

### 🚨 **Emergency Scenarios**
- **Security Breach**: Immediately logout all users
- **Account Compromise**: Force logout specific compromised accounts
- **System Maintenance**: Logout users before major updates

### 👥 **User Management**
- **Account Suspension**: Force logout suspended users
- **Role Changes**: Logout users after role modifications
- **Password Resets**: Ensure users re-authenticate after password changes

### 🔧 **Development & Testing**
- **Session Testing**: Force logout to test re-authentication flows
- **Bug Investigation**: Clear user sessions for debugging
- **Feature Development**: Test logout behavior during development

## Implementation Notes

### Database Migration
```sql
-- Add tokenVersion field to User table
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
```

### Performance Considerations
- **Database Query**: Token verification requires one DB lookup per request
- **Caching**: User data could be cached to reduce DB load
- **Indexing**: User ID already indexed for efficient lookups

### Error Handling
- **Force Logout Detection**: Mobile apps should handle "Token has been invalidated" errors
- **Graceful Redirect**: Redirect users to login screen on force logout
- **User Feedback**: Show clear messages explaining why logout occurred

## Testing

### Manual Testing Steps
1. **Login as Admin**: Access `/admin/users/force-logout`
2. **Verify User List**: Check all users are displayed correctly
3. **Test Individual Logout**: Force logout a specific user
4. **Test Global Logout**: Force logout all users
5. **Verify Mobile App**: Confirm mobile user is logged out on next API call

### Automated Testing
- **API Endpoint Tests**: Verify authentication and responses
- **Token Version Tests**: Ensure version increments correctly
- **Mobile Session Tests**: Verify token validation logic

## Future Enhancements

### 🔄 **Advanced Features**
- **Scheduled Logout**: Schedule force logout for specific times
- **Bulk User Selection**: Select multiple users for batch logout
- **Logout Reason**: Add reasons for audit trail
- **User Notifications**: Notify users before force logout

### 📈 **Analytics & Monitoring**
- **Logout Metrics**: Track force logout frequency and patterns
- **Session Analytics**: Monitor user session durations
- **Security Dashboard**: Visualize security events

### 🔧 **Performance Optimizations**
- **Redis Integration**: Use Redis for session state management
- **Database Optimization**: Optimize token verification queries
- **Caching Strategy**: Implement user data caching

## Troubleshooting

### Common Issues
1. **Token Version Mismatch**: Ensure mobile app handles invalidation errors
2. **Database Sync**: Verify `tokenVersion` field exists and is indexed
3. **Admin Access**: Confirm user has ADMIN role
4. **API Errors**: Check server logs for detailed error messages

### Debug Information
- **Server Logs**: All force logout actions logged with timestamps
- **Token Payload**: Include token version in JWT for debugging
- **Database State**: Check `tokenVersion` values in User table

---

## Summary
The Force Logout feature provides administrators with powerful session management capabilities while maintaining security and scalability. The token versioning approach ensures immediate session invalidation without requiring complex session storage, making it ideal for modern mobile applications.
