const express = require('express');
const router = express.Router();
const ConsultationRequest = require('../models/ConsultationRequest');
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

// Rate limiting for consultation creation
const consultationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    error: 'Too many consultation requests from this IP, please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  }
});

// Input sanitization helper
const sanitizeString = (str) => {
  if (!str || typeof str !== 'string') return '';
  return validator.escape(validator.trim(str));
};

// Email domain validation (shared pattern with quotes)
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

// Package definitions
const PACKAGES = [
  {
    id: 'foundation',
    name: 'Foundation Network',
    priceRange: '$799-$1,499',
    idealFor: 'Builder-grade homes using ISP router only.',
    includes: [
      'Network assessment',
      'Mesh router setup with optional wired backhaul',
      'Latency optimization (gaming + remote work)',
      'Cable management and clean mounting'
    ]
  },
  {
    id: 'backbone',
    name: 'Smart Home Backbone',
    priceRange: '$1,500-$3,500',
    idealFor: 'Homes adding automation and security devices.',
    includes: [
      'Full network redesign',
      'Managed PoE switch',
      '2-4 PoE access point installs',
      'VLAN segmentation (Main / Guest / IoT / Cameras)',
      'Structured panel or rack cleanup',
      'Smart home hub setup (Home Assistant optional)',
      'Optional remote management configuration'
    ]
  },
  {
    id: 'security',
    name: 'Security',
    priceRange: '$999-$1,999',
    idealFor: 'Homes adding PoE cameras with local recording.',
    includes: [
      '2-4 PoE camera installs',
      'Local NVR setup (no subscriptions)',
      'Detection zone configuration',
      'Night vision optimization',
      'Secure remote access',
      'Camera VLAN isolation'
    ]
  },
  {
    id: 'performance',
    name: 'Performance + Protection',
    priceRange: '$2,500-$6,000',
    idealFor: 'Full coverage: network, cameras, and smart home.',
    includes: [
      'Everything in Smart Home Backbone',
      'Everything in Security package',
      'UPS battery protection',
      'Full labeling and documentation',
      'Network diagram provided'
    ]
  }
];

// Standalone service definitions
const STANDALONE_SERVICES = [
  { id: 'ethernet-drops', name: 'Ethernet Drops', price: '$150-$300 per drop', description: '$150-$200 (attic access), $200-$300 (difficult walls). Discount for 4+ drops.' },
  { id: 'camera-install', name: 'PoE Camera Install', price: '$125-$175 per camera', description: 'Mount + configure. Wiring additional if needed.' },
  { id: 'ap-install', name: 'Access Point Install', price: '$125-$200 per AP', description: 'Includes mounting + configuration.' },
  { id: 'network-cleanup', name: 'Network Cleanup / Rebuild', price: '$250-$500', description: 'Flat diagnostic + cleanup.' }
];

// Validation middleware for consultation creation
const validateConsultation = [
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
  body('customer.phone')
    .optional()
    .trim()
    .matches(/^[\d\s()+-]{7,20}$/)
    .withMessage('Please enter a valid phone number'),
  body('property.squareFootage')
    .isIn(['Under 1,500', '1,500-2,500', '2,500-3,500', '3,500-5,000', 'Over 5,000'])
    .withMessage('Please select a square footage range'),
  body('property.isp')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('ISP name must be under 200 characters'),
  body('property.currentIssues')
    .optional()
    .isArray({ max: 8 })
    .withMessage('Invalid current issues selection'),
  body('property.currentIssues.*')
    .optional()
    .isIn(['Weak WiFi', 'Dead zones', 'Slow speeds', 'Too many devices', 'No wired connections', 'Subscription cameras', 'ISP router only', 'Smart home issues'])
    .withMessage('Invalid issue selection'),
  body('interestedServices')
    .isArray({ min: 1, max: 4 })
    .withMessage('Select at least one service'),
  body('interestedServices.*')
    .isIn(['networking', 'smart-home', 'cameras', 'structured-wiring'])
    .withMessage('Invalid service selection'),
  body('interestedPackage')
    .optional()
    .isIn(['foundation', 'backbone', 'security', 'performance', 'standalone', 'unsure'])
    .withMessage('Invalid package selection'),
  body('honeypot')
    .optional()
    .isEmpty()
    .withMessage('Bot detection triggered')
];

// GET /api/consultations/packages — return package definitions
router.get('/packages', (req, res) => {
  res.json(PACKAGES);
});

// GET /api/consultations/services — return standalone service definitions
router.get('/services', (req, res) => {
  res.json(STANDALONE_SERVICES);
});

// POST /api/consultations/create — intake form submission
router.post('/create', consultationRateLimit, validateConsultation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => err.msg)
    });
  }

  const { customer, property, interestedServices, interestedPackage } = req.body;
  const clientIP = getClientIP(req);

  // Sanitize customer data
  const sanitizedCustomer = {
    name: sanitizeString(customer.name),
    email: customer.email.toLowerCase(),
    phone: customer.phone ? sanitizeString(customer.phone) : undefined
  };

  try {
    // Check for recent submissions from same email (10 min cooldown)
    const recentRequest = await ConsultationRequest.findOne({
      'customer.email': sanitizedCustomer.email,
      createdAt: { $gte: new Date(Date.now() - 10 * 60 * 1000) }
    });

    if (recentRequest) {
      return res.status(429).json({ error: 'Please wait 10 minutes between consultation requests.' });
    }

    const requestNumber = await ConsultationRequest.generateRequestNumber();

    const consultationData = {
      requestNumber,
      customer: sanitizedCustomer,
      property: {
        squareFootage: property.squareFootage,
        isp: property.isp ? sanitizeString(property.isp) : undefined,
        currentIssues: property.currentIssues || []
      },
      interestedServices: interestedServices || [],
      interestedPackage: interestedPackage || 'unsure',
      ip: clientIP,
      userAgent: req.get('User-Agent')?.substring(0, 200) || 'Unknown'
    };

    const newRequest = new ConsultationRequest(consultationData);
    await newRequest.save();

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

        const serviceLabels = {
          'networking': 'Networking',
          'smart-home': 'Smart Home',
          'cameras': 'Cameras',
          'structured-wiring': 'Structured Wiring'
        };

        const packageLabels = {
          'foundation': 'Foundation Network ($799-$1,499)',
          'backbone': 'Smart Home Backbone ($1,500-$3,500)',
          'security': 'Security ($999-$1,999)',
          'performance': 'Performance + Protection ($2,500-$6,000)',
          'standalone': 'Standalone Services',
          'unsure': 'Not Sure'
        };

        const mailLines = [
          `New Consultation Request - #${requestNumber}`,
          `----------------------------------------`,
          `Name: ${sanitizedCustomer.name}`,
          `Email: ${sanitizedCustomer.email}`,
          sanitizedCustomer.phone ? `Phone: ${sanitizedCustomer.phone}` : '',
          ``,
          `Property:`,
          `  Square Footage: ${property.squareFootage}`,
          property.isp ? `  ISP: ${property.isp}` : '',
          property.currentIssues?.length ? `  Current Issues: ${property.currentIssues.join(', ')}` : '',
          ``,
          `Interested Services: ${(interestedServices || []).map(s => serviceLabels[s] || s).join(', ')}`,
          `Package Interest: ${packageLabels[interestedPackage] || 'Not specified'}`,
          ``,
          `IP Address: ${clientIP}`,
          `Timestamp: ${new Date().toISOString()}`
        ];

        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to:   process.env.ADMIN_EMAIL,
          subject: `New Consultation Request #${requestNumber}`,
          text: mailLines.filter(line => line !== '').join('\n')
        });
      } catch (emailError) {
        console.error('Email notification failed (consultation still saved):', emailError.message);
      }
    }

    res.status(201).json({
      id: newRequest._id,
      requestNumber,
      message: "We'll review your submission and send a booking link within 24 hours."
    });
  } catch (err) {
    console.error('Consultation create error:', err);
    res.status(500).json({ error: 'Error submitting consultation request' });
  }
});

module.exports = router;
