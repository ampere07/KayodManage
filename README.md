# 🚀 KayodManage - Admin Panel

A comprehensive admin panel for managing the Kayod platform with real-time updates, user management, and verification workflows.

## 🎯 **Key Features**

### 📸 **UserId-Based Image System**
The verification system uses a smart image naming convention:
- **Pattern**: `{userId}_{imageType}.{extension}`
- **Examples**: 
  - `507f1f77bcf86cd799439011_face.jpg` (face verification)
  - `507f1f77bcf86cd799439011_id.jpg` (government ID)
  - `507f1f77bcf86cd799439011_cert1.jpg` (credentials)

### 🔗 **New API Endpoints**
```bash
# Get all user images by userId
GET /api/admin/users/:userId/images

# Get specific image type
GET /api/admin/users/:userId/images?imageType=face
```

**Benefits:**
- 🎯 Direct image access without database lookups
- ⚡ Fast Cloudinary CDN delivery
- 🗂️ Organized file structure
- 🔧 Easy batch operations

See [VERIFICATION_IMAGES_GUIDE.md](./VERIFICATION_IMAGES_GUIDE.md) for complete documentation.

## 🔧 **Quick Start**

### Option 1: Use Start Scripts (Recommended)
Double-click one of these files to start both servers:
- `start-servers.bat` (Windows Command Prompt)
- `start-servers.ps1` (PowerShell)

### Option 2: Manual Start
```bash
# Terminal 1: Start Backend
cd Backend
npm install
npm run dev

# Terminal 2: Start Frontend  
cd Frontend
npm install
npm run dev
```

## 🌐 **Access Points**
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **Health Check:** http://localhost:5000/api/health

## 🔑 **Default Credentials**
- **Username:** `admin`
- **Password:** `admin`

## 🏗️ **Architecture**

```
KayodManage/
├── Backend/           # Node.js + Express API
│   ├── server.js      # Main server file  
│   ├── app/           # Application code
│   └── .env          # Backend configuration
├── Frontend/          # React + Vite application
│   ├── src/           # React components
│   └── .env          # Frontend configuration  
└── start-servers.*   # Quick start scripts
```

## ⚙️ **Configuration**

### Backend (.env)
```env
MONGODB_URI=mongodb+srv://...
PORT=5000
SESSION_SECRET=your-secret-key
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin

# Cloudinary Configuration for User Images
CLOUDINARY_BASE_URL=https://res.cloudinary.com/your-cloud-name
CLOUDINARY_VERIFICATION_FOLDER=kayod-verifications

# Main Kayod Backend Integration
KAYOD_BACKEND_URL=http://localhost:3001
KAYOD_API_KEY=your-api-key-here
```

### Frontend (.env)  
```env
VITE_API_BASE_URL=http://localhost:5000
```

## 🚨 **Common Issues & Solutions**

### Issue: "ERR_CONNECTION_REFUSED"
**Solution:** Backend server is not running
```bash
cd Backend && npm run dev
```

### Issue: "No authentication token found"
**Solution:** Port mismatch fixed - frontend now uses correct port 5000

### Issue: Login fails
**Solutions:**
1. Check backend console for errors
2. Verify MongoDB connection
3. Ensure session configuration is correct

### Issue: "EADDRINUSE" error
**Solution:** Port already in use
```bash
# Find and kill process using port 5000
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

## 📋 **Features**

### ✅ Authentication & Authorization
- Session-based authentication
- Admin role management
- Secure password handling

### ✅ Real-time Updates
- Socket.IO integration
- Live dashboard statistics  
- Real-time alerts system

### ✅ User Verification Management
- **UserId-based image system** for easy data retrieval
- Document review with face verification, ID validation, and credentials
- Status tracking (pending, approved, rejected, under review)
- Bulk image operations and direct Cloudinary integration
- **NEW**: Direct user image access via userId endpoint

### ✅ Professional Error Handling
- Network error detection
- Auto-retry mechanisms
- User-friendly error messages
- Connection status indicators

## 🔧 **Development**

### Prerequisites
- Node.js 16+
- MongoDB Atlas account
- npm or yarn

### Installation
```bash
# Backend setup
cd Backend
npm install

# Frontend setup  
cd Frontend
npm install
```

### Environment Setup
1. Copy `.env.example` to `.env` in both directories
2. Update MongoDB connection string
3. Configure session secrets

## 🛡️ **Security**

- Session-based authentication (no JWT tokens in localStorage)
- CORS protection
- MongoDB connection encryption
- Secure session management

## 🎯 **Project Structure**

### Backend
- **Express.js** REST API
- **Socket.IO** for real-time features
- **MongoDB** with Mongoose ODM
- **Session-based** authentication

### Frontend  
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Axios** for API communication
- **React Query** for data management

## 📱 **Responsive Design**
- Mobile-first approach
- Responsive navigation  
- Touch-friendly interfaces
- Cross-browser compatibility

---

### 🎉 **Ready to Go!**
Run the start script and access your admin panel at http://localhost:5173
