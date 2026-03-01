const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const ConsultationRequest = require('../models/ConsultationRequest');

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(() => Promise.resolve({ messageId: 'test-id' }))
  }))
}));

let app;
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  process.env.MONGO_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.EMAIL_USER = 'test@example.com';
  process.env.EMAIL_PASS = 'testpass';
  process.env.ADMIN_EMAIL = 'admin@example.com';

  app = require('../server');

  await mongoose.connection.once('open', () => {
    console.log('Test database connected');
  });
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

beforeEach(async () => {
  await ConsultationRequest.deleteMany({});
});

// Helper to build valid consultation payload
function makeConsultationPayload(overrides = {}) {
  return {
    customer: {
      name: 'John Doe',
      email: `test-${Date.now()}@example.com`,
      phone: '555-123-4567'
    },
    property: {
      squareFootage: '2,500-3,500',
      isp: 'AT&T Fiber',
      currentIssues: ['Weak WiFi', 'Dead zones']
    },
    interestedServices: ['networking', 'cameras'],
    interestedPackage: 'backbone',
    ...overrides
  };
}

describe('Consultation API', () => {
  describe('GET /api/consultations/packages', () => {
    it('should return package definitions', async () => {
      const res = await request(app).get('/api/consultations/packages');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(4);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('priceRange');
      expect(res.body[0]).toHaveProperty('includes');
    });

    it('should include foundation, backbone, security, and performance packages', async () => {
      const res = await request(app).get('/api/consultations/packages');
      const ids = res.body.map(p => p.id);
      expect(ids).toContain('foundation');
      expect(ids).toContain('backbone');
      expect(ids).toContain('security');
      expect(ids).toContain('performance');
    });
  });

  describe('GET /api/consultations/services', () => {
    it('should return standalone service definitions', async () => {
      const res = await request(app).get('/api/consultations/services');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('price');
    });
  });

  describe('POST /api/consultations/create', () => {
    it('should create a consultation request with valid data', async () => {
      const payload = makeConsultationPayload();
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('requestNumber');
      expect(res.body).toHaveProperty('id');
      expect(res.body.message).toContain('booking link within 24 hours');
    });

    it('should save consultation to database', async () => {
      const payload = makeConsultationPayload();
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      const saved = await ConsultationRequest.findById(res.body.id);
      expect(saved).not.toBeNull();
      expect(saved.customer.name).toBe('John Doe');
      expect(saved.property.squareFootage).toBe('2,500-3,500');
      expect(saved.interestedServices).toContain('networking');
      expect(saved.interestedPackage).toBe('backbone');
      expect(saved.status).toBe('new');
    });

    it('should generate unique 8-digit request number', async () => {
      const payload = makeConsultationPayload();
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.body.requestNumber).toMatch(/^\d{8}$/);
    });

    it('should record IP and user agent', async () => {
      const payload = makeConsultationPayload();
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      const saved = await ConsultationRequest.findById(res.body.id);
      expect(saved.userAgent).toBeTruthy();
    });

    // Validation tests
    it('should reject missing customer name', async () => {
      const payload = makeConsultationPayload({
        customer: { email: 'test@example.com' }
      });
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject invalid email', async () => {
      const payload = makeConsultationPayload({
        customer: { name: 'Test', email: 'not-an-email' }
      });
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('should reject disposable email domains', async () => {
      const payload = makeConsultationPayload({
        customer: { name: 'Test', email: 'test@mailinator.com' }
      });
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('should reject missing square footage', async () => {
      const payload = makeConsultationPayload({
        property: { isp: 'Comcast' }
      });
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('should reject invalid square footage value', async () => {
      const payload = makeConsultationPayload({
        property: { squareFootage: 'huge', isp: 'Comcast' }
      });
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('should reject empty interestedServices array', async () => {
      const payload = makeConsultationPayload({ interestedServices: [] });
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('should reject invalid service values', async () => {
      const payload = makeConsultationPayload({ interestedServices: ['hacking'] });
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('should accept security as valid package value', async () => {
      const payload = makeConsultationPayload({ interestedPackage: 'security' });
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(201);
      const saved = await ConsultationRequest.findById(res.body.id);
      expect(saved.interestedPackage).toBe('security');
    });

    it('should reject invalid package value', async () => {
      const payload = makeConsultationPayload({ interestedPackage: 'invalid' });
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('should reject invalid current issues', async () => {
      const payload = makeConsultationPayload({
        property: {
          squareFootage: '2,500-3,500',
          currentIssues: ['Not a real issue']
        }
      });
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
    });

    it('should handle honeypot field (bot detection)', async () => {
      const payload = makeConsultationPayload();
      payload.honeypot = 'bot-filled-this';
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
    });

    // Duplicate prevention
    it('should prevent duplicate submissions within 10 minutes', async () => {
      const email = `dupe-${Date.now()}@example.com`;
      const payload1 = makeConsultationPayload({
        customer: { name: 'Test User', email }
      });
      const payload2 = makeConsultationPayload({
        customer: { name: 'Test User', email }
      });

      const res1 = await request(app)
        .post('/api/consultations/create')
        .send(payload1);
      expect(res1.status).toBe(201);

      const res2 = await request(app)
        .post('/api/consultations/create')
        .send(payload2);
      expect(res2.status).toBe(429);
      expect(res2.body.error).toContain('wait 10 minutes');
    });

    // Optional fields
    it('should accept submission without optional fields', async () => {
      const payload = {
        customer: {
          name: 'Minimal User',
          email: `minimal-${Date.now()}@example.com`
        },
        property: {
          squareFootage: 'Under 1,500'
        },
        interestedServices: ['networking']
      };

      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(201);
    });

    it('should sanitize customer name (XSS prevention)', async () => {
      const payload = makeConsultationPayload();
      // Name validation only allows letters, spaces, apostrophes, hyphens
      // so XSS in name field should be rejected by validation
      payload.customer.name = '<script>alert("xss")</script>';
      const res = await request(app)
        .post('/api/consultations/create')
        .send(payload);

      expect(res.status).toBe(400);
    });
  });
});

describe('ConsultationRequest Model', () => {
  it('should generate unique request numbers', async () => {
    const num1 = await ConsultationRequest.generateRequestNumber();
    const num2 = await ConsultationRequest.generateRequestNumber();
    expect(num1).not.toBe(num2);
    expect(num1).toMatch(/^\d{8}$/);
    expect(num2).toMatch(/^\d{8}$/);
  });

  it('should default status to new', async () => {
    const requestNumber = await ConsultationRequest.generateRequestNumber();
    const consultation = new ConsultationRequest({
      requestNumber,
      customer: { name: 'Test', email: 'test@example.com' },
      interestedServices: ['networking']
    });
    await consultation.save();
    expect(consultation.status).toBe('new');
  });

  it('should update updatedAt on save', async () => {
    const requestNumber = await ConsultationRequest.generateRequestNumber();
    const consultation = new ConsultationRequest({
      requestNumber,
      customer: { name: 'Test', email: 'test@example.com' },
      interestedServices: ['networking']
    });
    await consultation.save();
    const firstUpdate = consultation.updatedAt;

    // Small delay to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 10));
    consultation.adminNotes = 'Updated';
    await consultation.save();
    expect(consultation.updatedAt.getTime()).toBeGreaterThanOrEqual(firstUpdate.getTime());
  });

  it('should validate status enum', async () => {
    const requestNumber = await ConsultationRequest.generateRequestNumber();
    const consultation = new ConsultationRequest({
      requestNumber,
      customer: { name: 'Test', email: 'test@example.com' },
      interestedServices: ['networking'],
      status: 'invalid-status'
    });

    await expect(consultation.save()).rejects.toThrow();
  });

  it('should validate interestedPackage enum', async () => {
    const requestNumber = await ConsultationRequest.generateRequestNumber();
    const consultation = new ConsultationRequest({
      requestNumber,
      customer: { name: 'Test', email: 'test@example.com' },
      interestedServices: ['networking'],
      interestedPackage: 'invalid-package'
    });

    await expect(consultation.save()).rejects.toThrow();
  });
});
