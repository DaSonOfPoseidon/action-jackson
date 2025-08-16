const mongoose = require('mongoose');

const QuoteSchema = new mongoose.Schema({
  customer: {
    name:  { type: String, required: true },
    email: { type: String, required: true }
  },
  packageOption: { 
    type: String, 
    required: true,
    enum: ['Basic', 'Premium']
  },
  includeSurvey: { type: Boolean, default: false },
  speedTier: { 
    type: String,
    enum: ['1 Gig', '5 Gig', '10 Gig']
  },
  discount: { type: Number, default: 0 },

  runs: {
    coax: { type: Number, default: 0 },
    cat6: { type: Number, default: 0 }
  },

  services: {
    deviceMount:   { type: Number, default: 0 },
    networkSetup:  { type: Number, default: 0 },
    mediaPanel:    { type: Number, default: 0 }
  },

  equipment: [{
    sku: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 }
  }],

  // Package-specific pricing fields
  pricing: {
    // For Basic package
    totalCost: { type: Number },
    depositRequired: { type: Number },
    
    // For Premium package  
    estimatedLaborHours: { type: Number },
    laborRate: { type: Number, default: 50 },
    estimatedTotal: { type: Number },
    
    // Survey and equipment pricing
    surveyFee: { type: Number, default: 0 },
    equipmentTotal: { type: Number, default: 0 }
  },

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

// Update the updatedAt field before saving
QuoteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Quote', QuoteSchema);
