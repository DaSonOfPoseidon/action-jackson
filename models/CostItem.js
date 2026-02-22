const mongoose = require('mongoose');

const CostItemSchema = new mongoose.Schema({
  // Unique identifier (e.g. CAT6-RUN, AP-MOUNT)
  code: {
    type: String,
    required: [true, 'Code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9][A-Z0-9\-_]*$/, 'Code must be uppercase alphanumeric with hyphens/underscores']
  },

  // Human-readable name
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },

  // Optional detail text for admin reference
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },

  // Category grouping
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: {
      values: ['Cable Runs', 'Services', 'Centralization', 'Equipment', 'Deposits'],
      message: '{VALUE} is not a valid category'
    }
  },

  // How pricing is calculated (customer-facing)
  unitType: {
    type: String,
    required: [true, 'Unit type is required'],
    enum: {
      values: ['per-foot', 'per-run', 'per-unit', 'flat-fee', 'threshold'],
      message: '{VALUE} is not a valid unit type'
    }
  },

  // Internal cost unit type (when different from customer pricing unit)
  costUnitType: {
    type: String,
    enum: {
      values: [null, 'per-foot', 'per-run', 'per-unit', 'flat-fee', 'threshold'],
      message: '{VALUE} is not a valid cost unit type'
    },
    default: null
  },

  // Display label (e.g. "per run", "per mount", "flat fee")
  unitLabel: {
    type: String,
    trim: true,
    maxlength: [50, 'Unit label cannot exceed 50 characters']
  },

  // Material cost component
  materialCost: {
    type: Number,
    min: [0, 'Material cost cannot be negative']
  },

  // Labor hours component
  laborHours: {
    type: Number,
    min: [0, 'Labor hours cannot be negative']
  },

  // Customer-facing price
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },

  // For threshold-type items (e.g. deposit kicks in above $100)
  thresholdAmount: {
    type: Number,
    min: [0, 'Threshold amount cannot be negative']
  },

  // Purchase URL for materials
  purchaseUrl: {
    type: String,
    trim: true,
    maxlength: [2000, 'Purchase URL cannot exceed 2000 characters'],
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^https?:\/\/.+/.test(v);
      },
      message: 'Purchase URL must be a valid http or https URL'
    }
  },

  // Bill of materials - component items needed
  billOfMaterials: [{
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CostItem',
      required: [true, 'BOM item reference is required']
    },
    quantity: {
      type: Number,
      required: [true, 'BOM quantity is required'],
      min: [1, 'BOM quantity must be at least 1']
    }
  }],

  // Soft-disable toggle
  isActive: {
    type: Boolean,
    default: true
  },

  // Display ordering within category
  sortOrder: {
    type: Number,
    default: 0
  },

  // Audit fields
  createdBy: { type: String },
  updatedBy: { type: String },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Enable virtuals in JSON/Object output
CostItemSchema.set('toJSON', { virtuals: true });
CostItemSchema.set('toObject', { virtuals: true });

// Indexes
CostItemSchema.index({ category: 1, sortOrder: 1 });
CostItemSchema.index({ code: 1 }, { unique: true });
CostItemSchema.index({ isActive: 1, category: 1 });

// Pre-validate hook: prevent self-referencing and duplicate BOM entries
CostItemSchema.pre('validate', function(next) {
  if (this.billOfMaterials && this.billOfMaterials.length > 0) {
    const selfId = this._id ? this._id.toString() : null;
    const seen = new Set();

    for (const entry of this.billOfMaterials) {
      const itemId = entry.item ? entry.item.toString() : null;

      // Prevent self-reference
      if (selfId && itemId === selfId) {
        const err = new Error('Bill of materials cannot reference itself');
        err.name = 'ValidationError';
        return next(err);
      }

      // Prevent duplicates
      if (itemId && seen.has(itemId)) {
        const err = new Error('Bill of materials cannot contain duplicate items');
        err.name = 'ValidationError';
        return next(err);
      }

      if (itemId) seen.add(itemId);
    }
  }

  next();
});

// Update timestamp on save
CostItemSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

/**
 * Get all active items sorted by category + sortOrder
 * (for future estimate engine)
 */
CostItemSchema.statics.getActiveByCategory = async function() {
  return this.find({ isActive: true })
    .populate('billOfMaterials.item', 'code name price')
    .sort({ category: 1, sortOrder: 1 })
    .exec();
};

/**
 * Get a code-keyed lookup object of all active items
 * (for future quote builder)
 * @param {number} laborRate - hourly labor rate for computing laborCost and cost
 */
CostItemSchema.statics.getPricingMap = async function(laborRate) {
  const rate = laborRate != null ? laborRate : 50;
  const items = await this.find({ isActive: true }).exec();
  const map = {};
  for (const item of items) {
    const computedLaborCost = (item.laborHours || 0) * rate;
    const mat = item.materialCost || 0;
    map[item.code] = {
      name: item.name,
      category: item.category,
      unitType: item.unitType,
      costUnitType: item.costUnitType,
      unitLabel: item.unitLabel,
      price: item.price,
      materialCost: item.materialCost,
      laborHours: item.laborHours,
      laborCost: computedLaborCost,
      cost: mat + computedLaborCost,
      purchaseUrl: item.purchaseUrl,
      billOfMaterials: item.billOfMaterials,
      thresholdAmount: item.thresholdAmount
    };
  }
  return map;
};

module.exports = mongoose.model('CostItem', CostItemSchema);
