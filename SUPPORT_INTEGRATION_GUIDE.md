# Support System Integration Setup Guide

## Overview
The support ticket system has been updated to use a shared database between the Kayod app and KayodManage admin panel. This ensures tickets created by users in the Kayod app are visible in the admin panel.

## Configuration Steps

### 1. Database Setup

Both systems now share a database for support tickets. You need to ensure both are configured to use the same MongoDB database for support data.

#### Option A: Use a Shared Database (Recommended)
1. Create a dedicated database for admin/support data:
   ```bash
   mongosh
   use kayod-admin
   ```

2. Update environment variables in both projects:
   
   **Kayod App (`kayod/server/.env`):**
   ```env
   # Main app database
   MONGODB_URI=mongodb://localhost:27017/kayod
   
   # Admin database for support tickets (shared with KayodManage)
   ADMIN_DB_URI=mongodb://localhost:27017/kayod-admin
   
   # Admin backend URL for notifications
   ADMIN_BACKEND_URL=http://localhost:5000
   ```
   
   **KayodManage (`KayodManage/Backend/.env`):**
   ```env
   # Shared database with Kayod for support tickets
   MONGODB_URI=mongodb://localhost:27017/kayod-admin
   DATABASE_URL=mongodb://localhost:27017/kayod-admin
   ```

### 2. Backend Services

#### Start KayodManage Backend:
```bash
cd KayodManage/Backend
npm install
npm start
# Server runs on http://localhost:5000
```

#### Start Kayod Backend:
```bash
cd kayod/server
npm install
npm start
# Server runs on http://localhost:8080
```

### 3. Frontend Services

#### Start KayodManage Frontend:
```bash
cd KayodManage/Frontend
npm install
npm run dev
# Admin panel runs on http://localhost:5173
```

#### Start Kayod App:
```bash
cd kayod/client
npm install
expo start
# Mobile app runs on Expo
```

## Testing the Integration

### 1. Create a Support Ticket from Kayod App:
1. Open the Kayod app
2. Navigate to Contact Support
3. Fill in the form:
   - Title: "Test Ticket"
   - Category: Select any category
   - Description: "This is a test ticket"
4. Submit the ticket

### 2. View Ticket in Admin Panel:
1. Open KayodManage admin panel (http://localhost:5173)
2. Login as admin
3. Navigate to Support section
4. You should see the ticket created from the Kayod app

### 3. Admin Response:
1. Click on the ticket in the admin panel
2. Accept the ticket
3. Send a message
4. The user should receive the message in the Kayod app

## Troubleshooting

### Issue: Support page not showing in Admin Panel
**Solution:** Ensure the Support route is properly configured in the frontend routing.

### Issue: Tickets not appearing in Admin Panel
**Solution:** 
1. Check that both systems are using the same database
2. Verify MongoDB connection strings in .env files
3. Check console logs for any connection errors

### Issue: Cannot submit ticket from Kayod app
**Solution:**
1. Ensure authentication is working (user must be logged in)
2. Check network connection to backend
3. Verify API endpoint is correct in apiConfig.js

### Issue: Socket notifications not working
**Solution:**
1. Ensure Socket.IO is properly initialized in both backends
2. Check CORS settings allow communication between services
3. Verify socket event handlers are properly set up

## API Endpoints

### Kayod App (User-facing):
- `GET /api/support/info` - Get categories and priorities
- `POST /api/support/tickets` - Create new ticket
- `GET /api/support/tickets` - Get user's tickets
- `GET /api/support/tickets/:id` - Get ticket details
- `POST /api/support/tickets/:id/messages` - Send message

### KayodManage (Admin-facing):
- `GET /api/support/tickets` - Get all tickets
- `GET /api/support/tickets/:id` - Get ticket details
- `PUT /api/support/tickets/:id/accept` - Accept ticket
- `PUT /api/support/tickets/:id/reject` - Reject ticket
- `PUT /api/support/tickets/:id/resolve` - Resolve ticket
- `POST /api/support/tickets/:id/messages` - Admin reply
- `POST /api/support/notify-new-ticket` - Receive notification
- `POST /api/support/notify-new-message` - Receive message notification

## Database Schema

The shared `SupportTicket` schema includes:
```javascript
{
  ticketId: String (unique, auto-generated),
  userId: String,
  userEmail: String,
  userName: String,
  userType: String,
  title: String,
  description: String,
  category: String,
  priority: String,
  status: String,
  assignedAdmin: ObjectId,
  messages: [{
    senderId: String,
    senderName: String,
    senderType: String,
    message: String,
    timestamp: Date,
    isRead: Boolean
  }],
  attachments: Array,
  resolution: String,
  rating: Number,
  feedback: String,
  lastActivity: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## Notes

1. **Data Persistence**: All support tickets are stored in the shared `kayod-admin` database
2. **Real-time Updates**: Socket.IO is used for real-time notifications
3. **Cross-Service Communication**: HTTP requests notify the admin system of new tickets
4. **User Privacy**: User IDs are stored as strings to maintain separation between databases
5. **Authentication**: Each system maintains its own authentication, but tickets are linked by user ID

## Security Considerations

1. **Inter-Service Communication**: The notification endpoints (`/notify-new-ticket`, `/notify-new-message`) currently don't require authentication for simplicity. In production, consider adding:
   - API key authentication
   - IP whitelisting
   - Request signing

2. **Database Access**: Ensure proper MongoDB authentication is configured in production

3. **CORS**: Configure CORS properly to only allow trusted origins

## Future Enhancements

1. **File Attachments**: Add support for uploading images/documents with tickets
2. **Email Notifications**: Send email alerts when tickets are updated
3. **SLA Tracking**: Add response time tracking and SLA management
4. **Ticket Templates**: Create templates for common issues
5. **Knowledge Base**: Link tickets to FAQ/knowledge base articles
