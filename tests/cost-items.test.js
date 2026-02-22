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

    test('should return pricing map via getPricingMap with new fields', async () => {
      await CostItem.create([
        { code: 'CAT6-RUN', name: 'Cat6 Cable Run', category: 'Cable Runs', unitType: 'per-run', costUnitType: 'per-foot', unitLabel: 'per run', price: 100, materialCost: 25, laborCost: 40, isActive: true },
        { code: 'AP-MOUNT', name: 'Access Point Mount', category: 'Services', unitType: 'per-unit', unitLabel: 'per mount', price: 25, isActive: true },
        { code: 'DISABLED', name: 'Disabled', category: 'Services', unitType: 'per-unit', price: 10, isActive: false }
      ]);

      const map = await CostItem.getPricingMap();

      expect(map['CAT6-RUN']).toBeDefined();
      expect(map['CAT6-RUN'].price).toBe(100);
      expect(map['CAT6-RUN'].unitType).toBe('per-run');
      expect(map['CAT6-RUN'].costUnitType).toBe('per-foot');
      expect(map['CAT6-RUN'].materialCost).toBe(25);
      expect(map['CAT6-RUN'].laborCost).toBe(40);
      expect(map['CAT6-RUN'].cost).toBe(65);
      expect(map['AP-MOUNT']).toBeDefined();
      expect(map['AP-MOUNT'].price).toBe(25);
      expect(map['AP-MOUNT'].costUnitType).toBeNull();
      expect(map['DISABLED']).toBeUndefined();
    });

    // New model tests for costUnitType
    test('should accept valid costUnitType values', async () => {
      const item = await CostItem.create({
        code: 'COST-UNIT-TEST',
        name: 'Cost Unit Test',
        category: 'Cable Runs',
        unitType: 'per-run',
        costUnitType: 'per-foot',
        price: 100
      });

      expect(item.costUnitType).toBe('per-foot');
    });

    test('should reject invalid costUnitType values', async () => {
      await expect(CostItem.create({
        code: 'BAD-COST-UNIT',
        name: 'Bad Cost Unit',
        category: 'Services',
        unitType: 'per-unit',
        costUnitType: 'per-galaxy',
        price: 10
      })).rejects.toThrow(/is not a valid cost unit type/);
    });

    test('should default costUnitType to null', async () => {
      const item = await CostItem.create({
        code: 'NULL-COST-UNIT',
        name: 'Null Cost Unit',
        category: 'Services',
        unitType: 'per-unit',
        price: 10
      });

      expect(item.costUnitType).toBeNull();
    });

    // purchaseUrl tests
    test('should accept valid purchaseUrl', async () => {
      const item = await CostItem.create({
        code: 'URL-TEST',
        name: 'URL Test',
        category: 'Equipment',
        unitType: 'per-unit',
        price: 10,
        purchaseUrl: 'https://example.com/product'
      });

      expect(item.purchaseUrl).toBe('https://example.com/product');
    });

    test('should accept http purchaseUrl', async () => {
      const item = await CostItem.create({
        code: 'HTTP-URL-TEST',
        name: 'HTTP URL Test',
        category: 'Equipment',
        unitType: 'per-unit',
        price: 10,
        purchaseUrl: 'http://example.com/product'
      });

      expect(item.purchaseUrl).toBe('http://example.com/product');
    });

    test('should reject invalid purchaseUrl', async () => {
      await expect(CostItem.create({
        code: 'BAD-URL',
        name: 'Bad URL',
        category: 'Equipment',
        unitType: 'per-unit',
        price: 10,
        purchaseUrl: 'ftp://example.com/file'
      })).rejects.toThrow(/Purchase URL must be a valid http or https URL/);
    });

    test('should allow empty purchaseUrl', async () => {
      const item = await CostItem.create({
        code: 'NO-URL',
        name: 'No URL',
        category: 'Equipment',
        unitType: 'per-unit',
        price: 10
      });

      expect(item.purchaseUrl).toBeUndefined();
    });

    // materialCost / laborCost tests
    test('should reject negative materialCost', async () => {
      await expect(CostItem.create({
        code: 'NEG-MAT',
        name: 'Negative Material',
        category: 'Services',
        unitType: 'per-unit',
        price: 10,
        materialCost: -5
      })).rejects.toThrow(/Material cost cannot be negative/);
    });

    test('should reject negative laborCost', async () => {
      await expect(CostItem.create({
        code: 'NEG-LAB',
        name: 'Negative Labor',
        category: 'Services',
        unitType: 'per-unit',
        price: 10,
        laborCost: -3
      })).rejects.toThrow(/Labor cost cannot be negative/);
    });

    // Virtual cost getter
    test('should compute virtual cost as materialCost + laborCost', async () => {
      const item = await CostItem.create({
        code: 'VIRTUAL-COST',
        name: 'Virtual Cost',
        category: 'Services',
        unitType: 'per-unit',
        price: 100,
        materialCost: 25,
        laborCost: 40
      });

      expect(item.cost).toBe(65);
    });

    test('should compute virtual cost when only materialCost set', async () => {
      const item = await CostItem.create({
        code: 'MAT-ONLY',
        name: 'Material Only',
        category: 'Services',
        unitType: 'per-unit',
        price: 50,
        materialCost: 20
      });

      expect(item.cost).toBe(20);
    });

    test('should compute virtual cost when only laborCost set', async () => {
      const item = await CostItem.create({
        code: 'LAB-ONLY',
        name: 'Labor Only',
        category: 'Services',
        unitType: 'per-unit',
        price: 50,
        laborCost: 15
      });

      expect(item.cost).toBe(15);
    });

    test('should compute virtual cost as 0 when neither set', async () => {
      const item = await CostItem.create({
        code: 'NO-COST',
        name: 'No Cost',
        category: 'Services',
        unitType: 'per-unit',
        price: 50
      });

      expect(item.cost).toBe(0);
    });

    test('should include virtual cost in toJSON', async () => {
      const item = await CostItem.create({
        code: 'JSON-COST',
        name: 'JSON Cost',
        category: 'Services',
        unitType: 'per-unit',
        price: 100,
        materialCost: 30,
        laborCost: 20
      });

      const json = item.toJSON();
      expect(json.cost).toBe(50);
    });

    // BOM tests
    test('should create item with BOM references', async () => {
      const comp = await CostItem.create({
        code: 'BOM-COMP',
        name: 'BOM Component',
        category: 'Equipment',
        unitType: 'per-unit',
        price: 5
      });

      const parent = await CostItem.create({
        code: 'BOM-PARENT',
        name: 'BOM Parent',
        category: 'Cable Runs',
        unitType: 'per-run',
        price: 100,
        billOfMaterials: [{ item: comp._id, quantity: 2 }]
      });

      expect(parent.billOfMaterials).toHaveLength(1);
      expect(parent.billOfMaterials[0].item.toString()).toBe(comp._id.toString());
      expect(parent.billOfMaterials[0].quantity).toBe(2);
    });

    test('should prevent self-referencing BOM entries', async () => {
      const item = new CostItem({
        code: 'SELF-REF',
        name: 'Self Reference',
        category: 'Services',
        unitType: 'per-unit',
        price: 10
      });

      // Set BOM to reference itself
      item.billOfMaterials = [{ item: item._id, quantity: 1 }];

      await expect(item.save()).rejects.toThrow(/Bill of materials cannot reference itself/);
    });

    test('should prevent duplicate BOM items', async () => {
      const comp = await CostItem.create({
        code: 'DUP-BOM-COMP',
        name: 'Dup BOM Component',
        category: 'Equipment',
        unitType: 'per-unit',
        price: 5
      });

      const item = new CostItem({
        code: 'DUP-BOM-PARENT',
        name: 'Dup BOM Parent',
        category: 'Cable Runs',
        unitType: 'per-run',
        price: 100,
        billOfMaterials: [
          { item: comp._id, quantity: 2 },
          { item: comp._id, quantity: 3 }
        ]
      });

      await expect(item.save()).rejects.toThrow(/Bill of materials cannot contain duplicate items/);
    });

    test('should reject BOM quantity less than 1', async () => {
      const comp = await CostItem.create({
        code: 'QTY-COMP',
        name: 'Qty Component',
        category: 'Equipment',
        unitType: 'per-unit',
        price: 5
      });

      await expect(CostItem.create({
        code: 'QTY-PARENT',
        name: 'Qty Parent',
        category: 'Cable Runs',
        unitType: 'per-run',
        price: 100,
        billOfMaterials: [{ item: comp._id, quantity: 0 }]
      })).rejects.toThrow(/BOM quantity must be at least 1/);
    });

    test('should allow multiple BOM entries with different items', async () => {
      const comp1 = await CostItem.create({
        code: 'MULTI-COMP1',
        name: 'Multi Component 1',
        category: 'Equipment',
        unitType: 'per-unit',
        price: 5
      });
      const comp2 = await CostItem.create({
        code: 'MULTI-COMP2',
        name: 'Multi Component 2',
        category: 'Equipment',
        unitType: 'per-unit',
        price: 3
      });

      const parent = await CostItem.create({
        code: 'MULTI-PARENT',
        name: 'Multi Parent',
        category: 'Cable Runs',
        unitType: 'per-run',
        price: 100,
        billOfMaterials: [
          { item: comp1._id, quantity: 2 },
          { item: comp2._id, quantity: 1 }
        ]
      });

      expect(parent.billOfMaterials).toHaveLength(2);
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

      test('should display material cost and labor cost columns', async () => {
        await CostItem.create({
          code: 'COST-COLS',
          name: 'Cost Columns Test',
          category: 'Services',
          unitType: 'per-unit',
          price: 100,
          materialCost: 25,
          laborCost: 40
        });

        const response = await adminAgent.get('/admin/cost-items');

        expect(response.status).toBe(200);
        expect(response.text).toMatch(/Material Cost/);
        expect(response.text).toMatch(/Labor Cost/);
        expect(response.text).toMatch(/\$25\.00/);
        expect(response.text).toMatch(/\$40\.00/);
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

      test('should create item with all new fields', async () => {
        const comp = await CostItem.create({
          code: 'BOM-COMP-RT',
          name: 'BOM Component',
          category: 'Equipment',
          unitType: 'per-unit',
          price: 5
        });

        const response = await adminAgent
          .post('/admin/cost-items')
          .send({
            code: 'FULL-ITEM',
            name: 'Full Item',
            category: 'Cable Runs',
            unitType: 'per-run',
            costUnitType: 'per-foot',
            unitLabel: 'per run',
            price: 100,
            materialCost: 25,
            laborCost: 40,
            purchaseUrl: 'https://example.com/cable',
            billOfMaterials: [{ item: comp._id.toString(), quantity: 2 }]
          });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);

        const item = await CostItem.findOne({ code: 'FULL-ITEM' });
        expect(item.costUnitType).toBe('per-foot');
        expect(item.materialCost).toBe(25);
        expect(item.laborCost).toBe(40);
        expect(item.purchaseUrl).toBe('https://example.com/cable');
        expect(item.billOfMaterials).toHaveLength(1);
        expect(item.billOfMaterials[0].quantity).toBe(2);
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

      test('should reject non-existent BOM item IDs', async () => {
        const fakeId = new mongoose.Types.ObjectId();
        const response = await adminAgent
          .post('/admin/cost-items')
          .send({
            code: 'BAD-BOM',
            name: 'Bad BOM',
            category: 'Cable Runs',
            unitType: 'per-run',
            price: 100,
            billOfMaterials: [{ item: fakeId.toString(), quantity: 1 }]
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/BOM item not found/);
      });
    });

    describe('POST /admin/cost-items/seed', () => {

      test('should seed default items for superadmin', async () => {
        const response = await superAdminAgent
          .post('/admin/cost-items/seed');

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.created).toBe(13);
        expect(response.body.skipped).toBe(0);

        const count = await CostItem.countDocuments();
        expect(count).toBe(13);

        // Verify cable runs have costUnitType
        const cat6 = await CostItem.findOne({ code: 'CAT6-RUN' });
        expect(cat6.costUnitType).toBe('per-foot');
        expect(cat6.materialCost).toBe(25);
        expect(cat6.laborCost).toBe(40);

        // Verify component items exist
        const rj45 = await CostItem.findOne({ code: 'RJ45-CONNECTOR' });
        expect(rj45).not.toBeNull();
        expect(rj45.category).toBe('Equipment');

        // Verify BOM wired up
        const cat6WithBom = await CostItem.findOne({ code: 'CAT6-RUN' });
        expect(cat6WithBom.billOfMaterials.length).toBeGreaterThan(0);
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
        expect(response.body.created).toBe(12);
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

      test('should update with all new fields', async () => {
        const item = await CostItem.create({
          code: 'UPD-FULL',
          name: 'Update Full',
          category: 'Cable Runs',
          unitType: 'per-run',
          price: 100
        });

        const comp = await CostItem.create({
          code: 'UPD-COMP',
          name: 'Update Component',
          category: 'Equipment',
          unitType: 'per-unit',
          price: 5
        });

        const response = await adminAgent
          .put(`/admin/cost-items/${item._id}`)
          .send({
            costUnitType: 'per-foot',
            materialCost: 30,
            laborCost: 50,
            purchaseUrl: 'https://example.com/updated',
            billOfMaterials: [{ item: comp._id.toString(), quantity: 3 }]
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const updated = await CostItem.findById(item._id);
        expect(updated.costUnitType).toBe('per-foot');
        expect(updated.materialCost).toBe(30);
        expect(updated.laborCost).toBe(50);
        expect(updated.purchaseUrl).toBe('https://example.com/updated');
        expect(updated.billOfMaterials).toHaveLength(1);
        expect(updated.billOfMaterials[0].quantity).toBe(3);
      });

      test('should reject non-existent BOM item IDs on update', async () => {
        const item = await CostItem.create({
          code: 'UPD-BAD-BOM',
          name: 'Update Bad BOM',
          category: 'Cable Runs',
          unitType: 'per-run',
          price: 100
        });

        const fakeId = new mongoose.Types.ObjectId();
        const response = await adminAgent
          .put(`/admin/cost-items/${item._id}`)
          .send({
            billOfMaterials: [{ item: fakeId.toString(), quantity: 1 }]
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toMatch(/BOM item not found/);
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

    describe('GET /admin/cost-items/search', () => {

      test('should return matching items by code', async () => {
        await CostItem.create([
          { code: 'RJ45-CONN', name: 'RJ45 Connector', category: 'Equipment', unitType: 'per-unit', price: 2 },
          { code: 'KEYSTONE', name: 'Keystone Jack', category: 'Equipment', unitType: 'per-unit', price: 5 }
        ]);

        const response = await adminAgent.get('/admin/cost-items/search?q=rj45');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].code).toBe('RJ45-CONN');
        expect(response.body[0].name).toBe('RJ45 Connector');
        expect(response.body[0].price).toBe(2);
      });

      test('should return matching items by name', async () => {
        await CostItem.create([
          { code: 'RJ45-CONN', name: 'RJ45 Connector', category: 'Equipment', unitType: 'per-unit', price: 2 },
          { code: 'KEYSTONE', name: 'Keystone Jack', category: 'Equipment', unitType: 'per-unit', price: 5 }
        ]);

        const response = await adminAgent.get('/admin/cost-items/search?q=keystone');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].code).toBe('KEYSTONE');
      });

      test('should exclude specified item ID', async () => {
        const item1 = await CostItem.create({
          code: 'EXCL-1', name: 'Exclude 1', category: 'Equipment', unitType: 'per-unit', price: 2
        });
        await CostItem.create({
          code: 'EXCL-2', name: 'Exclude 2', category: 'Equipment', unitType: 'per-unit', price: 5
        });

        const response = await adminAgent.get(`/admin/cost-items/search?q=excl&exclude=${item1._id}`);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].code).toBe('EXCL-2');
      });

      test('should only return active items', async () => {
        await CostItem.create([
          { code: 'ACTIVE-SRCH', name: 'Active Search', category: 'Equipment', unitType: 'per-unit', price: 2, isActive: true },
          { code: 'INACTIVE-SRCH', name: 'Inactive Search', category: 'Equipment', unitType: 'per-unit', price: 5, isActive: false }
        ]);

        const response = await adminAgent.get('/admin/cost-items/search?q=srch');

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].code).toBe('ACTIVE-SRCH');
      });

      test('should return empty array for empty query', async () => {
        const response = await adminAgent.get('/admin/cost-items/search?q=');

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
      });

      test('should limit results to 20', async () => {
        const items = [];
        for (let i = 0; i < 25; i++) {
          items.push({
            code: `LIMIT-${String(i).padStart(2, '0')}`,
            name: `Limit Item ${i}`,
            category: 'Equipment',
            unitType: 'per-unit',
            price: i
          });
        }
        await CostItem.create(items);

        const response = await adminAgent.get('/admin/cost-items/search?q=limit');

        expect(response.status).toBe(200);
        expect(response.body.length).toBeLessThanOrEqual(20);
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
