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
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || null;
};

// Rate limiting for quote creation
const quoteRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many quote requests from this IP, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  }
});

// Stricter rate limiting for calculate endpoint
const calculateRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    error: 'Too many calculation requests, please slow down.'
  },
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  }
});

// Input sanitization helper
const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return validator.escape(validator.trim(str));
};

// Email domain validation
const isValidBusinessEmail = (email) => {
  if (!validator.isEmail(email)) return false;

  const disposableDomains = [
    '10minutemail.com', 'mailinator.com', 'guerrillamail.com',
    'tempmail.org', 'temp-mail.org', '0-mail.com'
  ];

  const domain = email.split('@')[1]?.toLowerCase();

  if (process.env.NODE_ENV === 'test' && domain === 'example.com') {
    return true;
  }

  return !disposableDomains.includes(domain);
};

// Service configuration
const serviceConfig = {
  'Drops Only': {
    costPerRun: { cat6: 100, coax: 150, fiber: 200 },
    depositThreshold: 100,
    depositAmount: 20
  },
  'Whole-Home': {
    depositAmount: 200
  }
};

// Add-on service pricing
const addonPricing = {
  apMount: 25,         // $25 per AP mount
  ethRelocation: 20    // $20 per ethernet relocation
};

// Centralization pricing
const centralizationPricing = {
  'Media Panel': 100,      // $100 if no existing panel
  'Patch Panel': 50,       // $50 flat fee
  'Loose Termination': 0   // Free
};

// Calculate pricing for Drops Only quotes
const calculateDropsOnlyPricing = (runs, services, discount = 0, centralization = null) => {
  const costs = serviceConfig['Drops Only'].costPerRun;
  const runsCost = (runs.cat6 || 0) * costs.cat6 +
                   (runs.coax || 0) * costs.coax +
                   (runs.fiber || 0) * costs.fiber;

  const servicesCost =
    (services.apMount || 0) * addonPricing.apMount +
    (services.ethRelocation || 0) * addonPricing.ethRelocation;

  // Centralization cost
  let centralizationCost = 0;
  if (centralization && centralization.type) {
    if (centralization.type === 'Media Panel') {
      centralizationCost = centralization.hasExistingPanel ? 0 : centralizationPricing['Media Panel'];
    } else {
      centralizationCost = centralizationPricing[centralization.type] || 0;
    }
  }

  const subtotal = runsCost + servicesCost + centralizationCost;
  const totalCost = Math.round(subtotal * (1 - discount / 100) * 100) / 100;

  const config = serviceConfig['Drops Only'];
  const depositRequired = totalCost > config.depositThreshold ? config.depositAmount : 0;

  return {
    totalCost,
    depositRequired
  };
};

// GET route for real-time calculation (Drops Only only)
router.get('/calculate', calculateRateLimit, (req, res) => {
  const { serviceType, discount } = req.query;

  if (serviceType !== 'Drops Only') {
    return res.status(400).json({ error: 'Calculation only available for Drops Only quotes.' });
  }

  try {
    const runsData = {
      coax: parseInt(req.query.runs?.coax || '0') || 0,
      cat6: parseInt(req.query.runs?.cat6 || '0') || 0,
      fiber: parseInt(req.query.runs?.fiber || '0') || 0
    };

    const servicesData = {
      apMount: parseInt(req.query.services?.apMount || '0') || 0,
      ethRelocation: parseInt(req.query.services?.ethRelocation || '0') || 0
    };

    // Parse centralization params
    let centralizationData = null;
    if (req.query.centralization?.type) {
      centralizationData = {
        type: req.query.centralization.type,
        hasExistingPanel: req.query.centralization.hasExistingPanel === 'true'
      };
    }

    const pricing = calculateDropsOnlyPricing(runsData, servicesData, parseInt(discount) || 0, centralizationData);

    res.json({
      serviceType,
      pricing,
      config: serviceConfig['Drops Only'],
      addonPricing,
      centralizationPricing
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
  body('serviceType')
    .isIn(['Drops Only', 'Whole-Home'])
    .withMessage('Invalid service type'),
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
  body('runs.fiber')
    .optional()
    .isInt({ min: 0, max: 50 })
    .withMessage('Fiber runs must be between 0 and 50'),
  body('centralization')
    .if(body('serviceType').equals('Drops Only'))
    .isIn(['Media Panel', 'Loose Termination', 'Patch Panel'])
    .withMessage('Invalid centralization selection'),
  body('services.apMount')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('AP mounts must be between 0 and 20'),
  body('services.ethRelocation')
    .optional()
    .isInt({ min: 0, max: 20 })
    .withMessage('Ethernet relocations must be between 0 and 20'),
  body('homeInfo.liabilityAcknowledged')
    .equals('true')
    .withMessage('Liability acknowledgment is required'),
  body('homeInfo.homeAge')
    .isIn(['Pre-1960', '1960-1980', '1980-2000', '2000-2020', '2020+'])
    .withMessage('Invalid home age selection'),
  body('homeInfo.stories')
    .isInt({ min: 1, max: 4 })
    .withMessage('Stories must be between 1 and 4'),
  body('homeInfo.atticAccess')
    .isIn(['Walk-in attic', 'Crawl space', 'Scuttle hole', 'No attic access'])
    .withMessage('Invalid attic access selection'),
  body('wholeHome.equipmentDescription')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Equipment description must be under 2000 characters'),
  body('wholeHome.notes')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Notes must be under 2000 characters'),
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

  const { customer, serviceType, discount, runs, services, homeInfo, wholeHome, centralization } = req.body;
  const clientIP = getClientIP(req);

  // Sanitize customer data
  const sanitizedCustomer = {
    name: sanitizeString(customer.name),
    email: customer.email.toLowerCase(),
    phone: customer.phone ? sanitizeString(customer.phone) : undefined
  };

  // Business logic validation based on service type
  if (serviceType === 'Drops Only') {
    const totalRuns = (runs?.coax || 0) + (runs?.cat6 || 0) + (runs?.fiber || 0);
    const totalServices = (services?.apMount || 0) + (services?.ethRelocation || 0);
    if (totalRuns === 0 && totalServices === 0) {
      return res.status(400).json({ error: 'At least one cable run or service must be selected.' });
    }
  } else if (serviceType === 'Whole-Home') {
    // Validate at least one scope is selected
    if (!wholeHome?.scope?.networking && !wholeHome?.scope?.security && !wholeHome?.scope?.voip) {
      return res.status(400).json({ error: 'At least one scope (Networking, Security, or VoIP) must be selected.' });
    }
    // Validate brand preferences if no own equipment
    if (wholeHome && !wholeHome.hasOwnEquipment) {
      if (wholeHome.scope?.networking && wholeHome.networkingBrand &&
          !['Omada', 'UniFi', 'Ruckus', 'No Preference'].includes(wholeHome.networkingBrand)) {
        return res.status(400).json({ error: 'Invalid networking brand preference.' });
      }
      if (wholeHome.scope?.security && wholeHome.securityBrand &&
          !['UniFi', 'Reolink', 'No Preference'].includes(wholeHome.securityBrand)) {
        return res.status(400).json({ error: 'Invalid security brand preference.' });
      }
    }
  }

  try {
    // Calculate pricing
    let pricing = {};
    if (serviceType === 'Drops Only') {
      const centralizationData = centralization ? {
        type: centralization,
        hasExistingPanel: homeInfo?.hasMediaPanel || false
      } : null;
      pricing = calculateDropsOnlyPricing(runs || {}, services || {}, discount || 0, centralizationData);
    } else {
      // Whole-Home: deposit-based
      pricing = {
        depositAmount: serviceConfig['Whole-Home'].depositAmount
      };
    }

    // Check for recent quotes from same email
    const recentQuote = await Quote.findOne({
      'customer.email': sanitizedCustomer.email,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
    });

    if (recentQuote) {
      return res.status(429).json({ error: 'Please wait 10 minutes between quote requests.' });
    }

    // Generate unique quote number and save
    const quoteNumber = await Quote.generateQuoteNumber();

    const quoteData = {
      quoteNumber,
      customer: sanitizedCustomer,
      serviceType,
      discount: discount || 0,
      runs: runs || { coax: 0, cat6: 0, fiber: 0 },
      centralization: centralization || undefined,
      services: {
        mediaPanel: 0,
        apMount: services?.apMount || 0,
        ethRelocation: services?.ethRelocation || 0
      },
      homeInfo: {
        homeAge: homeInfo?.homeAge,
        stories: homeInfo?.stories,
        atticAccess: homeInfo?.atticAccess,
        hasMediaPanel: homeInfo?.hasMediaPanel || false,
        mediaPanelLocation: homeInfo?.mediaPanelLocation ? sanitizeString(homeInfo.mediaPanelLocation) : undefined,
        hasCrawlspaceOrBasement: homeInfo?.hasCrawlspaceOrBasement || false,
        liabilityAcknowledged: true
      },
      pricing,
      ip: clientIP,
      userAgent: req.get('User-Agent')?.substring(0, 200) || 'Unknown'
    };

    // Add Whole-Home fields if applicable
    if (serviceType === 'Whole-Home' && wholeHome) {
      quoteData.wholeHome = {
        scope: {
          networking: wholeHome.scope?.networking || false,
          security: wholeHome.scope?.security || false,
          voip: wholeHome.scope?.voip || false
        },
        internetSpeed: wholeHome.internetSpeed ? sanitizeString(wholeHome.internetSpeed) : undefined,
        hasOwnEquipment: wholeHome.hasOwnEquipment || false,
        equipmentDescription: wholeHome.hasOwnEquipment && wholeHome.equipmentDescription
          ? sanitizeString(wholeHome.equipmentDescription) : undefined,
        networkingBrand: !wholeHome.hasOwnEquipment ? wholeHome.networkingBrand : undefined,
        securityBrand: !wholeHome.hasOwnEquipment ? wholeHome.securityBrand : undefined,
        surveyPreference: wholeHome.surveyPreference || undefined,
        notes: wholeHome.notes ? sanitizeString(wholeHome.notes) : undefined
      };
    }

    const newQuote = new Quote(quoteData);
    await newQuote.save();

    // Notify admin by email
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
          `Service Type: ${serviceType}`,
          `Name: ${sanitizedCustomer.name}`,
          `Email: ${sanitizedCustomer.email}`,
          sanitizedCustomer.phone ? `Phone: ${sanitizedCustomer.phone}` : ''
        ];

        if (serviceType === 'Drops Only') {
          mailLines.push(
            `Coax runs: ${runs?.coax || 0}`,
            `Cat6 runs: ${runs?.cat6 || 0}`,
            `Fiber runs: ${runs?.fiber || 0}`,
            `Centralization: ${centralization || 'N/A'}`,
            `AP mounts: ${services?.apMount || 0}`,
            `Ethernet relocations: ${services?.ethRelocation || 0}`,
            `Total Cost: $${pricing.totalCost}`,
            `Deposit Required: $${pricing.depositRequired}`
          );
        } else {
          const scopeParts = [];
          if (wholeHome?.scope?.networking) scopeParts.push('Networking');
          if (wholeHome?.scope?.security) scopeParts.push('Security');
          if (wholeHome?.scope?.voip) scopeParts.push('VoIP');
          mailLines.push(
            `Scope: ${scopeParts.join(', ')}`,
            wholeHome?.internetSpeed ? `Internet Speed: ${wholeHome.internetSpeed}` : '',
            `Own Equipment: ${wholeHome?.hasOwnEquipment ? 'Yes' : 'No'}`,
            wholeHome?.hasOwnEquipment ? `Equipment: ${wholeHome.equipmentDescription || 'Not described'}` : '',
            !wholeHome?.hasOwnEquipment && wholeHome?.networkingBrand ? `Networking Brand: ${wholeHome.networkingBrand}` : '',
            !wholeHome?.hasOwnEquipment && wholeHome?.securityBrand ? `Security Brand: ${wholeHome.securityBrand}` : '',
            wholeHome?.surveyPreference ? `Survey Preference: ${wholeHome.surveyPreference}` : '',
            wholeHome?.notes ? `Notes: ${wholeHome.notes}` : '',
            `Deposit Amount: $${pricing.depositAmount}`
          );
        }

        mailLines.push(
          ``,
          `Home Info:`,
          `  Age: ${homeInfo?.homeAge || 'N/A'}`,
          `  Stories: ${homeInfo?.stories || 'N/A'}`,
          `  Attic Access: ${homeInfo?.atticAccess || 'N/A'}`,
          `  Media Panel: ${homeInfo?.hasMediaPanel ? `Yes (${homeInfo.mediaPanelLocation || 'location not specified'})` : 'No'}`,
          `  Crawl Space/Basement: ${homeInfo?.hasCrawlspaceOrBasement ? 'Yes' : 'No'}`,
          ``,
          `IP Address: ${clientIP}`,
          `Timestamp: ${new Date().toISOString()}`
        );

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to:   process.env.ADMIN_EMAIL,
          subject: `New Quote #${quoteNumber} - ${serviceType}`,
          text: mailLines.filter(line => line !== '').join('\n')
        });
      } catch (emailError) {
        console.error('Email notification failed (quote still saved):', emailError.message);
      }
    } else {
      console.log('Email notification skipped - email not configured');
    }

    // Respond to frontend
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
