const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  // Reference to original quote (if created from quote)
  quoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
  
  // Customer information
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: true }
  },
  
  // Invoice details
  invoiceNumber: { type: String, unique: true }, // Will be auto-generated
  
  // Service information (can be from quote or standalone)
  packageOption: { 
    type: String, 
    enum: ['Basic', 'Premium', 'Custom'],
    default: 'Custom'
  },
  
  // Financial information
  amount: { type: Number, required: true, min: 0 },
  discount: { type: Number, default: 0, min: 0, max: 100 },
  finalAmount: { type: Number, required: true, min: 0 },
  
  // Invoice status and dates
  status: { 
    type: String, 
    enum: ['Draft', 'Sent', 'Paid', 'Overdue', 'Cancelled'],
    default: 'Draft' 
  },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  paidDate: { type: Date },
  
  // Service details
  serviceDescription: { type: String, required: true },
  
  // Optional detailed breakdown (from quote system)
  runs: {
    coax: { type: Number, default: 0 },
    cat6: { type: Number, default: 0 }
  },
  
  services: {
    deviceMount: { type: Number, default: 0 },
    networkSetup: { type: Number, default: 0 },
    mediaPanel: { type: Number, default: 0 }
  },
  
  equipment: [{
    sku: { type: String },
    name: { type: String },
    price: { type: Number, min: 0 },
    quantity: { type: Number, min: 1 }
  }],
  
  // Tracking
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-generate invoice number before saving
InvoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const count = await this.constructor.countDocuments() + 1;
    this.invoiceNumber = `INV-${year}-${count.toString().padStart(4, '0')}`;
  }
  
  // Auto-calculate final amount
  if (this.amount && this.discount >= 0) {
    this.finalAmount = this.amount * (1 - this.discount / 100);
  }
  
  this.updatedAt = Date.now();
  next();
});

// Static method to create invoice from quote
InvoiceSchema.statics.createFromQuote = async function(quote, additionalData = {}) {
  const invoiceData = {
    quoteId: quote._id,
    customer: quote.customer,
    packageOption: quote.packageOption,
    amount: quote.pricing.totalCost || quote.pricing.estimatedTotal || 0,
    discount: quote.discount || 0,
    runs: quote.runs,
    services: quote.services,
    equipment: quote.equipment,
    serviceDescription: `${quote.packageOption} Package Installation`,
    ...additionalData
  };
  
  return new this(invoiceData);
};

module.exports = mongoose.model('Invoice', InvoiceSchema);