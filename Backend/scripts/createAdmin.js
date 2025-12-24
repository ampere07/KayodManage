const mongoose = require('mongoose');
const Admin = require('../app/models/Admin');
require('dotenv').config();

const createDefaultAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kayod-admin');
    console.log('Connected to MongoDB');

    const existingAdmin = await Admin.findOne({ username: 'admin' });
    
    if (existingAdmin) {
      console.log('Default admin already exists');
      process.exit(0);
    }

    const admin = new Admin({
      username: process.env.ADMIN_USERNAME || 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      email: process.env.ADMIN_EMAIL || 'admin@kayod.com',
      name: 'System Administrator',
      role: 'superadmin'
    });

    await admin.save();
    console.log('✅ Default admin created successfully');
    console.log('Username:', admin.username);
    console.log('Admin ID:', admin._id);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
    process.exit(1);
  }
};

createDefaultAdmin();
