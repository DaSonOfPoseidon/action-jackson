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

  // File attachments
  attachments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Attachment'
  }],
  
  // Tracking
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Auto-generate invoice number before saving
InvoiceSchema.pre('save', async function(next) {
  if (!this.invoiceNumber) {
    try {
      const year = new Date().getFullYear();
      
      // Use atomic findOneAndUpdate to get next invoice number safely
      let counter = 1;
      let invoiceNumber;
      let attempts = 0;
      const maxAttempts = 10;
      
      while (attempts < maxAttempts) {
        // Get the highest invoice number for this year
        const lastInvoice = await this.constructor
          .findOne({ invoiceNumber: { $regex: `^INV-${year}-` } })
          .sort({ invoiceNumber: -1 })
          .exec();
        
        if (lastInvoice) {
          const lastNumber = parseInt(lastInvoice.invoiceNumber.split('-')[2]);
          counter = lastNumber + 1;
        }
        
        invoiceNumber = `INV-${year}-${counter.toString().padStart(4, '0')}`;
        
        // Check if this number already exists
        const existing = await this.constructor.findOne({ invoiceNumber });
        if (!existing) {
          break;
        }
        
        counter++;
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique invoice number after multiple attempts');
      }
      
      this.invoiceNumber = invoiceNumber;
    } catch (error) {
      return next(error);
    }
  }
  
  // Auto-calculate final amount
  if (this.amount !== undefined && this.amount !== null) {
    const discount = this.discount || 0;
    this.finalAmount = this.amount * (1 - discount / 100);
  } else if (!this.finalAmount) {
    // If no amount is provided but finalAmount is required, set a default
    this.finalAmount = 0;
  }
  
  this.updatedAt = Date.now();
  next();
});

// Static method to create invoice from quote
InvoiceSchema.statics.createFromQuote = async function(quote, additionalData = {}) {
  const baseAmount = quote.pricing.totalCost || quote.pricing.estimatedTotal || 0;
  const amount = additionalData.amount || baseAmount;
  const discount = additionalData.discount || quote.discount || 0;
  
  // Calculate finalAmount immediately
  const finalAmount = amount * (1 - discount / 100);
  
  const invoiceData = {
    quoteId: quote._id,
    customer: quote.customer,
    packageOption: quote.packageOption,
    amount: amount,
    discount: discount,
    finalAmount: finalAmount, // Set this explicitly
    runs: quote.runs,
    services: quote.services,
    equipment: quote.equipment,
    serviceDescription: `${quote.packageOption} Package Installation`,
    ...additionalData,
    // Override finalAmount in case it was passed in additionalData
    finalAmount: finalAmount
  };
  
  return new this(invoiceData);
};

module.exports = mongoose.model('Invoice', InvoiceSchema);