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

// Helper to build valid Drops Only quote payload
function makeDropsOnlyPayload(overrides = {}) {
  return {
    customer: {
      name: 'John Doe',
      email: `test-${Date.now()}@example.com`
    },
    serviceType: 'Drops Only',
    discount: 0,
    runs: { coax: 1, cat6: 1, fiber: 0 },
    services: { apMount: 0, ethRelocation: 0 },
    centralization: 'Loose Termination',
    homeInfo: {
      homeAge: '2000-2020',
      stories: 2,
      atticAccess: 'Walk-in attic',
      hasMediaPanel: false,
      hasCrawlspaceOrBasement: false,
      liabilityAcknowledged: true,
      address: {
        street: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        zip: '62701'
      }
    },
    ...overrides
  };
}

// Helper to build valid Whole-Home quote payload
function makeWholeHomePayload(overrides = {}) {
  return {
    customer: {
      name: 'Jane Smith',
      email: `test-${Date.now()}@example.com`
    },
    serviceType: 'Whole-Home',
    wholeHome: {
      scope: { networking: true, security: false, voip: false },
      internetSpeed: '1 Gig',
      hasOwnEquipment: false,
      networkingBrand: 'UniFi',
      securityBrand: 'No Preference',
      surveyPreference: 'before-install',
      notes: ''
    },
    homeInfo: {
      homeAge: '2000-2020',
      stories: 2,
      atticAccess: 'Walk-in attic',
      hasMediaPanel: false,
      hasCrawlspaceOrBasement: false,
      liabilityAcknowledged: true,
      address: {
        street: '456 Oak Ave',
        city: 'Chicago',
        state: 'IL',
        zip: '60601'
      }
    },
    ...overrides
  };
}

// Helper to get a future date by day-of-week (0=Sun, 6=Sat)
function getFutureDate(targetDay = null) {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  if (targetDay !== null) {
    while (date.getDay() !== targetDay) {
      date.setDate(date.getDate() + 1);
    }
  }
  return date;
}

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
      const originalFind = require('../models/Service').find;
      const originalTestimonial = require('../models/Testimonial').find;

      require('../models/Service').find = jest.fn().mockRejectedValue(new Error('Database connection failed'));
      require('../models/Testimonial').find = jest.fn().mockResolvedValue([]);

      const response = await request(app).get('/api/home');
      expect(response.status).toBe(500);
      expect(response.text).toContain('Error fetching homepage content');

      require('../models/Service').find = originalFind;
      require('../models/Testimonial').find = originalTestimonial;
    });
  });

  describe('Scheduling Routes - /api/scheduling', () => {
    test('GET /slots should return available slots with appointmentType and duration', async () => {
      const testQuote = new Quote({
        quoteNumber: '12345678',
        customer: { name: 'John Doe', email: 'john@example.com' },
        serviceType: 'Drops Only',
        runs: { coax: 1, cat6: 0 },
        services: { mediaPanel: 0, apMount: 0, ethRelocation: 0 },
        homeInfo: {
          homeAge: '2000-2020', stories: 1, atticAccess: 'Walk-in attic',
          liabilityAcknowledged: true
        },
        pricing: { totalCost: 100, depositRequired: 0 }
      });
      await testQuote.save();

      const futureDate = getFutureDate(2); // Tuesday

      await Schedule.create({
        quoteNumber: '12345678',
        quoteId: testQuote._id,
        name: 'John Doe',
        email: 'john@example.com',
        date: futureDate,
        time: '10:00',
        appointmentType: 'drops-only-install',
        duration: 120
      });

      const response = await request(app).get('/api/scheduling/slots');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('upcomingAppointments');
      expect(Array.isArray(response.body.upcomingAppointments)).toBe(true);
      expect(response.body.upcomingAppointments).toHaveLength(1);

      // Test date-specific slots return appointmentType and duration
      const dateStr = futureDate.toISOString().split('T')[0];
      const slotsRes = await request(app).get(`/api/scheduling/slots?date=${dateStr}`);
      expect(slotsRes.status).toBe(200);
      expect(slotsRes.body.bookedSlots[0]).toHaveProperty('appointmentType', 'drops-only-install');
      expect(slotsRes.body.bookedSlots[0]).toHaveProperty('duration', 120);
    });

    test('POST /book should create new appointment with valid quote and appointmentType', async () => {
      const quoteData = makeDropsOnlyPayload({
        customer: { name: 'Jane Smith', email: 'jane@example.com' }
      });

      const quoteResponse = await request(app)
        .post('/api/quotes/create')
        .send(quoteData);

      expect(quoteResponse.status).toBe(201);
      const quoteNumber = quoteResponse.body.quoteNumber;

      const futureDate = getFutureDate(2); // Tuesday

      const appointmentData = {
        quoteNumber: quoteNumber,
        name: 'Jane Smith',
        email: 'jane@example.com',
        date: futureDate.toISOString().split('T')[0],
        time: '14:00',
        appointmentType: 'drops-only-install',
        duration: 120
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
      expect(savedAppointment.appointmentType).toBe('drops-only-install');
      expect(savedAppointment.duration).toBe(120);
    });

    test('POST /book should reject invalid quote number', async () => {
      const futureDate = getFutureDate();

      const response = await request(app)
        .post('/api/scheduling/book')
        .send({
          quoteNumber: '99999999',
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

    test('POST /book should allow weekend bookings', async () => {
      const quoteData = makeDropsOnlyPayload({
        customer: { name: 'Weekend User', email: 'weekend@example.com' }
      });

      const quoteResponse = await request(app)
        .post('/api/quotes/create')
        .send(quoteData);

      expect(quoteResponse.status).toBe(201);
      const quoteNumber = quoteResponse.body.quoteNumber;

      // Find a future Saturday
      const satDate = getFutureDate(6); // Saturday

      const response = await request(app)
        .post('/api/scheduling/book')
        .send({
          quoteNumber,
          name: 'Weekend User',
          email: 'weekend@example.com',
          date: satDate.toISOString().split('T')[0],
          time: '10:00',
          appointmentType: 'drops-only-install',
          duration: 120
        });

      expect(response.status).toBe(201);
      expect(response.body.appointment.quoteNumber).toBe(quoteNumber);
    });

    test('POST /book should reject 30-minute intervals', async () => {
      const quoteData = makeDropsOnlyPayload({
        customer: { name: 'Interval User', email: 'interval@example.com' }
      });

      const quoteResponse = await request(app)
        .post('/api/quotes/create')
        .send(quoteData);

      expect(quoteResponse.status).toBe(201);

      const futureDate = getFutureDate(3); // Wednesday

      const response = await request(app)
        .post('/api/scheduling/book')
        .send({
          quoteNumber: quoteResponse.body.quoteNumber,
          name: 'Interval User',
          email: 'interval@example.com',
          date: futureDate.toISOString().split('T')[0],
          time: '10:30'
        });

      expect(response.status).toBe(400);
      expect(response.body.details).toContain('Appointments must be scheduled at hourly intervals (e.g., 9:00, 10:00)');
    });

    test('Survey should block 2 hours', async () => {
      const quoteData1 = makeWholeHomePayload({
        customer: { name: 'Survey One', email: 'survey1@example.com' }
      });
      const q1 = await request(app).post('/api/quotes/create').send(quoteData1);
      expect(q1.status).toBe(201);

      const futureDate = getFutureDate(2); // Tuesday
      const dateStr = futureDate.toISOString().split('T')[0];

      // Book a survey at 10:00 (blocks 10:00-12:00)
      const bookRes = await request(app)
        .post('/api/scheduling/book')
        .send({
          quoteNumber: q1.body.quoteNumber,
          name: 'Survey One',
          email: 'survey1@example.com',
          date: dateStr,
          time: '10:00',
          appointmentType: 'survey',
          duration: 120
        });
      expect(bookRes.status).toBe(201);

      // Try to book at 11:00 - should conflict
      const quoteData2 = makeWholeHomePayload({
        customer: { name: 'Survey Two', email: 'survey2@example.com' }
      });
      const q2 = await request(app).post('/api/quotes/create').send(quoteData2);
      expect(q2.status).toBe(201);

      const conflictRes = await request(app)
        .post('/api/scheduling/book')
        .send({
          quoteNumber: q2.body.quoteNumber,
          name: 'Survey Two',
          email: 'survey2@example.com',
          date: dateStr,
          time: '11:00',
          appointmentType: 'survey',
          duration: 120
        });
      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error).toBe('Time slot is not available');
    });

    test('Whole-home install should block full day', async () => {
      const quoteData1 = makeWholeHomePayload({
        customer: { name: 'WH Block', email: 'whblock@example.com' }
      });
      const q1 = await request(app).post('/api/quotes/create').send(quoteData1);
      expect(q1.status).toBe(201);

      const futureDate = getFutureDate(3); // Wednesday
      const dateStr = futureDate.toISOString().split('T')[0];

      // Book a whole-home install
      const bookRes = await request(app)
        .post('/api/scheduling/book')
        .send({
          quoteNumber: q1.body.quoteNumber,
          name: 'WH Block',
          email: 'whblock@example.com',
          date: dateStr,
          time: '08:00',
          appointmentType: 'whole-home-install',
          duration: 720
        });
      expect(bookRes.status).toBe(201);

      // Try to book anything else on the same day
      const quoteData2 = makeDropsOnlyPayload({
        customer: { name: 'Blocked User', email: 'blocked@example.com' }
      });
      const q2 = await request(app).post('/api/quotes/create').send(quoteData2);
      expect(q2.status).toBe(201);

      const conflictRes = await request(app)
        .post('/api/scheduling/book')
        .send({
          quoteNumber: q2.body.quoteNumber,
          name: 'Blocked User',
          email: 'blocked@example.com',
          date: dateStr,
          time: '15:00',
          appointmentType: 'drops-only-install',
          duration: 120
        });
      expect(conflictRes.status).toBe(409);
    });
  });

  describe('Quotes Routes - /api/quotes', () => {
    describe('GET /calculate', () => {
      test('should calculate Drops Only pricing correctly', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            serviceType: 'Drops Only',
            'runs[coax]': 2,
            'runs[cat6]': 3,
            'services[apMount]': 2,
            'services[ethRelocation]': 1,
            'centralization[type]': 'Patch Panel',
            'centralization[hasExistingPanel]': 'false'
          });

        expect(response.status).toBe(200);
        expect(response.body.serviceType).toBe('Drops Only');
        expect(response.body.pricing).toHaveProperty('totalCost');
        expect(response.body.pricing).toHaveProperty('depositRequired');

        // 2 coax×$150 + 3 cat6×$100 = $600 + $50 patch panel + $50 AP mount + $20 eth reloc = $720
        expect(response.body.pricing.totalCost).toBe(720);
        expect(response.body.pricing.depositRequired).toBe(20); // Over $100 threshold
      });

      test('should reject non-Drops Only service type', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            serviceType: 'Whole-Home'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Calculation only available for Drops Only quotes.');
      });

      test('should handle missing service type', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({});

        expect(response.status).toBe(400);
      });

      test('should handle discount calculation', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            serviceType: 'Drops Only',
            'runs[coax]': 1,
            'runs[cat6]': 1,
            discount: 10
          });

        expect(response.status).toBe(200);
        // 1 coax×$150 + 1 cat6×$100 = $250, with 10% discount = $225
        expect(response.body.pricing.totalCost).toBe(225);
      });

      test('should sanitize calculate endpoint parameters', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            serviceType: 'Drops Only',
            'runs[coax]': '1<script>alert("xss")</script>',
            'runs[cat6]': '1'
          });

        expect(response.status).toBe(200);
        expect(response.body.pricing).toBeDefined();
      });
    });

    describe('POST /create - Drops Only', () => {
      test('should create Drops Only quote with pricing', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'John Doe', email: 'john@example.com' },
          runs: { coax: 2, cat6: 1 },
          services: { apMount: 0, ethRelocation: 0 },
          centralization: 'Loose Termination'
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body).toHaveProperty('quoteNumber');
        expect(response.body.quoteNumber).toMatch(/^\d{8}$/);

        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote).toBeTruthy();
        expect(savedQuote.serviceType).toBe('Drops Only');
        expect(savedQuote.customer.name).toBe('John Doe');
        // 2 coax×$150 + 1 cat6×$100 + $0 centralization = $400
        expect(savedQuote.pricing.totalCost).toBe(400);
        expect(savedQuote.pricing.depositRequired).toBe(20);
      });

      test('should calculate add-on services correctly', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Addon Test', email: 'addon@example.com' },
          runs: { coax: 0, cat6: 1 },
          services: { apMount: 2, ethRelocation: 3 },
          centralization: 'Patch Panel'
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        // 1 run * $100 + $50 patch panel + 2 * $25 AP mount + 3 * $20 eth reloc = $260
        expect(savedQuote.pricing.totalCost).toBe(260);
      });

      test('should save homeInfo correctly', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Home Info Test', email: 'homeinfo@example.com' },
          homeInfo: {
            homeAge: 'Pre-1960',
            stories: 3,
            atticAccess: 'Scuttle hole',
            hasMediaPanel: true,
            mediaPanelLocation: 'Basement',
            hasCrawlspaceOrBasement: true,
            liabilityAcknowledged: true,
            address: { street: '100 Test St', city: 'TestCity', state: 'IL', zip: '60601' }
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.homeInfo.homeAge).toBe('Pre-1960');
        expect(savedQuote.homeInfo.stories).toBe(3);
        expect(savedQuote.homeInfo.atticAccess).toBe('Scuttle hole');
        expect(savedQuote.homeInfo.hasMediaPanel).toBe(true);
        expect(savedQuote.homeInfo.hasCrawlspaceOrBasement).toBe(true);
        expect(savedQuote.homeInfo.liabilityAcknowledged).toBe(true);
      });

      test('should reject zero quantities', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Zero User', email: `zero-${Date.now()}@example.com` },
          runs: { coax: 0, cat6: 0 },
          services: { apMount: 0, ethRelocation: 0 }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('At least one cable run or service must be selected.');
      });

      test('should validate service type enum', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Test', email: `enum-${Date.now()}@example.com` },
          serviceType: 'InvalidType'
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details).toContain('Invalid service type');
      });

      test('should validate required customer fields', async () => {
        const response = await request(app)
          .post('/api/quotes/create')
          .send({
            customer: { name: 'John Doe' },
            serviceType: 'Drops Only'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details.some(msg => msg.includes('Valid email address is required'))).toBe(true);
      });

      test('should apply discount correctly', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Discount User', email: `disc-${Date.now()}@example.com` },
          discount: 20,
          runs: { coax: 2, cat6: 2 },
          services: { apMount: 0, ethRelocation: 0 },
          centralization: 'Loose Termination'
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        // 2 coax×$150 + 2 cat6×$100 = $500, with 20% discount = $400
        expect(savedQuote.pricing.totalCost).toBe(400);
      });

      test('should validate liability acknowledgment is required', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'No Liability', email: `noliab-${Date.now()}@example.com` },
          homeInfo: {
            homeAge: '2000-2020',
            stories: 1,
            atticAccess: 'Walk-in attic',
            liabilityAcknowledged: false,
            address: { street: '100 Test St', city: 'TestCity', state: 'IL', zip: '60601' }
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details.some(msg => msg.includes('Liability acknowledgment is required'))).toBe(true);
      });
    });

    describe('POST /create - Whole-Home', () => {
      test('should create Whole-Home quote with deposit', async () => {
        const quoteData = makeWholeHomePayload({
          customer: { name: 'WH User', email: 'wh@example.com' }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.serviceType).toBe('Whole-Home');
        expect(savedQuote.pricing.depositAmount).toBe(200);
        expect(savedQuote.wholeHome.scope.networking).toBe(true);
        expect(savedQuote.wholeHome.internetSpeed).toBe('1 Gig');
        expect(savedQuote.wholeHome.hasOwnEquipment).toBe(false);
        expect(savedQuote.wholeHome.networkingBrand).toBe('UniFi');
      });

      test('should reject Whole-Home with no scope selected', async () => {
        const quoteData = makeWholeHomePayload({
          customer: { name: 'No Scope', email: `noscope-${Date.now()}@example.com` },
          wholeHome: {
            scope: { networking: false, security: false, voip: false },
            internetSpeed: '1 Gig',
            hasOwnEquipment: false,
            networkingBrand: 'No Preference',
            securityBrand: 'No Preference',
            surveyPreference: 'before-install'
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('At least one scope (Networking, Security, or VoIP) must be selected.');
      });

      test('should save own equipment description', async () => {
        const quoteData = makeWholeHomePayload({
          customer: { name: 'Equip User', email: `equip-${Date.now()}@example.com` },
          wholeHome: {
            scope: { networking: true, security: false, voip: false },
            hasOwnEquipment: true,
            equipmentDescription: 'My custom UniFi setup with 3 APs',
            surveyPreference: 'day-of'
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.wholeHome.hasOwnEquipment).toBe(true);
        // Note: equipmentDescription is sanitized (HTML escaped)
        expect(savedQuote.wholeHome.equipmentDescription).toBeTruthy();
      });

      test('should save survey preference', async () => {
        const quoteData = makeWholeHomePayload({
          customer: { name: 'Survey Pref', email: `survey-${Date.now()}@example.com` },
          wholeHome: {
            scope: { networking: true, security: true, voip: false },
            hasOwnEquipment: false,
            networkingBrand: 'Ruckus',
            securityBrand: 'Reolink',
            surveyPreference: 'day-of'
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.wholeHome.surveyPreference).toBe('day-of');
        expect(savedQuote.wholeHome.networkingBrand).toBe('Ruckus');
        expect(savedQuote.wholeHome.securityBrand).toBe('Reolink');
      });
    });

    describe('POST /create - Security Validations', () => {
      test('should reject invalid name characters', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: {
            name: 'John<script>alert("xss")</script>',
            email: `xss-${Date.now()}@example.com`
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.details.some(msg => msg.includes('Name can only contain letters'))).toBe(true);
      });

      test('should reject disposable email domains', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: {
            name: 'Test User',
            email: `test-${Date.now()}@mailinator.com`
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.details.some(msg => msg.includes('Please use a valid business email'))).toBe(true);
      });

      test('should reject honeypot submissions', async () => {
        const quoteData = {
          ...makeDropsOnlyPayload({
            customer: { name: 'Bot User', email: `bot-${Date.now()}@example.com` }
          }),
          honeypot: 'bot-filled-field'
        };

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.details.some(msg => msg.includes('Bot detection triggered'))).toBe(true);
      });

      test('should reject oversized input values', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: {
            name: 'A'.repeat(101),
            email: `oversized-${Date.now()}@example.com`
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.details.some(msg => msg.includes('Name must be between 2 and 100 characters'))).toBe(true);
      });

      test('should reject excessive run quantities', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Test User', email: `runs-${Date.now()}@example.com` },
          runs: { coax: 51, cat6: 0 }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.details.some(msg => msg.includes('Coax runs must be between 0 and 50'))).toBe(true);
      });

      test('should capture client IP correctly', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'IP Test', email: 'ip@example.com' }
        });

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
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Duplicate User', email }
        });

        const response1 = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        expect(response1.status).toBe(201);

        const response2 = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);
        expect(response2.status).toBe(429);
        expect(response2.body.error).toBe('Please wait 10 minutes between quote requests.');
      });

      test('should sanitize and store user input safely', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: {
            name: "John O'Neill",
            email: `sanitize-${Date.now()}@example.com`
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.customer.name).toBe('John O&#x27;Neill');
        expect(savedQuote.userAgent).toBeTruthy();
      });

      test('should track IP addresses correctly', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'IP Test User', email: `iptest-${Date.now()}@example.com` }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .set('X-Forwarded-For', '192.168.1.100, 10.0.0.1')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.ip).toBe('192.168.1.100');
      });

      test('should handle database errors gracefully', async () => {
        const originalSave = require('../models/Quote').prototype.save;
        require('../models/Quote').prototype.save = jest.fn().mockRejectedValue(new Error('Database save failed'));

        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Test User', email: `dbtest-${Date.now()}@example.com` }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Error generating quote');

        require('../models/Quote').prototype.save = originalSave;
      });
    });

    describe('POST /create - Centralization', () => {
      test('should require centralization for Drops Only quotes', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'No Central', email: `nocentral-${Date.now()}@example.com` }
        });
        delete quoteData.centralization;

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
        expect(response.body.details.some(msg => msg.includes('Invalid centralization selection'))).toBe(true);
      });

      test('should reject invalid centralization value', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Invalid Central', email: `invalidcentral-${Date.now()}@example.com` },
          centralization: 'Invalid Value'
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.details.some(msg => msg.includes('Invalid centralization selection'))).toBe(true);
      });

      test('Media Panel centralization +$100 when no existing panel', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'MP New', email: `mpnew-${Date.now()}@example.com` },
          runs: { coax: 1, cat6: 0 },
          centralization: 'Media Panel',
          homeInfo: {
            homeAge: '2000-2020',
            stories: 1,
            atticAccess: 'Walk-in attic',
            hasMediaPanel: false,
            hasCrawlspaceOrBasement: false,
            liabilityAcknowledged: true,
            address: { street: '100 Test St', city: 'TestCity', state: 'IL', zip: '60601' }
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        // 1 coax×$150 + $100 media panel install = $250
        expect(savedQuote.pricing.totalCost).toBe(250);
        expect(savedQuote.centralization).toBe('Media Panel');
      });

      test('Media Panel centralization $0 when existing panel', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'MP Existing', email: `mpexist-${Date.now()}@example.com` },
          runs: { coax: 1, cat6: 0 },
          centralization: 'Media Panel',
          homeInfo: {
            homeAge: '2000-2020',
            stories: 1,
            atticAccess: 'Walk-in attic',
            hasMediaPanel: true,
            hasCrawlspaceOrBasement: false,
            liabilityAcknowledged: true,
            address: { street: '100 Test St', city: 'TestCity', state: 'IL', zip: '60601' }
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        // 1 coax×$150 + $0 existing media panel = $150
        expect(savedQuote.pricing.totalCost).toBe(150);
        expect(savedQuote.centralization).toBe('Media Panel');
      });

      test('Patch Panel centralization +$50', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'PP User', email: `pp-${Date.now()}@example.com` },
          runs: { coax: 1, cat6: 0 },
          centralization: 'Patch Panel'
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        // 1 coax×$150 + $50 patch panel = $200
        expect(savedQuote.pricing.totalCost).toBe(200);
        expect(savedQuote.centralization).toBe('Patch Panel');
      });

      test('Loose Termination centralization $0', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'LT User', email: `lt-${Date.now()}@example.com` },
          runs: { coax: 1, cat6: 0 },
          centralization: 'Loose Termination'
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        // 1 coax×$150 + $0 loose termination = $150
        expect(savedQuote.pricing.totalCost).toBe(150);
        expect(savedQuote.centralization).toBe('Loose Termination');
      });

      test('Calculate endpoint with centralization params', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            serviceType: 'Drops Only',
            'runs[coax]': 2,
            'runs[cat6]': 0,
            'centralization[type]': 'Media Panel',
            'centralization[hasExistingPanel]': 'false'
          });

        expect(response.status).toBe(200);
        // 2 coax×$150 + $100 media panel = $400
        expect(response.body.pricing.totalCost).toBe(400);
      });

      test('Calculate endpoint with existing media panel', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            serviceType: 'Drops Only',
            'runs[coax]': 2,
            'runs[cat6]': 0,
            'centralization[type]': 'Media Panel',
            'centralization[hasExistingPanel]': 'true'
          });

        expect(response.status).toBe(200);
        // 2 coax×$150 + $0 existing panel = $300
        expect(response.body.pricing.totalCost).toBe(300);
      });
    });

    describe('GET /pricing', () => {
      test('should return pricing configuration', async () => {
        const response = await request(app).get('/api/quotes/pricing');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('cables');
        expect(response.body.cables).toHaveProperty('cat6');
        expect(response.body.cables).toHaveProperty('coax');
        expect(response.body.cables).toHaveProperty('fiber');
        expect(response.body).toHaveProperty('addons');
        expect(response.body).toHaveProperty('centralization');
        expect(response.body).toHaveProperty('dropsOnly');
        expect(response.body).toHaveProperty('wholeHome');
        expect(response.body).toHaveProperty('laborHours');
      });
    });

    describe('POST /create - Address', () => {
      test('should save address in homeInfo', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Address Test', email: `addr-${Date.now()}@example.com` },
          homeInfo: {
            homeAge: '2000-2020',
            stories: 2,
            atticAccess: 'Walk-in attic',
            hasMediaPanel: false,
            hasCrawlspaceOrBasement: false,
            liabilityAcknowledged: true,
            address: {
              street: '789 Elm Blvd',
              city: 'Peoria',
              state: 'IL',
              zip: '61602'
            }
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.homeInfo.address.street).toBe('789 Elm Blvd');
        expect(savedQuote.homeInfo.address.city).toBe('Peoria');
        expect(savedQuote.homeInfo.address.state).toBe('IL');
        expect(savedQuote.homeInfo.address.zip).toBe('61602');
      });

      test('should reject missing address', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'No Address', email: `noaddr-${Date.now()}@example.com` },
        });
        delete quoteData.homeInfo.address;

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Validation failed');
      });

      test('should reject invalid ZIP code', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Bad Zip', email: `badzip-${Date.now()}@example.com` },
          homeInfo: {
            homeAge: '2000-2020',
            stories: 2,
            atticAccess: 'Walk-in attic',
            hasMediaPanel: false,
            hasCrawlspaceOrBasement: false,
            liabilityAcknowledged: true,
            address: {
              street: '123 Main St',
              city: 'Springfield',
              state: 'IL',
              zip: 'ABCDE'
            }
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.details.some(msg => msg.includes('ZIP code'))).toBe(true);
      });
    });

    describe('POST /create - Scope Details', () => {
      test('should save scope details for Whole-Home', async () => {
        const quoteData = makeWholeHomePayload({
          customer: { name: 'Scope Detail User', email: `scope-${Date.now()}@example.com` },
          wholeHome: {
            scope: { networking: true, security: true, voip: true },
            hasOwnEquipment: false,
            networkingBrand: 'UniFi',
            securityBrand: 'UniFi',
            surveyPreference: 'day-of',
            networkingDetails: 'Need 8 wired drops across 3 rooms',
            securityDetails: '4 outdoor cameras, 2 indoor',
            voipDetails: '3 desk phones and 1 conference room'
          }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.wholeHome.networkingDetails).toBeTruthy();
        expect(savedQuote.wholeHome.securityDetails).toBeTruthy();
        expect(savedQuote.wholeHome.voipDetails).toBeTruthy();
      });
    });

    describe('POST /create - Fiber', () => {
      test('should create quote with fiber runs and correct pricing', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Fiber User', email: `fiber-${Date.now()}@example.com` },
          runs: { coax: 0, cat6: 1, fiber: 2 },
          services: { apMount: 0, ethRelocation: 0 },
          centralization: 'Loose Termination'
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        // 1 cat6×$100 + 2 fiber×$200 = $500
        expect(savedQuote.pricing.totalCost).toBe(500);
        expect(savedQuote.runs.fiber).toBe(2);
      });

      test('should reject fiber runs exceeding max', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Fiber Max', email: `fibermax-${Date.now()}@example.com` },
          runs: { coax: 0, cat6: 0, fiber: 51 }
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(400);
        expect(response.body.details.some(msg => msg.includes('Fiber runs must be between 0 and 50'))).toBe(true);
      });

      test('should store fiber field in database', async () => {
        const quoteData = makeDropsOnlyPayload({
          customer: { name: 'Fiber Store', email: `fiberstore-${Date.now()}@example.com` },
          runs: { coax: 1, cat6: 0, fiber: 3 },
          centralization: 'Loose Termination'
        });

        const response = await request(app)
          .post('/api/quotes/create')
          .send(quoteData);

        expect(response.status).toBe(201);
        const savedQuote = await Quote.findById(response.body.id);
        expect(savedQuote.runs.fiber).toBe(3);
        expect(savedQuote.runs.coax).toBe(1);
        expect(savedQuote.runs.cat6).toBe(0);
      });

      test('should calculate fiber pricing via calculate endpoint', async () => {
        const response = await request(app)
          .get('/api/quotes/calculate')
          .query({
            serviceType: 'Drops Only',
            'runs[coax]': 0,
            'runs[cat6]': 1,
            'runs[fiber]': 2
          });

        expect(response.status).toBe(200);
        // 1 cat6×$100 + 2 fiber×$200 = $500
        expect(response.body.pricing.totalCost).toBe(500);
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
      const originalFind = require('../models/Service').find;
      require('../models/Service').find = jest.fn().mockRejectedValue(new Error('Database query failed'));

      const response = await request(app).get('/api/shared/services');
      expect(response.status).toBe(500);
      expect(response.text).toContain('Error fetching services');

      require('../models/Service').find = originalFind;
    });
  });
});
