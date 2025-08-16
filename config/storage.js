const Minio = require('minio');

class StorageConfig {
  constructor() {
    this.minioClient = null;
    this.bucketName = process.env.MINIO_BUCKET_NAME || 'actionjackson-files';
    
    // Environment-specific bucket names
    this.bucketNames = {
      development: `${this.bucketName}-dev`,
      production: `${this.bucketName}-prod`,
      test: `${this.bucketName}-test`
    };
  }

  getClient() {
    if (!this.minioClient) {
      const endpoint = process.env.MINIO_ENDPOINT;
      const port = parseInt(process.env.MINIO_PORT) || 9000;
      const useSSL = process.env.MINIO_USE_SSL === 'true';
      const accessKey = process.env.MINIO_ACCESS_KEY;
      const secretKey = process.env.MINIO_SECRET_KEY;

      if (!endpoint || !accessKey || !secretKey) {
        throw new Error('MinIO configuration incomplete. Check environment variables: MINIO_ENDPOINT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY');
      }

      this.minioClient = new Minio.Client({
        endPoint: endpoint,
        port: port,
        useSSL: useSSL,
        accessKey: accessKey,
        secretKey: secretKey
      });
    }

    return this.minioClient;
  }

  getBucketName(environment = null) {
    const env = environment || process.env.NODE_ENV || 'development';
    return this.bucketNames[env] || this.bucketNames.development;
  }

  async ensureBucketExists(bucketName = null) {
    const client = this.getClient();
    const bucket = bucketName || this.getBucketName();
    
    try {
      const exists = await client.bucketExists(bucket);
      if (!exists) {
        await client.makeBucket(bucket);
        console.log(`MinIO bucket '${bucket}' created successfully`);
      }
      return bucket;
    } catch (error) {
      console.error(`Error ensuring bucket '${bucket}' exists:`, error.message);
      throw error;
    }
  }

  generateObjectKey(modelType, filename) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now();
    const extension = filename.split('.').pop();
    const nameWithoutExt = filename.replace(`.${extension}`, '');
    
    return `${modelType}/${year}/${month}/${day}/${timestamp}-${nameWithoutExt}.${extension}`;
  }

  getPublicUrl(bucketName, objectKey) {
    const client = this.getClient();
    const protocol = process.env.MINIO_USE_SSL === 'true' ? 'https' : 'http';
    const port = process.env.MINIO_PORT && process.env.MINIO_PORT !== '80' && process.env.MINIO_PORT !== '443' 
      ? `:${process.env.MINIO_PORT}` 
      : '';
    
    return `${protocol}://${process.env.MINIO_ENDPOINT}${port}/${bucketName}/${objectKey}`;
  }
}

module.exports = new StorageConfig();