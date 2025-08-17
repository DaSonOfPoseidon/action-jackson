const express = require('express');
const router = express.Router();
const Quote = require('../models/Quote');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const validator = require('validator');

// Helper to grab real client IP (works behind proxies)
const getClientIP = req => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // Take the first IP from the forwarded list
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || null;
};

// Rate limiting for quote creation
const quoteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 quote requests per windowMs
  message: {
    error: 'Too many quote requests from this IP, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for test and development environments
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  }
});

// Stricter rate limiting for calculate endpoint
const calculateRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 calculation requests per minute
  message: {
    error: 'Too many calculation requests, please slow down.'
  },
  skip: (req) => {
    // Skip rate limiting for test and development environments
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  }
});

// Input sanitization helper
const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return validator.escape(validator.trim(str));
};

// Email domain validation (basic business email check)
const isValidBusinessEmail = (email) => {
  if (!validator.isEmail(email)) return false;
  
  // Block common disposable email domains
  const disposableDomains = [
    '10minutemail.com', 'mailinator.com', 'guerrillamail.com',
    'tempmail.org', 'temp-mail.org', '0-mail.com'
  ];
  
  const domain = email.split('@')[1]?.toLowerCase();
  
  // Allow example.com for testing
  if (process.env.NODE_ENV === 'test' && domain === 'example.com') {
    return true;
  }
  
  return !disposableDomains.includes(domain);
};

// Package configuration
const packageConfig = {
  Basic: {
    laborPerRun: 50,
    installFeePerRun: 50,
    depositThreshold: 100,
    depositAmount: 20
  },
  Premium: {
    laborHourlyRate: 50,
    estimatedLaborHours: 3,
    installHours: 2
  },
  Survey: {
    fee: 100,
    description: "≈2 hrs due up front, applied as credit to install costs"
  }
};

// Calculate pricing based on package
const calculatePricing = (packageOption, runs, services, includeSurvey = false, equipment = [], discount = 0) => {
  const config = packageConfig[packageOption];
  let pricing = {};

  // Calculate equipment total
  const equipmentTotal = equipment.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  if (packageOption === 'Basic') {
    const totalRuns = (runs.coax || 0) + (runs.cat6 || 0);
    const runsCost = totalRuns * (config.laborPerRun + config.installFeePerRun);
    const servicesCost = (services.deviceMount || 0) * 10 + 
                        (services.clientDevice || 0) * 10 + 
                        (services.serverDevice || 0) * 50 + 
                        (services.mediaPanel || 0) * 50 +
                        (services.internalCameras || 0) * 80 + 
                        (services.externalCameras || 0) * 100 + 
                        (services.doorbellCameras || 0) * 150;
    
    const subtotal = runsCost + servicesCost;
    const totalCost = subtotal * (1 - discount / 100);
    
    // If survey is included, no basic deposit required - just survey fee
    const depositRequired = includeSurvey 
      ? 0 
      : (totalCost > config.depositThreshold ? config.depositAmount : 0);
    
    pricing = {
      totalCost: Math.round(totalCost * 100) / 100,
      depositRequired,
      surveyFee: includeSurvey ? packageConfig.Survey.fee : 0,
      equipmentTotal: Math.round(equipmentTotal * 100) / 100
    };
  } else if (packageOption === 'Premium') {
    const totalRuns = (runs.coax || 0) + (runs.cat6 || 0);
    const baseHours = config.estimatedLaborHours + (totalRuns * 0.5); // 0.5hr per run
    const installHours = config.installHours;
    const totalHours = baseHours + installHours;
    
    const laborCost = totalHours * config.laborHourlyRate;
    const servicesCost = (services.deviceMount || 0) * 10 + 
                        (services.clientDevice || 0) * 10 + 
                        (services.serverDevice || 0) * 50 + 
                        (services.mediaPanel || 0) * 50 +
                        (services.internalCameras || 0) * 80 + 
                        (services.externalCameras || 0) * 100 + 
                        (services.doorbellCameras || 0) * 150;
    
    const subtotal = laborCost + servicesCost;
    const estimatedTotal = subtotal * (1 - discount / 100);
    
    pricing = {
      estimatedLaborHours: Math.round(totalHours * 100) / 100,
      laborRate: config.laborHourlyRate,
      estimatedTotal: Math.round(estimatedTotal * 100) / 100,
      surveyFee: includeSurvey ? packageConfig.Survey.fee : 0,
      equipmentTotal: Math.round(equipmentTotal * 100) / 100
    };
  }

  return pricing;
};

// GET route for real-time calculation
router.get('/calculate', calculateRateLimit, (req, res) => {
  const { packageOption, includeSurvey, discount } = req.query;

  if (!packageOption || !['Basic', 'Premium'].includes(packageOption)) {
    return res.status(400).json({ error: 'Invalid package option.' });
  }

  try {
    // Express automatically parses nested query parameters
    const runsData = {
      coax: parseInt(req.query.runs?.coax || '0') || 0,
      cat6: parseInt(req.query.runs?.cat6 || '0') || 0
    };

    const servicesData = {
      deviceMount: parseInt(req.query.services?.deviceMount || '0') || 0,
      clientDevice: parseInt(req.query.services?.clientDevice || '0') || 0,
      serverDevice: parseInt(req.query.services?.serverDevice || '0') || 0,
      mediaPanel: parseInt(req.query.services?.mediaPanel || '0') || 0,
      internalCameras: parseInt(req.query.services?.internalCameras || '0') || 0,
      externalCameras: parseInt(req.query.services?.externalCameras || '0') || 0,
      doorbellCameras: parseInt(req.query.services?.doorbellCameras || '0') || 0
    };

    // Handle equipment total from query (for real-time calculation)
    const equipmentTotal = parseFloat(req.query.equipmentTotal || '0') || 0;
    const equipmentData = equipmentTotal > 0 ? [{ price: equipmentTotal, quantity: 1 }] : [];

    const includesSurvey = includeSurvey === 'true';
    const pricing = calculatePricing(packageOption, runsData, servicesData, includesSurvey, equipmentData, parseInt(discount) || 0);
    
    res.json({
      packageOption,
      includeSurvey: includesSurvey,
      pricing,
      config: packageConfig[packageOption],
      surveyConfig: packageConfig.Survey
    });
  } catch (err) {
    console.error('Calculate error:', err);
    res.status(500).json({ error: 'Error calculating quote' });
  }
});

// Validation middleware for quote creation
const validateQuote = [
  body('customer.name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, apostrophes, and hyphens'),
  body('customer.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email address is required')
    .custom((email) => {
      if (!isValidBusinessEmail(email)) {
        throw new Error('Please use a valid business email address');
      }
      return true;
    }),
  body('packageOption')
    .isIn(['Basic', 'Premium'])
    .withMessage('Invalid package option'),
  body('discount')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100'),
  body('runs.coax')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Coax runs must be between 0 and 50'),
  body('runs.cat6')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Cat6 runs must be between 0 and 50'),
  body('services.deviceMount')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Device mounts must be between 0 and 20'),
  body('services.clientDevice')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Client device setups must be between 0 and 10'),
  body('services.serverDevice')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Server device setups must be between 0 and 10'),
  body('services.mediaPanel')
    .optional()
    .isInt({ min: 0, max: 10 })
    .withMessage('Media panels must be between 0 and 10'),
  body('services.internalCameras')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Internal cameras must be between 0 and 20'),
  body('services.externalCameras')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('External cameras must be between 0 and 20'),
  body('services.doorbellCameras')
    .optional()
    .isInt({ min: 0, max: 5 })
    .withMessage('Doorbell cameras must be between 0 and 5'),
  body('speedTier')
    .optional()
    .isIn(['1 Gig', '5 Gig', '10 Gig'])
    .withMessage('Invalid speed tier'),
  body('equipment')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Equipment list cannot exceed 20 items'),
  body('honeypot')
    .optional()
    .isEmpty()
    .withMessage('Bot detection triggered')
];

router.post('/create', quoteRateLimit, validateQuote, async (req, res) => {
  // Check validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array().map(err => err.msg)
    });
  }

  const { customer, packageOption, discount, runs, services, includeSurvey, speedTier, equipment } = req.body;
  const clientIP = getClientIP(req);

  // Sanitize customer data
  const sanitizedCustomer = {
    name: sanitizeString(customer.name),
    email: customer.email.toLowerCase() // already validated by express-validator
  };

  // Additional business logic validation
  const totalRuns = (runs?.coax || 0) + (runs?.cat6 || 0);
  if (totalRuns === 0 && (!services || Object.values(services).every(val => val === 0))) {
    return res.status(400).json({ error: 'At least one service or cable run must be selected.' });
  }

  // Check for suspicious patterns
  if (equipment && equipment.length > 0) {
    const totalEquipmentCost = equipment.reduce((total, item) => total + (item.price * item.quantity), 0);
    if (totalEquipmentCost > 50000) { // Reasonable upper limit
      return res.status(400).json({ error: 'Equipment total exceeds reasonable limits.' });
    }
  }

  try {
    // Calculate pricing with equipment
    const pricing = calculatePricing(packageOption, runs, services, includeSurvey, equipment || [], discount);

    // Check for recent quotes from same email (additional spam protection)
    const recentQuote = await Quote.findOne({
      'customer.email': sanitizedCustomer.email,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) } // 10 minutes
    });
    
    if (recentQuote) {
      return res.status(429).json({ error: 'Please wait 10 minutes between quote requests.' });
    }

    // 1) Generate unique quote number and save to Mongo
    const quoteNumber = await Quote.generateQuoteNumber();
    
    const newQuote = new Quote({
      quoteNumber,
      customer: sanitizedCustomer,
      packageOption,
      includeSurvey,
      speedTier,
      discount,
      runs,
      services,
      equipment: equipment || [],
      pricing,
      ip: clientIP,
      userAgent: req.get('User-Agent')?.substring(0, 200) || 'Unknown'
    });
    await newQuote.save();

    // 2) Notify admin by email (optional - only if email is configured)
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS && 
        !process.env.EMAIL_USER.includes('example.com') && 
        !process.env.EMAIL_USER.includes('your_dev_email')) {
      
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });

        const mailLines = [
          `New Quote Submission - #${quoteNumber}`,
          `----------------------------------------`,
          `Quote Number: ${quoteNumber}`,
          `Name: ${sanitizedCustomer.name}`,
          `Email: ${sanitizedCustomer.email}`,
          `Package: ${packageOption}${includeSurvey ? ' + Survey' : ''}`,
          speedTier ? `Speed Tier: ${speedTier}` : '',
          `Discount: ${discount}%`,
          `Coax runs: ${runs.coax}`,
          `Cat6 runs: ${runs.cat6}`,
          `Device mounts: ${services.deviceMount}`,
          `Client device setups: ${services.clientDevice}`,
          `Server device setups: ${services.serverDevice}`,
          `Media panels: ${services.mediaPanel}`,
          `Internal cameras: ${services.internalCameras}`,
          `External cameras: ${services.externalCameras}`,
          `Doorbell cameras: ${services.doorbellCameras}`,
          equipment && equipment.length > 0 ? `Equipment Items: ${equipment.length}` : '',
          ...(equipment || []).map(item => `  - ${item.name} (${item.quantity}x) @ $${item.price} each`),
          packageOption === 'Basic' 
            ? `Total Cost: $${pricing.totalCost}`
            : `Estimated Hours: ${pricing.estimatedLaborHours}`,
          packageOption === 'Basic' 
            ? `Deposit Required: $${pricing.depositRequired}`
            : `Estimated Total: $${pricing.estimatedTotal}`,
          includeSurvey ? `Survey Fee: $${pricing.surveyFee}` : '',
          pricing.equipmentTotal > 0 ? `Equipment Total: $${pricing.equipmentTotal}` : '',
          `IP Address: ${clientIP}`,
          `User Agent: ${req.get('User-Agent')?.substring(0, 100) || 'Unknown'}`,
          `Timestamp: ${new Date().toISOString()}`
        ].filter(line => line !== '');

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to:   process.env.ADMIN_EMAIL,
          subject: `📄 New Quote #${quoteNumber} Submitted`,
          text:     mailLines.join('\n')
        });
      } catch (emailError) {
        console.error('Email notification failed (quote still saved):', emailError.message);
      }
    } else {
      console.log('Email notification skipped - email not configured');
    }

    // 3) Respond to frontend
    res.status(201).json({ 
      id: newQuote._id,
      quoteNumber: quoteNumber,
      message: `Quote #${quoteNumber} created successfully`
    });
  } catch (err) {
    console.error('Quote create error:', err);
    res.status(500).json({ error: 'Error generating quote' });
  }
});

module.exports = router;