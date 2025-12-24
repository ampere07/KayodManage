const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDatabase } = require('./app/config/database');
const { sessionConfig } = require('./app/config/session');
const { setupSocketHandlers } = require('./app/socket/socketHandlers');
const { startAutoApprovalScheduler, stopAutoApprovalScheduler } = require('./app/utils/autoApproveTopups');

// Routes
const authRoutes = require('./app/routes/auth');
const dashboardRoutes = require('./app/routes/dashboard');
const userRoutes = require('./app/routes/users');
const jobRoutes = require('./app/routes/jobs');
const transactionRoutes = require('./app/routes/transactions');
const adminRoutes = require('./app/routes/admin');
const supportRoutes = require('./app/routes/support');
const debugRoutes = require('./app/routes/debug');

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8081',
  'http://localhost:3000',
  'http://localhost:19000',
  'http://localhost:19006',
  'http://10.0.2.2:8081',
  'exp://localhost:8081',
];

const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://192.168.')) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin?.startsWith('http://192.168.')) {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(sessionConfig);

// Connect to MongoDB
connectDatabase();

// Setup Socket.IO handlers
setupSocketHandlers(io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/debug', debugRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

const PORT = process.env.PORT || 5000;

const serverInstance = server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO server ready`);
  console.log(`🌐 Admin panel: http://localhost:5173`);
  
  // Start automatic top-up approval (runs every 5 minutes)
  startAutoApprovalScheduler(5);
});

const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down...');
  
  try {
    stopAutoApprovalScheduler();
    
    const { closeChatSupportChangeStream } = require('./app/socket/socketHandlers');
    closeChatSupportChangeStream();
    
    io.close(() => {});
    serverInstance.close(() => {});
    
    const { disconnectDatabase } = require('./app/config/database');
    await disconnectDatabase();
    
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Shutdown error:', error.message);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { io };
