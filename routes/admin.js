const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { adminPageAuth, adminSecurityHeaders } = require('../middleware/auth');
const Quote = require('../models/Quote');
const Schedule = require('../models/Schedule');
const Invoice = require('../models/Invoice');
const CostItem = require('../models/CostItem');
const Setting = require('../models/Setting');

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
        .select('customer.name serviceType packageOption pricing.totalCost pricing.depositAmount createdAt status'),
      Schedule.find().sort({ createdAt: -1 }).limit(5)
        .select('name date time status createdAt'),
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
      serviceType,
      discount,
      runs,
      services,
      adminNotes,
      finalQuoteAmount,
      centralization
    } = req.body;

    // Validate service type if provided (may be legacy quote without it)
    if (serviceType && !['Drops Only', 'Whole-Home'].includes(serviceType)) {
      return res.status(400).json({
        error: 'Invalid service type'
      });
    }

    // Build update data
    const updateData = {
      discount: Math.max(0, Math.min(100, parseInt(discount) || 0)),
      runs: {
        coax: Math.max(0, parseInt(runs?.coax) || 0),
        cat6: Math.max(0, parseInt(runs?.cat6) || 0),
        fiber: Math.max(0, parseInt(runs?.fiber) || 0)
      },
      services: {
        mediaPanel: Math.max(0, parseInt(services?.mediaPanel) || 0),
        apMount: Math.max(0, parseInt(services?.apMount) || 0),
        ethRelocation: Math.max(0, parseInt(services?.ethRelocation) || 0)
      },
      adminNotes: adminNotes || '',
      updatedAt: new Date(),
      updatedBy: req.admin.username
    };

    if (serviceType) {
      updateData.serviceType = serviceType;
    }

    if (centralization && ['Media Panel', 'Loose Termination', 'Patch Panel'].includes(centralization)) {
      updateData.centralization = centralization;
    }

    if (finalQuoteAmount !== undefined) {
      updateData.finalQuoteAmount = parseFloat(finalQuoteAmount) || 0;
    }

    // Calculate pricing
    const calculatedPricing = calculateQuotePricing({
      serviceType: serviceType || req.body.packageOption || 'Drops Only',
      runs: updateData.runs,
      services: updateData.services,
      discount: updateData.discount,
      centralization: updateData.centralization || centralization || null
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
        serviceType: quote.serviceType,
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

// ============================================================
// Settings Routes
// ============================================================

/**
 * GET /admin/settings/labor-rate - Get current labor rate
 */
router.get('/settings/labor-rate', async (req, res) => {
  try {
    const settings = await Setting.getSettings();
    res.json({ laborRate: settings.laborRate });
  } catch (error) {
    console.error('Get labor rate error:', error);
    res.status(500).json({ error: 'Error fetching labor rate' });
  }
});

/**
 * PUT /admin/settings/labor-rate - Update labor rate
 */
router.put('/settings/labor-rate', async (req, res) => {
  try {
    const { laborRate } = req.body;

    if (laborRate == null || isNaN(laborRate)) {
      return res.status(400).json({ error: 'Labor rate is required and must be a number' });
    }

    if (Number(laborRate) < 0) {
      return res.status(400).json({ error: 'Labor rate cannot be negative' });
    }

    const settings = await Setting.updateLaborRate(Number(laborRate), req.admin.username);

    console.log(`Labor rate updated to $${settings.laborRate}/hr by ${req.admin.username}`);

    res.json({
      success: true,
      laborRate: settings.laborRate
    });
  } catch (error) {
    console.error('Update labor rate error:', error);
    res.status(500).json({ error: 'Error updating labor rate' });
  }
});

// ============================================================
// Cost Item Management Routes
// ============================================================

/**
 * GET /admin/cost-items - Cost item management page
 */
router.get('/cost-items', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const search = req.query.search ? req.query.search.trim() : '';
    const category = req.query.category || '';
    const status = req.query.status || '';
    const sort = req.query.sort || 'category';

    let filter = {};

    if (search) {
      filter.$or = [
        { code: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      filter.category = category;
    }

    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    let sortQuery = {};
    switch (sort) {
      case 'name':
        sortQuery = { name: 1 };
        break;
      case 'price_high':
        sortQuery = { price: -1 };
        break;
      case 'price_low':
        sortQuery = { price: 1 };
        break;
      case 'newest':
        sortQuery = { createdAt: -1 };
        break;
      default: // category
        sortQuery = { category: 1, sortOrder: 1, name: 1 };
    }

    const [costItems, totalCount, allItemsForBom, settings] = await Promise.all([
      CostItem.find(filter)
        .populate('billOfMaterials.item', 'code name')
        .sort(sortQuery)
        .skip(skip)
        .limit(limit),
      CostItem.countDocuments(filter),
      CostItem.find({ isActive: true }, '_id code name price').sort({ code: 1 }).lean(),
      Setting.getSettings()
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.render('admin/cost-items', {
      title: 'Cost Item Management',
      costItems,
      allItemsForBom,
      laborRate: settings.laborRate,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: { search, category, status, sort },
      user: {
        username: req.admin.username,
        role: req.admin.role
      }
    });

  } catch (error) {
    console.error('Cost item management error:', error);
    res.status(500).render('error', {
      title: 'Cost Item Management Error',
      message: 'Error loading cost item management page',
      statusCode: 500,
      variant: 'business',
      switcherUrl: 'https://dev.actionjacksoninstalls.com'
    });
  }
});

/**
 * POST /admin/cost-items/seed - Seed default cost items (superadmin only)
 * Must be registered before /cost-items/:id routes
 */
router.post('/cost-items/seed', async (req, res) => {
  try {
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Insufficient privileges - superadmin required'
      });
    }

    // Pass 1: Create all items (without BOM references)
    const defaults = [
      { code: 'CAT6-RUN', name: 'Cat6 Cable Run', category: 'Cable Runs', unitType: 'per-run', costUnitType: 'per-foot', unitLabel: 'per run', price: 100, materialCost: 25, laborHours: 0.8, sortOrder: 0 },
      { code: 'COAX-RUN', name: 'Coax Cable Run', category: 'Cable Runs', unitType: 'per-run', costUnitType: 'per-foot', unitLabel: 'per run', price: 150, materialCost: 35, laborHours: 1.0, sortOrder: 1 },
      { code: 'FIBER-RUN', name: 'Fiber Cable Run', category: 'Cable Runs', unitType: 'per-run', costUnitType: 'per-foot', unitLabel: 'per run', price: 200, materialCost: 60, laborHours: 1.4, sortOrder: 2 },
      { code: 'AP-MOUNT', name: 'Access Point Mount', category: 'Services', unitType: 'per-unit', unitLabel: 'per mount', price: 25, materialCost: 5, laborHours: 0.2, sortOrder: 0 },
      { code: 'ETH-RELOCATION', name: 'Ethernet Relocation', category: 'Services', unitType: 'per-unit', unitLabel: 'per relocation', price: 20, materialCost: 2, laborHours: 0.2, sortOrder: 1 },
      { code: 'MEDIA-PANEL', name: 'Media Panel Install', category: 'Centralization', unitType: 'flat-fee', unitLabel: 'flat fee', price: 100, materialCost: 30, laborHours: 0.8, sortOrder: 0 },
      { code: 'PATCH-PANEL', name: 'Patch Panel', category: 'Centralization', unitType: 'flat-fee', unitLabel: 'flat fee', price: 50, materialCost: 20, laborHours: 0.3, sortOrder: 1 },
      { code: 'LOOSE-TERM', name: 'Loose Termination', category: 'Centralization', unitType: 'flat-fee', unitLabel: 'flat fee', price: 0, sortOrder: 2 },
      { code: 'DEPOSIT-DROPS', name: 'Drops Only Deposit', category: 'Deposits', unitType: 'threshold', unitLabel: 'deposit', price: 20, thresholdAmount: 100, sortOrder: 0 },
      { code: 'DEPOSIT-WHOLE', name: 'Whole-Home Deposit', category: 'Deposits', unitType: 'flat-fee', unitLabel: 'flat fee', price: 200, sortOrder: 1 },
      { code: 'RJ45-CONNECTOR', name: 'RJ45 Connector', category: 'Equipment', unitType: 'per-unit', unitLabel: 'each', price: 2, materialCost: 0.50, sortOrder: 0 },
      { code: 'KEYSTONE-JACK', name: 'Keystone Jack', category: 'Equipment', unitType: 'per-unit', unitLabel: 'each', price: 5, materialCost: 2, sortOrder: 1 },
      { code: 'WALL-PLATE', name: 'Wall Plate', category: 'Equipment', unitType: 'per-unit', unitLabel: 'each', price: 4, materialCost: 1.50, sortOrder: 2 }
    ];

    let created = 0;
    let skipped = 0;

    for (const item of defaults) {
      const existing = await CostItem.findOne({ code: item.code });
      if (existing) {
        skipped++;
      } else {
        await CostItem.create({
          ...item,
          createdBy: req.admin.username,
          updatedBy: req.admin.username
        });
        created++;
      }
    }

    // Pass 2: Wire up BOM references for cable runs
    const bomMappings = {
      'CAT6-RUN': [
        { code: 'RJ45-CONNECTOR', quantity: 2 },
        { code: 'KEYSTONE-JACK', quantity: 1 },
        { code: 'WALL-PLATE', quantity: 1 }
      ]
    };

    for (const [parentCode, components] of Object.entries(bomMappings)) {
      const parent = await CostItem.findOne({ code: parentCode });
      if (parent && (!parent.billOfMaterials || parent.billOfMaterials.length === 0)) {
        const bomEntries = [];
        for (const comp of components) {
          const compItem = await CostItem.findOne({ code: comp.code });
          if (compItem) {
            bomEntries.push({ item: compItem._id, quantity: comp.quantity });
          }
        }
        if (bomEntries.length > 0) {
          parent.billOfMaterials = bomEntries;
          parent.updatedBy = req.admin.username;
          await parent.save();
        }
      }
    }

    console.log(`Cost items seeded by ${req.admin.username}: ${created} created, ${skipped} skipped`);

    res.json({
      success: true,
      message: `Seeded ${created} cost items, ${skipped} already existed`,
      created,
      skipped
    });

  } catch (error) {
    console.error('Cost item seed error:', error);
    res.status(500).json({
      error: 'Error seeding cost items'
    });
  }
});

/**
 * GET /admin/cost-items/search - Lightweight search for BOM typeahead
 */
router.get('/cost-items/search', async (req, res) => {
  try {
    const q = req.query.q ? req.query.q.trim() : '';
    const exclude = req.query.exclude || '';

    if (!q) {
      return res.json([]);
    }

    const filter = {
      isActive: true,
      $or: [
        { code: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ]
    };

    if (exclude && mongoose.Types.ObjectId.isValid(exclude)) {
      filter._id = { $ne: exclude };
    }

    const items = await CostItem.find(filter, '_id code name price')
      .limit(20)
      .sort({ code: 1 })
      .lean();

    res.json(items);
  } catch (error) {
    console.error('Cost item search error:', error);
    res.status(500).json({ error: 'Error searching cost items' });
  }
});

/**
 * POST /admin/cost-items - Create a new cost item
 */
router.post('/cost-items', async (req, res) => {
  try {
    const { code, name, description, category, unitType, costUnitType, unitLabel, price, materialCost, laborHours, thresholdAmount, purchaseUrl, billOfMaterials, sortOrder } = req.body;

    if (!code || !name || !category || !unitType || price == null) {
      return res.status(400).json({
        error: 'Missing required fields: code, name, category, unitType, price'
      });
    }

    // Validate BOM item IDs exist
    if (billOfMaterials && billOfMaterials.length > 0) {
      for (const entry of billOfMaterials) {
        if (!mongoose.Types.ObjectId.isValid(entry.item)) {
          return res.status(400).json({ error: 'Invalid BOM item ID: ' + entry.item });
        }
        const exists = await CostItem.findById(entry.item);
        if (!exists) {
          return res.status(400).json({ error: 'BOM item not found: ' + entry.item });
        }
      }
    }

    const costItem = new CostItem({
      code,
      name,
      description,
      category,
      unitType,
      costUnitType: costUnitType || null,
      unitLabel,
      price,
      materialCost,
      laborHours,
      thresholdAmount,
      purchaseUrl: purchaseUrl || undefined,
      billOfMaterials: billOfMaterials || [],
      sortOrder: sortOrder || 0,
      createdBy: req.admin.username,
      updatedBy: req.admin.username
    });

    await costItem.save();

    console.log(`Cost item ${costItem.code} created by ${req.admin.username}`);

    res.status(201).json({
      success: true,
      message: 'Cost item created successfully',
      costItem: {
        id: costItem._id,
        code: costItem.code,
        name: costItem.name
      }
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'A cost item with that code already exists'
      });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        error: messages.join(', ')
      });
    }
    console.error('Cost item creation error:', error);
    res.status(500).json({
      error: 'Error creating cost item'
    });
  }
});

/**
 * PUT /admin/cost-items/:id - Update a cost item
 */
router.put('/cost-items/:id', async (req, res) => {
  try {
    const { code, name, description, category, unitType, costUnitType, unitLabel, price, materialCost, laborHours, thresholdAmount, purchaseUrl, billOfMaterials, sortOrder } = req.body;

    // Validate BOM item IDs exist
    if (billOfMaterials && billOfMaterials.length > 0) {
      for (const entry of billOfMaterials) {
        if (!mongoose.Types.ObjectId.isValid(entry.item)) {
          return res.status(400).json({ error: 'Invalid BOM item ID: ' + entry.item });
        }
        const exists = await CostItem.findById(entry.item);
        if (!exists) {
          return res.status(400).json({ error: 'BOM item not found: ' + entry.item });
        }
      }
    }

    const updateData = {
      updatedBy: req.admin.username,
      updatedAt: new Date()
    };

    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (unitType !== undefined) updateData.unitType = unitType;
    if (costUnitType !== undefined) updateData.costUnitType = costUnitType || null;
    if (unitLabel !== undefined) updateData.unitLabel = unitLabel;
    if (price !== undefined) updateData.price = price;
    if (materialCost !== undefined) updateData.materialCost = materialCost;
    if (laborHours !== undefined) updateData.laborHours = laborHours;
    if (thresholdAmount !== undefined) updateData.thresholdAmount = thresholdAmount;
    if (purchaseUrl !== undefined) updateData.purchaseUrl = purchaseUrl || null;
    if (billOfMaterials !== undefined) updateData.billOfMaterials = billOfMaterials;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

    const costItem = await CostItem.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!costItem) {
      return res.status(404).json({
        error: 'Cost item not found'
      });
    }

    console.log(`Cost item ${costItem.code} updated by ${req.admin.username}`);

    res.json({
      success: true,
      message: 'Cost item updated successfully',
      costItem: {
        id: costItem._id,
        code: costItem.code,
        name: costItem.name
      }
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'A cost item with that code already exists'
      });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        error: messages.join(', ')
      });
    }
    console.error('Cost item update error:', error);
    res.status(500).json({
      error: 'Error updating cost item'
    });
  }
});

/**
 * PUT /admin/cost-items/:id/toggle - Toggle active/inactive
 */
router.put('/cost-items/:id/toggle', async (req, res) => {
  try {
    const costItem = await CostItem.findById(req.params.id);

    if (!costItem) {
      return res.status(404).json({
        error: 'Cost item not found'
      });
    }

    costItem.isActive = !costItem.isActive;
    costItem.updatedBy = req.admin.username;
    await costItem.save();

    console.log(`Cost item ${costItem.code} ${costItem.isActive ? 'activated' : 'deactivated'} by ${req.admin.username}`);

    res.json({
      success: true,
      message: `Cost item ${costItem.isActive ? 'activated' : 'deactivated'} successfully`,
      costItem: {
        id: costItem._id,
        code: costItem.code,
        isActive: costItem.isActive
      }
    });

  } catch (error) {
    console.error('Cost item toggle error:', error);
    res.status(500).json({
      error: 'Error toggling cost item'
    });
  }
});

/**
 * DELETE /admin/cost-items/:id - Delete cost item (superadmin only)
 */
router.delete('/cost-items/:id', async (req, res) => {
  try {
    if (req.admin.role !== 'superadmin') {
      return res.status(403).json({
        error: 'Insufficient privileges - superadmin required'
      });
    }

    const costItem = await CostItem.findByIdAndDelete(req.params.id);

    if (!costItem) {
      return res.status(404).json({
        error: 'Cost item not found'
      });
    }

    console.log(`Cost item ${costItem.code} deleted by ${req.admin.username}`);

    res.json({
      success: true,
      message: 'Cost item deleted successfully'
    });

  } catch (error) {
    console.error('Cost item deletion error:', error);
    res.status(500).json({
      error: 'Error deleting cost item'
    });
  }
});

/**
 * Calculate pricing for a quote based on services and package type
 */
function calculateQuotePricing(options) {
  const {
    serviceType,
    runs = { coax: 0, cat6: 0, fiber: 0 },
    services = { mediaPanel: 0, apMount: 0, ethRelocation: 0 },
    discount = 0,
    centralization = null,
    hasExistingPanel = false
  } = options;

  const ADDON_PRICING = {
    apMount: 25,         // $25 per AP mount
    ethRelocation: 20,   // $20 per ethernet relocation
    costPerRun: { cat6: 100, coax: 150, fiber: 200 }
  };

  const CENTRALIZATION_PRICING = {
    'Media Panel': 100,
    'Patch Panel': 50,
    'Loose Termination': 0
  };

  if (serviceType === 'Drops Only' || serviceType === 'Basic') {
    const runsCost = (runs.cat6 || 0) * ADDON_PRICING.costPerRun.cat6 +
                     (runs.coax || 0) * ADDON_PRICING.costPerRun.coax +
                     (runs.fiber || 0) * ADDON_PRICING.costPerRun.fiber;
    const servicesCost =
      (services.apMount || 0) * ADDON_PRICING.apMount +
      (services.ethRelocation || 0) * ADDON_PRICING.ethRelocation;

    // Centralization cost (new quotes) or legacy mediaPanel cost
    let centralizationCost = 0;
    if (centralization) {
      if (centralization === 'Media Panel') {
        centralizationCost = hasExistingPanel ? 0 : CENTRALIZATION_PRICING['Media Panel'];
      } else {
        centralizationCost = CENTRALIZATION_PRICING[centralization] || 0;
      }
    } else {
      // Legacy fallback: use services.mediaPanel quantity
      centralizationCost = (services.mediaPanel || 0) * 100;
    }

    const subtotal = runsCost + servicesCost + centralizationCost;
    const discountAmount = subtotal * (discount / 100);
    const totalCost = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
    const depositRequired = totalCost > 100 ? 20 : 0;

    return {
      totalCost,
      depositRequired
    };
  } else {
    // Whole-Home: deposit-based pricing
    return {
      depositAmount: 200
    };
  }
}

module.exports = router;