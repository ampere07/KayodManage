const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../app/models/User');
require('dotenv').config();

const createSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kayod-admin');
    console.log('Connected to MongoDB');

    const superAdminEmail = 'superadmin';
    
    const existingSuperAdmin = await User.findOne({ 
      email: superAdminEmail,
      userType: 'superadmin'
    });
    
    if (existingSuperAdmin) {
      console.log('✅ Super Admin user already exists');
      console.log('Email:', existingSuperAdmin.email);
      console.log('Name:', existingSuperAdmin.name);
      console.log('Super Admin ID:', existingSuperAdmin._id);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash('superadmin', 10);

    const superAdmin = new User({
      name: 'Super Melvin',
      email: superAdminEmail,
      password: hashedPassword,
      phone: '+1234567890',
      location: 'Admin Office',
      userType: 'superadmin',
      accountStatus: 'active',
      isVerified: true,
      categories: []
    });

    await superAdmin.save();
    console.log('✅ Super Admin user created successfully');
    console.log('Email:', superAdmin.email);
    console.log('Password: superadmin (hashed)');
    console.log('Super Admin ID:', superAdmin._id);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating super admin user:', error);
    process.exit(1);
  }
};

createSuperAdmin();
