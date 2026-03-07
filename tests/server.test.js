const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let app;
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  process.env.MONGO_URI = uri;
  process.env.NODE_ENV = 'test';
  
  app = require('../server');
  
  await mongoose.connection.once('open', () => {
    console.log('Test database connected');
  });
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

describe('Server Middleware and Routes', () => {
  describe('Health Check', () => {
    test('GET /healthz should return 200 with database ok', async () => {
      const response = await request(app).get('/healthz');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('app', 'ok');
      expect(response.body).toHaveProperty('db', 'ok');
    });
  });

  describe('Public routes removed (served by Next.js frontends)', () => {
    test('GET / should return 404 (served by Next.js frontend)', async () => {
      const response = await request(app).get('/');
      expect(response.status).toBe(404);
    });

    test('GET /about should return 404 (served by Next.js frontend)', async () => {
      const response = await request(app).get('/about');
      expect(response.status).toBe(404);
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app).get('/non-existent-route');
      expect(response.status).toBe(404);
      expect(response.body.error).toContain("doesn't exist");
    });
  });

  describe('Security Headers', () => {
    test('should set security headers', async () => {
      const response = await request(app).get('/');
      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });
});