const mongoose = require('mongoose');

const QuoteSchema = new mongoose.Schema({
  quoteNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  customer: {
    name:  { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String }
  },

  // New service type field (required for new quotes)
  serviceType: {
    type: String,
    enum: ['Drops Only', 'Whole-Home']
  },

  // Legacy field - kept for backward compatibility with old quotes
  packageOption: {
    type: String,
    enum: ['Basic', 'Premium']
  },

  discount: { type: Number, default: 0 },

  runs: {
    coax: { type: Number, default: 0 },
    cat6: { type: Number, default: 0 },
    fiber: { type: Number, default: 0 }
  },

  services: {
    mediaPanel:    { type: Number, default: 0 },
    apMount:       { type: Number, default: 0 },
    ethRelocation: { type: Number, default: 0 }
  },

  centralization: {
    type: String,
    enum: ['Media Panel', 'Loose Termination', 'Patch Panel']
  },

  // Whole-Home specific fields
  wholeHome: {
    scope: {
      networking: { type: Boolean, default: false },
      security:   { type: Boolean, default: false },
      voip:       { type: Boolean, default: false }
    },
    internetSpeed:        { type: String },
    hasOwnEquipment:      { type: Boolean },
    equipmentDescription: { type: String, maxlength: 2000 },
    networkingBrand: {
      type: String,
      enum: ['Omada', 'UniFi', 'Ruckus', 'No Preference']
    },
    securityBrand: {
      type: String,
      enum: ['UniFi', 'Reolink', 'No Preference']
    },
    surveyPreference: {
      type: String,
      enum: ['before-install', 'day-of']
    },
    networkingDetails: { type: String, maxlength: 2000 },
    securityDetails:   { type: String, maxlength: 2000 },
    voipDetails:       { type: String, maxlength: 2000 },
    notes: { type: String, maxlength: 2000 }
  },

  // Linked survey schedule (when booked inline during quote)
  surveyScheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule'
  },

  // Home info (both paths)
  homeInfo: {
    homeAge: {
      type: String,
      enum: ['Pre-1960', '1960-1980', '1980-2000', '2000-2020', '2020+']
    },
    stories: { type: Number, min: 1, max: 4 },
    atticAccess: {
      type: String,
      enum: ['Walk-in attic', 'Crawl space', 'Scuttle hole', 'No attic access']
    },
    hasMediaPanel:            { type: Boolean },
    mediaPanelLocation:       { type: String },
    hasCrawlspaceOrBasement:  { type: Boolean },
    liabilityAcknowledged:    { type: Boolean },
    address: {
      street: { type: String, maxlength: 200, trim: true },
      city:   { type: String, maxlength: 100, trim: true },
      state:  { type: String, maxlength: 2, uppercase: true, trim: true },
      zip:    { type: String, maxlength: 10, trim: true }
    }
  },

  // Pricing
  pricing: {
    totalCost:       { type: Number },
    depositRequired: { type: Number },
    depositAmount:   { type: Number }
  },

  // Legacy pricing fields (kept for old quotes)
  // estimatedLaborHours, laborRate, estimatedTotal, surveyFee, equipmentTotal
  // are no longer used for new quotes but may exist on old documents

  // File attachments
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attachment'
  }],

  // Admin management fields
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'approved', 'rejected', 'completed'],
    default: 'pending'
  },
  updatedBy: { type: String },
  adminNotes: { type: String, maxlength: 1000 },

  // Admin final quote amount for Whole-Home quotes
  finalQuoteAmount: { type: Number },

  // Invoice reference (when quote is converted to invoice)
  invoiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Invoice'
  },

  ip:        { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Validate that new quotes have serviceType OR old quotes have packageOption
QuoteSchema.pre('validate', function(next) {
  if (!this.serviceType && !this.packageOption) {
    this.invalidate('serviceType', 'Either serviceType or packageOption is required');
  }
  next();
});

// Generate unique 8-digit quote number
QuoteSchema.statics.generateQuoteNumber = async function() {
  let quoteNumber;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    // Generate 8-digit number (10000000 to 99999999)
    quoteNumber = Math.floor(Math.random() * 90000000) + 10000000;
    quoteNumber = quoteNumber.toString();

    // Check if this number already exists
    const existing = await this.findOne({ quoteNumber });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique quote number after multiple attempts');
  }

  return quoteNumber;
};

// Update the updatedAt field before saving
QuoteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Helper to get display-friendly service type (handles legacy quotes)
QuoteSchema.methods.getDisplayServiceType = function() {
  if (this.serviceType) return this.serviceType;
  if (this.packageOption) return `${this.packageOption} (Legacy)`;
  return 'Unknown';
};

module.exports = mongoose.model('Quote', QuoteSchema);
