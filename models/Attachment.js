const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  // File metadata
  filename: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  originalName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 255
  },
  contentType: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  size: {
    type: Number,
    required: true,
    min: 0,
    max: 50 * 1024 * 1024 // 50MB limit
  },
  
  // MinIO storage information
  bucketName: {
    type: String,
    required: true,
    trim: true
  },
  objectKey: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  
  // Associated model information
  modelType: {
    type: String,
    required: true,
    enum: ['Quote', 'Invoice', 'Schedule', 'Admin'],
    trim: true
  },
  modelId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'modelType'
  },
  
  // File validation and security
  checksum: {
    type: String,
    trim: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  
  // Access control
  uploadedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId },
    userType: { 
      type: String, 
      enum: ['admin', 'customer'],
      default: 'customer'
    },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true, maxlength: 500 }
  },
  
  // Status and lifecycle
  status: {
    type: String,
    enum: ['uploading', 'active', 'archived', 'deleted'],
    default: 'uploading'
  },
  
  // Timestamps
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  },
  archivedAt: {
    type: Date
  },
  deletedAt: {
    type: Date
  }
});

// Indexes for efficient queries
AttachmentSchema.index({ modelType: 1, modelId: 1 });
AttachmentSchema.index({ objectKey: 1 }, { unique: true });
AttachmentSchema.index({ status: 1, uploadedAt: -1 });
AttachmentSchema.index({ 'uploadedBy.userId': 1, uploadedAt: -1 });

// Update lastAccessedAt when file is accessed
AttachmentSchema.methods.recordAccess = function() {
  this.lastAccessedAt = new Date();
  return this.save({ validateBeforeSave: false });
};

// Soft delete method
AttachmentSchema.methods.softDelete = function() {
  this.status = 'deleted';
  this.deletedAt = new Date();
  return this.save();
};

// Archive method
AttachmentSchema.methods.archive = function() {
  this.status = 'archived';
  this.archivedAt = new Date();
  return this.save();
};

// Static method to find files by model
AttachmentSchema.statics.findByModel = function(modelType, modelId, options = {}) {
  const query = { 
    modelType, 
    modelId, 
    status: { $in: options.includeArchived ? ['active', 'archived'] : ['active'] }
  };
  
  return this.find(query)
    .sort({ uploadedAt: -1 })
    .limit(options.limit || 50);
};

// Static method to get file stats
AttachmentSchema.statics.getStats = function() {
  return this.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$modelType',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' }
      }
    }
  ]);
};

// Pre-save validation
AttachmentSchema.pre('save', function(next) {
  // Ensure URL is set if not provided
  if (!this.url && this.bucketName && this.objectKey) {
    const storageConfig = require('../config/storage');
    this.url = storageConfig.getPublicUrl(this.bucketName, this.objectKey);
  }
  
  next();
});

module.exports = mongoose.model('Attachment', AttachmentSchema);