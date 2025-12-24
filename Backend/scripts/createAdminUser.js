const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../app/models/User');
require('dotenv').config();

const createAdminUser = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kayod-admin');
    console.log('Connected to MongoDB');

    const adminEmail = 'admin';
    
    const existingAdmin = await User.findOne({ 
      email: adminEmail,
      userType: 'admin'
    });
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      console.log('Email:', existingAdmin.email);
      console.log('Name:', existingAdmin.name);
      console.log('Admin ID:', existingAdmin._id);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash('admin', 10);

    const admin = new User({
      name: 'System Administrator',
      email: adminEmail,
      password: hashedPassword,
      phone: '+1234567890',
      location: 'Admin Office',
      userType: 'admin',
      accountStatus: 'active',
      isVerified: true,
      categories: []
    });

    await admin.save();
    console.log('✅ Admin user created successfully');
    console.log('Email:', admin.email);
    console.log('Password: admin (hashed)');
    console.log('Admin ID:', admin._id);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();
