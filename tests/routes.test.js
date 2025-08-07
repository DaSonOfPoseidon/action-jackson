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
    describe('GET /calculate', () => {
      test('should calculate Basic package pricing correctly', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            packageOption: 'Basic',
            'runs[coax]': 2,
            'runs[cat6]': 3,
            'services[deviceMount]': 1,
            'services[networkSetup]': 1,
            'services[mediaPanel]': 0,
            includeSurvey: false
          });

        expect(response.status).toBe(200);
        expect(response.body.packageOption).toBe('Basic');
        expect(response.body.pricing).toHaveProperty('totalCost');
        expect(response.body.pricing).toHaveProperty('depositRequired');
        
        // 5 runs * $100 per run = $500, + $30 services = $530
        expect(response.body.pricing.totalCost).toBe(530);
        expect(response.body.pricing.depositRequired).toBe(20); // Over $100 threshold
      });

      test('should calculate Premium package pricing correctly', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            packageOption: 'Premium',
            'runs[coax]': 2,
            'runs[cat6]': 2,
            'services[deviceMount]': 2,
            'services[networkSetup]': 1,
            'services[mediaPanel]': 1,
            includeSurvey: false
          });

        expect(response.status).toBe(200);
        expect(response.body.packageOption).toBe('Premium');
        expect(response.body.pricing).toHaveProperty('estimatedLaborHours');
        expect(response.body.pricing).toHaveProperty('estimatedTotal');
        
        // Base 3hrs + Install 2hrs + (4 runs * 0.5) = 7 hours
        expect(response.body.pricing.estimatedLaborHours).toBe(7);
        // 7hrs * $50 + $90 services = $440
        expect(response.body.pricing.estimatedTotal).toBe(440);
      });

      test('should include survey fee when survey is selected', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            packageOption: 'Basic',
            'runs[coax]': 1,
            'runs[cat6]': 1,
            includeSurvey: true
          });

        expect(response.status).toBe(200);
        expect(response.body.pricing.surveyFee).toBe(100);
        expect(response.body.pricing.depositRequired).toBe(0); // Survey waives deposit
      });

      test('should handle discount calculation', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            packageOption: 'Basic',
            'runs[coax]': 1,
            'runs[cat6]': 1,
            discount: 10
          });

        expect(response.status).toBe(200);
        // 2 runs * $100 = $200, with 10% discount = $180
        expect(response.body.pricing.totalCost).toBe(180);
      });

      test('should validate package option', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            packageOption: 'Invalid'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid package option.');
      });

      test('should handle missing package option', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({});

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid package option.');
      });
    });

    describe('POST /create', () => {
      test('should create Basic package quote with pricing', async () => {
        const quoteData = {
          customer: {
            name: 'John Doe',
            email: 'john@example.com'
          },
          packageOption: 'Basic',
          includeSurvey: false,
          discount: 0,
          runs: {
            coax: 2,
            cat6: 1
          },
          services: {
            deviceMount: 1,
            networkSetup: 1,
            mediaPanel: 0
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
        expect(savedQuote.packageOption).toBe('Basic');
        expect(savedQuote.includeSurvey).toBe(false);
        expect(savedQuote.pricing.totalCost).toBe(330); // 3 runs * $100 + $30 services
        expect(savedQuote.pricing.depositRequired).toBe(20);
        expect(savedQuote.pricing.surveyFee).toBe(0);
      });

      test('should create Premium package quote with hours estimation', async () => {
        const quoteData = {
          customer: {
            name: 'Jane Smith',
            email: 'jane@example.com'
          },
          packageOption: 'Premium',
          includeSurvey: true,
          discount: 0,
          runs: {
            coax: 1,
            cat6: 2
          },
          services: {
            deviceMount: 2,
            networkSetup: 0,
            mediaPanel: 1
          }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response.status).toBe(201);
        
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.packageOption).toBe('Premium');
        expect(savedQuote.includeSurvey).toBe(true);
        expect(savedQuote.pricing.estimatedLaborHours).toBe(6.5); // 3 + 2 + (3*0.5)
        expect(savedQuote.pricing.laborRate).toBe(50);
        expect(savedQuote.pricing.estimatedTotal).toBe(395); // 6.5hrs * $50 + $70 services
        expect(savedQuote.pricing.surveyFee).toBe(100);
      });

      test('should handle survey with Basic package (no deposit)', async () => {
        const quoteData = {
          customer: {
            name: 'Survey User',
            email: 'survey@example.com'
          },
          packageOption: 'Basic',
          includeSurvey: true,
          discount: 0,
          runs: { coax: 3, cat6: 2 },
          services: { deviceMount: 0, networkSetup: 0, mediaPanel: 0 }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response.status).toBe(201);
        
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.pricing.totalCost).toBe(500); // 5 runs * $100
        expect(savedQuote.pricing.depositRequired).toBe(0); // Survey waives deposit
        expect(savedQuote.pricing.surveyFee).toBe(100);
      });

      test('should validate package option enum', async () => {
        const quoteData = {
          customer: {
            name: 'Test User',
            email: 'test@example.com'
          },
          packageOption: 'InvalidPackage',
          includeSurvey: false,
          runs: { coax: 1, cat6: 1 },
          services: { deviceMount: 0, networkSetup: 0, mediaPanel: 0 }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid package option.');
      });

      test('should validate required customer fields', async () => {
        const incompleteData = {
          customer: {
            name: 'John Doe'
            // Missing email
          },
          packageOption: 'Basic'
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(incompleteData);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Missing customer name, email or package');
      });

      test('should handle zero quantities gracefully', async () => {
        const quoteData = {
          customer: {
            name: 'Zero User',
            email: 'zero@example.com'
          },
          packageOption: 'Basic',
          includeSurvey: false,
          runs: { coax: 0, cat6: 0 },
          services: { deviceMount: 0, networkSetup: 0, mediaPanel: 0 }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response.status).toBe(201);
        
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.pricing.totalCost).toBe(0);
        expect(savedQuote.pricing.depositRequired).toBe(0); // Under threshold
      });

      test('should capture client IP correctly', async () => {
        const quoteData = {
          customer: {
            name: 'IP Test',
            email: 'ip@example.com'
          },
          packageOption: 'Premium',
          includeSurvey: false,
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

      test('should handle database errors gracefully', async () => {
        await mongoose.connection.close();
        
        const response = await request(app)
          .post('/api/quotes/create')
          .send({
            customer: { name: 'Test', email: 'test@example.com' },
            packageOption: 'Basic',
            includeSurvey: false
          });
        
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Error generating quote');
        
        await mongoose.connect(mongoServer.getUri());
      });

      test('should apply discount correctly', async () => {
        const quoteData = {
          customer: {
            name: 'Discount User',
            email: 'discount@example.com'
          },
          packageOption: 'Basic',
          includeSurvey: false,
          discount: 20,
          runs: { coax: 2, cat6: 2 },
          services: { deviceMount: 0, networkSetup: 0, mediaPanel: 0 }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response.status).toBe(201);
        
        const savedQuote = await Quote.findById(response.body.id);
        // 4 runs * $100 = $400, with 20% discount = $320
        expect(savedQuote.pricing.totalCost).toBe(320);
      });
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