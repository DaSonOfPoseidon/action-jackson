const mongoose = require('mongoose');

const ConsultationRequestSchema = new mongoose.Schema({
  requestNumber: {
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
  property: {
    squareFootage: {
      type: String,
      enum: ['Under 1,500', '1,500-2,500', '2,500-3,500', '3,500-5,000', 'Over 5,000']
    },
    isp: { type: String, maxlength: 200 },
    currentIssues: [{
      type: String,
      enum: [
        'Weak WiFi', 'Dead zones', 'Slow speeds', 'Too many devices',
        'No wired connections', 'Subscription cameras', 'ISP router only', 'Smart home issues'
      ]
    }]
  },
  interestedServices: [{
    type: String,
    enum: ['networking', 'smart-home', 'cameras', 'structured-wiring']
  }],
  interestedPackage: {
    type: String,
    enum: ['foundation', 'backbone', 'performance', 'standalone', 'unsure']
  },
  status: {
    type: String,
    enum: ['new', 'contacted', 'consultation-scheduled', 'quoted', 'booked', 'completed', 'closed'],
    default: 'new'
  },
  adminNotes:            { type: String, maxlength: 2000 },
  quotedAmount:          { type: Number },
  scheduledConsultation: { type: Date },

  ip:        { type: String },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Generate unique 8-digit request number
ConsultationRequestSchema.statics.generateRequestNumber = async function() {
  let requestNumber;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    requestNumber = Math.floor(Math.random() * 90000000) + 10000000;
    requestNumber = requestNumber.toString();

    const existing = await this.findOne({ requestNumber });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Failed to generate unique request number after multiple attempts');
  }

  return requestNumber;
};

// Update the updatedAt field before saving
ConsultationRequestSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ConsultationRequest', ConsultationRequestSchema);
