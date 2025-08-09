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
    test('should create a quote with all fields including new package features', async () => {
      const quoteData = {
        customer: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        packageOption: 'Premium',
        includeSurvey: true,
        discount: 15,
        runs: {
          coax: 5,
          cat6: 8
        },
        services: {
          deviceMount: 3,
          networkSetup: 2,
          mediaPanel: 1
        },
        pricing: {
          estimatedLaborHours: 8.5,
          laborRate: 50,
          estimatedTotal: 495,
          surveyFee: 100
        },
        ip: '192.168.1.100'
      };

      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();

      expect(savedQuote._id).toBeDefined();
      expect(savedQuote.customer.name).toBe('John Doe');
      expect(savedQuote.customer.email).toBe('john@example.com');
      expect(savedQuote.packageOption).toBe('Premium');
      expect(savedQuote.includeSurvey).toBe(true);
      expect(savedQuote.discount).toBe(15);
      expect(savedQuote.runs.coax).toBe(5);
      expect(savedQuote.runs.cat6).toBe(8);
      expect(savedQuote.services.deviceMount).toBe(3);
      expect(savedQuote.pricing.estimatedLaborHours).toBe(8.5);
      expect(savedQuote.pricing.laborRate).toBe(50);
      expect(savedQuote.pricing.estimatedTotal).toBe(495);
      expect(savedQuote.pricing.surveyFee).toBe(100);
      expect(savedQuote.ip).toBe('192.168.1.100');
      expect(savedQuote.createdAt).toBeDefined();
    });

    test('should create Basic package quote with cost pricing', async () => {
      const quoteData = {
        customer: {
          name: 'Jane Smith',
          email: 'jane@example.com'
        },
        packageOption: 'Basic',
        includeSurvey: false,
        runs: { coax: 2, cat6: 3 },
        services: { deviceMount: 1, networkSetup: 1, mediaPanel: 0 },
        pricing: {
          totalCost: 530,
          depositRequired: 20,
          surveyFee: 0
        }
      };

      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();

      expect(savedQuote.packageOption).toBe('Basic');
      expect(savedQuote.includeSurvey).toBe(false);
      expect(savedQuote.pricing.totalCost).toBe(530);
      expect(savedQuote.pricing.depositRequired).toBe(20);
      expect(savedQuote.pricing.surveyFee).toBe(0);
    });

    test('should use default values for optional fields', async () => {
      const quoteData = {
        customer: {
          name: 'Default User',
          email: 'default@example.com'
        },
        packageOption: 'Basic'
      };

      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();

      expect(savedQuote.includeSurvey).toBe(false);
      expect(savedQuote.discount).toBe(0);
      expect(savedQuote.runs.coax).toBe(0);
      expect(savedQuote.runs.cat6).toBe(0);
      expect(savedQuote.services.deviceMount).toBe(0);
      expect(savedQuote.services.networkSetup).toBe(0);
      expect(savedQuote.services.mediaPanel).toBe(0);
    });

    test('should validate packageOption enum values', async () => {
      const quoteWithInvalidPackage = new Quote({
        customer: {
          name: 'Test User',
          email: 'test@example.com'
        },
        packageOption: 'InvalidPackage'
      });

      await expect(quoteWithInvalidPackage.save()).rejects.toThrow();
    });

    test('should accept valid packageOption enum values', async () => {
      const basicQuote = new Quote({
        customer: {
          name: 'Basic User',
          email: 'basic@example.com'
        },
        packageOption: 'Basic'
      });

      const premiumQuote = new Quote({
        customer: {
          name: 'Premium User',
          email: 'premium@example.com'
        },
        packageOption: 'Premium'
      });

      const savedBasic = await basicQuote.save();
      const savedPremium = await premiumQuote.save();

      expect(savedBasic.packageOption).toBe('Basic');
      expect(savedPremium.packageOption).toBe('Premium');
    });

    test('should handle survey pricing correctly', async () => {
      const quoteWithSurvey = new Quote({
        customer: {
          name: 'Survey User',
          email: 'survey@example.com'
        },
        packageOption: 'Basic',
        includeSurvey: true,
        pricing: {
          totalCost: 200,
          depositRequired: 0, // Survey waives deposit
          surveyFee: 100
        }
      });

      const savedQuote = await quoteWithSurvey.save();

      expect(savedQuote.includeSurvey).toBe(true);
      expect(savedQuote.pricing.depositRequired).toBe(0);
      expect(savedQuote.pricing.surveyFee).toBe(100);
    });

    test('should require customer name', async () => {
      const quote = new Quote({
        customer: {
          email: 'test@example.com'
        },
        packageOption: 'Basic'
      });

      await expect(quote.save()).rejects.toThrow();
    });

    test('should require customer email', async () => {
      const quote = new Quote({
        customer: {
          name: 'Test User'
        },
        packageOption: 'Basic'
      });

      await expect(quote.save()).rejects.toThrow();
    });

    test('should require packageOption', async () => {
      const quote = new Quote({
        customer: {
          name: 'Test User',
          email: 'test@example.com'
        }
      });

      await expect(quote.save()).rejects.toThrow();
    });

    test('should handle premium pricing fields correctly', async () => {
      const premiumQuote = new Quote({
        customer: {
          name: 'Premium Test',
          email: 'premium@example.com'
        },
        packageOption: 'Premium',
        includeSurvey: true,
        runs: { coax: 2, cat6: 2 },
        pricing: {
          estimatedLaborHours: 7,
          laborRate: 50,
          estimatedTotal: 420,
          surveyFee: 100
        }
      });

      const savedQuote = await premiumQuote.save();

      expect(savedQuote.pricing.estimatedLaborHours).toBe(7);
      expect(savedQuote.pricing.laborRate).toBe(50);
      expect(savedQuote.pricing.estimatedTotal).toBe(420);
      expect(savedQuote.pricing.surveyFee).toBe(100);
    });
  });

  describe('Schedule Model', () => {
    test('should create a schedule entry', async () => {
      // Use a future weekday date
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7); // Next week
      while (futureDate.getDay() === 0 || futureDate.getDay() === 6) {
        futureDate.setDate(futureDate.getDate() + 1); // Skip to weekday
      }
      
      const scheduleData = {
        name: 'John Doe',
        email: 'john@example.com',
        date: futureDate,
        time: '10:00'
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
        time: '25:00' // Invalid time
      };

      const schedule = new Schedule(scheduleData);
      await expect(schedule.save()).rejects.toThrow('Time must be in HH:MM format');
    });

    test('should validate email format', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      
      const scheduleData = {
        name: 'John Doe',
        email: 'invalid-email', // Invalid email
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