const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { adminPageAuth, adminSecurityHeaders } = require('../middleware/auth');
const Quote = require('../models/Quote');
const Schedule = require('../models/Schedule');
const Invoice = require('../models/Invoice');

// Rate limiting for admin operations
const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 10000 : 100, // Much higher limit for tests
  message: {
    error: 'Too many admin requests. Please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * GET /admin/login - Admin login page (no auth required)
 */
router.get('/login', adminRateLimit, (req, res) => {
  // If already authenticated, redirect to dashboard
  if (req.session && req.session.adminId) {
    return res.redirect('/admin/dashboard');
  }
  
  res.render('admin/login', { 
    title: 'Admin Login',
    layout: false // Don't use main layout for login
  });
});

// Apply rate limiting, security headers, and authentication to all other admin routes
router.use(adminRateLimit);
router.use(adminSecurityHeaders);
router.use(adminPageAuth);

/**
 * GET /admin/dashboard - Main admin dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    // Get recent stats for dashboard overview
    const [quoteCount, scheduleCount, invoiceCount] = await Promise.all([
      Quote.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      Schedule.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      Invoice.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } })
    ]);

    // Get recent activity
    const [recentQuotes, recentSchedules, recentInvoices] = await Promise.all([
      Quote.find().sort({ createdAt: -1 }).limit(5)
        .select('customer.name packageOption pricing.totalCost createdAt status'),
      Schedule.find().sort({ createdAt: -1 }).limit(5)
        .select('name date service status createdAt'),
      Invoice.find().sort({ createdAt: -1 }).limit(5)
        .select('invoiceNumber customer.name finalAmount status createdAt')
    ]);

    const dashboardData = {
      stats: {
        quotes: quoteCount,
        schedules: scheduleCount,
        invoices: invoiceCount
      },
      recentActivity: {
        quotes: recentQuotes,
        schedules: recentSchedules,
        invoices: recentInvoices
      }
    };

    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      user: {
        username: req.admin.username,
        role: req.admin.role
      },
      ...dashboardData
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).render('error', {
      title: 'Dashboard Error',
      message: 'Error loading admin dashboard',
      statusCode: 500
    });
  }
});

/**
 * GET /admin/quotes - Quote management page
 */
router.get('/quotes', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sort = req.query.sort || '-createdAt';

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    // Get quotes with pagination
    const quotes = await Quote.find(query)
      .sort(sort)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const totalQuotes = await Quote.countDocuments(query);
    const totalPages = Math.ceil(totalQuotes / limit);

    res.render('admin/quotes', {
      title: 'Quote Management',
      quotes,
      pagination: {
        currentPage: page,
        totalPages,
        totalQuotes,
        limit
      },
      filters: {
        search,
        status,
        sort
      },
      user: {
        username: req.admin.username,
        role: req.admin.role
      }
    });

  } catch (error) {
    console.error('Quotes page error:', error);
    res.status(500).render('error', {
      title: 'Quotes Error',
      message: 'Error loading quotes',
      statusCode: 500
    });
  }
});

/**
 * GET /admin/quotes/:id/data - Get quote data as JSON
 */
router.get('/quotes/:id/data', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    
    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    res.json(quote);

  } catch (error) {
    console.error('Quote data error:', error);
    res.status(500).json({
      error: 'Error loading quote data'
    });
  }
});

/**
 * GET /admin/quotes/:id - View specific quote
 */
router.get('/quotes/:id', async (req, res) => {
  try {
    const quote = await Quote.findById(req.params.id);
    
    if (!quote) {
      return res.status(404).render('error', {
        title: 'Quote Not Found',
        message: 'The requested quote was not found',
        statusCode: 404
      });
    }

    res.render('admin/quote-detail', {
      title: `Quote - ${quote.customer.name}`,
      quote,
      user: {
        username: req.admin.username,
        role: req.admin.role
      }
    });

  } catch (error) {
    console.error('Quote detail error:', error);
    res.status(500).render('error', {
      title: 'Quote Error',
      message: 'Error loading quote details',
      statusCode: 500
    });
  }
});

/**
 * GET /admin/schedule - Schedule management page
 */
router.get('/schedule', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status = req.query.status || '';
    const sort = req.query.sort || 'scheduledDate';

    // Build query
    const query = {};
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    if (status) {
      query.status = status;
    }

    // Get schedules with pagination
    const schedules = await Schedule.find(query)
      .sort(sort)
      .limit(limit)
      .skip((page - 1) * limit)
      .exec();

    const totalSchedules = await Schedule.countDocuments(query);
    const totalPages = Math.ceil(totalSchedules / limit);

    res.render('admin/schedule', {
      title: 'Schedule Management',
      schedules,
      pagination: {
        currentPage: page,
        totalPages,
        totalSchedules,
        limit
      },
      filters: {
        search,
        status,
        sort
      },
      user: {
        username: req.admin.username,
        role: req.admin.role
      }
    });

  } catch (error) {
    console.error('Schedule page error:', error);
    res.status(500).render('error', {
      title: 'Schedule Error',
      message: 'Error loading schedules',
      statusCode: 500
    });
  }
});

/**
 * GET /admin/schedule/:id - View specific schedule
 */
router.get('/schedule/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    
    if (!schedule) {
      return res.status(404).render('error', {
        title: 'Schedule Not Found',
        message: 'The requested schedule was not found',
        statusCode: 404
      });
    }

    res.render('admin/schedule-detail', {
      title: `Schedule - ${schedule.name}`,
      schedule,
      user: {
        username: req.admin.username,
        role: req.admin.role
      }
    });

  } catch (error) {
    console.error('Schedule detail error:', error);
    res.status(500).render('error', {
      title: 'Schedule Error',
      message: 'Error loading schedule details',
      statusCode: 500
    });
  }
});

/**
 * PUT /admin/quotes/:id - Update quote details
 */
router.put('/quotes/:id', async (req, res) => {
  try {
    const {
      packageOption,
      speedTier,
      includeSurvey,
      discount,
      runs,
      services,
      pricing,
      adminNotes
    } = req.body;

    // Validate package option
    if (!['Basic', 'Premium'].includes(packageOption)) {
      return res.status(400).json({
        error: 'Invalid package option'
      });
    }

    // Validate speed tier if provided
    if (speedTier && !['1 Gig', '5 Gig', '10 Gig'].includes(speedTier)) {
      return res.status(400).json({
        error: 'Invalid speed tier'
      });
    }

    // Build update data
    const updateData = {
      packageOption,
      includeSurvey: Boolean(includeSurvey),
      discount: Math.max(0, Math.min(100, parseInt(discount) || 0)),
      runs: {
        coax: Math.max(0, parseInt(runs?.coax) || 0),
        cat6: Math.max(0, parseInt(runs?.cat6) || 0)
      },
      services: {
        deviceMount: Math.max(0, parseInt(services?.deviceMount) || 0),
        networkSetup: Math.max(0, parseInt(services?.networkSetup) || 0),
        mediaPanel: Math.max(0, parseInt(services?.mediaPanel) || 0)
      },
      pricing: {},
      adminNotes: adminNotes || '',
      updatedAt: new Date(),
      updatedBy: req.admin.username
    };

    // Only set speedTier if it has a valid value
    if (speedTier && ['1 Gig', '5 Gig', '10 Gig'].includes(speedTier)) {
      updateData.speedTier = speedTier;
    } else {
      // Explicitly unset the speedTier field if it's empty/null
      updateData.$unset = { speedTier: 1 };
    }

    // Calculate pricing based on package type and services
    const calculatedPricing = calculateQuotePricing({
      packageOption,
      runs: updateData.runs,
      services: updateData.services,
      includeSurvey: updateData.includeSurvey,
      discount: updateData.discount,
      laborRate: req.body.laborRate || 50
    });
    
    updateData.pricing = calculatedPricing;

    const quote = await Quote.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    console.log(`Quote ${req.params.id} updated by ${req.admin.username}`);

    res.json({
      success: true,
      quote: {
        id: quote._id,
        packageOption: quote.packageOption,
        pricing: quote.pricing,
        updatedAt: quote.updatedAt
      }
    });

  } catch (error) {
    console.error('Quote update error:', error);
    console.error('Error details:', error.message);
    console.error('Request body was:', req.body);
    res.status(500).json({
      error: 'Error updating quote',
      details: error.message
    });
  }
});

/**
 * PUT /admin/quotes/:id/status - Update quote status
 */
router.put('/quotes/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'reviewed', 'approved', 'rejected', 'completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status value'
      });
    }

    const quote = await Quote.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        updatedAt: new Date(),
        updatedBy: req.admin.username
      },
      { new: true }
    );

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    console.log(`Quote ${req.params.id} status updated to ${status} by ${req.admin.username}`);

    res.json({
      success: true,
      quote: {
        id: quote._id,
        status: quote.status,
        updatedAt: quote.updatedAt
      }
    });

  } catch (error) {
    console.error('Quote status update error:', error);
    res.status(500).json({
      error: 'Error updating quote status'
    });
  }
});

/**
 * POST /admin/quotes/:id/convert-to-invoice - Convert quote to invoice
 */
router.post('/quotes/:id/convert-to-invoice', async (req, res) => {
  try {
    const Invoice = require('../models/Invoice');
    
    // Get the quote
    const quote = await Quote.findById(req.params.id);
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: 'Quote not found'
      });
    }

    // Check if quote is approved
    if (quote.status !== 'approved') {
      return res.status(400).json({
        success: false,
        error: 'Only approved quotes can be converted to invoices'
      });
    }

    // Check if invoice already exists for this quote
    const existingInvoice = await Invoice.findOne({ quoteId: quote._id });
    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        error: 'Invoice already exists for this quote',
        invoiceId: existingInvoice._id
      });
    }

    // Create invoice from quote with overrides from request body
    const invoiceData = {
      serviceDescription: req.body.serviceDescription,
      amount: req.body.amount,
      discount: req.body.discount || 0,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
      status: 'Draft'
    };

    const newInvoice = await Invoice.createFromQuote(quote, invoiceData);
    await newInvoice.save();

    // Update quote to reference the invoice
    quote.invoiceId = newInvoice._id;
    quote.updatedBy = req.admin.username;
    await quote.save();

    console.log(`Invoice ${newInvoice.invoiceNumber} created from quote ${quote._id} by ${req.admin.username}`);

    res.json({
      success: true,
      invoice: {
        id: newInvoice._id,
        invoiceNumber: newInvoice.invoiceNumber,
        finalAmount: newInvoice.finalAmount
      }
    });

  } catch (error) {
    console.error('Quote to invoice conversion error:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    res.status(500).json({
      success: false,
      error: 'Error converting quote to invoice',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * PUT /admin/schedule/:id/status - Update schedule status
 */
router.put('/schedule/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status value'
      });
    }

    const schedule = await Schedule.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        updatedAt: new Date(),
        updatedBy: req.admin.username
      },
      { new: true }
    );

    if (!schedule) {
      return res.status(404).json({
        error: 'Schedule not found'
      });
    }

    console.log(`Schedule ${req.params.id} status updated to ${status} by ${req.admin.username}`);

    res.json({
      success: true,
      schedule: {
        id: schedule._id,
        status: schedule.status,
        updatedAt: schedule.updatedAt
      }
    });

  } catch (error) {
    console.error('Schedule status update error:', error);
    res.status(500).json({
      error: 'Error updating schedule status'
    });
  }
});

/**
 * DELETE /admin/quotes/:id - Delete quote (superadmin only)
 */
router.delete('/quotes/:id', async (req, res) => {
  try {
    // Only superadmin can delete quotes
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Insufficient privileges - superadmin required'
      });
    }

    const quote = await Quote.findByIdAndDelete(req.params.id);

    if (!quote) {
      return res.status(404).json({
        error: 'Quote not found'
      });
    }

    console.log(`Quote ${req.params.id} deleted by ${req.admin.username}`);

    res.json({
      success: true,
      message: 'Quote deleted successfully'
    });

  } catch (error) {
    console.error('Quote deletion error:', error);
    res.status(500).json({
      error: 'Error deleting quote'
    });
  }
});

/**
 * DELETE /admin/schedule/:id - Delete schedule (superadmin only)
 */
router.delete('/schedule/:id', async (req, res) => {
  try {
    // Only superadmin can delete schedules
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Insufficient privileges - superadmin required'
      });
    }

    const schedule = await Schedule.findByIdAndDelete(req.params.id);

    if (!schedule) {
      return res.status(404).json({
        error: 'Schedule not found'
      });
    }

    console.log(`Schedule ${req.params.id} deleted by ${req.admin.username}`);

    res.json({
      success: true,
      message: 'Schedule deleted successfully'
    });

  } catch (error) {
    console.error('Schedule deletion error:', error);
    res.status(500).json({
      error: 'Error deleting schedule'
    });
  }
});

/**
 * GET /admin/invoices - Invoice management page
 */
router.get('/invoices', async (req, res) => {
  try {
    // Parse query parameters for pagination and filtering
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;
    
    // Build search filter
    const search = req.query.search ? req.query.search.trim() : '';
    const status = req.query.status || '';
    const sort = req.query.sort || 'newest';
    
    let filter = {};
    
    // Search filter (invoice number or customer name)
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } }
      ];
    }
    
    // Status filter
    if (status) {
      filter.status = status;
    }
    
    // Sort options
    let sortQuery = {};
    switch (sort) {
      case 'oldest':
        sortQuery = { createdAt: 1 };
        break;
      case 'amount_high':
        sortQuery = { finalAmount: -1 };
        break;
      case 'amount_low':
        sortQuery = { finalAmount: 1 };
        break;
      case 'invoice_number':
        sortQuery = { invoiceNumber: 1 };
        break;
      default: // newest
        sortQuery = { createdAt: -1 };
    }
    
    // Execute queries
    const [invoices, totalCount] = await Promise.all([
      Invoice.find(filter)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .select('invoiceNumber customer finalAmount status dueDate createdAt quoteId'),
      Invoice.countDocuments(filter)
    ]);
    
    // Pagination calculation
    const totalPages = Math.ceil(totalCount / limit);
    
    const pagination = {
      currentPage: page,
      totalPages,
      totalCount,
      limit,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
    
    res.render('admin/invoices', {
      title: 'Invoice Management',
      invoices,
      pagination,
      filters: {
        search,
        status,
        sort
      },
      user: {
        username: req.admin.username,
        role: req.admin.role
      }
    });
    
  } catch (error) {
    console.error('Invoice management error:', error);
    res.status(500).render('error', {
      title: 'Invoice Management Error',
      message: 'Error loading invoice management page',
      statusCode: 500,
      variant: 'business',
      switcherUrl: 'https://dev.actionjacksoninstalls.com'
    });
  }
});

/**
 * GET /admin/invoices/:id - View specific invoice
 */
router.get('/invoices/:id', async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('quoteId', 'customer packageOption runs services equipment');
    
    if (!invoice) {
      return res.status(404).render('error', {
        title: 'Invoice Not Found',
        message: 'The requested invoice was not found',
        statusCode: 404
      });
    }

    res.render('admin/invoice-detail', {
      title: `Invoice ${invoice.invoiceNumber}`,
      invoice,
      user: {
        username: req.admin.username,
        role: req.admin.role
      }
    });

  } catch (error) {
    console.error('Invoice detail error:', error);
    res.status(500).render('error', {
      title: 'Invoice Error',
      message: 'Error loading invoice details',
      statusCode: 500
    });
  }
});

/**
 * PUT /admin/invoices/:id/status - Update invoice status
 */
router.put('/invoices/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    // Validate status
    const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid status value'
      });
    }
    
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { 
        status,
        updatedBy: req.admin.username,
        updatedAt: new Date()
      },
      { new: true }
    );
    
    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }
    
    console.log(`Invoice ${invoice.invoiceNumber} status updated to ${status} by ${req.admin.username}`);
    
    res.json({
      success: true,
      message: 'Invoice status updated successfully',
      invoice: {
        id: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status
      }
    });
    
  } catch (error) {
    console.error('Invoice status update error:', error);
    res.status(500).json({
      error: 'Error updating invoice status'
    });
  }
});

/**
 * DELETE /admin/invoices/:id - Delete invoice (superadmin only)
 */
router.delete('/invoices/:id', async (req, res) => {
  try {
    // Only superadmin can delete invoices
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Insufficient privileges - superadmin required'
      });
    }

    const invoice = await Invoice.findByIdAndDelete(req.params.id);

    if (!invoice) {
      return res.status(404).json({
        error: 'Invoice not found'
      });
    }

    console.log(`Invoice ${invoice.invoiceNumber} deleted by ${req.admin.username}`);

    res.json({
      success: true,
      message: 'Invoice deleted successfully'
    });

  } catch (error) {
    console.error('Invoice deletion error:', error);
    res.status(500).json({
      error: 'Error deleting invoice'
    });
  }
});

/**
 * Calculate pricing for a quote based on services and package type
 */
function calculateQuotePricing(options) {
  const {
    packageOption,
    runs = { coax: 0, cat6: 0 },
    services = { deviceMount: 0, networkSetup: 0, mediaPanel: 0 },
    includeSurvey = false,
    discount = 0,
    laborRate = 50
  } = options;

  // Service pricing constants
  const SERVICE_PRICING = {
    deviceMount: 10,    // $10 per device mount
    networkSetup: 20,   // $20 per network setup  
    mediaPanel: 50,     // $50 per media panel
    coaxRun: 50,        // $50 per coax run
    cat6Run: 75         // $75 per cat6 run
  };

  const LABOR_RATES = {
    deviceMount: 0.25,  // 0.25 hours per device mount
    networkSetup: 0.5,  // 0.5 hours per network setup
    mediaPanel: 1.0,    // 1.0 hour per media panel
    coaxRun: 0.5,       // 0.5 hours per coax run
    cat6Run: 0.75       // 0.75 hours per cat6 run
  };

  const surveyFee = includeSurvey ? 100 : 0;

  if (packageOption === 'Basic') {
    // Calculate fixed pricing based on services
    const servicesCost = 
      (runs.coax * SERVICE_PRICING.coaxRun) +
      (runs.cat6 * SERVICE_PRICING.cat6Run) +
      (services.deviceMount * SERVICE_PRICING.deviceMount) +
      (services.networkSetup * SERVICE_PRICING.networkSetup) +
      (services.mediaPanel * SERVICE_PRICING.mediaPanel);
    
    const subtotal = servicesCost + surveyFee;
    const discountAmount = subtotal * (discount / 100);
    const totalCost = Math.max(0, subtotal - discountAmount);
    const depositRequired = Math.round(totalCost * 0.3); // 30% deposit
    
    return {
      totalCost,
      depositRequired,
      surveyFee,
      equipmentTotal: 0 // Will be calculated separately if equipment is selected
    };
  } else {
    // Premium package - calculate labor hours and pricing
    const laborHours = 
      (runs.coax * LABOR_RATES.coaxRun) +
      (runs.cat6 * LABOR_RATES.cat6Run) +
      (services.deviceMount * LABOR_RATES.deviceMount) +
      (services.networkSetup * LABOR_RATES.networkSetup) +
      (services.mediaPanel * LABOR_RATES.mediaPanel);
    
    const laborCost = laborHours * laborRate;
    const subtotal = laborCost + surveyFee;
    const discountAmount = subtotal * (discount / 100);
    const estimatedTotal = Math.max(0, subtotal - discountAmount);
    
    return {
      estimatedLaborHours: Math.round(laborHours * 10) / 10, // Round to 1 decimal
      laborRate,
      estimatedTotal,
      surveyFee,
      equipmentTotal: 0 // Will be calculated separately if equipment is selected
    };
  }
}

module.exports = router;