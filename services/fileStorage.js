const storageConfig = require('../config/storage');
const Attachment = require('../models/Attachment');
const crypto = require('crypto');
const path = require('path');

class FileStorageService {
  constructor() {
    this.client = null;
  }

  getClient() {
    if (!this.client) {
      this.client = storageConfig.getClient();
    }
    return this.client;
  }

  // Validate file before upload
  validateFile(file, options = {}) {
    const maxSize = options.maxSize || 50 * 1024 * 1024; // 50MB default
    const allowedTypes = options.allowedTypes || [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    const errors = [];

    if (file.size > maxSize) {
      errors.push(`File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`);
    }

    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} not allowed`);
    }

    // Basic security checks
    const dangerousExts = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js'];
    const extension = path.extname(file.originalname).toLowerCase();
    if (dangerousExts.includes(extension)) {
      errors.push('File type not allowed for security reasons');
    }

    return errors;
  }

  // Generate checksum for file integrity
  generateChecksum(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // Upload file to MinIO
  async uploadFile(file, modelType, modelId, uploadedBy = {}) {
    try {
      // Validate file
      const validationErrors = this.validateFile(file);
      if (validationErrors.length > 0) {
        throw new Error(`File validation failed: ${validationErrors.join(', ')}`);
      }

      // Ensure bucket exists
      const bucketName = await storageConfig.ensureBucketExists();
      
      // Generate unique object key
      const objectKey = storageConfig.generateObjectKey(modelType, file.originalname);
      
      // Generate checksum
      const checksum = this.generateChecksum(file.buffer);
      
      // Upload to MinIO
      const client = this.getClient();
      const uploadResult = await client.putObject(
        bucketName,
        objectKey,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
          'X-Amz-Meta-Original-Name': file.originalname,
          'X-Amz-Meta-Uploaded-By': uploadedBy.userType || 'customer',
          'X-Amz-Meta-Checksum': checksum
        }
      );

      // Generate public URL
      const url = storageConfig.getPublicUrl(bucketName, objectKey);

      // Save attachment metadata to MongoDB
      const attachment = new Attachment({
        filename: file.originalname,
        originalName: file.originalname,
        contentType: file.mimetype,
        size: file.size,
        bucketName: bucketName,
        objectKey: objectKey,
        url: url,
        modelType: modelType,
        modelId: modelId,
        checksum: checksum,
        uploadedBy: uploadedBy,
        status: 'active'
      });

      await attachment.save();

      return {
        success: true,
        attachment: attachment,
        etag: uploadResult.etag
      };

    } catch (error) {
      console.error('File upload error:', error);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  // Download file from MinIO
  async downloadFile(attachmentId) {
    try {
      const attachment = await Attachment.findById(attachmentId);
      if (!attachment || attachment.status !== 'active') {
        throw new Error('File not found or no longer available');
      }

      const client = this.getClient();
      const stream = await client.getObject(attachment.bucketName, attachment.objectKey);
      
      // Update last accessed time
      await attachment.recordAccess();

      return {
        stream: stream,
        attachment: attachment,
        headers: {
          'Content-Type': attachment.contentType,
          'Content-Length': attachment.size,
          'Content-Disposition': `attachment; filename="${attachment.originalName}"`,
          'Cache-Control': 'private, max-age=3600'
        }
      };

    } catch (error) {
      console.error('File download error:', error);
      throw new Error(`File download failed: ${error.message}`);
    }
  }

  // Delete file from both MinIO and MongoDB
  async deleteFile(attachmentId, permanent = false) {
    try {
      const attachment = await Attachment.findById(attachmentId);
      if (!attachment) {
        throw new Error('File not found');
      }

      if (permanent || attachment.status === 'deleted') {
        // Permanently delete from MinIO
        const client = this.getClient();
        await client.removeObject(attachment.bucketName, attachment.objectKey);
        
        // Delete from MongoDB
        await Attachment.findByIdAndDelete(attachmentId);
        
        return { success: true, message: 'File permanently deleted' };
      } else {
        // Soft delete
        await attachment.softDelete();
        return { success: true, message: 'File moved to trash' };
      }

    } catch (error) {
      console.error('File delete error:', error);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }

  // Get files for a specific model
  async getModelFiles(modelType, modelId, options = {}) {
    try {
      const attachments = await Attachment.findByModel(modelType, modelId, options);
      return attachments;
    } catch (error) {
      console.error('Get model files error:', error);
      throw new Error(`Failed to retrieve files: ${error.message}`);
    }
  }

  // Get file statistics
  async getStorageStats() {
    try {
      const stats = await Attachment.getStats();
      return stats;
    } catch (error) {
      console.error('Get storage stats error:', error);
      throw new Error(`Failed to get storage statistics: ${error.message}`);
    }
  }

  // Generate presigned URL for temporary access
  async getPresignedUrl(attachmentId, expiry = 3600) {
    try {
      const attachment = await Attachment.findById(attachmentId);
      if (!attachment || attachment.status !== 'active') {
        throw new Error('File not found or no longer available');
      }

      const client = this.getClient();
      const presignedUrl = await client.presignedGetObject(
        attachment.bucketName,
        attachment.objectKey,
        expiry
      );

      // Update last accessed time
      await attachment.recordAccess();

      return {
        url: presignedUrl,
        expiry: new Date(Date.now() + expiry * 1000),
        attachment: {
          id: attachment._id,
          filename: attachment.originalName,
          contentType: attachment.contentType,
          size: attachment.size
        }
      };

    } catch (error) {
      console.error('Presigned URL error:', error);
      throw new Error(`Failed to generate download link: ${error.message}`);
    }
  }

  // Cleanup old deleted files
  async cleanupDeletedFiles(daysOld = 30) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      
      const deletedFiles = await Attachment.find({
        status: 'deleted',
        deletedAt: { $lt: cutoffDate }
      });

      const client = this.getClient();
      let cleanedCount = 0;

      for (const file of deletedFiles) {
        try {
          // Delete from MinIO
          await client.removeObject(file.bucketName, file.objectKey);
          
          // Delete from MongoDB
          await Attachment.findByIdAndDelete(file._id);
          
          cleanedCount++;
        } catch (error) {
          console.error(`Failed to cleanup file ${file._id}:`, error.message);
        }
      }

      return {
        success: true,
        cleanedCount: cleanedCount,
        totalFound: deletedFiles.length
      };

    } catch (error) {
      console.error('Cleanup error:', error);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }
}

module.exports = new FileStorageService();