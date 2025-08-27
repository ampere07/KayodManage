# Troubleshooting Guide: KayodManage Still Showing Mock Data

## Problem
KayodManage admin panel is still displaying mock/example user verification data instead of real data from the Kayod backend.

## Root Cause Analysis

The issue occurs because KayodManage backend fails to connect to the Kayod backend and falls back to mock data. This can happen due to:

1. **Kayod server not running**
2. **Port mismatch**
3. **Authentication failure**
4. **Database connection issues**
5. **CORS configuration problems**

## Step-by-Step Solution

### Step 1: Test the Connection

First, let's test if the Kayod backend is accessible:

```bash
cd C:\Users\melvi\Documents\GitHub\KayodManage\Backend
npm run test-connection
```

This will run comprehensive tests and show you exactly what's working and what's failing.

### Step 2: Start Kayod Server

If the connection test fails, start the Kayod server:

```bash
cd C:\Users\melvi\Documents\GitHub\kayod\server
npm start
```

**Expected output:**
```
🚀 Kayod Server Started Successfully!
📍 Server running on port 8080
🌐 API: http://localhost:8080/api
```

**If you see a different port (like 8081), stop the server and check your .env file.**

### Step 3: Verify Port Configuration

**Kayod Server (.env should have):**
```
PORT=8080
```

**KayodManage (.env should have):**
```
KAYOD_BACKEND_URL=http://localhost:8080
```

### Step 4: Test Manual API Calls

Open a browser or use Postman to test these endpoints:

1. **Basic connectivity:** `http://localhost:8080/`
   - Should return JSON with "Kayod API is running"

2. **Health check:** `http://localhost:8080/api/health`
   - Should show database status

3. **Verification endpoint (should fail without auth):** 
   `http://localhost:8080/api/credential-verification/admin/all`
   - Should return 401 Unauthorized

4. **With API key (should work):**
   ```
   URL: http://localhost:8080/api/credential-verification/admin/all
   Headers: 
     x-api-key: kayod-admin-access-key-123
   ```
   - Should return verification data

### Step 5: Check Database

Both systems should use the same database. Verify your MongoDB URIs:

**Both .env files should have:**
```
MONGODB_URI=mongodb+srv://kayodtest1:kayodtest123@kayodcluster1.30yt5b2.mongodb.net/kayod?retryWrites=true&w=majority&appName=kayodcluster1
```

Note the `/kayod` database name at the end.

### Step 6: Start Both Services in Order

1. **Start Kayod backend first:**
   ```bash
   cd C:\Users\melvi\Documents\GitHub\kayod\server
   npm start
   ```
   Wait for "Server running on port 8080"

2. **Start KayodManage backend:**
   ```bash
   cd C:\Users\melvi\Documents\GitHub\KayodManage\Backend
   npm start
   ```
   Wait for "Server running on port 5000"

3. **Start KayodManage frontend:**
   ```bash
   cd C:\Users\melvi\Documents\GitHub\KayodManage\Frontend
   npm run dev
   ```

### Step 7: Check Console Logs

When you refresh the User Verifications page, check the KayodManage backend console. You should see:

**Success (real data):**
```
🔌 Making request to Kayod backend:
   URL: http://localhost:8080/api/credential-verification/admin/all?limit=50&skip=0
   Method: GET
✅ Request successful: 200
```

**Failure (falls back to mock data):**
```
❌ Error making request to Kayod backend:
   URL: http://localhost:8080/api/credential-verification/admin/all?limit=50&skip=0
   Status: [ERROR CODE]
   Message: [ERROR MESSAGE]
Main backend not available, using mock data
```

### Step 8: Create Test Verification Data

If everything connects but you still see no data, create some test verification data:

1. Go to your main Kayod app/website
2. Create a user account
3. Try to submit verification documents
4. Check the MongoDB database for verification documents

## Common Issues & Solutions

### Issue: "ECONNREFUSED" Error
**Solution:** Kayod server is not running. Start it first.

### Issue: "401 Unauthorized"
**Solution:** API key mismatch. Check both .env files have the same `KAYOD_API_KEY` and `ADMIN_API_KEY`.

### Issue: "404 Not Found"
**Solution:** Endpoint doesn't exist. Check if the credential verification routes are properly configured.

### Issue: Empty verification list but connection works
**Solution:** No verification data in database. Create test data or check if verifications exist in MongoDB.

### Issue: CORS errors in browser console
**Solution:** Already fixed in the latest server.js update.

## Expected Final Result

When working correctly:
- Real user names (not Jane Smith, Bob Johnson, etc.)
- Real email addresses
- Actual verification statuses from your database
- Real submission dates
- Actual document counts

## Next Steps After Fix

1. Configure Cloudinary for actual image display
2. Set up proper verification image URLs
3. Test the complete verification workflow

## Need Help?

If issues persist:
1. Run the connection test: `npm run test-connection`
2. Share the console output
3. Check both server console logs
4. Verify database has verification documents
