const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { adminPageAuth } = require('../middleware/auth');
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

// Apply rate limiting and authentication to all other admin routes
router.use(adminRateLimit);
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
        .select('invoiceNumber customer.name totalAmount status createdAt')
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

module.exports = router;