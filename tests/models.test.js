const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Service = require('../models/Service');
const Quote = require('../models/Quote');
const Schedule = require('../models/Schedule');
const Testimonial = require('../models/Testimonial');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Service.deleteMany({});
  await Quote.deleteMany({});
  await Schedule.deleteMany({});
  await Testimonial.deleteMany({});
});

describe('Data Models', () => {
  describe('Service Model', () => {
    test('should create a service with required fields', async () => {
      const serviceData = {
        name: 'Network Installation',
        description: 'Professional network setup and configuration',
        price: 250
      };

      const service = new Service(serviceData);
      const savedService = await service.save();

      expect(savedService._id).toBeDefined();
      expect(savedService.name).toBe('Network Installation');
      expect(savedService.description).toBe('Professional network setup and configuration');
      expect(savedService.price).toBe(250);
      expect(savedService.createdAt).toBeDefined();
    });

    test('should create service without optional price field', async () => {
      const serviceData = {
        name: 'Consultation',
        description: 'Initial consultation and assessment'
      };

      const service = new Service(serviceData);
      const savedService = await service.save();

      expect(savedService.name).toBe('Consultation');
      expect(savedService.price).toBeUndefined();
    });

    test('should require name field', async () => {
      const service = new Service({
        description: 'Test description'
      });

      await expect(service.save()).rejects.toThrow();
    });

    test('should require description field', async () => {
      const service = new Service({
        name: 'Test Service'
      });

      await expect(service.save()).rejects.toThrow();
    });
  });

  describe('Quote Model', () => {
    test('should create a Drops Only quote with all fields', async () => {
      const quoteData = {
        customer: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        serviceType: 'Drops Only',
        runs: { coax: 2, cat6: 3, fiber: 1 },
        services: { mediaPanel: 1, apMount: 2, ethRelocation: 1 },
        homeInfo: {
          homeAge: '2000-2020',
          stories: 2,
          atticAccess: 'Walk-in attic',
          hasMediaPanel: true,
          mediaPanelLocation: 'Garage',
          hasCrawlspaceOrBasement: true,
          liabilityAcknowledged: true
        },
        pricing: {
          totalCost: 670,
          depositRequired: 20
        },
        ip: '192.168.1.100'
      };

      quoteData.quoteNumber = quoteData.quoteNumber || String(Math.floor(Math.random() * 90000000) + 10000000);
      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();

      expect(savedQuote._id).toBeDefined();
      expect(savedQuote.serviceType).toBe('Drops Only');
      expect(savedQuote.customer.name).toBe('John Doe');
      expect(savedQuote.runs.coax).toBe(2);
      expect(savedQuote.runs.cat6).toBe(3);
      expect(savedQuote.runs.fiber).toBe(1);
      expect(savedQuote.services.mediaPanel).toBe(1);
      expect(savedQuote.services.apMount).toBe(2);
      expect(savedQuote.services.ethRelocation).toBe(1);
      expect(savedQuote.homeInfo.homeAge).toBe('2000-2020');
      expect(savedQuote.homeInfo.stories).toBe(2);
      expect(savedQuote.homeInfo.atticAccess).toBe('Walk-in attic');
      expect(savedQuote.homeInfo.hasMediaPanel).toBe(true);
      expect(savedQuote.homeInfo.mediaPanelLocation).toBe('Garage');
      expect(savedQuote.homeInfo.hasCrawlspaceOrBasement).toBe(true);
      expect(savedQuote.homeInfo.liabilityAcknowledged).toBe(true);
      expect(savedQuote.pricing.totalCost).toBe(670);
      expect(savedQuote.pricing.depositRequired).toBe(20);
    });

    test('should create a Whole-Home quote with all fields', async () => {
      const quoteData = {
        customer: {
          name: 'Jane Smith',
          email: 'jane@example.com',
          phone: '555-1234'
        },
        serviceType: 'Whole-Home',
        wholeHome: {
          scope: { networking: true, security: true, voip: false },
          internetSpeed: '1 Gig',
          hasOwnEquipment: false,
          networkingBrand: 'UniFi',
          securityBrand: 'Reolink',
          surveyPreference: 'before-install',
          notes: 'Two-story home, need full coverage'
        },
        homeInfo: {
          homeAge: '1980-2000',
          stories: 2,
          atticAccess: 'Scuttle hole',
          hasMediaPanel: false,
          hasCrawlspaceOrBasement: true,
          liabilityAcknowledged: true
        },
        pricing: {
          depositAmount: 200
        }
      };

      quoteData.quoteNumber = quoteData.quoteNumber || String(Math.floor(Math.random() * 90000000) + 10000000);
      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();

      expect(savedQuote.serviceType).toBe('Whole-Home');
      expect(savedQuote.wholeHome.scope.networking).toBe(true);
      expect(savedQuote.wholeHome.scope.security).toBe(true);
      expect(savedQuote.wholeHome.scope.voip).toBe(false);
      expect(savedQuote.wholeHome.internetSpeed).toBe('1 Gig');
      expect(savedQuote.wholeHome.hasOwnEquipment).toBe(false);
      expect(savedQuote.wholeHome.networkingBrand).toBe('UniFi');
      expect(savedQuote.wholeHome.securityBrand).toBe('Reolink');
      expect(savedQuote.wholeHome.surveyPreference).toBe('before-install');
      expect(savedQuote.wholeHome.notes).toBe('Two-story home, need full coverage');
      expect(savedQuote.pricing.depositAmount).toBe(200);
      expect(savedQuote.customer.phone).toBe('555-1234');
    });

    test('should create Whole-Home quote with own equipment', async () => {
      const quoteData = {
        customer: { name: 'Equipment Owner', email: 'equip@example.com' },
        serviceType: 'Whole-Home',
        wholeHome: {
          scope: { networking: true, security: false, voip: false },
          hasOwnEquipment: true,
          equipmentDescription: 'UniFi Dream Machine SE, 2x U7 Pro APs, USW-24-PoE switch'
        },
        homeInfo: {
          homeAge: '2020+',
          stories: 1,
          atticAccess: 'Walk-in attic',
          hasMediaPanel: true,
          mediaPanelLocation: 'Utility closet',
          hasCrawlspaceOrBasement: false,
          liabilityAcknowledged: true
        },
        pricing: { depositAmount: 200 }
      };

      quoteData.quoteNumber = quoteData.quoteNumber || String(Math.floor(Math.random() * 90000000) + 10000000);
      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();

      expect(savedQuote.wholeHome.hasOwnEquipment).toBe(true);
      expect(savedQuote.wholeHome.equipmentDescription).toBe('UniFi Dream Machine SE, 2x U7 Pro APs, USW-24-PoE switch');
    });

    test('should use default values for optional fields', async () => {
      const quoteData = {
        customer: {
          name: 'Default User',
          email: 'default@example.com'
        },
        serviceType: 'Drops Only'
      };

      quoteData.quoteNumber = quoteData.quoteNumber || String(Math.floor(Math.random() * 90000000) + 10000000);
      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();

      expect(savedQuote.discount).toBe(0);
      expect(savedQuote.runs.coax).toBe(0);
      expect(savedQuote.runs.cat6).toBe(0);
      expect(savedQuote.runs.fiber).toBe(0);
      expect(savedQuote.services.mediaPanel).toBe(0);
      expect(savedQuote.services.apMount).toBe(0);
      expect(savedQuote.services.ethRelocation).toBe(0);
    });

    test('should validate serviceType enum values', async () => {
      const quoteWithInvalid = new Quote({
        customer: { name: 'Test', email: 'test@example.com' },
        serviceType: 'InvalidType'
      });

      await expect(quoteWithInvalid.save()).rejects.toThrow();
    });

    test('should accept valid serviceType enum values', async () => {
      const dropsQuote = new Quote({
        customer: { name: 'Drops User', email: 'drops@example.com' },
        serviceType: 'Drops Only',
        quoteNumber: String(Math.floor(Math.random() * 90000000) + 10000000)
      });
      const wholeHomeQuote = new Quote({
        customer: { name: 'WH User', email: 'wh@example.com' },
        serviceType: 'Whole-Home',
        quoteNumber: String(Math.floor(Math.random() * 90000000) + 10000000)
      });

      const savedDrops = await dropsQuote.save();
      const savedWH = await wholeHomeQuote.save();

      expect(savedDrops.serviceType).toBe('Drops Only');
      expect(savedWH.serviceType).toBe('Whole-Home');
    });

    test('should require either serviceType or packageOption', async () => {
      const quote = new Quote({
        customer: { name: 'Test', email: 'test@example.com' }
      });

      await expect(quote.save()).rejects.toThrow();
    });

    test('should require customer name', async () => {
      const quote = new Quote({
        customer: { email: 'test@example.com' },
        serviceType: 'Drops Only'
      });

      await expect(quote.save()).rejects.toThrow();
    });

    test('should require customer email', async () => {
      const quote = new Quote({
        customer: { name: 'Test User' },
        serviceType: 'Drops Only'
      });

      await expect(quote.save()).rejects.toThrow();
    });

    test('should validate homeInfo enum values', async () => {
      const quote = new Quote({
        customer: { name: 'Test', email: 'test@example.com' },
        serviceType: 'Drops Only',
        homeInfo: {
          homeAge: 'Invalid Age',
          stories: 2,
          atticAccess: 'Walk-in attic',
          liabilityAcknowledged: true
        }
      });

      await expect(quote.save()).rejects.toThrow();
    });

    test('should validate wholeHome brand enums', async () => {
      const quote = new Quote({
        customer: { name: 'Test', email: 'test@example.com' },
        serviceType: 'Whole-Home',
        wholeHome: {
          scope: { networking: true },
          networkingBrand: 'InvalidBrand'
        }
      });

      await expect(quote.save()).rejects.toThrow();
    });

    test('backward compat: should still accept old packageOption quotes', async () => {
      const quoteData = {
        customer: { name: 'Legacy User', email: 'legacy@example.com' },
        packageOption: 'Basic',
        runs: { coax: 1, cat6: 1 },
        pricing: { totalCost: 200, depositRequired: 20 }
      };

      quoteData.quoteNumber = quoteData.quoteNumber || String(Math.floor(Math.random() * 90000000) + 10000000);
      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();

      expect(savedQuote.packageOption).toBe('Basic');
      expect(savedQuote.serviceType).toBeUndefined();
    });

    test('should save centralization field', async () => {
      const quoteData = {
        customer: { name: 'Central User', email: 'central@example.com' },
        serviceType: 'Drops Only',
        centralization: 'Patch Panel',
        quoteNumber: String(Math.floor(Math.random() * 90000000) + 10000000)
      };

      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();
      expect(savedQuote.centralization).toBe('Patch Panel');
    });

    test('should validate centralization enum values', async () => {
      const quote = new Quote({
        customer: { name: 'Test', email: 'test@example.com' },
        serviceType: 'Drops Only',
        centralization: 'Invalid Type',
        quoteNumber: String(Math.floor(Math.random() * 90000000) + 10000000)
      });

      await expect(quote.save()).rejects.toThrow();
    });

    test('should allow null centralization for backward compat', async () => {
      const quoteData = {
        customer: { name: 'Legacy Central', email: 'legacycentral@example.com' },
        serviceType: 'Drops Only',
        quoteNumber: String(Math.floor(Math.random() * 90000000) + 10000000)
      };

      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();
      expect(savedQuote.centralization).toBeUndefined();
    });

    test('getDisplayServiceType helper works for new and legacy quotes', async () => {
      const newQuote = new Quote({
        customer: { name: 'New', email: 'new@example.com' },
        serviceType: 'Drops Only',
        quoteNumber: String(Math.floor(Math.random() * 90000000) + 10000000)
      });
      await newQuote.save();

      const legacyQuote = new Quote({
        customer: { name: 'Old', email: 'old@example.com' },
        packageOption: 'Premium',
        quoteNumber: String(Math.floor(Math.random() * 90000000) + 10000000)
      });
      await legacyQuote.save();

      expect(newQuote.getDisplayServiceType()).toBe('Drops Only');
      expect(legacyQuote.getDisplayServiceType()).toBe('Premium (Legacy)');
    });
  });

  describe('Schedule Model', () => {
    test('should create a schedule entry', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      while (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
        futureDate.setDate(futureDate.getDate() + 1);
      }

      const scheduleData = {
        name: 'John Doe',
        email: 'john@example.com',
        date: futureDate,
        time: '10:00',
        quoteNumber: String(Math.floor(Math.random() * 90000000) + 10000000),
        quoteId: new mongoose.Types.ObjectId()
      };

      const schedule = new Schedule(scheduleData);
      const savedSchedule = await schedule.save();

      expect(savedSchedule._id).toBeDefined();
      expect(savedSchedule.name).toBe('John Doe');
      expect(savedSchedule.email).toBe('john@example.com');
      expect(savedSchedule.date.toDateString()).toEqual(futureDate.toDateString());
      expect(savedSchedule.time).toBe('10:00');
    });

    test('should reject past dates', async () => {
      const pastDate = new Date('2020-01-01');

      const scheduleData = {
        name: 'John Doe',
        email: 'john@example.com',
        date: pastDate,
        time: '10:00'
      };

      const schedule = new Schedule(scheduleData);
      await expect(schedule.save()).rejects.toThrow('Appointment date cannot be in the past');
    });

    test('should validate time format', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const scheduleData = {
        name: 'John Doe',
        email: 'john@example.com',
        date: futureDate,
        time: '25:00'
      };

      const schedule = new Schedule(scheduleData);
      await expect(schedule.save()).rejects.toThrow('Time must be in HH:MM format');
    });

    test('should validate email format', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const scheduleData = {
        name: 'John Doe',
        email: 'invalid-email',
        date: futureDate,
        time: '10:00'
      };

      const schedule = new Schedule(scheduleData);
      await expect(schedule.save()).rejects.toThrow('Please enter a valid email address');
    });
  });

  describe('Testimonial Model', () => {
    test('should create a testimonial', async () => {
      const testimonialData = {
        name: 'Happy Customer',
        message: 'Excellent service and professional work!',
        rating: 5
      };

      const testimonial = new Testimonial(testimonialData);
      const savedTestimonial = await testimonial.save();

      expect(savedTestimonial._id).toBeDefined();
      expect(savedTestimonial.name).toBe('Happy Customer');
      expect(savedTestimonial.message).toBe('Excellent service and professional work!');
      expect(savedTestimonial.rating).toBe(5);
    });
  });
});
