const express = require('express');
const router = express.Router();
const CostItem = require('../models/CostItem');
const Setting = require('../models/Setting');
const rateLimit = require('express-rate-limit');

// Rate limiting for cost items endpoint
const costItemsRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    error: 'Too many requests, please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  }
});

// GET /cost-items — active items grouped by category (excluding Deposits and $0 items)
router.get('/cost-items', costItemsRateLimit, async (req, res) => {
  try {
    const [items, settings] = await Promise.all([
      CostItem.getActiveByCategory(),
      Setting.getSettings()
    ]);

    const categories = {};

    for (const item of items) {
      // Exclude Deposits category and $0-priced items
      if (item.category === 'Deposits' || item.price === 0) continue;

      if (!categories[item.category]) {
        categories[item.category] = [];
      }

      categories[item.category].push({
        _id: item._id,
        code: item.code,
        name: item.name,
        description: item.description,
        category: item.category,
        unitType: item.unitType,
        unitLabel: item.unitLabel,
        price: item.price,
        sortOrder: item.sortOrder
      });
    }

    res.json({
      categories,
      laborRate: settings.laborRate
    });
  } catch (err) {
    console.error('Error fetching cost items:', err);
    res.status(500).json({ error: 'Failed to load cost items.' });
  }
});

module.exports = router;
