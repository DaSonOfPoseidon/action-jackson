const mongoose = require('mongoose');

const QuoteSchema = new mongoose.Schema({
  customer: {
    name:  { type: String, required: true },
    email: { type: String, required: true }
  },
  packageOption: { type: String, required: true },
  discount:      { type: Number, default: 0 },

  runs: {
    coax: { type: Number, default: 0 },
    cat6: { type: Number, default: 0 }
  },

  services: {
    deviceMount:   { type: Number, default: 0 },
    networkSetup:  { type: Number, default: 0 },
    mediaPanel:    { type: Number, default: 0 }
  },

  ip:        { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quote', QuoteSchema);
