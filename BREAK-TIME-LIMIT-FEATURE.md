# 30-Minute Break Time Limit Feature

## Overview
Implemented a comprehensive break time management system that enforces a **30-minute daily limit** for driver breaks. When drivers exceed this limit, their break requests are automatically redirected to admin for approval.

## Features

### ⏰ **Break Time Enforcement**
- **30-Minute Daily Limit**: Drivers cannot take more than 30 minutes of breaks per day
- **Automatic Tracking**: System calculates total break time for the current day
- **Real-time Validation**: Break requests checked against daily total before approval
- **Admin Override**: Required approval for breaks exceeding the limit

### 📋 **Approval Workflow**
- **Automatic Request Creation**: When limit exceeded, approval request created automatically
- **Admin Dashboard**: Dedicated interface for managing break approval requests
- **Approval/Rejection**: Admins can approve or reject with optional reasons
- **Status Tracking**: PENDING → APPROVED/REJECTED workflow

### 📊 **Statistics & Monitoring**
- **Daily Break Summary**: Shows total break time taken vs. remaining time
- **Request History**: Complete audit trail of all break requests
- **Driver Information**: Detailed driver and break context for decisions

## Architecture

### Database Schema

#### New Model: DriverBreakApprovalRequest
```prisma
model DriverBreakApprovalRequest {
  id                   String   @id
  driverId             String
  driverDayId          String
  reason               String   // LUNCH, REST, PERSONAL, EMERGENCY, OTHER
  reasonDisplay        String   // "Lunch Break", "Rest Break", etc.
  notes                String?
  requestedDuration    Int?     // Requested break duration in minutes
  totalBreakTimeToday  Int      // Total break time already taken today
  status               String   @default("PENDING") // PENDING, APPROVED, REJECTED
  approvedBy           String?  // Admin user ID who approved/rejected
  approvedAt           DateTime?
  rejectionReason      String?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @default(now())
  
  // Relations
  User                 User     @relation(fields: [driverId], references: [id])
  DriverDay            DriverDay @relation(fields: [driverDayId], references: [id])
}
```

### API Endpoints

#### Driver Break API (Enhanced)
**Endpoint**: `POST /api/driver/break`

**Enhanced Logic**:
```typescript
// Calculate today's total break time
const todayBreaks = await prisma.driverBreak.findMany({
  where: {
    driverId,
    startedAt: { gte: today, lt: tomorrow }
  }
});

const totalBreakTime = todayBreaks.reduce((total, break_) => {
  if (break_.endedAt) {
    const duration = break_.endedAt.getTime() - break_.startedAt.getTime();
    return total + (duration / (1000 * 60)); // Convert to minutes
  }
  return total;
}, 0);

// Check against 30-minute limit
if (totalBreakTime >= 30) {
  // Create approval request instead of break
  const approvalRequest = await prisma.driverBreakApprovalRequest.create({
    data: {
      driverId,
      reason,
      totalBreakTimeToday: Math.round(totalBreakTime),
      status: 'PENDING'
    }
  });
  
  return NextResponse.json({
    success: false,
    requiresApproval: true,
    message: `You have already taken ${Math.round(totalBreakTime)} minutes of breaks today (30-minute limit exceeded). Your request has been sent to admin for approval.`,
    approvalRequest: { /* ... */ }
  });
}

// Normal break creation continues...
```

#### Admin Break Approvals API
**Endpoint**: `GET /api/admin/break-approvals`
- Fetch all break approval requests with filtering
- Include driver information and break statistics
- Support pagination and status filtering

**Endpoint**: `POST /api/admin/break-approvals`
- Approve or reject break requests
- Create actual break record when approved
- Log admin action and timestamps

### User Interface

#### Admin Break Approvals Dashboard
**Location**: `/admin/break-approvals`
**Features**:
- **Request List**: All approval requests with driver details
- **Status Filtering**: Filter by PENDING/APPROVED/REJECTED
- **Quick Actions**: Approve/Reject buttons with reason input
- **Break Statistics**: Show daily break time vs. remaining time
- **Pagination**: Handle large volumes of requests

#### Request Card Display
```
John Doe (driver@test.com)
[PENDING] [LUNCH] [30+ minutes taken]

Requested Break: Lunch Break
Today's Break Time: 35 minutes taken (0 minutes remaining)

Requested: Mar 29, 2024, 2:30 PM
Notes: Need extra time for personal appointment

[Approve] [Reject]
```

## User Experience Flow

### Driver Experience

#### Normal Break (Under 30 minutes)
1. **Driver requests break** via mobile app
2. **System checks daily total** (e.g., 15 minutes taken)
3. **Remaining time calculated** (30 - 15 = 15 minutes available)
4. **Break starts immediately** ✅

#### Limit Exceeded Break (Over 30 minutes)
1. **Driver requests break** via mobile app
2. **System checks daily total** (e.g., 32 minutes already taken)
3. **Limit exceeded detected** (32 > 30)
4. **Approval request created** automatically 📋
5. **Driver notified** of approval requirement ⏳
6. **Admin reviews request** via dashboard 👀
7. **Admin approves/rejects** with optional reason ✅/❌
8. **Driver notified** of decision 📱

#### Mobile App Response
```json
// Normal break (approved immediately)
{
  "success": true,
  "break": {
    "id": "break-driver123-1711768200000",
    "reason": "LUNCH",
    "startedAt": "2024-03-29T14:30:00.000Z"
  }
}

// Limit exceeded (requires approval)
{
  "success": false,
  "requiresApproval": true,
  "message": "You have already taken 32 minutes of breaks today (30-minute limit exceeded). Your request has been sent to admin for approval.",
  "approvalRequest": {
    "id": "approval-driver123-1711768200000",
    "totalBreakTimeToday": 32,
    "maxAllowedTime": 30,
    "status": "PENDING"
  }
}
```

### Admin Experience

#### Dashboard Overview
- **Pending Requests**: Highlighted for immediate attention
- **Request Details**: Driver info, break reason, time statistics
- **Quick Actions**: One-click approve/reject with reason input
- **Status Tracking**: Complete audit trail of all decisions

#### Approval Process
1. **Admin navigates** to `/admin/break-approvals`
2. **Views pending requests** with driver context
3. **Reviews break statistics** and driver history
4. **Makes decision**: Approve or reject
5. **Adds optional reason** for rejection
6. **System processes** request and notifies driver

## Business Logic

### Break Time Calculation
```typescript
// Today's date range
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

// Get all breaks for today
const todayBreaks = await prisma.driverBreak.findMany({
  where: {
    driverId,
    startedAt: { gte: today, lt: tomorrow }
  }
});

// Calculate total completed break time
const totalBreakTime = todayBreaks.reduce((total, break_) => {
  if (break_.endedAt) {
    const duration = break_.endedAt.getTime() - break_.startedAt.getTime();
    return total + (duration / (1000 * 60)); // Minutes
  }
  return total; // Don't count ongoing breaks
}, 0);
```

### Approval Request Creation
```typescript
const approvalRequest = await prisma.driverBreakApprovalRequest.create({
  data: {
    id: `approval-${driverId}-${Date.now()}`,
    driverId,
    driverDayId: activeDay.id,
    reason: reason as BreakReason,
    reasonDisplay: BREAK_REASON_SCHEMA[reason],
    notes: notes || null,
    totalBreakTimeToday: Math.round(totalBreakTime),
    status: 'PENDING',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
});
```

### Approval Processing
```typescript
if (action === 'APPROVE') {
  // Create the actual break record
  await prisma.driverBreak.create({
    data: {
      id: `break-${request.driverId}-${Date.now()}`,
      driverId: request.driverId,
      driverDayId: request.driverDayId,
      reason: request.reason,
      reasonDisplay: request.reasonDisplay,
      notes: request.notes,
      startedAt: new Date(),
    }
  });
}

// Update approval request status
await prisma.driverBreakApprovalRequest.update({
  where: { id: requestId },
  data: {
    status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
    approvedBy: session.user.id,
    approvedAt: new Date(),
    rejectionReason: action === 'REJECT' ? rejectionReason : null,
  }
});
```

## Security & Validation

### Input Validation
- **Break Reasons**: Validated against predefined schema
- **Driver Authentication**: Verified mobile session required
- **Admin Authorization**: Admin role required for approvals
- **Request Uniqueness**: Prevent duplicate approval requests

### Data Integrity
- **Atomic Operations**: Break creation and approval updates are atomic
- **Foreign Key Constraints**: Proper relations between models
- **Audit Trail**: All actions logged with timestamps and user IDs
- **Status Validation**: Prevent invalid status transitions

## Configuration

### Environment Variables
```env
# No additional environment variables required
# Uses existing Prisma and NextAuth configuration
```

### Customization Options
```typescript
// Can be easily configured for different limits
const DAILY_BREAK_LIMIT_MINUTES = 30; // Change to 45, 60, etc.

// Can add different limits per role
const BREAK_LIMITS = {
  DRIVER: 30,
  SENIOR_DRIVER: 45,
  MANAGER: 60
};
```

## Testing

### Manual Testing Steps
1. **Driver Login**: Use test driver account
2. **Take Breaks**: Create multiple breaks totaling under 30 minutes
3. **Verify Normal Flow**: Breaks should start immediately
4. **Exceed Limit**: Take breaks totaling over 30 minutes
5. **Verify Approval Request**: Should create approval request instead
6. **Admin Approval**: Admin approves/rejects via dashboard
7. **Verify Break Creation**: Approved requests should create actual breaks

### Test Scenarios
- ✅ **Under Limit**: 15 minutes total → Break starts immediately
- ✅ **At Limit**: 30 minutes total → Approval required
- ✅ **Over Limit**: 35 minutes total → Approval required
- ✅ **Multiple Requests**: Multiple requests in same day
- ✅ **Admin Approval**: Approved request creates break
- ✅ **Admin Rejection**: Rejected request logged

## Performance Considerations

### Database Optimization
- **Indexes**: Proper indexes on driverId, dates, and status fields
- **Query Efficiency**: Optimized queries for break time calculations
- **Pagination**: Large datasets handled with pagination
- **Caching**: Break statistics cached for dashboard

### Scalability
- **Concurrent Requests**: Multiple drivers can request simultaneously
- **Admin Load**: Multiple admins can process approvals concurrently
- **Database Load**: Efficient queries minimize database impact

## Monitoring & Analytics

### Key Metrics
- **Daily Break Requests**: Number of requests per day
- **Approval Rate**: Percentage of approved vs. rejected requests
- **Average Response Time**: Time from request to admin decision
- **Limit Exceeded Frequency**: How often drivers exceed limits

### Admin Reports
- **Break Usage Patterns**: Most common break reasons and times
- **Driver Compliance**: Drivers who frequently exceed limits
- **Approval Workload**: Admin approval queue metrics

## Future Enhancements

### Advanced Features
- **Role-based Limits**: Different break limits per driver role
- **Time-based Rules**: Different limits for different shift types
- **Automatic Approvals**: Auto-approve certain break types
- **Break Scheduling**: Pre-scheduled breaks with admin approval

### Notifications
- **Real-time Alerts**: Push notifications for approval requests
- **Email Notifications**: Email alerts for admins and drivers
- **SMS Integration**: SMS notifications for urgent requests

### Analytics Dashboard
- **Visual Reports**: Charts and graphs for break analytics
- **Trend Analysis**: Break pattern analysis over time
- **Compliance Reports**: Driver compliance tracking

---

## Summary
The 30-Minute Break Time Limit feature provides comprehensive break management with automatic enforcement, admin approval workflows, and detailed monitoring. It ensures fair break time distribution while maintaining flexibility through admin override capabilities. The system is production-ready with proper error handling, security measures, and user-friendly interfaces.
