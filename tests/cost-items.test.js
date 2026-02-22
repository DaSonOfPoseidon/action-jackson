const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../server');
const Admin = require('../models/Admin');
const CostItem = require('../models/CostItem');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  await mongoose.disconnect();
  await mongoose.connect(mongoUri);

  process.env.ADMIN_JWT_SECRET = 'test-jwt-secret-for-testing-only-64-character-string-here';
  process.env.ADMIN_SESSION_SECRET = 'test-session-secret-for-testing-only-64-character-string';
  process.env.NODE_ENV = 'test';
  process.env.EMAIL_USER = 'test@example.com';
  process.env.EMAIL_PASS = 'testpass';
  process.env.ADMIN_EMAIL = 'admin@example.com';
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
});

beforeEach(async () => {
  await Admin.deleteMany({});
  await CostItem.deleteMany({});
  await new Promise(resolve => setTimeout(resolve, 100));
});

describe('Cost Item System Tests', () => {

  // ============================================================
  // Model Tests
  // ============================================================
  describe('CostItem Model', () => {

    test('should create a valid cost item with required fields', async () => {
      const item = await CostItem.create({
        code: 'TEST-ITEM',
        name: 'Test Item',
        category: 'Services',
        unitType: 'per-unit',
        price: 50
      });

      expect(item.code).toBe('TEST-ITEM');
      expect(item.name).toBe('Test Item');
      expect(item.category).toBe('Services');
      expect(item.unitType).toBe('per-unit');
      expect(item.price).toBe(50);
      expect(item.isActive).toBe(true);
      expect(item.sortOrder).toBe(0);
    });

    test('should require code field', async () => {
      await expect(CostItem.create({
        name: 'No Code',
        category: 'Services',
        unitType: 'per-unit',
        price: 10
      })).rejects.toThrow(/Code is required/);
    });

    test('should require name field', async () => {
      await expect(CostItem.create({
        code: 'NO-NAME',
        category: 'Services',
        unitType: 'per-unit',
        price: 10
      })).rejects.toThrow(/Name is required/);
    });

    test('should require category field', async () => {
      await expect(CostItem.create({
        code: 'NO-CAT',
        name: 'No Category',
        unitType: 'per-unit',
        price: 10
      })).rejects.toThrow(/Category is required/);
    });

    test('should require price field', async () => {
      await expect(CostItem.create({
        code: 'NO-PRICE',
        name: 'No Price',
        category: 'Services',
        unitType: 'per-unit'
      })).rejects.toThrow(/Price is required/);
    });

    test('should enforce unique code', async () => {
      await CostItem.create({
        code: 'UNIQUE-CODE',
        name: 'First',
        category: 'Services',
        unitType: 'per-unit',
        price: 10
      });

      await expect(CostItem.create({
        code: 'UNIQUE-CODE',
        name: 'Second',
        category: 'Equipment',
        unitType: 'flat-fee',
        price: 20
      })).rejects.toThrow();
    });

    test('should reject invalid category', async () => {
      await expect(CostItem.create({
        code: 'BAD-CAT',
        name: 'Bad Category',
        category: 'InvalidCategory',
        unitType: 'per-unit',
        price: 10
      })).rejects.toThrow(/is not a valid category/);
    });

    test('should reject invalid unitType', async () => {
      await expect(CostItem.create({
        code: 'BAD-UNIT',
        name: 'Bad Unit',
        category: 'Services',
        unitType: 'per-galaxy',
        price: 10
      })).rejects.toThrow(/is not a valid unit type/);
    });

    test('should reject negative price', async () => {
      await expect(CostItem.create({
        code: 'NEG-PRICE',
        name: 'Negative Price',
        category: 'Services',
        unitType: 'per-unit',
        price: -5
      })).rejects.toThrow(/Price cannot be negative/);
    });

    test('should uppercase code on save', async () => {
      const item = await CostItem.create({
        code: 'lower-case',
        name: 'Lowercase Code',
        category: 'Services',
        unitType: 'per-unit',
        price: 10
      });

      expect(item.code).toBe('LOWER-CASE');
    });

    test('should return active items by category via getActiveByCategory', async () => {
      await CostItem.create([
        { code: 'A-1', name: 'A First', category: 'Cable Runs', unitType: 'per-run', price: 100, sortOrder: 0, isActive: true },
        { code: 'B-1', name: 'B First', category: 'Services', unitType: 'per-unit', price: 25, sortOrder: 0, isActive: true },
        { code: 'A-2', name: 'A Second', category: 'Cable Runs', unitType: 'per-run', price: 150, sortOrder: 1, isActive: true },
        { code: 'INACTIVE', name: 'Inactive', category: 'Cable Runs', unitType: 'per-run', price: 50, sortOrder: 2, isActive: false }
      ]);

      const items = await CostItem.getActiveByCategory();

      expect(items).toHaveLength(3);
      expect(items[0].code).toBe('A-1');
      expect(items[1].code).toBe('A-2');
      expect(items[2].code).toBe('B-1');
    });

    test('should return pricing map via getPricingMap', async () => {
      await CostItem.create([
        { code: 'CAT6-RUN', name: 'Cat6 Cable Run', category: 'Cable Runs', unitType: 'per-run', unitLabel: 'per run', price: 100, isActive: true },
        { code: 'AP-MOUNT', name: 'Access Point Mount', category: 'Services', unitType: 'per-unit', unitLabel: 'per mount', price: 25, isActive: true },
        { code: 'DISABLED', name: 'Disabled', category: 'Services', unitType: 'per-unit', price: 10, isActive: false }
      ]);

      const map = await CostItem.getPricingMap();

      expect(map['CAT6-RUN']).toBeDefined();
      expect(map['CAT6-RUN'].price).toBe(100);
      expect(map['CAT6-RUN'].unitType).toBe('per-run');
      expect(map['AP-MOUNT']).toBeDefined();
      expect(map['AP-MOUNT'].price).toBe(25);
      expect(map['DISABLED']).toBeUndefined();
    });
  });

  // ============================================================
  // Route Tests
  // ============================================================
  describe('Cost Item Routes', () => {
    let adminAgent;
    let superAdminAgent;

    beforeEach(async () => {
      await Admin.createAdmin({
        username: 'testadmin',
        password: 'SecurePassword123!',
        role: 'admin'
      });

      adminAgent = request.agent(app);
      await adminAgent
        .post('/auth/login')
        .send({
          username: 'testadmin',
          password: 'SecurePassword123!',
          rememberMe: false
        });

      await Admin.createAdmin({
        username: 'superadmin',
        password: 'SuperSecure123!',
        role: 'superadmin'
      });

      superAdminAgent = request.agent(app);
      await superAdminAgent
        .post('/auth/login')
        .send({
          username: 'superadmin',
          password: 'SuperSecure123!',
          rememberMe: false
        });
    });

    describe('GET /admin/cost-items', () => {

      test('should render cost items page for authenticated admin', async () => {
        const response = await adminAgent.get('/admin/cost-items');

        expect(response.status).toBe(200);
        expect(response.text).toMatch(/Cost Item Management/);
      });

      test('should redirect unauthenticated users to login', async () => {
        const response = await request(app).get('/admin/cost-items');

        expect(response.status).toBe(302);
        expect(response.headers.location).toMatch(/\/admin\/login/);
      });

      test('should display cost items in table', async () => {
        await CostItem.create({
          code: 'CAT6-RUN',
          name: 'Cat6 Cable Run',
          category: 'Cable Runs',
          unitType: 'per-run',
          price: 100
        });

        const response = await adminAgent.get('/admin/cost-items');

        expect(response.status).toBe(200);
        expect(response.text).toMatch(/CAT6-RUN/);
        expect(response.text).toMatch(/Cat6 Cable Run/);
      });

      test('should filter by category', async () => {
        await CostItem.create([
          { code: 'CAT6', name: 'Cat6', category: 'Cable Runs', unitType: 'per-run', price: 100 },
          { code: 'AP', name: 'AP Mount', category: 'Services', unitType: 'per-unit', price: 25 }
        ]);

        const response = await adminAgent.get('/admin/cost-items?category=Cable Runs');

        expect(response.status).toBe(200);
        expect(response.text).toMatch(/CAT6/);
        expect(response.text).not.toMatch(/>AP</);
      });

      test('should filter by search term', async () => {
        await CostItem.create([
          { code: 'CAT6-RUN', name: 'Cat6 Cable Run', category: 'Cable Runs', unitType: 'per-run', price: 100 },
          { code: 'AP-MOUNT', name: 'Access Point Mount', category: 'Services', unitType: 'per-unit', price: 25 }
        ]);

        const response = await adminAgent.get('/admin/cost-items?search=cat6');

        expect(response.status).toBe(200);
        expect(response.text).toMatch(/CAT6-RUN/);
      });

      test('should filter by active status', async () => {
        await CostItem.create([
          { code: 'ACTIVE-ITEM', name: 'Active', category: 'Services', unitType: 'per-unit', price: 10, isActive: true },
          { code: 'INACTIVE-ITEM', name: 'Inactive', category: 'Services', unitType: 'per-unit', price: 20, isActive: false }
        ]);

        const response = await adminAgent.get('/admin/cost-items?status=active');

        expect(response.status).toBe(200);
        expect(response.text).toMatch(/ACTIVE-ITEM/);
        expect(response.text).not.toMatch(/INACTIVE-ITEM/);
      });

      test('should show empty state when no items exist', async () => {
        const response = await adminAgent.get('/admin/cost-items');

        expect(response.status).toBe(200);
        expect(response.text).toMatch(/No Cost Items Found/);
      });
    });

    describe('POST /admin/cost-items', () => {

      test('should create a new cost item', async () => {
        const response = await adminAgent
          .post('/admin/cost-items')
          .send({
            code: 'NEW-ITEM',
            name: 'New Item',
            category: 'Services',
            unitType: 'per-unit',
            unitLabel: 'per device',
            price: 35
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.costItem.code).toBe('NEW-ITEM');

        const item = await CostItem.findOne({ code: 'NEW-ITEM' });
        expect(item).not.toBeNull();
        expect(item.price).toBe(35);
        expect(item.createdBy).toBe('testadmin');
      });

      test('should reject missing required fields', async () => {
        const response = await adminAgent
          .post('/admin/cost-items')
          .send({
            name: 'Missing Code'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/Missing required fields/);
      });

      test('should reject duplicate code', async () => {
        await CostItem.create({
          code: 'DUP-CODE',
          name: 'Original',
          category: 'Services',
          unitType: 'per-unit',
          price: 10
        });

        const response = await adminAgent
          .post('/admin/cost-items')
          .send({
            code: 'DUP-CODE',
            name: 'Duplicate',
            category: 'Equipment',
            unitType: 'flat-fee',
            price: 20
          });

        expect(response.status).toBe(409);
        expect(response.body.error).toMatch(/already exists/);
      });
    });

    describe('POST /admin/cost-items/seed', () => {

      test('should seed default items for superadmin', async () => {
        const response = await superAdminAgent
          .post('/admin/cost-items/seed');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.created).toBe(10);
        expect(response.body.skipped).toBe(0);

        const count = await CostItem.countDocuments();
        expect(count).toBe(10);
      });

      test('should skip existing items on re-seed', async () => {
        await CostItem.create({
          code: 'CAT6-RUN',
          name: 'Existing Cat6',
          category: 'Cable Runs',
          unitType: 'per-run',
          price: 999
        });

        const response = await superAdminAgent
          .post('/admin/cost-items/seed');

        expect(response.status).toBe(200);
        expect(response.body.created).toBe(9);
        expect(response.body.skipped).toBe(1);

        // Original should not be overwritten
        const item = await CostItem.findOne({ code: 'CAT6-RUN' });
        expect(item.price).toBe(999);
      });

      test('should prevent regular admin from seeding', async () => {
        const response = await adminAgent
          .post('/admin/cost-items/seed');

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Insufficient privileges - superadmin required');
      });
    });

    describe('PUT /admin/cost-items/:id', () => {

      test('should update a cost item', async () => {
        const item = await CostItem.create({
          code: 'UPD-ITEM',
          name: 'Original Name',
          category: 'Services',
          unitType: 'per-unit',
          price: 30
        });

        const response = await adminAgent
          .put(`/admin/cost-items/${item._id}`)
          .send({
            name: 'Updated Name',
            price: 45
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const updated = await CostItem.findById(item._id);
        expect(updated.name).toBe('Updated Name');
        expect(updated.price).toBe(45);
        expect(updated.updatedBy).toBe('testadmin');
      });

      test('should return 404 for non-existent item', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const response = await adminAgent
          .put(`/admin/cost-items/${fakeId}`)
          .send({ name: 'Ghost' });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Cost item not found');
      });
    });

    describe('PUT /admin/cost-items/:id/toggle', () => {

      test('should toggle item from active to inactive', async () => {
        const item = await CostItem.create({
          code: 'TOGGLE-ITEM',
          name: 'Toggle Me',
          category: 'Services',
          unitType: 'per-unit',
          price: 10,
          isActive: true
        });

        const response = await adminAgent
          .put(`/admin/cost-items/${item._id}/toggle`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.costItem.isActive).toBe(false);

        const updated = await CostItem.findById(item._id);
        expect(updated.isActive).toBe(false);
      });

      test('should toggle item from inactive to active', async () => {
        const item = await CostItem.create({
          code: 'TOGGLE-BACK',
          name: 'Toggle Back',
          category: 'Services',
          unitType: 'per-unit',
          price: 10,
          isActive: false
        });

        const response = await adminAgent
          .put(`/admin/cost-items/${item._id}/toggle`);

        expect(response.status).toBe(200);
        expect(response.body.costItem.isActive).toBe(true);
      });

      test('should return 404 for non-existent item', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const response = await adminAgent
          .put(`/admin/cost-items/${fakeId}/toggle`);

        expect(response.status).toBe(404);
      });
    });

    describe('DELETE /admin/cost-items/:id', () => {

      test('should allow superadmin to delete', async () => {
        const item = await CostItem.create({
          code: 'DEL-ITEM',
          name: 'Delete Me',
          category: 'Services',
          unitType: 'per-unit',
          price: 10
        });

        const response = await superAdminAgent
          .delete(`/admin/cost-items/${item._id}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const deleted = await CostItem.findById(item._id);
        expect(deleted).toBeNull();
      });

      test('should prevent regular admin from deleting', async () => {
        const item = await CostItem.create({
          code: 'NO-DEL',
          name: 'Protected',
          category: 'Services',
          unitType: 'per-unit',
          price: 10
        });

        const response = await adminAgent
          .delete(`/admin/cost-items/${item._id}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe('Insufficient privileges - superadmin required');

        const stillExists = await CostItem.findById(item._id);
        expect(stillExists).not.toBeNull();
      });

      test('should return 404 for non-existent item', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const response = await superAdminAgent
          .delete(`/admin/cost-items/${fakeId}`);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Cost item not found');
      });
    });
  });
});
