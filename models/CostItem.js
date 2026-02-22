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

  // How pricing is calculated
  unitType: {
    type: String,
    required: [true, 'Unit type is required'],
    enum: {
      values: ['per-foot', 'per-run', 'per-unit', 'flat-fee', 'threshold'],
      message: '{VALUE} is not a valid unit type'
    }
  },

  // Display label (e.g. "per run", "per mount", "flat fee")
  unitLabel: {
    type: String,
    trim: true,
    maxlength: [50, 'Unit label cannot exceed 50 characters']
  },

  // Admin's actual cost (for margin tracking in future quote builder)
  cost: {
    type: Number,
    min: [0, 'Cost cannot be negative']
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

// Indexes
CostItemSchema.index({ category: 1, sortOrder: 1 });
CostItemSchema.index({ code: 1 }, { unique: true });
CostItemSchema.index({ isActive: 1, category: 1 });

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
    .sort({ category: 1, sortOrder: 1 })
    .exec();
};

/**
 * Get a code-keyed lookup object of all active items
 * (for future quote builder)
 */
CostItemSchema.statics.getPricingMap = async function() {
  const items = await this.find({ isActive: true }).exec();
  const map = {};
  for (const item of items) {
    map[item.code] = {
      name: item.name,
      category: item.category,
      unitType: item.unitType,
      unitLabel: item.unitLabel,
      price: item.price,
      cost: item.cost,
      thresholdAmount: item.thresholdAmount
    };
  }
  return map;
};

module.exports = mongoose.model('CostItem', CostItemSchema);
