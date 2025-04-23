const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  serviceType: { type: String, required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'Pending' }
});

module.exports = mongoose.model('Invoice', InvoiceSchema);