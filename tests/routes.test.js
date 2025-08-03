const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Service = require('../models/Service');
const Testimonial = require('../models/Testimonial');
const Quote = require('../models/Quote');
const Schedule = require('../models/Schedule');

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
  await Service.deleteMany({});
  await Testimonial.deleteMany({});
  await Quote.deleteMany({});
  await Schedule.deleteMany({});
});

describe('API Routes', () => {
  describe('Home Routes - /api/home', () => {
    test('GET / should return services and testimonials', async () => {
      await Service.create({
        name: 'Test Service',
        description: 'Test Description',
        price: 100
      });
      
      await Testimonial.create({
        name: 'John Doe',
        message: 'Great service!',
        rating: 5
      });

      const response = await request(app).get('/api/home');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('testimonials');
      expect(response.body.services).toHaveLength(1);
      expect(response.body.testimonials).toHaveLength(1);
    });

    test('GET / should handle database errors gracefully', async () => {
      await mongoose.connection.close();
      
      const response = await request(app).get('/api/home');
      expect(response.status).toBe(500);
      
      await mongoose.connect(mongoServer.getUri());
    });
  });

  describe('Scheduling Routes - /api/scheduling', () => {
    test('GET /slots should return available slots', async () => {
      await Schedule.create({
        name: 'John Doe',
        email: 'john@example.com',
        date: new Date('2024-12-25'),
        time: '10:00'
      });

      const response = await request(app).get('/api/scheduling/slots');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
    });

    test('POST /book should create new appointment', async () => {
      const appointmentData = {
        name: 'Jane Smith',
        email: 'jane@example.com',
        date: new Date('2024-12-26'),
        time: '14:00'
      };

      const response = await request(app)
        .post('/api/scheduling/book')
        .send(appointmentData);
      
      expect(response.status).toBe(201);
      expect(response.text).toBe('Appointment scheduled successfully');
      
      const savedAppointment = await Schedule.findOne({ email: 'jane@example.com' });
      expect(savedAppointment).toBeTruthy();
      expect(savedAppointment.name).toBe('Jane Smith');
    });

    test('POST /book should handle database errors', async () => {
      await mongoose.connection.close();
      
      const response = await request(app)
        .post('/api/scheduling/book')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          date: new Date('2024-12-27'),
          time: '15:00'
        });
      
      expect(response.status).toBe(500);
      
      await mongoose.connect(mongoServer.getUri());
    });
  });

  describe('Quotes Routes - /api/quotes', () => {
    test('POST /create should create a new quote with valid data', async () => {
      const quoteData = {
        customer: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        packageOption: 'basic',
        discount: 10,
        runs: {
          coax: 5,
          cat6: 3
        },
        services: {
          deviceMount: 2,
          networkSetup: 1,
          mediaPanel: 1
        }
      };

      const response = await request(app)
        .post('/api/quotes/create')
        .send(quoteData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      
      const savedQuote = await Quote.findById(response.body.id);
      expect(savedQuote).toBeTruthy();
      expect(savedQuote.customer.name).toBe('John Doe');
      expect(savedQuote.packageOption).toBe('basic');
    });

    test('POST /create should validate required fields', async () => {
      const incompleteData = {
        customer: {
          name: 'John Doe'
        },
        packageOption: 'basic'
      };

      const response = await request(app)
        .post('/api/quotes/create')
        .send(incompleteData);
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Missing customer name, email or package');
    });

    test('POST /create should handle missing customer data', async () => {
      const response = await request(app)
        .post('/api/quotes/create')
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Missing customer name, email or package');
    });

    test('POST /create should capture client IP', async () => {
      const quoteData = {
        customer: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        packageOption: 'premium',
        discount: 0,
        runs: { coax: 1, cat6: 1 },
        services: { deviceMount: 1, networkSetup: 1, mediaPanel: 1 }
      };

      const response = await request(app)
        .post('/api/quotes/create')
        .set('X-Forwarded-For', '192.168.1.100')
        .send(quoteData);
      
      expect(response.status).toBe(201);
      
      const savedQuote = await Quote.findById(response.body.id);
      expect(savedQuote.ip).toBe('192.168.1.100');
    });

    test('POST /create should handle database errors', async () => {
      await mongoose.connection.close();
      
      const response = await request(app)
        .post('/api/quotes/create')
        .send({
          customer: { name: 'Test', email: 'test@example.com' },
          packageOption: 'basic'
        });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Error generating quote');
      
      await mongoose.connect(mongoServer.getUri());
    });
  });

  describe('Shared Routes - /api/shared', () => {
    test('GET /services should return all services', async () => {
      await Service.create([
        { name: 'Service 1', description: 'Description 1', price: 100 },
        { name: 'Service 2', description: 'Description 2', price: 200 }
      ]);

      const response = await request(app).get('/api/shared/services');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });

    test('GET /services should handle database errors', async () => {
      await mongoose.connection.close();
      
      const response = await request(app).get('/api/shared/services');
      expect(response.status).toBe(500);
      
      await mongoose.connect(mongoServer.getUri());
    });
  });
});