const Attachment = require('../models/Attachment');
const mongoose = require('mongoose');

// Middleware to check if user can access a file
const checkFileAccess = (options = {}) => {
  return async (req, res, next) => {
    try {
      const { fileId } = req.params;
      
      // Validate fileId is a valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(fileId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file ID'
        });
      }

      // Find the attachment
      const attachment = await Attachment.findById(fileId);
      if (!attachment) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      // Check if file is deleted (unless requesting permanent deletion)
      if (attachment.status === 'deleted' && req.method !== 'DELETE') {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      // Admin users have full access
      if (req.session?.userType === 'admin' || req.session?.isAdmin) {
        req.attachment = attachment;
        return next();
      }

      // Public files can be accessed by anyone
      if (attachment.isPublic) {
        req.attachment = attachment;
        return next();
      }

      // For non-public files, check ownership
      const userId = req.session?.userId;
      
      // If no user session, deny access
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to access this file'
        });
      }

      // Check if user uploaded the file
      if (attachment.uploadedBy?.userId?.toString() === userId.toString()) {
        req.attachment = attachment;
        return next();
      }

      // Additional access checks based on model ownership
      // This would require checking if the user owns the Quote, Invoice, or Schedule
      // For now, we'll deny access if none of the above conditions are met
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to access this file'
      });

    } catch (error) {
      console.error('File access check error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during file access check'
      });
    }
  };
};

// Middleware to check if user can upload files to a model
const checkUploadPermission = (req, res, next) => {
  try {
    // Skip validation here - let express-validator handle it
    // This middleware now just handles authorization after validation passes
    
    // Admin users can upload to any model
    if (req.session?.userType === 'admin' || req.session?.isAdmin) {
      return next();
    }

    // For customer users, they can upload to their own records
    // This would require additional validation to check model ownership
    // For now, we'll allow uploads but the model validation should be done in the route

    next();

  } catch (error) {
    console.error('Upload permission check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during upload permission check'
    });
  }
};

// Middleware to validate file operation permissions
const validateFileOperation = (operation) => {
  return (req, res, next) => {
    try {
      // Check if MinIO is properly configured
      if (!process.env.MINIO_ENDPOINT || !process.env.MINIO_ACCESS_KEY || !process.env.MINIO_SECRET_KEY) {
        return res.status(503).json({
          success: false,
          message: 'File storage service is not properly configured'
        });
      }

      // Log file operations for audit trail
      const logData = {
        operation: operation,
        userId: req.session?.userId || 'anonymous',
        userType: req.session?.userType || 'customer',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        fileId: req.params?.fileId,
        modelType: req.body?.modelType,
        modelId: req.body?.modelId
      };

      console.log('File operation audit log:', logData);

      next();

    } catch (error) {
      console.error('File operation validation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during operation validation'
      });
    }
  };
};

// Middleware to check file size limits based on user type
const checkFileSizeLimits = (req, res, next) => {
  try {
    const isAdmin = req.session?.userType === 'admin' || req.session?.isAdmin;
    
    // Admin users get higher limits
    const maxFileSize = isAdmin ? 100 * 1024 * 1024 : 50 * 1024 * 1024; // 100MB for admin, 50MB for users
    const maxFiles = isAdmin ? 10 : 5; // 10 files for admin, 5 for users

    // Check if files exceed limits
    if (req.files && req.files.length > 0) {
      // Check number of files
      if (req.files.length > maxFiles) {
        return res.status(400).json({
          success: false,
          message: `Maximum ${maxFiles} files allowed per upload`
        });
      }

      // Check individual file sizes
      for (const file of req.files) {
        if (file.size > maxFileSize) {
          return res.status(400).json({
            success: false,
            message: `File "${file.originalname}" exceeds maximum size of ${maxFileSize / 1024 / 1024}MB`
          });
        }
      }
    }

    next();

  } catch (error) {
    console.error('File size limit check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during file size validation'
    });
  }
};

module.exports = {
  checkFileAccess,
  checkUploadPermission,
  validateFileOperation,
  checkFileSizeLimits
};