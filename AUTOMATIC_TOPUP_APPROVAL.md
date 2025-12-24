# Automatic Top-Up Approval System

## Overview
The KayodManage system now automatically approves all top-up transactions (`xendit_topup` and `wallet_topup` types). This eliminates the need for manual approval and provides instant wallet credit to users.

## Features

### 1. Automatic Scheduled Approval
- **Runs every 5 minutes** automatically after server starts
- Checks for all pending top-up transactions
- Automatically approves and credits user wallets
- Logs all approvals for audit trail
- Emits real-time socket events to admin dashboard

### 2. Manual Status Update
When an admin manually updates a top-up transaction status via the transactions endpoint:
- Transaction is automatically set to 'completed' status
- User wallet balance is immediately updated
- Activity is logged
- Real-time notification is sent to admin dashboard

### 3. Bulk Approval Endpoint
Admins can manually trigger approval of all pending top-ups at any time.

## Implementation Details

### Modified Files

#### 1. `Backend/app/controllers/transactionController.js`
**Changes:**
- Removed restriction preventing manual updates to `xendit_topup` transactions
- Added auto-approval logic when updating top-up transaction status
- Automatically updates user wallet balance on approval
- Logs activity and emits socket events

**Previous behavior:**
```javascript
if (transaction.type === 'xendit_topup') {
  return res.status(403).json({ error: 'Top-up transactions are read-only and cannot be manually updated' });
}
```

**New behavior:**
- Automatically approves both `xendit_topup` and `wallet_topup` transactions
- Updates user wallet balance immediately
- Returns completed transaction data

#### 2. `Backend/app/routes/transactions.js`
**Added:**
- New endpoint: `POST /api/transactions/approve-topups`
- Bulk approves all pending top-up transactions
- Requires admin authentication
- Returns count and details of approved transactions

#### 3. `Backend/app/utils/autoApproveTopups.js` (NEW FILE)
**Utility functions:**
- `autoApproveTopups()` - Approves all pending top-ups
- `startAutoApprovalScheduler(intervalMinutes)` - Starts periodic approval
- `stopAutoApprovalScheduler()` - Stops the scheduler

**Features:**
- Comprehensive error handling
- Detailed logging with timestamps
- Socket.IO event emission
- Tracks both successful and failed approvals

#### 4. `Backend/app/routes/admin.js`
**Added:**
- New endpoint: `POST /api/admin/approve-topups-now`
- Manual trigger for immediate approval
- Requires admin authentication

#### 5. `Backend/server.js`
**Changes:**
- Imports auto-approval scheduler
- Starts scheduler on server startup (5-minute interval)
- Stops scheduler gracefully on server shutdown

## API Endpoints

### 1. Update Transaction Status (Modified)
```
PATCH /api/transactions/:transactionId/status
```
**Headers:**
- Authentication required (admin)

**Body:**
```json
{
  "status": "completed" // Will auto-approve if type is xendit_topup or wallet_topup
}
```

**Response:**
```json
{
  "_id": "transaction_id",
  "status": "completed",
  "completedAt": "2025-01-15T10:30:00.000Z",
  "amount": 500,
  "type": "xendit_topup",
  "fromUser": { ... },
  ...
}
```

### 2. Bulk Approve All Pending Top-Ups
```
POST /api/transactions/approve-topups
```
**Headers:**
- Authentication required (admin)

**Response:**
```json
{
  "success": true,
  "message": "Successfully approved 5 top-up transactions",
  "approved": 5,
  "transactions": [
    {
      "id": "transaction_id",
      "userId": "user_id",
      "amount": 500,
      "type": "xendit_topup"
    },
    ...
  ]
}
```

### 3. Manual Trigger Approval (Admin)
```
POST /api/admin/approve-topups-now
```
**Headers:**
- Authentication required (admin)

**Response:**
```json
{
  "success": true,
  "approved": 3,
  "failed": 0,
  "transactions": [...],
  "message": "Automatically approved 3 top-up transaction(s)"
}
```

## Automatic Scheduler

### Configuration
The scheduler runs every **5 minutes** by default. This can be modified in `server.js`:

```javascript
// Change the interval (in minutes)
startAutoApprovalScheduler(5); // Runs every 5 minutes
```

### Logs
The scheduler outputs detailed logs:
```
[AUTO-APPROVE] Starting automatic top-up approval...
[AUTO-APPROVE] Found 3 pending top-up(s)
[AUTO-APPROVE] ✓ Approved transaction 507f1f77bcf86cd799439011 for user 507f191e810c19729de860ea - Amount: ₱500
[AUTO-APPROVE] ✓ Approved transaction 507f1f77bcf86cd799439012 for user 507f191e810c19729de860eb - Amount: ₱1000
[AUTO-APPROVE] ✓ Approved transaction 507f1f77bcf86cd799439013 for user 507f191e810c19729de860ec - Amount: ₱250
[AUTO-APPROVE] Completed: 3 approved, 0 failed
```

## Socket.IO Events

### Event: `transaction:updated`
Emitted when a single transaction is approved manually.

**Payload:**
```javascript
{
  transaction: { ... },
  updateType: 'auto-approved top-up'
}
```

### Event: `transactions:bulk-approved`
Emitted when bulk approval is triggered via endpoint.

**Payload:**
```javascript
{
  count: 5,
  transactions: [...]
}
```

### Event: `transactions:auto-approved`
Emitted when the scheduler approves transactions.

**Payload:**
```javascript
{
  count: 3,
  transactions: [...],
  timestamp: "2025-01-15T10:30:00.000Z"
}
```

## Wallet Balance Updates

When a top-up transaction is approved:

1. Transaction status changes to `completed`
2. `completedAt` timestamp is set
3. User's wallet balance is incremented:
   ```javascript
   await User.findByIdAndUpdate(
     userId,
     { $inc: { 'wallet.balance': transaction.amount } }
   );
   ```

## Error Handling

The system includes comprehensive error handling:
- Individual transaction failures don't stop batch processing
- All errors are logged with details
- Failed transactions are tracked and reported
- Socket events are wrapped in try-catch to prevent server crashes

## Testing

### Test Manual Approval
```bash
# Using curl
curl -X PATCH http://localhost:5000/api/transactions/:transactionId/status \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{"status":"completed"}'
```

### Test Bulk Approval
```bash
curl -X POST http://localhost:5000/api/transactions/approve-topups \
  -H "Cookie: your-session-cookie"
```

### Test Manual Trigger
```bash
curl -X POST http://localhost:5000/api/admin/approve-topups-now \
  -H "Cookie: your-session-cookie"
```

## Monitoring

### Server Startup
```
✅ Auto-approval scheduler started for top-up transactions
```

### Server Shutdown
```
✅ Auto-approval scheduler stopped
```

### Regular Operations
Monitor the `[AUTO-APPROVE]` logs to track automatic approvals.

## Security Considerations

1. **Authentication Required**: All endpoints require admin authentication
2. **Activity Logging**: All approvals are logged for audit purposes
3. **Idempotent Operations**: Safe to run multiple times
4. **Wallet Validation**: User existence is verified before wallet update
5. **Transaction Integrity**: Uses atomic database operations

## Future Enhancements

Potential improvements:
- Configurable approval rules (amount limits, user verification requirements)
- Email notifications to users on approval
- Dashboard statistics for approval rates
- Webhook integration for external services
- Approval history and analytics

## Troubleshooting

### Scheduler Not Running
Check server logs for:
```
✅ Auto-approval scheduler started for top-up transactions
```

If missing, verify the scheduler import in `server.js`.

### Transactions Not Approved
1. Check transaction type (`xendit_topup` or `wallet_topup`)
2. Verify transaction status is `pending`
3. Check server logs for errors
4. Verify database connection

### Wallet Balance Not Updated
1. Verify user exists in database
2. Check for wallet field in User model
3. Review error logs for specific failures

## Summary

The automatic top-up approval system provides:
- ✅ Instant wallet credit for users
- ✅ Zero manual intervention required
- ✅ Comprehensive logging and monitoring
- ✅ Real-time admin notifications
- ✅ Manual override capabilities
- ✅ Robust error handling

All top-up transactions are now processed automatically, improving user experience and reducing administrative overhead.
