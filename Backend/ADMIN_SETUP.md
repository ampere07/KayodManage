# Admin Activity Logging Fix - Setup Instructions

## What Was Fixed

The admin activity logging system was not working because the system was using a placeholder string ID (`'admin_admin'`) instead of a valid MongoDB ObjectId for the admin user. This caused the activity logger to reject all log entries.

## Changes Made

1. **Updated User Model** (`app/models/User.js`)
   - Added `password` field (required for admin and superadmin users)
   - Added `userType` field with 'admin' and 'superadmin' enum values
   - Now supports userType: 'client', 'provider', 'admin', 'superadmin'
   - Changed `restrictedBy` reference from 'Admin' to 'User'

2. **Updated Auth Controller** (`app/controllers/authController.js`)
   - Authenticates against User collection filtering by userType: 'admin' or 'superadmin'
   - Stores real MongoDB ObjectId in session
   - Uses bcrypt to verify hashed passwords
   - Uses email as username for admin login

3. **Updated Activity Log Controller** (`app/controllers/activityLogController.js`)
   - Added 'username' to populated admin fields

4. **Created Admin Setup Scripts**
   - `scripts/createSuperAdmin.js` - Script to create super admin user
   - `scripts/createAdminUser.js` - Script to create regular admin user

## Setup Instructions

### Step 1: Create Super Admin User (Do this first!)

Run the super admin creation script:

```bash
cd Backend
node scripts/createSuperAdmin.js
```

This will create a super admin user with:
- **Email:** `superadmin`
- **Password:** `superadmin` (hashed with bcrypt)

### Step 2: (Optional) Create Regular Admin User

If you need additional admin users:

```bash
node scripts/createAdminUser.js
```

This will create an admin user with:
- **Email:** `admin`
- **Password:** `admin` (hashed with bcrypt)

### Step 3: Restart Backend Server

```bash
npm run dev
```

### Step 4: Login with Super Admin Credentials

1. Go to the admin login page
2. Login with:
   - **Username:** `superadmin`
   - **Password:** `superadmin`
3. The system will now use the proper admin ObjectId
4. All activity logs will be properly created and displayed

## Verification

After setup, verify the super admin user:

1. Check MongoDB:
   ```javascript
   db.users.findOne({ userType: 'superadmin' })
   ```

2. Login through the admin panel

3. Perform an action (restrict user, approve verification, etc.)

4. Check activity logs - they should now appear with admin information

## User Types

The system now supports:
- **superadmin** - Super administrator with full access
- **admin** - Regular administrator with admin access
- **provider** - Service provider users
- **client** - Client users

## Security Note

**IMPORTANT:** In production, you should:
1. Change the admin passwords immediately after first login
2. Use strong, unique passwords
3. Consider implementing password change functionality
4. Never commit passwords or credentials to version control
5. Use environment variables for sensitive data

## Notes

- Admin users are regular User documents with `userType: 'admin'` or `userType: 'superadmin'`
- Passwords are hashed using bcrypt with salt rounds of 10
- All existing sessions will be invalidated and users need to login again
- Activity logs created before this fix will have invalid adminId references
- The admin ObjectId is now properly stored and used for all activity logging
