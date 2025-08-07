const express    = require('express');
const router     = express.Router();
const Quote      = require('../models/Quote');
const nodemailer = require('nodemailer');

// Helper to grab real client IP (works behind proxies)
const getClientIP = req =>
  req.headers['x-forwarded-for'] ||
  req.socket.remoteAddress ||
  null;

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
                        (services.networkSetup || 0) * 20 + 
                        (services.mediaPanel || 0) * 50;
    
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
                        (services.networkSetup || 0) * 20 + 
                        (services.mediaPanel || 0) * 50;
    
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
router.get('/calculate', (req, res) => {
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
      networkSetup: parseInt(req.query.services?.networkSetup || '0') || 0,
      mediaPanel: parseInt(req.query.services?.mediaPanel || '0') || 0
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

router.post('/create', async (req, res) => {
  const { customer, packageOption, discount, runs, services, includeSurvey, speedTier, equipment } = req.body;
  const clientIP = getClientIP(req);

  // Basic validation
  if (!customer?.name || !customer?.email || !packageOption) {
    return res.status(400).json({ error: 'Missing customer name, email or package.' });
  }

  if (!['Basic', 'Premium'].includes(packageOption)) {
    return res.status(400).json({ error: 'Invalid package option.' });
  }

  // Validate speed tier if provided
  if (speedTier && !['1 Gig', '5 Gig', '10 Gig'].includes(speedTier)) {
    return res.status(400).json({ error: 'Invalid speed tier option.' });
  }

  // Validate equipment array if provided
  if (equipment && !Array.isArray(equipment)) {
    return res.status(400).json({ error: 'Equipment must be an array.' });
  }

  try {
    // Calculate pricing with equipment
    const pricing = calculatePricing(packageOption, runs, services, includeSurvey, equipment || [], discount);

    // 1) Save to Mongo
    const newQuote = new Quote({
      customer,
      packageOption,
      includeSurvey,
      speedTier,
      discount,
      runs,
      services,
      equipment: equipment || [],
      pricing,
      ip: clientIP
    });
    await newQuote.save();

    // 2) Notify admin by email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailLines = [
      `New Quote Submission`,
      `--------------------`,
      `Name: ${customer.name}`,
      `Email: ${customer.email}`,
      `Package: ${packageOption}${includeSurvey ? ' + Survey' : ''}`,
      speedTier ? `Speed Tier: ${speedTier}` : '',
      `Discount: ${discount}%`,
      `Coax runs: ${runs.coax}`,
      `Cat6 runs: ${runs.cat6}`,
      `Device mounts: ${services.deviceMount}`,
      `Network setups: ${services.networkSetup}`,
      `Media panels: ${services.mediaPanel}`,
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
      `IP Address: ${clientIP}`
    ].filter(line => line !== '');

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to:   process.env.ADMIN_EMAIL,
      subject: '📄 New Quote Submitted',
      text:     mailLines.join('\n')
    });

    // 3) Respond to frontend
    res.status(201).json({ id: newQuote._id });
  } catch (err) {
    console.error('Quote create error:', err);
    res.status(500).json({ error: 'Error generating quote' });
  }
});

module.exports = router;