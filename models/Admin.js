const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const adminSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50,
    match: [/^[a-zA-Z0-9_-]+$/, 'Username can only contain alphanumeric characters, underscores, and hyphens']
  },
  passwordHash: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'superadmin'],
    default: 'admin'
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  // Security audit fields
  createdBy: {
    type: String,
    default: 'system'
  },
  createdIP: {
    type: String,
    default: null
  },
  lastLoginIP: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Adds createdAt and updatedAt
});

// Security constants
adminSchema.statics.MAX_LOGIN_ATTEMPTS = 5;
adminSchema.statics.LOCK_TIME = 30 * 60 * 1000; // 30 minutes

// Virtual for checking if account is locked
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
adminSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('passwordHash')) return next();
  
  try {
    // Hash password with salt rounds of 12
    const saltRounds = 12;
    this.passwordHash = await bcrypt.hash(this.passwordHash, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to verify password
adminSchema.methods.verifyPassword = async function(candidatePassword) {
  if (!candidatePassword || !this.passwordHash) {
    return false;
  }
  
  try {
    return await bcrypt.compare(candidatePassword, this.passwordHash);
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
};

// Instance method to handle failed login attempts
adminSchema.methods.incLoginAttempts = async function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after MAX_LOGIN_ATTEMPTS
  if (this.loginAttempts + 1 >= this.constructor.MAX_LOGIN_ATTEMPTS && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + this.constructor.LOCK_TIME };
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts after successful login
adminSchema.methods.resetLoginAttempts = async function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  });
};

// Static method to create admin with hashed password
adminSchema.statics.createAdmin = async function(userData) {
  try {
    // Password will be hashed by pre-save middleware
    const admin = new this({
      username: userData.username,
      passwordHash: userData.password, // This will be hashed by pre-save
      role: userData.role || 'admin',
      createdBy: userData.createdBy || 'system',
      createdIP: userData.createdIP || null
    });
    
    return await admin.save();
  } catch (error) {
    throw error;
  }
};

// Static method for secure login
adminSchema.statics.authenticate = async function(username, password, ipAddress) {
  try {
    const admin = await this.findOne({ 
      username: username.toLowerCase().trim(),
      isActive: true 
    });
    
    if (!admin) {
      // Return consistent response to prevent username enumeration
      return { success: false, reason: 'invalid_credentials' };
    }
    
    // Check if account is locked
    if (admin.isLocked) {
      return { 
        success: false, 
        reason: 'account_locked',
        lockUntil: admin.lockUntil
      };
    }
    
    // Verify password
    const isValidPassword = await admin.verifyPassword(password);
    
    if (!isValidPassword) {
      // Increment login attempts
      await admin.incLoginAttempts();
      return { success: false, reason: 'invalid_credentials' };
    }
    
    // Successful login - reset attempts and update last login info
    await admin.resetLoginAttempts();
    await admin.updateOne({ 
      lastLoginIP: ipAddress,
      lastLogin: new Date()
    });
    
    return { 
      success: true, 
      user: {
        id: admin._id,
        username: admin.username,
        role: admin.role,
        lastLogin: admin.lastLogin
      }
    };
    
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, reason: 'system_error' };
  }
};

// Index for performance
adminSchema.index({ username: 1, isActive: 1 });
adminSchema.index({ lockUntil: 1 });

module.exports = mongoose.model('Admin', adminSchema);