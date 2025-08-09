#!/usr/bin/env node

/**
 * Admin Account Creation Script
 * 
 * This script creates a secure admin account for the Action Jackson system.
 * Usage: node scripts/createAdmin.js [username] [password] [role]
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Admin = require('../models/Admin');

// Password validation function
function validatePassword(password) {
  const minLength = 12;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }
  
  if (!hasSpecialChars) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Generate secure random password
function generateSecurePassword() {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const allChars = uppercase + lowercase + numbers + special;
  
  let password = '';
  
  // Ensure at least one character from each category
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // Fill the rest with random characters
  for (let i = 4; i < 16; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Main function
async function createAdmin() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    let username = args[0] || process.env.ADMIN_DEFAULT_USERNAME || 'admin';
    let password = args[1] || process.env.ADMIN_DEFAULT_PASSWORD;
    let role = args[2] || 'admin';
    
    // Validate role
    if (!['admin', 'superadmin'].includes(role)) {
      console.error('❌ Error: Role must be either "admin" or "superadmin"');
      process.exit(1);
    }
    
    // Generate password if not provided
    if (!password) {
      password = generateSecurePassword();
      console.log('🔐 Generated secure password for admin account');
    }
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      console.error('❌ Password validation failed:');
      passwordValidation.errors.forEach(error => {
        console.error(`   - ${error}`);
      });
      process.exit(1);
    }
    
    console.log('🔗 Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: username.toLowerCase() });
    if (existingAdmin) {
      console.error(`❌ Error: Admin user '${username}' already exists`);
      console.log('💡 Use a different username or delete the existing admin first');
      await mongoose.connection.close();
      process.exit(1);
    }
    
    // Create admin account
    console.log('👤 Creating admin account...');
    const admin = await Admin.createAdmin({
      username: username,
      password: password,
      role: role,
      createdBy: 'script',
      createdIP: 'localhost'
    });
    
    console.log('✅ Admin account created successfully!');
    console.log('');
    console.log('📝 Account Details:');
    console.log(`   Username: ${admin.username}`);
    console.log(`   Password: ${password}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Created: ${admin.createdAt}`);
    console.log('');
    console.log('🔒 Security Notes:');
    console.log('   - Password is displayed only once - save it securely');
    console.log('   - Change the default password after first login');
    console.log('   - Use a password manager to store credentials');
    console.log('   - Enable 2FA if available in future versions');
    console.log('');
    console.log('🌐 Access your admin panel at: http://localhost:3000/admin/login');
    
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    
  } catch (error) {
    console.error('❌ Error creating admin account:', error.message);
    
    if (error.code === 11000) {
      console.error('💡 This usually means an admin with this username already exists');
    }
    
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Help function
function showHelp() {
  console.log('');
  console.log('🛠️  Action Jackson Admin Account Creation Script');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/createAdmin.js [username] [password] [role]');
  console.log('');
  console.log('Arguments:');
  console.log('  username  Admin username (default: "admin" or ADMIN_DEFAULT_USERNAME)');
  console.log('  password  Admin password (auto-generated if not provided)');
  console.log('  role      Admin role: "admin" or "superadmin" (default: "admin")');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/createAdmin.js');
  console.log('  node scripts/createAdmin.js myAdmin MySecurePassword123!');
  console.log('  node scripts/createAdmin.js superuser MySecurePassword123! superadmin');
  console.log('');
  console.log('Password Requirements:');
  console.log('  - At least 12 characters long');
  console.log('  - Contains uppercase and lowercase letters');
  console.log('  - Contains at least one number');
  console.log('  - Contains at least one special character');
  console.log('');
}

// Check for help flag
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Check MongoDB URI
if (!process.env.MONGO_URI) {
  console.error('❌ Error: MONGO_URI environment variable is required');
  console.log('💡 Make sure you have a .env file with MONGO_URI configured');
  process.exit(1);
}

// Run the script
console.log('🚀 Starting admin account creation...');
createAdmin();