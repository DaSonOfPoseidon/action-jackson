const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { body, param, query, validationResult } = require('express-validator');
const fileStorage = require('../services/fileStorage');
const Attachment = require('../models/Attachment');
const { checkFileAccess, checkUploadPermission, validateFileOperation, checkFileSizeLimits } = require('../middleware/fileAuth');
const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 5 // Max 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Basic file type validation
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
  }
});

// Rate limiting for file operations
const fileUploadLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Max 20 uploads per 15 minutes per IP
  message: {
    error: 'Too many file uploads. Please try again later.',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false
});

const fileDownloadLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Max 100 downloads per 5 minutes per IP
  message: {
    error: 'Too many download requests. Please try again later.',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware to extract user info (integrate with existing auth if available)
const extractUserInfo = (req, res, next) => {
  req.uploadedBy = {
    userId: req.session?.userId || null,
    userType: req.session?.userType || 'customer',
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent') || 'Unknown'
  };
  next();
};

// Upload files
router.post('/upload', 
  fileUploadLimit,
  extractUserInfo,
  upload.array('files', 5),
  validateFileOperation('upload'),
  checkFileSizeLimits,
  [
    body('modelType')
      .isIn(['Quote', 'Invoice', 'Schedule', 'Admin'])
      .withMessage('Invalid model type'),
    body('modelId')
      .isMongoId()
      .withMessage('Invalid model ID'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be boolean')
  ],
  checkUploadPermission,
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files uploaded'
        });
      }

      const { modelType, modelId } = req.body;
      const uploadResults = [];
      const uploadErrors = [];

      // Process each file
      for (const file of req.files) {
        try {
          const result = await fileStorage.uploadFile(
            file,
            modelType,
            modelId,
            req.uploadedBy
          );
          uploadResults.push(result.attachment);
        } catch (error) {
          uploadErrors.push({
            filename: file.originalname,
            error: error.message
          });
        }
      }

      // Return results
      if (uploadResults.length > 0) {
        res.status(201).json({
          success: true,
          message: `${uploadResults.length} file(s) uploaded successfully`,
          files: uploadResults.map(attachment => ({
            id: attachment._id,
            filename: attachment.originalName,
            contentType: attachment.contentType,
            size: attachment.size,
            url: attachment.url,
            uploadedAt: attachment.uploadedAt
          })),
          errors: uploadErrors.length > 0 ? uploadErrors : undefined
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'All file uploads failed',
          errors: uploadErrors
        });
      }

    } catch (error) {
      console.error('File upload route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during file upload',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Download file
router.get('/download/:fileId',
  fileDownloadLimit,
  validateFileOperation('download'),
  checkFileAccess(),
  [
    param('fileId')
      .isMongoId()
      .withMessage('Invalid file ID')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file ID',
          errors: errors.array()
        });
      }

      const { fileId } = req.params;
      
      // Get file info and stream
      const result = await fileStorage.downloadFile(fileId);
      
      // Set response headers
      Object.entries(result.headers).forEach(([key, value]) => {
        res.set(key, value);
      });

      // Pipe the file stream to response
      result.stream.pipe(res);

    } catch (error) {
      console.error('File download route error:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during file download',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get presigned download URL
router.get('/presigned/:fileId',
  fileDownloadLimit,
  validateFileOperation('presigned'),
  checkFileAccess(),
  [
    param('fileId')
      .isMongoId()
      .withMessage('Invalid file ID'),
    query('expiry')
      .optional()
      .isInt({ min: 60, max: 7200 })
      .withMessage('Expiry must be between 60 and 7200 seconds')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { fileId } = req.params;
      const expiry = parseInt(req.query.expiry) || 3600; // Default 1 hour

      const result = await fileStorage.getPresignedUrl(fileId, expiry);

      res.json({
        success: true,
        downloadUrl: result.url,
        expiry: result.expiry,
        file: result.attachment
      });

    } catch (error) {
      console.error('Presigned URL route error:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error generating download link',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Delete file
router.delete('/:fileId',
  validateFileOperation('delete'),
  checkFileAccess(),
  [
    param('fileId')
      .isMongoId()
      .withMessage('Invalid file ID'),
    query('permanent')
      .optional()
      .isBoolean()
      .withMessage('Permanent must be boolean')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { fileId } = req.params;
      const permanent = req.query.permanent === 'true';

      const result = await fileStorage.deleteFile(fileId, permanent);

      res.json({
        success: true,
        message: result.message
      });

    } catch (error) {
      console.error('File delete route error:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during file deletion',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get files for a model
router.get('/model/:modelType/:modelId',
  [
    param('modelType')
      .isIn(['Quote', 'Invoice', 'Schedule', 'Admin'])
      .withMessage('Invalid model type'),
    param('modelId')
      .isMongoId()
      .withMessage('Invalid model ID'),
    query('includeArchived')
      .optional()
      .isBoolean()
      .withMessage('includeArchived must be boolean'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { modelType, modelId } = req.params;
      const includeArchived = req.query.includeArchived === 'true';
      const limit = parseInt(req.query.limit) || 50;

      const files = await fileStorage.getModelFiles(modelType, modelId, {
        includeArchived,
        limit
      });

      res.json({
        success: true,
        files: files.map(file => ({
          id: file._id,
          filename: file.originalName,
          contentType: file.contentType,
          size: file.size,
          url: file.url,
          status: file.status,
          uploadedAt: file.uploadedAt,
          lastAccessedAt: file.lastAccessedAt
        }))
      });

    } catch (error) {
      console.error('Get model files route error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error retrieving files',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// Get storage statistics (admin only)
router.get('/stats', 
  require('../middleware/auth').adminPageAuth,
  async (req, res) => {
  try {
    
    const stats = await fileStorage.getStorageStats();
    
    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('Storage stats route error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error retrieving statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;