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
    test('should create a quote with all fields', async () => {
      const quoteData = {
        customer: {
          name: 'John Doe',
          email: 'john@example.com'
        },
        packageOption: 'premium',
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
        ip: '192.168.1.100'
      };

      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();

      expect(savedQuote._id).toBeDefined();
      expect(savedQuote.customer.name).toBe('John Doe');
      expect(savedQuote.customer.email).toBe('john@example.com');
      expect(savedQuote.packageOption).toBe('premium');
      expect(savedQuote.discount).toBe(15);
      expect(savedQuote.runs.coax).toBe(5);
      expect(savedQuote.runs.cat6).toBe(8);
      expect(savedQuote.services.deviceMount).toBe(3);
      expect(savedQuote.ip).toBe('192.168.1.100');
      expect(savedQuote.createdAt).toBeDefined();
    });

    test('should use default values for optional fields', async () => {
      const quoteData = {
        customer: {
          name: 'Jane Smith',
          email: 'jane@example.com'
        },
        packageOption: 'basic'
      };

      const quote = new Quote(quoteData);
      const savedQuote = await quote.save();

      expect(savedQuote.discount).toBe(0);
      expect(savedQuote.runs.coax).toBe(0);
      expect(savedQuote.runs.cat6).toBe(0);
      expect(savedQuote.services.deviceMount).toBe(0);
      expect(savedQuote.services.networkSetup).toBe(0);
      expect(savedQuote.services.mediaPanel).toBe(0);
    });

    test('should require customer name', async () => {
      const quote = new Quote({
        customer: {
          email: 'test@example.com'
        },
        packageOption: 'basic'
      });

      await expect(quote.save()).rejects.toThrow();
    });

    test('should require customer email', async () => {
      const quote = new Quote({
        customer: {
          name: 'Test User'
        },
        packageOption: 'basic'
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
  });

  describe('Schedule Model', () => {
    test('should create a schedule entry', async () => {
      const scheduleData = {
        name: 'John Doe',
        email: 'john@example.com',
        date: new Date('2024-12-25'),
        time: '10:00'
      };

      const schedule = new Schedule(scheduleData);
      const savedSchedule = await schedule.save();

      expect(savedSchedule._id).toBeDefined();
      expect(savedSchedule.name).toBe('John Doe');
      expect(savedSchedule.email).toBe('john@example.com');
      expect(savedSchedule.date).toEqual(new Date('2024-12-25'));
      expect(savedSchedule.time).toBe('10:00');
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