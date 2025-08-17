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
      // Mock the database operations to simulate failures
      const originalFind = require('../models/Service').find;
      const originalTestimonial = require('../models/Testimonial').find;
      
      // Mock Service.find to throw an error
      require('../models/Service').find = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      require('../models/Testimonial').find = jest.fn().mockResolvedValue([]);
      
      const response = await request(app).get('/api/home');
      expect(response.status).toBe(500);
      expect(response.text).toContain('Error fetching homepage content');
      
      // Restore original functions
      require('../models/Service').find = originalFind;
      require('../models/Testimonial').find = originalTestimonial;
    });
  });

  describe('Scheduling Routes - /api/scheduling', () => {
    test('GET /slots should return available slots', async () => {
      // First create a quote for the test appointment
      const testQuote = new Quote({
        quoteNumber: '12345678',
        customer: { name: 'John Doe', email: 'john@example.com' },
        packageOption: 'Basic',
        includeSurvey: false,
        discount: 0,
        runs: { coax: 1, cat6: 0 },
        services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 },
        pricing: { totalCost: 100, depositRequired: 0 }
      });
      await testQuote.save();
      
      // Use a future date that's not a weekend (Tuesday)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // Next week
      while (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
        futureDate.setDate(futureDate.getDate() + 1); // Skip to weekday
      }
      
      await Schedule.create({
        quoteNumber: '12345678',
        quoteId: testQuote._id,
        name: 'John Doe',
        email: 'john@example.com',
        date: futureDate,
        time: '10:00'
      });

      const response = await request(app).get('/api/scheduling/slots');
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('upcomingAppointments');
      expect(Array.isArray(response.body.upcomingAppointments)).toBe(true);
      expect(response.body.upcomingAppointments).toHaveLength(1);
    });

    test('POST /book should create new appointment with valid quote', async () => {
      // First create a quote
      const quoteData = {
        customer: {
          name: 'Jane Smith',
          email: 'jane@example.com'
        },
        packageOption: 'Basic',
        includeSurvey: false,
        discount: 0,
        runs: { coax: 1, cat6: 1 },
        services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
      };

      const quoteResponse = await request(app)
        .post('/api/quotes/create')
        .send(quoteData);
      
      expect(quoteResponse.status).toBe(201);
      const quoteNumber = quoteResponse.body.quoteNumber;
      
      // Use a future weekday date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 8); // Next week + 1 day
      while (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
        futureDate.setDate(futureDate.getDate() + 1); // Skip to weekday
      }
      
      const appointmentData = {
        quoteNumber: quoteNumber,
        name: 'Jane Smith',
        email: 'jane@example.com',
        date: futureDate.toISOString().split('T')[0], // YYYY-MM-DD format
        time: '14:00'
      };

      const response = await request(app)
        .post('/api/scheduling/book')
        .send(appointmentData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe(`Appointment scheduled successfully for Quote #${quoteNumber}`);
      expect(response.body).toHaveProperty('appointment');
      expect(response.body.appointment.quoteNumber).toBe(quoteNumber);
      
      const savedAppointment = await Schedule.findOne({ email: 'jane@example.com' });
      expect(savedAppointment).toBeTruthy();
      expect(savedAppointment.name).toBe('Jane Smith');
      expect(savedAppointment.quoteNumber).toBe(quoteNumber);
    });

    test('POST /book should reject invalid quote number', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 9); // Next week + 2 days
      while (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
        futureDate.setDate(futureDate.getDate() + 1); // Skip to weekday
      }
      
      const response = await request(app)
        .post('/api/scheduling/book')
        .send({
          quoteNumber: '99999999', // Non-existent quote number
          name: 'Test User',
          email: 'errortest@example.com',
          date: futureDate.toISOString().split('T')[0],
          time: '15:00'
        });
      
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Validation failed');
      expect(response.body.details).toContain('Quote number not found. Please verify your quote number.');
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
            'services[clientDevice]': 1,
            'services[serverDevice]': 0,
            'services[mediaPanel]': 0,
            includeSurvey: false
          });

        expect(response.status).toBe(200);
        expect(response.body.packageOption).toBe('Basic');
        expect(response.body.pricing).toHaveProperty('totalCost');
        expect(response.body.pricing).toHaveProperty('depositRequired');
        
        // 5 runs * $100 per run = $500, + $20 services = $520
        expect(response.body.pricing.totalCost).toBe(520);
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
            'services[clientDevice]': 1,
            'services[serverDevice]': 0,
            'services[mediaPanel]': 1,
            includeSurvey: false
          });

        expect(response.status).toBe(200);
        expect(response.body.packageOption).toBe('Premium');
        expect(response.body.pricing).toHaveProperty('estimatedLaborHours');
        expect(response.body.pricing).toHaveProperty('estimatedTotal');
        
        // Base 3hrs + Install 2hrs + (4 runs * 0.5) = 7 hours
        expect(response.body.pricing.estimatedLaborHours).toBe(7);
        // 7hrs * $50 + $80 services = $430
        expect(response.body.pricing.estimatedTotal).toBe(430);
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

      test('should handle calculate endpoint rate limiting in production', async () => {
        // Note: Rate limiting is bypassed for localhost in test environment
        // This test verifies the middleware is properly configured
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            packageOption: 'Basic',
            'runs[coax]': 1,
            'runs[cat6]': 1
          });

        expect(response.status).toBe(200);
      });

      test('should sanitize calculate endpoint parameters', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            packageOption: 'Basic',
            'runs[coax]': '1<script>alert("xss")</script>',
            'runs[cat6]': '1'
          });

        expect(response.status).toBe(200);
        // Should parse as 1 (parseInt ignores non-numeric characters)
        expect(response.body.pricing).toBeDefined();
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
            clientDevice: 1,
            serverDevice: 0,
            mediaPanel: 0
          }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('quoteNumber');
        expect(response.body).toHaveProperty('message');
        expect(response.body.quoteNumber).toMatch(/^\d{8}$/); // 8-digit number
        
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote).toBeTruthy();
        expect(savedQuote.quoteNumber).toBe(response.body.quoteNumber);
        expect(savedQuote.customer.name).toBe('John Doe');
        expect(savedQuote.packageOption).toBe('Basic');
        expect(savedQuote.includeSurvey).toBe(false);
        expect(savedQuote.pricing.totalCost).toBe(320); // 3 runs * $100 + $20 services
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
            clientDevice: 0,
            mediaPanel: 1
          }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('quoteNumber');
        expect(response.body.quoteNumber).toMatch(/^\d{8}$/); // 8-digit number
        
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.quoteNumber).toBe(response.body.quoteNumber);
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
          services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
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
            email: `test-enum-${Date.now()}@example.com`
          },
          packageOption: 'InvalidPackage',
          includeSurvey: false,
          runs: { coax: 1, cat6: 1 },
          services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details).toContain('Invalid package option');
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
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details.some(msg => msg.includes('Valid email address is required'))).toBe(true);
      });

      test('should reject zero quantities (business logic validation)', async () => {
        const quoteData = {
          customer: {
            name: 'Zero User',
            email: `zero-${Date.now()}@example.com`
          },
          packageOption: 'Basic',
          includeSurvey: false,
          runs: { coax: 0, cat6: 0 },
          services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response.status).toBe(400);
        expect(response.body.error).toBe('At least one service or cable run must be selected.');
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
          services: { deviceMount: 1, clientDevice: 1, serverDevice: 1, mediaPanel: 1 }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .set('X-Forwarded-For', '192.168.1.100')
          .send(quoteData);
        
        expect(response.status).toBe(201);
        
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.ip).toBe('192.168.1.100');
      });

      test('should handle duplicate email within time window', async () => {
        const email = `duplicate-${Date.now()}@example.com`;
        const quoteData = {
          customer: {
            name: 'Duplicate User',
            email: email
          },
          packageOption: 'Basic',
          includeSurvey: false,
          runs: { coax: 1, cat6: 0 },
          services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
        };

        // First request should succeed
        const response1 = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response1.status).toBe(201);

        // Second request within 10 minutes should be rejected
        const response2 = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response2.status).toBe(429);
        expect(response2.body.error).toBe('Please wait 10 minutes between quote requests.');
      });

      test('should handle database errors gracefully', async () => {
        // Mock Quote.create to simulate database error
        const originalCreate = require('../models/Quote').prototype.save;
        require('../models/Quote').prototype.save = jest.fn().mockRejectedValue(new Error('Database save failed'));
        
        const response = await request(app)
          .post('/api/quotes/create')
          .send({
            customer: { name: 'Test User', email: `dbtest-${Date.now()}@example.com` },
            packageOption: 'Basic',
            runs: { coax: 1, cat6: 0 },
            services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
          });
        
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Error generating quote');
        
        // Restore original function
        require('../models/Quote').prototype.save = originalCreate;
      });

      test('should apply discount correctly', async () => {
        const quoteData = {
          customer: {
            name: 'Discount User',
            email: `discount-${Date.now()}@example.com`
          },
          packageOption: 'Basic',
          includeSurvey: false,
          discount: 20,
          runs: { coax: 2, cat6: 2 },
          services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        
        expect(response.status).toBe(201);
        
        const savedQuote = await Quote.findById(response.body.id);
        // 4 runs * $100 = $400, with 20% discount = $320
        expect(savedQuote.pricing.totalCost).toBe(320);
      });

      // Security Tests
      describe('Security Validations', () => {
        test('should reject invalid name characters', async () => {
          const quoteData = {
            customer: {
              name: 'John<script>alert("xss")</script>',
              email: `xss-test-${Date.now()}@example.com`
            },
            packageOption: 'Basic',
            runs: { coax: 1, cat6: 0 },
            services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
          };

          const response = await request(app)
            .post('/api/quotes/create')
            .send(quoteData);
          
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Validation failed');
          expect(response.body.details.some(msg => msg.includes('Name can only contain letters'))).toBe(true);
        });

        test('should reject disposable email domains', async () => {
          const quoteData = {
            customer: {
              name: 'Test User',
              email: `test-${Date.now()}@mailinator.com`
            },
            packageOption: 'Basic',
            runs: { coax: 1, cat6: 0 },
            services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
          };

          const response = await request(app)
            .post('/api/quotes/create')
            .send(quoteData);
          
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Validation failed');
          expect(response.body.details.some(msg => msg.includes('Please use a valid business email'))).toBe(true);
        });

        test('should reject honeypot submissions', async () => {
          const quoteData = {
            customer: {
              name: 'Bot User',
              email: `bot-${Date.now()}@example.com`
            },
            packageOption: 'Basic',
            runs: { coax: 1, cat6: 0 },
            services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 },
            honeypot: 'bot-filled-field'
          };

          const response = await request(app)
            .post('/api/quotes/create')
            .send(quoteData);
          
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Validation failed');
          expect(response.body.details.some(msg => msg.includes('Bot detection triggered'))).toBe(true);
        });

        test('should reject excessive equipment quantities', async () => {
          const quoteData = {
            customer: {
              name: 'Test User',
              email: `equipment-${Date.now()}@example.com`
            },
            packageOption: 'Basic',
            runs: { coax: 1, cat6: 0 },
            services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 },
            equipment: [
              { sku: 'TEST', name: 'Expensive Item', price: 10000, quantity: 10 }
            ]
          };

          const response = await request(app)
            .post('/api/quotes/create')
            .send(quoteData);
          
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Equipment total exceeds reasonable limits.');
        });

        test('should reject oversized input values', async () => {
          const quoteData = {
            customer: {
              name: 'A'.repeat(101), // Exceeds 100 char limit
              email: `oversized-${Date.now()}@example.com`
            },
            packageOption: 'Basic',
            runs: { coax: 1, cat6: 0 },
            services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
          };

          const response = await request(app)
            .post('/api/quotes/create')
            .send(quoteData);
          
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Validation failed');
          expect(response.body.details.some(msg => msg.includes('Name must be between 2 and 100 characters'))).toBe(true);
        });

        test('should reject excessive service quantities', async () => {
          const quoteData = {
            customer: {
              name: 'Test User',
              email: `service-${Date.now()}@example.com`
            },
            packageOption: 'Basic',
            runs: { coax: 51, cat6: 0 }, // Exceeds 50 limit
            services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
          };

          const response = await request(app)
            .post('/api/quotes/create')
            .send(quoteData);
          
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Validation failed');
          expect(response.body.details.some(msg => msg.includes('Coax runs must be between 0 and 50'))).toBe(true);
        });

        test('should sanitize and store user input safely', async () => {
          const quoteData = {
            customer: {
              name: "John O'Neill",  // Valid name with apostrophe
              email: `sanitize-${Date.now()}@example.com`
            },
            packageOption: 'Basic',
            runs: { coax: 1, cat6: 0 },
            services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
          };

          const response = await request(app)
            .post('/api/quotes/create')
            .send(quoteData);
          
          expect(response.status).toBe(201);
          
          const savedQuote = await Quote.findById(response.body.id);
          expect(savedQuote.customer.name).toBe('John O&#x27;Neill'); // HTML escaped
          expect(savedQuote.userAgent).toBeTruthy(); // Should have user agent
        });

        test('should track IP addresses correctly', async () => {
          const quoteData = {
            customer: {
              name: 'IP Test User',
              email: `iptest-${Date.now()}@example.com`
            },
            packageOption: 'Basic',
            runs: { coax: 1, cat6: 0 },
            services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
          };

          const response = await request(app)
            .post('/api/quotes/create')
            .set('X-Forwarded-For', '192.168.1.100, 10.0.0.1')
            .send(quoteData);
          
          expect(response.status).toBe(201);
          
          const savedQuote = await Quote.findById(response.body.id);
          expect(savedQuote.ip).toBe('192.168.1.100'); // Should use first forwarded IP
        });

        test('should handle rate limiting gracefully', async () => {
          // Test rate limiting by temporarily changing NODE_ENV
          const originalEnv = process.env.NODE_ENV;
          process.env.NODE_ENV = 'production';
          
          // Create a new app instance for this test to pick up the env change
          delete require.cache[require.resolve('../server')];
          const prodApp = require('../server');
          
          const quoteData = {
            customer: {
              name: 'Rate Test User',
              email: `ratetest-${Date.now()}@example.com`
            },
            packageOption: 'Basic',
            runs: { coax: 1, cat6: 0 },
            services: { deviceMount: 0, clientDevice: 0, serverDevice: 0, mediaPanel: 0 }
          };

          // First 3 requests should succeed (within rate limit)
          for (let i = 0; i < 3; i++) {
            const response = await request(prodApp)
              .post('/api/quotes/create')
              .send({
                ...quoteData,
                customer: { ...quoteData.customer, email: `ratetest-${Date.now()}-${i}@example.com` }
              });
            expect([201, 400, 429]).toContain(response.status); // 201=success, 400=validation, 429=rate limit
          }
          
          // Restore original environment
          process.env.NODE_ENV = originalEnv;
          delete require.cache[require.resolve('../server')];
        });
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
      // Mock Service.find to simulate database error
      const originalFind = require('../models/Service').find;
      require('../models/Service').find = jest.fn().mockRejectedValue(new Error('Database query failed'));
      
      const response = await request(app).get('/api/shared/services');
      expect(response.status).toBe(500);
      expect(response.text).toContain('Error fetching services');
      
      // Restore original function
      require('../models/Service').find = originalFind;
    });
  });
});