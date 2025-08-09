const express = require('express');
const router = express.Router();
const Invoice = require('../models/Invoice');
const rateLimit = require('express-rate-limit');

// Rate limiting for invoice operations
const invoiceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    error: 'Too many invoice requests from this IP, please try again later.'
  },
  skip: (req) => {
    // Skip rate limiting for test and development environments
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  }
});

// Simple API key authentication middleware (optional - can be disabled)
const authenticateApiKey = (req, res, next) => {
  // If no API key is configured, allow access (for development)
  if (!process.env.INVOICE_API_KEY) {
    console.log('Invoice API accessed without authentication (no API key configured)');
    return next();
  }
  
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  if (!apiKey || apiKey !== process.env.INVOICE_API_KEY) {
    console.log(`Invoice API access denied from IP: ${req.ip}`);
    return res.status(401).json({ 
      error: 'Invalid or missing API key. Include X-API-Key header or apiKey query parameter.' 
    });
  }
  
  next();
};

// Apply rate limiting and optional authentication to all routes
router.use(invoiceRateLimit);
router.use(authenticateApiKey);

// GET all invoices - with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50); // Max 50 per page
    const skip = (page - 1) * limit;
    
    const invoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Invoice.countDocuments();
    
    res.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Invoice fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET single invoice by ID
router.get('/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a new invoice
router.post('/', async (req, res) => {
  try {
    console.log(`Invoice creation attempt from IP: ${req.ip}`, {
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent')
    });
    
    const newInvoice = new Invoice(req.body);
    await newInvoice.save();
    
    console.log(`Invoice created successfully: ${newInvoice.invoiceNumber}`);
    res.status(201).json(newInvoice);
  } catch (err) {
    console.error(`Invoice creation failed from IP: ${req.ip}`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST create invoice from quote
router.post('/from-quote/:quoteId', async (req, res) => {
  try {
    const Quote = require('../models/Quote');
    const quote = await Quote.findById(req.params.quoteId);
    
    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }
    
    // Check if invoice already exists for this quote
    const existingInvoice = await Invoice.findOne({ quoteId: quote._id });
    if (existingInvoice) {
      return res.status(400).json({ 
        error: 'Invoice already exists for this quote',
        invoice: existingInvoice
      });
    }
    
    const newInvoice = await Invoice.createFromQuote(quote, req.body);
    await newInvoice.save();
    
    console.log(`Invoice ${newInvoice.invoiceNumber} created from quote ${quote._id}`);
    res.status(201).json(newInvoice);
  } catch (err) {
    console.error(`Failed to create invoice from quote:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// PUT update an invoice
router.put('/:id', async (req, res) => {
  try {
    const updatedInvoice = await Invoice.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedInvoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(updatedInvoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE an invoice
router.delete('/:id', async (req, res) => {
  try {
    const deletedInvoice = await Invoice.findByIdAndDelete(req.params.id);
    if (!deletedInvoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
